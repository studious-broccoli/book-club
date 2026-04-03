from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import ClubMembership, User

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer()


def hash_password(_password: str) -> str:
    """Return a placeholder — individual passwords are unused in the simple auth flow.

    Args:
        _password: Ignored.

    Returns:
        A static placeholder string.
    """
    return "unused"


def create_user_token(user_id: int, club_id: int) -> str:
    """Create a signed JWT token encoding both user and club context.

    Args:
        user_id: The ID of the authenticated user.
        club_id: The ID of the club the session is scoped to.

    Returns:
        A signed JWT string.
    """
    payload = {
        "sub": str(user_id),
        "club_id": club_id,
        "exp": datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> tuple[int, int]:
    """Decode a JWT and return (user_id, club_id).

    Args:
        token: The raw JWT string.

    Returns:
        A tuple of (user_id, club_id).

    Raises:
        HTTPException: If the token is invalid or missing required fields.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        club_id = payload.get("club_id")
        if user_id is None or club_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return int(user_id), int(club_id)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_membership(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> ClubMembership:
    """Resolve the current user's club membership from the Bearer token.

    Args:
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The ClubMembership for the current user and club.

    Raises:
        HTTPException: If the token is invalid or the membership no longer exists.
    """
    user_id, club_id = _decode_token(credentials.credentials)
    membership = (
        db.query(ClubMembership)
        .filter(ClubMembership.user_id == user_id, ClubMembership.club_id == club_id)
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Membership not found")
    return membership


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> int:
    """Extract only the user_id from the token (no club check).

    Used for endpoints that need to work across clubs, like listing all clubs
    a user belongs to.

    Args:
        credentials: The HTTP Authorization header credentials.

    Returns:
        The authenticated user's ID.
    """
    user_id, _ = _decode_token(credentials.credentials)
    return user_id


def require_club_admin(
    membership: ClubMembership = Depends(get_current_membership),
) -> ClubMembership:
    """Dependency that enforces club-admin role.

    Args:
        membership: The current user's club membership.

    Returns:
        The membership if the user is a club admin.

    Raises:
        HTTPException: If the user is not an admin of the current club.
    """
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Club admin access required")
    return membership


def require_global_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that enforces the global admin role (for creating clubs).

    Args:
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The User if they have the global admin role.

    Raises:
        HTTPException: If the user is not a global admin.
    """
    user_id, _ = _decode_token(credentials.credentials)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Global admin access required")
    return user
