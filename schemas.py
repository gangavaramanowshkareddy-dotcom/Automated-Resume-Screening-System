from pydantic import BaseModel
from typing import Optional, Any


class JobCreate(BaseModel):
    job_title: str
    job_description: str
    required_skills: Optional[Any] = None
    preferred_skills: Optional[Any] = None
    required_education: Optional[Any] = None
    required_experience: Optional[Any] = None
    other_requirements: Optional[Any] = None
    threshold: float = 70

    # HR-configurable scoring weights
    required_skills_weight: float = 40
    relevant_experience_weight: float = 20
    education_weight: float = 15
    projects_weight: float = 15
    preferred_skills_weight: float = 5
    overall_alignment_weight: float = 5


class JobResponse(JobCreate):
    id: int

    class Config:
        from_attributes = True


class CandidateCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    education: Optional[Any] = None
    skills: Optional[Any] = None
    experience: Optional[Any] = None
    projects: Optional[Any] = None
    strengths: Optional[Any] = None
    gaps: Optional[Any] = None
    jd_alignment_notes: Optional[str] = None


class CandidateResponse(CandidateCreate):
    id: int

    class Config:
        from_attributes = True


class ScreeningResultCreate(BaseModel):
    screening_id: int
    resume_id: int

    candidate_id: Optional[int] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None

    education: Optional[Any] = None
    skills: Optional[Any] = None
    experience: Optional[Any] = None
    projects: Optional[Any] = None
    strengths: Optional[Any] = None
    gaps: Optional[Any] = None

    # Final deterministic score
    match_score: float

    # Criterion-level scores from the LLM
    required_skills_score: float
    relevant_experience_score: float
    education_score: float
    projects_score: float
    preferred_skills_score: float
    overall_alignment_score: float

    matched_skills: Optional[Any] = None
    missing_skills: Optional[Any] = None
    experience_match: Optional[str] = None
    education_match: Optional[Any] = None
    recommendation: Optional[str] = None
    reason: Optional[str] = None

# =========================================================
# Forgot Password
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
