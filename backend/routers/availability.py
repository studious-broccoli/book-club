from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_membership
from database import get_db
from models import ClubMembership, UserAvailability
from schemas import AvailabilityRecord, AvailabilitySetRequest

router = APIRouter()


@router.get("/me", response_model=list[AvailabilityRecord])
def get_my_availability(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> list[AvailabilityRecord]:
    """Return all availability records for the current user.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A list of AvailabilityRecord objects (date + time_slot + status) for the user.
    """
    rows = db.query(UserAvailability).filter(UserAvailability.user_id == membership.user_id).all()
    return [AvailabilityRecord(date=r.date, time_slot=r.time_slot, status=r.status) for r in rows]


@router.post("/me", response_model=list[AvailabilityRecord])
def set_availability(
    payload: AvailabilitySetRequest,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> list[AvailabilityRecord]:
    """Set or clear availability for a single date + time slot (auto-save).

    Args:
        payload: The date, time_slot, and status to set, or None to clear that slot.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The full updated list of AvailabilityRecord objects for the user.
    """
    existing = db.query(UserAvailability).filter(
        UserAvailability.user_id == membership.user_id,
        UserAvailability.date == payload.date,
        UserAvailability.time_slot == payload.time_slot,
    ).first()

    if payload.status is None:
        if existing:
            db.delete(existing)
    elif existing:
        existing.status = payload.status
    else:
        db.add(UserAvailability(
            user_id=membership.user_id,
            date=payload.date,
            time_slot=payload.time_slot,
            status=payload.status,
        ))

    db.commit()

    rows = db.query(UserAvailability).filter(UserAvailability.user_id == membership.user_id).all()
    return [AvailabilityRecord(date=r.date, time_slot=r.time_slot, status=r.status) for r in rows]


@router.delete("/me")
def clear_all_availability(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> dict:
    """Clear all availability records for the current user.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A confirmation dict.
    """
    db.query(UserAvailability).filter(UserAvailability.user_id == membership.user_id).delete()
    db.commit()
    return {"ok": True}
