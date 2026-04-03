from __future__ import annotations

import json
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, hash_password, require_club_admin
from database import get_db
from models import ClubMembership, MemberPreference, User
from schemas import MemberWithPreferences, PreferencesIn, PreferencesOut, UserCreate

router = APIRouter()

HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]


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


def _build_member_out(m: ClubMembership) -> MemberWithPreferences:
    """Build a MemberWithPreferences response from a ClubMembership.

    Args:
        m: The ClubMembership with user loaded.

    Returns:
        A MemberWithPreferences instance.
    """
    return MemberWithPreferences(
        user_id=m.user_id,
        username=m.user.username,
        display_name=m.display_name,
        heart_color=m.user.heart_color,
        role=m.role,
        email=m.user.email,
        preferences=_parse_preferences(m.user.preferences),
    )


@router.get("", response_model=list[MemberWithPreferences])
def list_members(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> list[MemberWithPreferences]:
    """Return all members of the current club (admin only).

    Args:
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A list of MemberWithPreferences objects.
    """
    club_memberships = (
        db.query(ClubMembership)
        .filter(ClubMembership.club_id == membership.club_id)
        .all()
    )
    return [_build_member_out(m) for m in club_memberships]


@router.post("", response_model=MemberWithPreferences, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: UserCreate,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> MemberWithPreferences:
    """Add a member to the current club, creating the user account if needed (admin only).

    If a user with the given username already exists, they are added to this club.
    If not, a new user account is created and then added.

    Args:
        payload: The new member's details including display_name for this club.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        The created MemberWithPreferences object.

    Raises:
        HTTPException: If the user is already a member of this club.
    """
    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        user = User(
            username=payload.username,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            role=payload.role if payload.role == "admin" else "member",
            heart_color=random.choice(HEART_EMOJIS),
        )
        db.add(user)
        db.flush()

    already_member = db.query(ClubMembership).filter(
        ClubMembership.user_id == user.id,
        ClubMembership.club_id == membership.club_id,
    ).first()
    if already_member:
        raise HTTPException(status_code=400, detail="User is already a member of this club")

    new_membership = ClubMembership(
        user_id=user.id,
        club_id=membership.club_id,
        display_name=payload.display_name,
        role="member",
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)
    return _build_member_out(new_membership)


@router.delete("/{user_id}")
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Remove a member from the current club (admin only).

    This removes the membership only — the user account is kept so they can
    remain in other clubs.

    Args:
        user_id: The ID of the user to remove.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If trying to remove yourself or if membership not found.
    """
    if user_id == membership.user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the club")
    target = db.query(ClubMembership).filter(
        ClubMembership.user_id == user_id,
        ClubMembership.club_id == membership.club_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Membership not found")
    db.delete(target)
    db.commit()
    return {"ok": True}


@router.get("/me/preferences", response_model=PreferencesOut | None)
def get_preferences(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> PreferencesOut | None:
    """Return the current user's scheduling preferences.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The user's PreferencesOut, or None if not set.
    """
    return _parse_preferences(membership.user.preferences)


@router.put("/me/preferences", response_model=PreferencesOut)
def update_preferences(
    payload: PreferencesIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> PreferencesOut:
    """Update the current user's scheduling preferences.

    Args:
        payload: The new preference values.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The updated PreferencesOut object.
    """
    user = membership.user
    prefs = user.preferences
    if prefs is None:
        prefs = MemberPreference(user_id=user.id)
        db.add(prefs)

    prefs.no_weeknights = payload.no_weeknights
    prefs.preferred_days = json.dumps(payload.preferred_days)
    prefs.notes = payload.notes
    prefs.blackout_dates = json.dumps(payload.blackout_dates)

    db.commit()
    db.refresh(user)
    return _parse_preferences(user.preferences)
