from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
CLUB_PASSWORD = os.getenv("CLUB_PASSWORD", "bookclub2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer()


def verify_club_password(password: str) -> bool:
    """Check whether the provided password matches the club password.

    Args:
        password: The password to verify.

    Returns:
        True if the password matches, False otherwise.
    """
    return password == CLUB_PASSWORD


def create_user_token(user_id: int) -> str:
    """Create a signed JWT token for a user (no password required — club password was the gate).

    Args:
        user_id: The ID of the user to create a token for.

    Returns:
        A signed JWT string.
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the current user from a Bearer token.

    Args:
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The authenticated User.

    Raises:
        HTTPException: If the token is invalid or the user no longer exists.
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that enforces the admin role.

    Args:
        current_user: The authenticated user from get_current_user.

    Returns:
        The user if they are an admin.

    Raises:
        HTTPException: If the user does not have the admin role.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
