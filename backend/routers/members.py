from __future__ import annotations

import json
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, hash_password, require_admin
from database import get_db
from models import MemberPreference, User

HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]
from schemas import PreferencesIn, PreferencesOut, UserCreate, UserOut, UserWithPreferences

router = APIRouter()


def _parse_preferences(prefs: MemberPreference | None) -> PreferencesOut | None:
    """Convert a MemberPreference ORM object to a PreferencesOut schema.

    Args:
        prefs: The SQLAlchemy MemberPreference instance, or None.

    Returns:
        A PreferencesOut instance, or None if prefs is None.
    """
    if prefs is None:
        return None
    return PreferencesOut(
        no_weeknights=prefs.no_weeknights,
        preferred_days=json.loads(prefs.preferred_days) if prefs.preferred_days else [],
        notes=prefs.notes,
        blackout_dates=json.loads(prefs.blackout_dates) if prefs.blackout_dates else [],
    )


def _build_user_with_prefs(user: User) -> UserWithPreferences:
    """Build a UserWithPreferences response from a User ORM object.

    Args:
        user: The SQLAlchemy User instance.

    Returns:
        A UserWithPreferences instance.
    """
    return UserWithPreferences(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        preferences=_parse_preferences(user.preferences),
    )


@router.get("", response_model=list[UserWithPreferences])
def list_members(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserWithPreferences]:
    """Return all members with their preferences (admin only).

    Args:
        db: The database session.
        _: The authenticated admin user.

    Returns:
        A list of UserWithPreferences objects.
    """
    users = db.query(User).order_by(User.created_at).all()
    return [_build_user_with_prefs(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserOut:
    """Create a new member account (admin only).

    Args:
        payload: The new member's details.
        db: The database session.
        _: The authenticated admin user.

    Returns:
        The created UserOut object.

    Raises:
        HTTPException: If the username is already taken.
    """
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        heart_color=random.choice(HEART_EMOJIS),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    """Delete a member account (admin only).

    Args:
        user_id: The ID of the user to delete.
        db: The database session.
        current_user: The authenticated admin user.

    Raises:
        HTTPException: If the user is not found or if trying to delete self.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.get("/me", response_model=UserWithPreferences)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserWithPreferences:
    """Return the current user's profile and preferences.

    Args:
        db: The database session.
        current_user: The authenticated user.

    Returns:
        The current user's UserWithPreferences object.
    """
    return _build_user_with_prefs(current_user)


@router.put("/me/preferences", response_model=UserWithPreferences)
def update_preferences(
    payload: PreferencesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserWithPreferences:
    """Update the current user's scheduling preferences.

    Args:
        payload: The new preference values.
        db: The database session.
        current_user: The authenticated user.

    Returns:
        The updated UserWithPreferences object.
    """
    prefs = current_user.preferences
    if prefs is None:
        prefs = MemberPreference(user_id=current_user.id)
        db.add(prefs)

    prefs.no_weeknights = payload.no_weeknights
    prefs.preferred_days = json.dumps(payload.preferred_days)
    prefs.notes = payload.notes
    prefs.blackout_dates = json.dumps(payload.blackout_dates)

    db.commit()
    db.refresh(current_user)
    return _build_user_with_prefs(current_user)
