
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel


# =========================================================
# Security configuration
# =========================================================

SECRET_KEY = os.getenv("JWT_SECRET", "").strip()

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is not set")
if len(SECRET_KEY) < 32 or SECRET_KEY.lower().startswith(("replace_with", "change_me", "changeme", "your_secret")):
    raise RuntimeError(
        "JWT_SECRET must be a unique random value of at least 32 characters. "
        'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
    )

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_MINUTES = 15


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


# =========================================================
# Login schema
# =========================================================

class LoginRequest(BaseModel):
    username: str
    password: str


# =========================================================
# Password helpers
# =========================================================

def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    if not hashed_password:
        return False

    try:
        return pwd_context.verify(
            plain_password,
            hashed_password
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# =========================================================
# JWT Access Token
# =========================================================

def create_access_token(
    username: str,
    role: str = "HR"
) -> str:

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================================
# Refresh Token
# =========================================================

def create_refresh_token(
    username: str,
    role: str = "HR"
) -> str:

    expire = datetime.now(timezone.utc) + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": username,
        "role": role,
        "type": "refresh",
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def verify_refresh_token(token: str) -> dict:

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        if payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")

        username = payload.get("sub")
        role = payload.get("role")

        if not username or not role:
            raise ValueError("Invalid refresh token")

        return {
            "username": username,
            "role": role
        }

    except (JWTError, ValueError):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


# =========================================================
# Password Reset Token
# =========================================================

def create_password_reset_token(email: str) -> tuple[str, str]:
    """Create a short-lived reset token and return (jwt, one-time token id)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_EXPIRE_MINUTES
    )
    token_id = uuid4().hex
    payload = {
        "sub": email,
        "type": "password_reset",
        "jti": token_id,
        "exp": expire,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, token_id


def verify_password_reset_token(token: str) -> dict:
    """Validate a reset JWT and return its email and one-time token id."""
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        if payload.get("type") != "password_reset":
            raise ValueError("Invalid reset token")
        email = payload.get("sub")
        token_id = payload.get("jti")
        if not email or not token_id:
            raise ValueError("Invalid reset token")
        return {"email": email, "token_id": token_id}
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset link",
        )


# =========================================================
# Current User
# =========================================================

def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Only access tokens are allowed for protected APIs.
        if payload.get("type") != "access":
            raise credentials_exception

        username = payload.get("sub")
        role = payload.get("role")

        if not username or not role:
            raise credentials_exception

        return {
            "username": username,
            "role": role
        }

    except JWTError:
        raise credentials_exception


# =========================================================
# HR Authorization
# =========================================================

def require_hr(
    current_user: dict = Depends(get_current_user)
):

    if current_user.get("role") not in {
        "HR",
        "ADMIN"
    }:

        raise HTTPException(
            status_code=403,
            detail="HR access required"
        )

    return current_user
