import os
import math
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from sqlalchemy.orm import Session

# Load environment variables first
load_dotenv(override=False)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

if not CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS environment variable is not set")
# =========================================================
# Email configuration
# =========================================================
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "").strip()

MAIL_CONFIG = ConnectionConfig(
    MAIL_USERNAME=SMTP_EMAIL,
    MAIL_PASSWORD=SMTP_APP_PASSWORD,
    MAIL_FROM=SMTP_EMAIL,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)
    
from auth import (
    LoginRequest,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    create_password_reset_token,
    verify_password_reset_token,
    RESET_TOKEN_EXPIRE_MINUTES,
    get_password_hash,
    verify_password,
    require_hr,
)
from database import engine, Base, SessionLocal, get_db

from models import (
    User,
    Job,
    Candidate,
    Resume,
    Screening,
    ScreeningScore,
    ProcessingLog,
    EmailNotification,
    PasswordResetToken,
)

from schemas import (
    JobCreate,
    JobResponse,
    CandidateCreate,
    CandidateResponse,
    ScreeningResultCreate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

# Create database tables
Base.metadata.create_all(bind=engine)

# =========================================================
# Initialize first HR user for a fresh database
# =========================================================

def initialize_hr_user():
    db = SessionLocal()

    try:
        existing_user = db.query(User).first()

        # Do nothing when a user already exists.
        if existing_user:
            return

        initial_email = os.getenv(
            "INITIAL_HR_EMAIL",
            ""
        ).strip().lower()

        initial_password = os.getenv(
            "INITIAL_HR_PASSWORD",
            ""
        )

        if not initial_email or not initial_password:
            raise RuntimeError(
                "Database contains no users. "
                "Set INITIAL_HR_EMAIL and "
                "INITIAL_HR_PASSWORD in the .env file."
            )

        if len(initial_password) < 8:
            raise RuntimeError(
                "INITIAL_HR_PASSWORD must be at least "
                "8 characters long."
            )

        initial_user = User(
            username=initial_email,
            email=initial_email,
            password_hash=get_password_hash(
                initial_password
            ),
            role="HR"
        )

        db.add(initial_user)
        db.commit()

        print(
            "Initial HR user created successfully."
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


initialize_hr_user()

# =========================================================
# FastAPI application
# =========================================================

app = FastAPI(
    title="Automated Resume Screening System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# Authentication
# =========================================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str



@app.post("/api/auth/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.username == data.username)
        .first()
    )

    if not user or not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        username=user.username,
        role=user.role
    )

    refresh_token = create_refresh_token(
        username=user.username,
        role=user.role
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user.role
    }


# =========================================================
# Refresh Token
# =========================================================

@app.post("/api/auth/refresh")
def refresh_access_token(data: RefreshTokenRequest):
    user = verify_refresh_token(data.refresh_token)

    new_access_token = create_access_token(
        username=user["username"],
        role=user["role"]
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "role": user["role"]
    }

# =========================================================
# Change Password
# =========================================================

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    username = current_user.get("username")

    if not username:
        raise HTTPException(
            status_code=401,
            detail="Unable to identify the current user"
        )

    user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found"
        )

    if not verify_password(
        data.current_password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters long"
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password"
        )

    user.password_hash = get_password_hash(
        data.new_password
    )

    db.commit()
    db.refresh(user)

    return {
        "message": "Password changed successfully"
    }
# =========================================================
# Forgot Password
# =========================================================

@app.post("/api/auth/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    # Return the same public response whether or not the email exists.
    generic_response = {
        "message": "If an account exists for that email, a reset link will be sent."
    }
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return generic_response

    now = datetime.now(timezone.utc)
    # Invalidate earlier outstanding reset links and remove expired records.
    db.query(PasswordResetToken).filter(
        (PasswordResetToken.expires_at <= now)
        | (PasswordResetToken.used_at.is_not(None))
    ).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)

    reset_token, token_id = create_password_reset_token(user.email)
    db.add(PasswordResetToken(
        token_id=token_id,
        user_id=user.id,
        expires_at=now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    ))
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    message = MessageSchema(
        subject="Password Reset - Resume Screening System",
        recipients=[user.email],
        body=(
            "Hello,\n\nWe received a request to reset your password.\n\n"
            f"Open this link within 15 minutes: {reset_link}\n\n"
            "If you did not request this, you can ignore this email.\n\n"
            "Regards,\nResume Screening System"
        ),
        subtype=MessageType.plain,
    )
    try:
        await FastMail(MAIL_CONFIG).send_message(message)
    except Exception:
        # Do not disclose account existence or SMTP details to unauthenticated callers.
        # Server logs should capture the SMTP failure in the deployment environment.
        print("Password reset email delivery failed; check SMTP configuration.")
    return generic_response


@app.post("/api/auth/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_payload = verify_password_reset_token(data.token)
    email = token_payload["email"].strip().lower()
    token_id = token_payload["token_id"]

    reset_record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_id == token_id)
        .with_for_update()
        .first()
    )
    if (
        not reset_record
        or reset_record.used_at is not None
        or reset_record.expires_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or already-used password reset link",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or reset_record.user_id != user.id:
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or already-used password reset link",
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters long",
        )

    user.password_hash = get_password_hash(data.new_password)
    reset_record.used_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Password reset successfully"}


def verify_n8n_api_key(
    x_n8n_api_key: str | None = Header(default=None)
):
    expected_key = os.getenv("N8N_API_KEY")

    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail="N8N_API_KEY is not configured"
        )

    if x_n8n_api_key != expected_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid n8n API key"
        )

    return True

# =========================================================
# Local file storage
# =========================================================

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/jpeg": ".jpg",
}

# Maximum allowed resume file size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024
# =========================================================
# Root
# =========================================================

@app.get("/")
def root():
    return {
        "message": "Resume Screening Backend is running"
    }



# =========================================================
# Local OCR
# =========================================================

@app.post("/api/ocr")
async def local_ocr(
    file: UploadFile = File(...),
    n8n_authenticated: bool = Depends(verify_n8n_api_key),
):
    """
    Run OCR locally using EasyOCR.

    The resume image is processed on this machine and is not sent
    to a third-party OCR API.
    """

    if file.content_type != "image/jpeg":
        raise HTTPException(
            status_code=400,
            detail="Only JPEG images are supported by the local OCR endpoint."
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File '{file.filename}' exceeds the maximum allowed "
                f"size of {MAX_FILE_SIZE // (1024 * 1024)} MB."
            )
        )

    try:
        from io import BytesIO
        import numpy as np
        import easyocr
        from PIL import Image

        image_buffer = BytesIO(content)

        with Image.open(image_buffer) as image:
            image.verify()

        image_buffer = BytesIO(content)
        with Image.open(image_buffer) as image:
            rgb_image = image.convert("RGB")
            image_array = np.array(rgb_image)

        reader = easyocr.Reader(["en"], gpu=False)

        detected_text = reader.readtext(
            image_array,
            detail=0,
            paragraph=True
        )

        text = "\n".join(
            str(line).strip()
            for line in detected_text
            if str(line).strip()
        )

        if not text:
            return {
                "filename": file.filename,
                "text": "",
                "message": "OCR completed but no readable text was detected."
            }

        return {
            "filename": file.filename,
            "text": text,
            "message": "Local OCR completed successfully."
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Local OCR failed: {error}"
        )


# =========================================================
# Create Job
# =========================================================

@app.post("/api/jobs", response_model=JobResponse)
def create_job(
    job: JobCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    # Validate scoring weights
    total_weight = (
        job.required_skills_weight
        + job.relevant_experience_weight
        + job.education_weight
        + job.projects_weight
        + job.preferred_skills_weight
        + job.overall_alignment_weight
    )

    if abs(total_weight - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Scoring weights must total 100%. Current total: {total_weight}%"
        )

    # Create job
    new_job = Job(
        job_title=job.job_title,
        job_description=job.job_description,
        required_skills=job.required_skills,
        preferred_skills=job.preferred_skills,
        required_education=job.required_education,
        required_experience=job.required_experience,
        other_requirements=job.other_requirements,

        # Threshold
        threshold=job.threshold,

        # HR-configurable scoring weights
        required_skills_weight=job.required_skills_weight,
        relevant_experience_weight=job.relevant_experience_weight,
        education_weight=job.education_weight,
        projects_weight=job.projects_weight,
        preferred_skills_weight=job.preferred_skills_weight,
        overall_alignment_weight=job.overall_alignment_weight,
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return new_job

@app.put("/api/jobs/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    if "job_title" in job_data:
        job.job_title = job_data["job_title"]

    if "job_description" in job_data:
        job.job_description = job_data["job_description"]

    if "required_skills" in job_data:
        job.required_skills = job_data["required_skills"]

    if "required_experience" in job_data:
        job.required_experience = job_data["required_experience"]

    db.commit()
    db.refresh(job)

    return job


@app.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    db.delete(job)
    db.commit()

    return {
        "message": "Job deleted successfully"
    }
@app.get("/api/jobs", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    jobs = (
        db.query(Job)
        .order_by(Job.id.desc())
        .all()
    )

    return jobs
# =========================================================
# Dashboard Overview
# =========================================================

@app.get("/api/dashboard/overview")
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    # -----------------------------------------------------
    # Application-wide totals
    # -----------------------------------------------------

    total_jobs = db.query(Job).count()

    total_candidates = db.query(Candidate).count()

    total_screenings = db.query(Screening).count()

    # -----------------------------------------------------
    # Get latest screening
    # -----------------------------------------------------

    latest_screening = (
        db.query(Screening)
        .order_by(Screening.id.desc())
        .first()
    )

    # -----------------------------------------------------
    # No screening yet
    # -----------------------------------------------------

    if not latest_screening:
        return {
            "total_jobs": total_jobs,
            "total_candidates": total_candidates,
            "total_screenings": total_screenings,

            "job_title": "",

            "latest_screening_id": None,
            "latest_screening_status": None,

            "latest_screening_uploaded": 0,
            "latest_screening_screened": 0,
            "latest_screening_pending": 0,

            "average_score": None,
            "shortlisted": 0,
            "rejected": 0,

            "candidates": [],
            "top_candidate": None,
        }

    # -----------------------------------------------------
    # Get latest screening job
    # -----------------------------------------------------

    job = (
        db.query(Job)
        .filter(Job.id == latest_screening.job_id)
        .first()
    )

    # -----------------------------------------------------
    # Total resumes uploaded for latest screening/job
    # -----------------------------------------------------

    total_resumes_uploaded = (
        db.query(Resume)
        .filter(
            Resume.job_id == latest_screening.job_id
        )
        .count()
    )

    # -----------------------------------------------------
    # Get ALL scores for latest screening
    #
    # IMPORTANT:
    # Do NOT limit this query to 5.
    # We need all scores for accurate dashboard statistics.
    # -----------------------------------------------------

    score_rows = (
        db.query(
            Candidate,
            ScreeningScore
        )
        .join(
            ScreeningScore,
            ScreeningScore.candidate_id == Candidate.id
        )
        .filter(
            ScreeningScore.screening_id == latest_screening.id
        )
        .order_by(
            ScreeningScore.id.desc()
        )
        .all()
    )

    # -----------------------------------------------------
    # Build candidate data
    # -----------------------------------------------------

    all_candidates = []

    for candidate, score in score_rows:
        final_score = (
            float(score.final_score)
            if score.final_score is not None
            else None
        )

        all_candidates.append({
            "candidate_id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,
            "education": candidate.education,
            "skills": candidate.skills,
            "experience": candidate.experience,
            "projects": candidate.projects,
            "strengths": candidate.strengths,
            "gaps": candidate.gaps,
            "jd_alignment_notes": candidate.jd_alignment_notes,
            "final_score": final_score,
            "decision": score.decision,
            "screening_id": score.screening_id,
        })

    # -----------------------------------------------------
    # Accurate latest-screening metrics
    # -----------------------------------------------------

    scored_candidates = [
        candidate
        for candidate in all_candidates
        if isinstance(
            candidate.get("final_score"),
            (int, float)
        )
    ]

    latest_screening_screened = len(scored_candidates)

    latest_screening_pending = max(
        total_resumes_uploaded - latest_screening_screened,
        0
    )

    # -----------------------------------------------------
    # Average score across ALL latest-screening results
    # -----------------------------------------------------

    if scored_candidates:
        total_score = sum(
            candidate["final_score"]
            for candidate in scored_candidates
        )

        average_score = round(
            total_score / len(scored_candidates)
        )
    else:
        average_score = None

    # -----------------------------------------------------
    # Shortlisted count across ALL latest-screening results
    # -----------------------------------------------------

    shortlisted = 0

    for candidate in all_candidates:
        decision = str(
            candidate.get("decision") or ""
        ).upper()

        if decision in {
            "SHORTLIST",
            "SHORTLISTED",
        }:
            shortlisted += 1

    # -----------------------------------------------------
    # Rejected count across ALL latest-screening results
    # -----------------------------------------------------

    rejected = 0

    for candidate in all_candidates:
        decision = str(
            candidate.get("decision") or ""
        ).upper()

        if decision in {
            "REJECT",
            "REJECTED",
        }:
            rejected += 1

    # -----------------------------------------------------
    # Highest-scoring candidate from ALL results
    # -----------------------------------------------------

    top_candidate = None

    if scored_candidates:
        top_candidate = max(
            scored_candidates,
            key=lambda candidate: candidate["final_score"]
        )

    # -----------------------------------------------------
    # Recent activity
    #
    # Only the latest 5 are returned for display.
    # They are NOT used for calculating statistics.
    # -----------------------------------------------------

    recent_candidates = all_candidates[:5]

    # -----------------------------------------------------
    # Final response
    # -----------------------------------------------------

    return {
        "total_jobs": total_jobs,
        "total_candidates": total_candidates,
        "total_screenings": total_screenings,

        "job_title": (
            job.job_title
            if job
            else ""
        ),

        "latest_screening_id": latest_screening.id,

        "latest_screening_status": (
            latest_screening.status
            if latest_screening.status
            else None
        ),

        "latest_screening_uploaded": (
            total_resumes_uploaded
        ),

        "latest_screening_screened": (
            latest_screening_screened
        ),

        "latest_screening_pending": (
            latest_screening_pending
        ),

        "average_score": average_score,

        "shortlisted": shortlisted,

        "rejected": rejected,

        "candidates": recent_candidates,

        "top_candidate": top_candidate,
    }
    
# =========================================================
# Create Candidate
# =========================================================

@app.post("/api/candidates", response_model=CandidateResponse)
def create_candidate(
    candidate: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    new_candidate = Candidate(
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        location=candidate.location,
        education=candidate.education,
        skills=candidate.skills,
        experience=candidate.experience,
        projects=candidate.projects,
        strengths=candidate.strengths,
        gaps=candidate.gaps,
        jd_alignment_notes=candidate.jd_alignment_notes,
    )

    db.add(new_candidate)
    db.commit()
    db.refresh(new_candidate)

    return new_candidate


# =========================================================
# Upload Resumes for a Job
# =========================================================


def validate_file_integrity(file_path: Path, content_type: str) -> None:
    """Validate that an uploaded file is structurally readable."""
    try:
        if content_type == "application/pdf":
            with open(file_path, "rb") as pdf_file:
                header = pdf_file.read(5)
                if header != b"%PDF-":
                    raise ValueError("Invalid PDF header")

                pdf_file.seek(0, 2)
                file_size = pdf_file.tell()
                tail_size = min(file_size, 4096)
                pdf_file.seek(file_size - tail_size)
                tail = pdf_file.read(tail_size)

                if b"%%EOF" not in tail:
                    raise ValueError("PDF appears incomplete or corrupted")

        elif content_type == (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ):
            import zipfile

            with zipfile.ZipFile(file_path, "r") as docx_file:
                bad_file = docx_file.testzip()
                if bad_file is not None:
                    raise ValueError("DOCX contains a corrupted ZIP entry")

                required_entries = {
                    "[Content_Types].xml",
                    "word/document.xml",
                }
                missing_entries = required_entries - set(docx_file.namelist())
                if missing_entries:
                    raise ValueError(
                        "DOCX is missing required document entries"
                    )

        elif content_type == "image/jpeg":
            from PIL import Image

            with Image.open(file_path) as image:
                image.verify()

        else:
            raise ValueError("Unsupported file type")

    except ValueError:
        raise
    except Exception as error:
        raise ValueError("File is corrupted or unreadable") from error


@app.post("/api/jobs/{job_id}/resumes")
async def upload_resumes(
    job_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    uploaded_files = []

    for file in files:

        # -------------------------------------------------
        # Validate file type
        # -------------------------------------------------
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported file type for '{file.filename}'. "
                    "Allowed formats: PDF, DOCX, JPEG."
                )
            )

        extension = ALLOWED_TYPES[file.content_type]
        unique_name = f"{uuid4().hex}{extension}"
        storage_path = UPLOAD_DIR / unique_name
        file_size = 0

        try:
            # ---------------------------------------------
            # Save file while enforcing 10 MB maximum
            # ---------------------------------------------
            with open(storage_path, "wb") as output_file:
                while True:
                    chunk = await file.read(1024 * 1024)

                    if not chunk:
                        break

                    file_size += len(chunk)

                    if file_size > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"File '{file.filename}' exceeds the maximum "
                                f"allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB."
                            )
                        )

                    output_file.write(chunk)

            # ---------------------------------------------
            # Validate structural integrity after saving
            # ---------------------------------------------
            try:
                validate_file_integrity(storage_path, file.content_type)
            except ValueError as integrity_error:
                if storage_path.exists():
                    storage_path.unlink()

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"File '{file.filename}' failed integrity validation: "
                        f"{integrity_error}"
                    )
                )

            # ---------------------------------------------
            # Save resume metadata
            # ---------------------------------------------
            new_resume = Resume(
                job_id=job_id,
                candidate_id=None,
                file_name=file.filename,
                file_type=file.content_type,
                file_size=file_size,
                storage_reference=str(storage_path),
            )

            db.add(new_resume)
            db.commit()
            db.refresh(new_resume)

            uploaded_files.append({
                "resume_id": new_resume.id,
                "job_id": job_id,
                "file_name": file.filename,
                "file_type": file.content_type,
                "file_size": file_size,
                "storage_reference": str(storage_path),
            })

        except HTTPException:
            if storage_path.exists():
                storage_path.unlink()
            raise

        except Exception as error:
            db.rollback()
            if storage_path.exists():
                storage_path.unlink()

            raise HTTPException(
                status_code=500,
                detail=f"Failed to process '{file.filename}': {error}"
            )

    return {
        "message": "Resume upload successful",
        "job_id": job_id,
        "files_uploaded": len(uploaded_files),
        "resumes": uploaded_files,
    }


# =========================================================
# Trigger Screening
# =========================================================

@app.post("/api/jobs/{job_id}/screen")
async def screen_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    # -----------------------------------------------------
    # Find job
    # -----------------------------------------------------
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # -----------------------------------------------------
    # Find resumes
    # -----------------------------------------------------
    resumes = (
        db.query(Resume)
        .filter(Resume.job_id == job_id)
        .all()
    )

    if not resumes:
        raise HTTPException(
            status_code=400,
            detail="No resumes found for this job"
        )

    # -----------------------------------------------------
    # Get n8n webhook URL
    # -----------------------------------------------------
    n8n_webhook_url = os.getenv("N8N_WEBHOOK_URL")

    if not n8n_webhook_url:
        raise HTTPException(
            status_code=500,
            detail="N8N_WEBHOOK_URL is not configured"
        )

    # -----------------------------------------------------
    # Validate HR weights
    # -----------------------------------------------------
    weights = {
        "required_skills": float(job.required_skills_weight or 0),
        "relevant_experience": float(job.relevant_experience_weight or 0),
        "education": float(job.education_weight or 0),
        "projects": float(job.projects_weight or 0),
        "preferred_skills": float(job.preferred_skills_weight or 0),
        "overall_alignment": float(job.overall_alignment_weight or 0),
    }

    total_weight = sum(weights.values())

    if abs(total_weight - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Scoring weights for Job {job_id} must total 100%. "
                f"Current total: {total_weight}%"
            )
        )

    # -----------------------------------------------------
    # Block duplicate screening while one is already active
    # -----------------------------------------------------
    existing_screening = (
        db.query(Screening)
        .filter(
            Screening.job_id == job_id,
            Screening.status.in_(["running", "triggered", "partial"]),
        )
        .order_by(Screening.id.desc())
        .first()
    )

    if existing_screening:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Screening is already in progress for Job {job_id}. "
                f"Screening ID: {existing_screening.id}"
            )
        )

    # -----------------------------------------------------
    # Create screening record
    # -----------------------------------------------------
    screening = Screening(
        job_id=job_id,
        status="running",
        started_at=datetime.now()
    )

    db.add(screening)
    db.commit()
    db.refresh(screening)

    # -----------------------------------------------------
    # Log screening start
    # -----------------------------------------------------
    db.add(
        ProcessingLog(
            screening_id=screening.id,
            candidate_id=None,
            step_name="screening_start",
            status="started",
            input_reference=f"job_id={job_id}",
            error_detail=None
        )
    )
    db.commit()

    triggered = []
    failed = []

     # Process each resume independently
    # -----------------------------------------------------
    async with httpx.AsyncClient(timeout=120.0) as client:

        for resume in resumes:
            # Stop sending new resumes if this screening was cancelled
            db.refresh(screening)

            if screening.status == "cancelled":
                break

            file_path = Path(resume.storage_reference)

            # -------------------------------------------------
            # Verify stored file exists
            # -------------------------------------------------
            if not file_path.exists():
                error_message = "Resume file not found"

                failed.append({
                    "resume_id": resume.id,
                    "file_name": resume.file_name,
                    "error": error_message
                })

                db.add(
                    ProcessingLog(
                        screening_id=screening.id,
                        candidate_id=resume.candidate_id,
                        step_name="resume_file_check",
                        status="failed",
                        input_reference=str(file_path),
                        error_detail=error_message
                    )
                )
                db.commit()

                continue

            # -------------------------------------------------
            # Build n8n request
            # -------------------------------------------------
            form_data = {
                "job_id": str(job.id),
                "job_title": job.job_title,
                "job_description": job.job_description,
                "threshold": str(job.threshold),

                "required_skills_weight": str(weights["required_skills"]),
                "relevant_experience_weight": str(weights["relevant_experience"]),
                "education_weight": str(weights["education"]),
                "projects_weight": str(weights["projects"]),
                "preferred_skills_weight": str(weights["preferred_skills"]),
                "overall_alignment_weight": str(weights["overall_alignment"]),

                "resume_id": str(resume.id),
                "screening_id": str(screening.id),
            }

            success = False
            last_error = None

            # -------------------------------------------------
            # Retry n8n request up to 3 times
            # -------------------------------------------------
            for attempt in range(1, 4):
                try:
                    with open(file_path, "rb") as resume_file:
                        files = {
                            "data": (
                                resume.file_name,
                                resume_file,
                                resume.file_type
                            )
                        }

                        response = await client.post(
                            n8n_webhook_url,
                            data=form_data,
                            files=files
                        )

                    response.raise_for_status()
                    success = True

                    db.add(
                        ProcessingLog(
                            screening_id=screening.id,
                            candidate_id=resume.candidate_id,
                            step_name="n8n_trigger",
                            status="success",
                            input_reference=(
                                f"resume_id={resume.id}; "
                                f"file={resume.file_name}; "
                                f"attempt={attempt}"
                            ),
                            error_detail=None
                        )
                    )
                    db.commit()

                    triggered.append({
                        "resume_id": resume.id,
                        "file_name": resume.file_name,
                        "status": "triggered",
                        "attempt": attempt
                    })

                    break

                except (httpx.HTTPError, OSError) as error:
                    last_error = str(error)

                    if attempt < 3:
                        await asyncio.sleep(2 ** (attempt - 1))

            # -------------------------------------------------
            # Resume failed after all retries
            # Continue with next resume
            # -------------------------------------------------
            if not success:
                error_message = f"Failed after 3 attempts: {last_error}"

                failed.append({
                    "resume_id": resume.id,
                    "file_name": resume.file_name,
                    "error": error_message
                })

                db.add(
                    ProcessingLog(
                        screening_id=screening.id,
                        candidate_id=resume.candidate_id,
                        step_name="n8n_trigger",
                        status="failed",
                        input_reference=(
                            f"resume_id={resume.id}; "
                            f"file={resume.file_name}"
                        ),
                        error_detail=error_message
                    )
                )
                db.commit()

    # -----------------------------------------------------
    # Final trigger status
    # -----------------------------------------------------
    if screening.status != "cancelled":
        if triggered and failed:
            screening.status = "partial"
        elif triggered:
            screening.status = "triggered"
        else:
            screening.status = "failed"

    screening.completed_at = datetime.now()

    # -----------------------------------------------------
    # Final screening log
    # -----------------------------------------------------
    db.add(
        ProcessingLog(
            screening_id=screening.id,
            candidate_id=None,
            step_name="screening_trigger_complete",
            status="success" if triggered else "failed",
            input_reference=(
                f"total_resumes={len(resumes)}; "
                f"triggered={len(triggered)}; "
                f"failed={len(failed)}"
            ),
            error_detail=None if not failed else (
                f"{len(failed)} resume(s) failed"
            )
        )
    )

    db.commit()
    db.refresh(screening)

    return {
        "message": "n8n screening workflow triggered",
        "screening_id": screening.id,
        "job_id": job_id,
        "total_resumes": len(resumes),
        "resumes_triggered": len(triggered),
        "resumes_failed": len(failed),
        "resumes": triggered,
        "failed_resumes": failed
    }
    
# =========================================================
# Save or Update Screening Result
# =========================================================


@app.post("/api/screening-results")
def save_screening_result(
    result: ScreeningResultCreate,
    db: Session = Depends(get_db),
    n8n_authenticated: bool = Depends(verify_n8n_api_key)
):


    # -----------------------------------------------------
    # Lock screening row and check cancellation state
    # -----------------------------------------------------

    screening = (
        db.query(Screening)
        .filter(Screening.id == result.screening_id)
        .with_for_update()
        .first()
    )

    if not screening:
        raise HTTPException(
            status_code=404,
            detail="Screening not found"
        )

    if screening.status == "cancelled":
        raise HTTPException(
            status_code=409,
            detail="Screening has been cancelled. Result will not be saved."
        )

    # -----------------------------------------------------
    # Check resume
    # -----------------------------------------------------

    resume = (
        db.query(Resume)
        .filter(Resume.id == result.resume_id)
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    # Verify that the resume belongs to this screening's job.
    if resume.job_id != screening.job_id:
        raise HTTPException(
            status_code=409,
            detail="Resume does not belong to this screening's job."
        )
    
    # Validate scores before modifying candidate data.
    score_values = {
        "match_score": result.match_score,
        "required_skills_score": result.required_skills_score,
        "relevant_experience_score": result.relevant_experience_score,
        "education_score": result.education_score,
        "projects_score": result.projects_score,
        "preferred_skills_score": result.preferred_skills_score,
        "overall_alignment_score": result.overall_alignment_score,
    }

    
    
    for score_name, score_value in score_values.items():
        if (
            not math.isfinite(score_value)
            or not 0 <= score_value <= 100
        ):
            raise HTTPException(
                status_code=422,
                detail=f"{score_name} must be between 0 and 100."
            )



    # Validate the decision against the job threshold.
    job = (
        db.query(Job)
        .filter(Job.id == screening.job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found for this screening."
        )

    recommendation = str(result.recommendation or "").strip().upper()

    if recommendation not in {
        "SHORTLIST", "SHORTLISTED", "REJECT", "REJECTED"
    }:
        raise HTTPException(
            status_code=422,
            detail="Invalid screening recommendation."
        )

    should_shortlist = result.match_score >= job.threshold
    is_shortlisted = recommendation in {"SHORTLIST", "SHORTLISTED"}

    if should_shortlist != is_shortlisted:
        raise HTTPException(
            status_code=422,
            detail="Screening recommendation does not match the configured threshold."
        )


    # -----------------------------------------------------
    # Find candidate
    # -----------------------------------------------------

    candidate = None

    if result.candidate_id:
        candidate = (
            db.query(Candidate)
            .filter(Candidate.id == result.candidate_id)
            .first()
        )

    if not candidate and result.candidate_email:
        candidate = (
            db.query(Candidate)
            .filter(Candidate.email == result.candidate_email)
            .first()
        )

    # -----------------------------------------------------
    # Create candidate when necessary
    # -----------------------------------------------------

    if not candidate:
        candidate = Candidate(
            name=result.candidate_name,
            email=result.candidate_email,
            phone=result.candidate_phone,
            education=result.education,
            skills=result.skills,
            experience=result.experience,
            projects=result.projects,
            strengths=(
                result.strengths
                if result.strengths is not None
                else result.matched_skills
            ),
            gaps=(
                result.gaps
                if result.gaps is not None
                else result.missing_skills
            ),
            jd_alignment_notes=result.reason,
        )

        db.add(candidate)

        # Get the generated candidate ID without committing yet.
        db.flush()

    else:
        if result.candidate_name:
            candidate.name = result.candidate_name

        if result.candidate_email:
            candidate.email = result.candidate_email

        if result.candidate_phone:
            candidate.phone = result.candidate_phone

        if result.education is not None:
            candidate.education = result.education

        if result.skills is not None:
            candidate.skills = result.skills

        if result.experience is not None:
            candidate.experience = result.experience

        if result.projects is not None:
            candidate.projects = result.projects

        if result.strengths is not None:
            candidate.strengths = result.strengths
        elif result.matched_skills is not None:
            candidate.strengths = result.matched_skills

        if result.gaps is not None:
            candidate.gaps = result.gaps
        elif result.missing_skills is not None:
            candidate.gaps = result.missing_skills

        if result.reason:
            candidate.jd_alignment_notes = result.reason

    # -----------------------------------------------------
    # Link resume to candidate
    # -----------------------------------------------------

    resume.candidate_id = candidate.id

    # -----------------------------------------------------
    # Find existing screening score
    # -----------------------------------------------------

    existing_score = (
        db.query(ScreeningScore)
        .filter(
            ScreeningScore.screening_id == result.screening_id,
            ScreeningScore.resume_id == result.resume_id
        )
        .first()
    )

    # -----------------------------------------------------
    # Update existing score
    # -----------------------------------------------------

    if existing_score:
        existing_score.required_skills_score = (
            result.required_skills_score
        )

        existing_score.relevant_experience_score = (
            result.relevant_experience_score
        )

        existing_score.education_score = (
            result.education_score
        )

        existing_score.projects_score = (
            result.projects_score
        )

        existing_score.preferred_skills_score = (
            result.preferred_skills_score
        )

        existing_score.overall_alignment_score = (
            result.overall_alignment_score
        )

        existing_score.final_score = result.match_score
        existing_score.decision = result.recommendation
        existing_score.candidate_id = candidate.id
        existing_score.resume_id = result.resume_id

        score = existing_score
        action = "updated"
    # -----------------------------------------------------
    # Create new score
    # -----------------------------------------------------

    
    else:
        score = ScreeningScore(
            screening_id=result.screening_id,
            resume_id=result.resume_id,
            candidate_id=candidate.id,
            required_skills_score=result.required_skills_score,
            relevant_experience_score=result.relevant_experience_score,
            education_score=result.education_score,
            projects_score=result.projects_score,
            preferred_skills_score=result.preferred_skills_score,
            overall_alignment_score=result.overall_alignment_score,
            final_score=result.match_score,
            decision=result.recommendation,
        )

        db.add(score)
        action = "created"

        
    # -----------------------------------------------------
    # Mark screening completed
    # -----------------------------------------------------

    total_resumes = (
        db.query(Resume)
        .filter(Resume.job_id == screening.job_id)
        .count()
    )

    completed_results = (
        db.query(ScreeningScore)
        .filter(ScreeningScore.screening_id == screening.id)
        .count()
    )

    if total_resumes > 0 and completed_results >= total_resumes:
        screening.status = "completed"
        screening.completed_at = datetime.now()

    # -----------------------------------------------------
    # Log result storage
    # -----------------------------------------------------

    result_log = ProcessingLog(
        screening_id=result.screening_id,
        candidate_id=candidate.id,
        step_name="screening_result_save",
        status="success",
        input_reference=(
            f"resume_id={result.resume_id}; "
            f"score={result.match_score}; "
            f"decision={result.recommendation}"
        ),
        error_detail=None
    )

    db.add(result_log)

    # Commit only after the entire result operation is ready.
    db.commit()

    db.refresh(score)

    return {
        "message": "Screening result saved successfully",
        "action": action,
        "screening_id": result.screening_id,
        "resume_id": result.resume_id,
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "match_score": float(score.final_score),
        "decision": score.decision,
    }

   


# =========================================================
# Get Candidates for a Job
# =========================================================

@app.get("/api/jobs/{job_id}/candidates")
def get_candidates_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # -----------------------------------------------------
    # Get all screening IDs for this job
    # -----------------------------------------------------
    screening_ids = [
        screening.id
        for screening in (
            db.query(Screening)
            .filter(Screening.job_id == job_id)
            .all()
        )
    ]

    # No screening results yet
    if not screening_ids:
        return {
            "job_id": job_id,
            "job_title": job.job_title,
            "candidates": []
        }

    # -----------------------------------------------------
    # Get scored candidates for this job only
    # Newest score first
    # -----------------------------------------------------
    rows = (
        db.query(
            Candidate,
            ScreeningScore
        )
        .join(
            ScreeningScore,
            ScreeningScore.candidate_id == Candidate.id
        )
        .filter(
            ScreeningScore.screening_id.in_(screening_ids)
        )
        .order_by(
            ScreeningScore.id.desc()
        )
        .all()
    )

    # -----------------------------------------------------
    # Keep only the latest score per candidate for this job
    # -----------------------------------------------------
    candidates = []
    seen_candidate_ids = set()

    for candidate, score in rows:

        if candidate.id in seen_candidate_ids:
            continue

        seen_candidate_ids.add(candidate.id)

        candidates.append({
            "candidate_id": candidate.id,

            "name": candidate.name,

            "email": candidate.email,

            "phone": candidate.phone,

            "location": candidate.location,

            "education": candidate.education,

            "skills": candidate.skills,

            "experience": candidate.experience,

            "projects": candidate.projects,

            "strengths": candidate.strengths,

            "gaps": candidate.gaps,

            "jd_alignment_notes": (
                candidate.jd_alignment_notes
            ),

            "final_score": (
                float(score.final_score)
                if score.final_score is not None
                else None
            ),

            "decision": score.decision,

            "required_skills_score": (
                float(score.required_skills_score)
                if score.required_skills_score is not None
                else None
            ),

            "relevant_experience_score": (
                float(score.relevant_experience_score)
                if score.relevant_experience_score is not None
                else None
            ),

            "education_score": (
                float(score.education_score)
                if score.education_score is not None
                else None
            ),

            "projects_score": (
                float(score.projects_score)
                if score.projects_score is not None
                else None
            ),

            "preferred_skills_score": (
                float(score.preferred_skills_score)
                if score.preferred_skills_score is not None
                else None
            ),

            "overall_alignment_score": (
                float(score.overall_alignment_score)
                if score.overall_alignment_score is not None
                else None
            ),

            "screening_id": score.screening_id
        })

    return {
        "job_id": job_id,
        "job_title": job.job_title,
        "candidates": candidates
    }


# =========================================================
# Get Single Candidate Details
# =========================================================

@app.get("/api/candidates/{candidate_id}")
def get_candidate_details(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):

    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id)
        .first()
    )

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    # Get all screening results for this candidate
    scores = (
        db.query(
            ScreeningScore,
            Screening
        )
        .join(
            Screening,
            Screening.id == ScreeningScore.screening_id
        )
        .filter(
            ScreeningScore.candidate_id == candidate_id
        )
        .order_by(
            ScreeningScore.id.desc()
        )
        .all()
    )

    screening_results = []

    for score, screening in scores:

        screening_results.append({

            "screening_id": screening.id,

            "job_id": screening.job_id,

            "required_skills_score": (
                float(score.required_skills_score)
                if score.required_skills_score is not None
                else None
            ),

            "relevant_experience_score": (
                float(score.relevant_experience_score)
                if score.relevant_experience_score is not None
                else None
            ),

            "education_score": (
                float(score.education_score)
                if score.education_score is not None
                else None
            ),

            "projects_score": (
                float(score.projects_score)
                if score.projects_score is not None
                else None
            ),

            "preferred_skills_score": (
                float(score.preferred_skills_score)
                if score.preferred_skills_score is not None
                else None
            ),

            "overall_alignment_score": (
                float(score.overall_alignment_score)
                if score.overall_alignment_score is not None
                else None
            ),

            "final_score": (
                float(score.final_score)
                if score.final_score is not None
                else None
            ),

            "decision": score.decision,
        })

    return {

        "candidate_id": candidate.id,

        "name": candidate.name,

        "email": candidate.email,

        "phone": candidate.phone,

        "location": candidate.location,

        "education": candidate.education,

        "skills": candidate.skills,

        "experience": candidate.experience,

        "projects": candidate.projects,

        "strengths": candidate.strengths,

        "gaps": candidate.gaps,

        "jd_alignment_notes": candidate.jd_alignment_notes,

        "screening_results": screening_results
    }
# =========================================================
# Cancel Screening
# =========================================================

@app.post("/api/screenings/{screening_id}/cancel")
def cancel_screening(
    screening_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):

    # Lock the screening row so cancellation cannot race
    # with an incoming n8n screening result.
    screening = (
        db.query(Screening)
        .filter(Screening.id == screening_id)
        .with_for_update()
        .first()
    )

    if not screening:
        raise HTTPException(
            status_code=404,
            detail="Screening not found"
        )

    if screening.status == "cancelled":
        return {
            "message": "Screening is already cancelled",
            "screening_id": screening.id,
            "status": screening.status
        }

    if screening.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="Completed screening cannot be cancelled"
        )

    screening.status = "cancelled"
    screening.completed_at = datetime.now()

    db.commit()
    db.refresh(screening)

    return {
        "message": "Screening cancelled successfully",
        "screening_id": screening.id,
        "status": screening.status
    }

# =========================================================
# Get Screening Status
# =========================================================

@app.get("/api/jobs/{job_id}/status")
def get_screening_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    screening = (
        db.query(Screening)
        .filter(Screening.job_id == job_id)
        .order_by(Screening.id.desc())
        .first()
    )

    if not screening:

        return {
            "job_id": job_id,

            "job_title": job.job_title,

            "screening_id": None,

            "status": "not_started",

            "started_at": None,

            "completed_at": None
        }

    return {
        "job_id": job_id,

        "job_title": job.job_title,

        "screening_id": screening.id,

        "status": screening.status,

        "started_at": screening.started_at,

        "completed_at": screening.completed_at
    }


# =========================================================
# Get Screening Results
# =========================================================

@app.get("/api/jobs/{job_id}/results")
def get_screening_results(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    # -----------------------------------------------------
    # Check job
    # -----------------------------------------------------
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # -----------------------------------------------------
    # Get all screening IDs for this job
    # -----------------------------------------------------
    screening_ids = [
        screening.id
        for screening in (
            db.query(Screening)
            .filter(Screening.job_id == job_id)
            .all()
        )
    ]

    if not screening_ids:
        return {
            "job_id": job_id,
            "job_title": job.job_title,
            "total_results": 0,
            "results": []
        }

    # -----------------------------------------------------
    # Get scores for this job only
    # Newest score first
    # -----------------------------------------------------
    rows = (
        db.query(
            ScreeningScore,
            Candidate
        )
        .join(
            Candidate,
            Candidate.id == ScreeningScore.candidate_id
        )
        .filter(
            ScreeningScore.screening_id.in_(screening_ids)
        )
        .order_by(
            ScreeningScore.id.desc()
        )
        .all()
    )

    # -----------------------------------------------------
    # Keep latest result per candidate
    # -----------------------------------------------------
    results = []
    seen_candidate_ids = set()

    for score, candidate in rows:

        if candidate.id in seen_candidate_ids:
            continue

        seen_candidate_ids.add(candidate.id)

        results.append({
            "candidate_id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,

            "required_skills_score": (
                float(score.required_skills_score)
                if score.required_skills_score is not None
                else None
            ),

            "relevant_experience_score": (
                float(score.relevant_experience_score)
                if score.relevant_experience_score is not None
                else None
            ),

            "education_score": (
                float(score.education_score)
                if score.education_score is not None
                else None
            ),

            "projects_score": (
                float(score.projects_score)
                if score.projects_score is not None
                else None
            ),

            "preferred_skills_score": (
                float(score.preferred_skills_score)
                if score.preferred_skills_score is not None
                else None
            ),

            "overall_alignment_score": (
                float(score.overall_alignment_score)
                if score.overall_alignment_score is not None
                else None
            ),

            "final_score": (
                float(score.final_score)
                if score.final_score is not None
                else None
            ),

            "decision": score.decision,

            "matched_skills": candidate.strengths,

            "missing_skills": candidate.gaps,

            "jd_alignment_notes": candidate.jd_alignment_notes,

            "screening_id": score.screening_id
        })

    return {
        "job_id": job_id,
        "job_title": job.job_title,
        "total_results": len(results),
        "results": results
    }       

            

# =========================================================
# Save Email Notification
# =========================================================

@app.post("/api/email-notifications")
def save_email_notification(
    screening_id: int,
    candidate_id: int | None = None,
    recipient_email: str = "",
    notification_type: str = "REJECTION",
    status: str = "SENT",
    retry_count: int = 0,
    error_detail: str | None = None,
    db: Session = Depends(get_db),
    n8n_authenticated: bool = Depends(verify_n8n_api_key),
):
    # Verify screening exists
    screening = (
        db.query(Screening)
        .filter(Screening.id == screening_id)
        .first()
    )

    if not screening:
        raise HTTPException(
            status_code=404,
            detail="Screening not found"
        )

    # Create email notification record
    notification = EmailNotification(
        screening_id=screening_id,
        candidate_id=candidate_id,
        recipient_email=recipient_email,
        notification_type=notification_type,
        status=status,
        retry_count=retry_count,
        error_detail=error_detail,
        sent_at=datetime.now() if status.upper() == "SENT" else None
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {
        "message": "Email notification recorded successfully",
        "notification_id": notification.id,
        "screening_id": screening_id,
        "candidate_id": candidate_id,
        "recipient_email": recipient_email,
        "notification_type": notification_type,
        "status": status,
        "retry_count": retry_count,
        "error_detail": error_detail,
        "sent_at": notification.sent_at
    }
# -------------------------
# Update Job Threshold
# -------------------------


class ThresholdUpdate(BaseModel):
    threshold: float


@app.patch("/api/jobs/{job_id}/threshold")
def update_job_threshold(
    job_id: int,
    data: ThresholdUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    if data.threshold < 0 or data.threshold > 100:
        raise HTTPException(
            status_code=400,
            detail="Threshold must be between 0 and 100"
        )

    job.threshold = data.threshold

    db.commit()
    db.refresh(job)

    return {
        "message": "Threshold updated successfully",
        "job_id": job.id,
        "threshold": float(job.threshold)
    }

# =========================================================
# Export Screening Results
# =========================================================

@app.get("/api/jobs/{job_id}/export")
def export_screening_results(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_hr)
):
    # -----------------------------------------------------
    # Check job
    # -----------------------------------------------------
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # -----------------------------------------------------
    # Get all screening IDs for this job
    # -----------------------------------------------------
    screening_ids = [
        screening.id
        for screening in (
            db.query(Screening)
            .filter(Screening.job_id == job_id)
            .all()
        )
    ]

    if not screening_ids:
        return {
            "job_id": job.id,
            "job_title": job.job_title,
            "total_results": 0,
            "results": []
        }

    # -----------------------------------------------------
    # Get all scores for this job
    # Newest first
    # -----------------------------------------------------
    rows = (
        db.query(
            ScreeningScore,
            Candidate
        )
        .join(
            Candidate,
            Candidate.id == ScreeningScore.candidate_id
        )
        .filter(
            ScreeningScore.screening_id.in_(screening_ids)
        )
        .order_by(
            ScreeningScore.id.desc()
        )
        .all()
    )

    # -----------------------------------------------------
    # Keep only latest result per candidate
    # -----------------------------------------------------
    export_results = []
    seen_candidate_ids = set()

    for score, candidate in rows:

        if candidate.id in seen_candidate_ids:
            continue

        seen_candidate_ids.add(candidate.id)

        export_results.append({
            "screening_id": score.screening_id,
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,

            "required_skills_score": (
                float(score.required_skills_score)
                if score.required_skills_score is not None
                else None
            ),

            "relevant_experience_score": (
                float(score.relevant_experience_score)
                if score.relevant_experience_score is not None
                else None
            ),

            "education_score": (
                float(score.education_score)
                if score.education_score is not None
                else None
            ),

            "projects_score": (
                float(score.projects_score)
                if score.projects_score is not None
                else None
            ),

            "preferred_skills_score": (
                float(score.preferred_skills_score)
                if score.preferred_skills_score is not None
                else None
            ),

            "overall_alignment_score": (
                float(score.overall_alignment_score)
                if score.overall_alignment_score is not None
                else None
            ),

            "final_score": (
                float(score.final_score)
                if score.final_score is not None
                else None
            ),

            "decision": score.decision,

            "matched_skills": candidate.strengths,

            "missing_skills": candidate.gaps,

            "jd_alignment_notes": candidate.jd_alignment_notes
        })

    return {
        "job_id": job.id,
        "job_title": job.job_title,
        "total_results": len(export_results),
        "results": export_results
    }
    