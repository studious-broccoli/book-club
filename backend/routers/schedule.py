from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from database import get_db
from models import Availability, MeetingDate, User
from schemas import (
    AvailabilityEntry,
    AvailabilityIn,
    AvailabilitySummary,
    MeetingDateCreate,
    MeetingDateOut,
)

router = APIRouter()


def _build_date_out(meeting: MeetingDate, current_user: User) -> MeetingDateOut:
    """Serialize a MeetingDate ORM object into a MeetingDateOut schema.

    Args:
        meeting: The SQLAlchemy MeetingDate instance.
        current_user: The requesting user, used to determine my_status.

    Returns:
        A MeetingDateOut instance with availability details.
    """
    yes_count = sum(1 for a in meeting.availabilities if a.status == "yes")
    no_count = sum(1 for a in meeting.availabilities if a.status == "no")
    my_status = next(
        (a.status for a in meeting.availabilities if a.user_id == current_user.id), None
    )
    entries = [
        AvailabilityEntry(user_id=a.user_id, username=a.user.username, status=a.status)
        for a in meeting.availabilities
    ]
    return MeetingDateOut(
        id=meeting.id,
        datetime_utc=meeting.datetime_utc,
        label=meeting.label,
        availability_summary=AvailabilitySummary(yes=yes_count, no=no_count, total=len(meeting.availabilities)),
        my_status=my_status,
        availabilities=entries,
        created_at=meeting.created_at,
    )


@router.get("", response_model=list[MeetingDateOut])
def list_dates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MeetingDateOut]:
    """Return all proposed meeting dates with availability.

    Args:
        db: The database session.
        current_user: The authenticated user.

    Returns:
        A list of MeetingDateOut objects ordered by date.
    """
    dates = db.query(MeetingDate).order_by(MeetingDate.datetime_utc).all()
    return [_build_date_out(d, current_user) for d in dates]


@router.post("", response_model=MeetingDateOut, status_code=status.HTTP_201_CREATED)
def create_date(
    payload: MeetingDateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MeetingDateOut:
    """Create a new proposed meeting date (admin only).

    Args:
        payload: The date and optional label.
        db: The database session.
        current_user: The authenticated admin user.

    Returns:
        The created MeetingDateOut object.
    """
    meeting = MeetingDate(
        datetime_utc=payload.datetime_utc,
        label=payload.label,
        created_by_id=current_user.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _build_date_out(meeting, current_user)


@router.delete("/{date_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_date(
    date_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    """Delete a proposed meeting date (admin only).

    Args:
        date_id: The ID of the meeting date to delete.
        db: The database session.
        _: The authenticated admin user.

    Raises:
        HTTPException: If the date is not found.
    """
    meeting = db.query(MeetingDate).filter(MeetingDate.id == date_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Date not found")
    db.delete(meeting)
    db.commit()


@router.post("/{date_id}/availability", response_model=MeetingDateOut)
def set_availability(
    date_id: int,
    payload: AvailabilityIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingDateOut:
    """Set or clear the current user's availability for a meeting date.

    Args:
        date_id: The ID of the meeting date.
        payload: Contains status ("yes", "no", or None to clear).
        db: The database session.
        current_user: The authenticated user.

    Returns:
        The updated MeetingDateOut object.

    Raises:
        HTTPException: If the date is not found.
    """
    meeting = db.query(MeetingDate).filter(MeetingDate.id == date_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Date not found")

    existing = db.query(Availability).filter(
        Availability.user_id == current_user.id,
        Availability.meeting_date_id == date_id,
    ).first()

    if payload.status is None:
        if existing:
            db.delete(existing)
    elif existing:
        existing.status = payload.status
    else:
        db.add(Availability(user_id=current_user.id, meeting_date_id=date_id, status=payload.status))

    db.commit()
    db.refresh(meeting)
    return _build_date_out(meeting, current_user)
