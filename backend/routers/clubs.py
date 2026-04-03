from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, get_current_user_id, require_club_admin, require_global_admin
from database import get_db
from models import (
    Club,
    ClubCadence,
    ClubMembership,
    FinalSelection,
    User,
    UserAvailability,
)
from schemas import (
    CadenceIn,
    CadenceOut,
    ClubCreate,
    ClubEntryOut,
    ClubMemberOut,
    ClubOut,
    FinalSelectionIn,
    FinalSelectionOut,
    GroupAvailabilityDay,
)

router = APIRouter()


@router.get("", response_model=list[ClubEntryOut])
def list_my_clubs(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> list[ClubEntryOut]:
    """Return all clubs the current user belongs to, including each club's member list.

    Uses only the user_id from the token so this works regardless of which
    club context the token was issued for.

    Args:
        db: The database session.
        user_id: The authenticated user's ID.

    Returns:
        A list of ClubEntryOut objects, each with their members.
    """
    memberships = db.query(ClubMembership).filter(ClubMembership.user_id == user_id).all()
    result = []
    for m in memberships:
        members_out = [
            ClubMemberOut(
                user_id=cm.user_id,
                username=cm.user.username,
                display_name=cm.display_name,
                heart_color=cm.user.heart_color,
                role=cm.role,
            )
            for cm in m.club.memberships
        ]
        result.append(ClubEntryOut(club_id=m.club.id, club_name=m.club.name, members=members_out))
    return result


@router.post("", response_model=ClubOut, status_code=status.HTTP_201_CREATED)
def create_club(
    payload: ClubCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_global_admin),
) -> ClubOut:
    """Create a new club (global admin only).

    Args:
        payload: The club name and password.
        db: The database session.
        admin: The authenticated global admin user.

    Returns:
        The created ClubOut object.

    Raises:
        HTTPException: If a club with that name already exists.
    """
    existing = db.query(Club).filter(Club.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A club with that name already exists")

    club = Club(name=payload.name, password=payload.password)
    db.add(club)
    db.flush()

    membership = ClubMembership(
        user_id=admin.id,
        club_id=club.id,
        display_name=admin.username,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(club)
    return ClubOut(id=club.id, name=club.name)


@router.get("/group-availability", response_model=list[GroupAvailabilityDay])
def get_group_availability(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> list[GroupAvailabilityDay]:
    """Return aggregated personal availability for all members of the current club.

    For each date that has at least one record from any club member, returns
    counts of available/tentative/unavailable/no_response.

    Args:
        db: The database session.
        membership: The current user's club membership (determines which club).

    Returns:
        A list of GroupAvailabilityDay objects sorted by date.
    """
    member_ids = [
        m.user_id
        for m in db.query(ClubMembership).filter(ClubMembership.club_id == membership.club_id).all()
    ]
    total_members = len(member_ids)

    records = (
        db.query(UserAvailability)
        .filter(UserAvailability.user_id.in_(member_ids))
        .all()
    )

    # Group by date (collapse time slots — a member counts as "available" for a date
    # if any of their slots is available)
    date_user_map: dict[str, dict[int, str]] = {}
    for r in records:
        if r.date not in date_user_map:
            date_user_map[r.date] = {}
        existing_status = date_user_map[r.date].get(r.user_id)
        # Priority: available > tentative > unavailable
        priority = {"available": 2, "tentative": 1, "unavailable": 0}
        if existing_status is None or priority.get(r.status, 0) > priority.get(existing_status, 0):
            date_user_map[r.date][r.user_id] = r.status

    result = []
    for d, user_statuses in sorted(date_user_map.items()):
        counts: dict[str, int] = {"available": 0, "tentative": 0, "unavailable": 0}
        for s in user_statuses.values():
            if s in counts:
                counts[s] += 1
        responded = sum(counts.values())
        result.append(
            GroupAvailabilityDay(
                date=d,
                available=counts["available"],
                tentative=counts["tentative"],
                unavailable=counts["unavailable"],
                no_response=total_members - responded,
                total_members=total_members,
            )
        )
    return result


# ── Cadence ───────────────────────────────────────────────────────────────────

@router.get("/cadence", response_model=CadenceOut | None)
def get_cadence(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> CadenceOut | None:
    """Return the current club's meeting cadence, or None if not set.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A CadenceOut object, or None.
    """
    cadence = db.query(ClubCadence).filter(ClubCadence.club_id == membership.club_id).first()
    if not cadence:
        return None
    return CadenceOut(
        frequency=cadence.frequency,
        day_of_week=cadence.day_of_week,
        week_of_month=cadence.week_of_month,
        preferred_time=cadence.preferred_time,
        notes=cadence.notes,
    )


@router.put("/cadence", response_model=CadenceOut)
def set_cadence(
    payload: CadenceIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> CadenceOut:
    """Set or update the current club's meeting cadence (admin only).

    Args:
        payload: The cadence details.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        The updated CadenceOut object.
    """
    cadence = db.query(ClubCadence).filter(ClubCadence.club_id == membership.club_id).first()
    if cadence:
        cadence.frequency = payload.frequency
        cadence.day_of_week = payload.day_of_week
        cadence.week_of_month = payload.week_of_month
        cadence.preferred_time = payload.preferred_time
        cadence.notes = payload.notes
    else:
        cadence = ClubCadence(
            club_id=membership.club_id,
            frequency=payload.frequency,
            day_of_week=payload.day_of_week,
            week_of_month=payload.week_of_month,
            preferred_time=payload.preferred_time,
            notes=payload.notes,
        )
        db.add(cadence)
    db.commit()
    db.refresh(cadence)
    return CadenceOut(
        frequency=cadence.frequency,
        day_of_week=cadence.day_of_week,
        week_of_month=cadence.week_of_month,
        preferred_time=cadence.preferred_time,
        notes=cadence.notes,
    )


@router.delete("/cadence")
def delete_cadence(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Clear the current club's meeting cadence (admin only).

    Args:
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.
    """
    cadence = db.query(ClubCadence).filter(ClubCadence.club_id == membership.club_id).first()
    if cadence:
        db.delete(cadence)
        db.commit()
    return {"ok": True}


# ── Final Selection ───────────────────────────────────────────────────────────

@router.get("/final-selection", response_model=FinalSelectionOut | None)
def get_final_selection(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> FinalSelectionOut | None:
    """Return the current club's confirmed book + meeting time, or None.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A FinalSelectionOut object, or None if not set.
    """
    sel = db.query(FinalSelection).filter(FinalSelection.club_id == membership.club_id).first()
    if not sel:
        return None
    return FinalSelectionOut(
        book_id=sel.book_id,
        book_title=sel.book.title if sel.book else None,
        book_author=sel.book.author if sel.book else None,
        confirmed_datetime=sel.confirmed_datetime,
        notes=sel.notes,
        updated_at=sel.updated_at,
    )


@router.put("/final-selection", response_model=FinalSelectionOut)
def set_final_selection(
    payload: FinalSelectionIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> FinalSelectionOut:
    """Set or update the current club's final book and meeting time (admin only).

    Args:
        payload: The book_id, confirmed_datetime, and optional notes.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        The updated FinalSelectionOut object.
    """
    sel = db.query(FinalSelection).filter(FinalSelection.club_id == membership.club_id).first()
    if sel:
        sel.book_id = payload.book_id
        sel.confirmed_datetime = payload.confirmed_datetime
        sel.notes = payload.notes
        sel.updated_at = datetime.utcnow()
    else:
        sel = FinalSelection(
            club_id=membership.club_id,
            book_id=payload.book_id,
            confirmed_datetime=payload.confirmed_datetime,
            notes=payload.notes,
        )
        db.add(sel)
    db.commit()
    db.refresh(sel)
    return FinalSelectionOut(
        book_id=sel.book_id,
        book_title=sel.book.title if sel.book else None,
        book_author=sel.book.author if sel.book else None,
        confirmed_datetime=sel.confirmed_datetime,
        notes=sel.notes,
        updated_at=sel.updated_at,
    )


@router.delete("/final-selection")
def delete_final_selection(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Clear the current club's final selection (admin only).

    Args:
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.
    """
    sel = db.query(FinalSelection).filter(FinalSelection.club_id == membership.club_id).first()
    if sel:
        db.delete(sel)
        db.commit()
    return {"ok": True}
