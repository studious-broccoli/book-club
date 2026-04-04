from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, require_club_admin
from database import get_db
from models import Availability, ClubMembership, MeetingDate
from schemas import (
    AvailabilityEntry,
    AvailabilityIn,
    AvailabilitySummary,
    MeetingDateCreate,
    MeetingDateOut,
)

router = APIRouter()


def _build_date_out(meeting: MeetingDate, membership: ClubMembership, db: Session) -> MeetingDateOut:
    """Serialize a MeetingDate ORM object into a MeetingDateOut schema.

    Args:
        meeting: The SQLAlchemy MeetingDate instance.
        membership: The current user's club membership.
        db: The database session, used to resolve club display names.

    Returns:
        A MeetingDateOut instance with availability details.
    """
    yes_count = sum(1 for a in meeting.availabilities if a.status == "yes")
    no_count = sum(1 for a in meeting.availabilities if a.status == "no")
    my_status = next(
        (a.status for a in meeting.availabilities if a.user_id == membership.user_id), None
    )
    club_memberships = db.query(ClubMembership).filter(ClubMembership.club_id == meeting.club_id).all()
    member_display: dict[int, str] = {cm.user_id: cm.display_name for cm in club_memberships}
    entries = [
        AvailabilityEntry(
            user_id=a.user_id,
            display_name=member_display.get(a.user_id, a.user.username),
            status=a.status,
        )
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
    membership: ClubMembership = Depends(get_current_membership),
) -> list[MeetingDateOut]:
    """Return all proposed meeting dates for the current club.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A list of MeetingDateOut objects ordered by date.
    """
    dates = db.query(MeetingDate).filter(MeetingDate.club_id == membership.club_id).order_by(MeetingDate.datetime_utc).all()
    return [_build_date_out(d, membership, db) for d in dates]


@router.post("", response_model=MeetingDateOut, status_code=status.HTTP_201_CREATED)
def create_date(
    payload: MeetingDateCreate,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> MeetingDateOut:
    """Create a new proposed meeting date (any club member).

    Args:
        payload: The date and optional label.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The created MeetingDateOut object.
    """
    meeting = MeetingDate(
        club_id=membership.club_id,
        datetime_utc=payload.datetime_utc,
        label=payload.label,
        created_by_id=membership.user_id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _build_date_out(meeting, membership, db)


@router.delete("/{date_id}")
def delete_date(
    date_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Delete a proposed meeting date (admin only).

    Args:
        date_id: The ID of the meeting date to delete.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If the date is not found in this club.
    """
    meeting = db.query(MeetingDate).filter(MeetingDate.id == date_id, MeetingDate.club_id == membership.club_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Date not found")
    db.delete(meeting)
    db.commit()
    return {"ok": True}


@router.post("/{date_id}/availability", response_model=MeetingDateOut)
def set_availability(
    date_id: int,
    payload: AvailabilityIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> MeetingDateOut:
    """Set or clear the current user's availability for a meeting date.

    Args:
        date_id: The ID of the meeting date.
        payload: Contains status ("yes", "no", or None to clear).
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The updated MeetingDateOut object.

    Raises:
        HTTPException: If the date is not found in this club.
    """
    meeting = db.query(MeetingDate).filter(MeetingDate.id == date_id, MeetingDate.club_id == membership.club_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Date not found")

    existing = db.query(Availability).filter(
        Availability.user_id == membership.user_id,
        Availability.meeting_date_id == date_id,
    ).first()

    if payload.status is None:
        if existing:
            db.delete(existing)
    elif existing:
        existing.status = payload.status
    else:
        db.add(Availability(user_id=membership.user_id, meeting_date_id=date_id, status=payload.status))

    db.commit()
    db.refresh(meeting)
    return _build_date_out(meeting, membership, db)
