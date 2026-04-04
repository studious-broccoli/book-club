from __future__ import annotations

import json
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, get_current_user_id, hash_password, require_club_admin, require_global_admin
from database import get_db
from models import (
    Book,
    BookRanking,
    Club,
    ClubCadence,
    ClubMembership,
    FinalSelection,
    MeetingDate,
    Poll,
    User,
    UserAvailability,
)
from schemas import (
    CadenceIn,
    CadenceOut,
    ClubCreate,
    ClubEntryOut,
    ClubMemberAdd,
    ClubMemberOut,
    ClubOut,
    FinalSelectionIn,
    FinalSelectionOut,
    GroupAvailabilityDay,
    MemberWithPreferences,
    PreferencesOut,
    SlotCounts,
)

HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]

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
    membership: ClubMembership = Depends(get_current_membership),
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

    admin_display = membership.display_name
    membership = ClubMembership(
        user_id=admin.id,
        club_id=club.id,
        display_name=admin_display,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(club)
    return ClubOut(id=club.id, name=club.name)


@router.delete("/{club_id}")
def delete_club(
    club_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_global_admin),
) -> dict:
    """Delete a club and all its data (global admin only).

    Args:
        club_id: The ID of the club to delete.
        db: The database session.
        admin: The authenticated global admin user.

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If the club is not found.
    """
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    # Delete dependent records that don't cascade automatically
    polls = db.query(Poll).filter(Poll.club_id == club_id).all()
    for p in polls:
        db.delete(p)
    db.flush()

    books = db.query(Book).filter(Book.club_id == club_id).all()
    for b in books:
        db.delete(b)
    db.flush()

    dates = db.query(MeetingDate).filter(MeetingDate.club_id == club_id).all()
    for d in dates:
        db.delete(d)
    db.flush()

    db.query(BookRanking).filter(BookRanking.club_id == club_id).delete()
    db.query(ClubCadence).filter(ClubCadence.club_id == club_id).delete()
    db.query(FinalSelection).filter(FinalSelection.club_id == club_id).delete()
    db.flush()

    db.delete(club)  # cascades ClubMemberships
    db.commit()
    return {"ok": True}


@router.post("/{club_id}/members", response_model=MemberWithPreferences, status_code=status.HTTP_201_CREATED)
def add_member_to_club(
    club_id: int,
    payload: ClubMemberAdd,
    db: Session = Depends(get_db),
    admin: User = Depends(require_global_admin),
) -> MemberWithPreferences:
    """Add an existing or new user to a specific club (global admin only).

    If the username already exists the user is added to the club without
    creating a new account (password is ignored). If the user does not exist
    a new account is created — password is required in that case.

    Args:
        club_id: The ID of the target club.
        payload: Member details; password only required for new users.
        db: The database session.
        admin: The authenticated global admin user.

    Returns:
        The created MemberWithPreferences object.

    Raises:
        HTTPException: If the club does not exist, the user is already a member,
            or no password is provided for a new user.
    """
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        if not payload.password:
            raise HTTPException(status_code=400, detail="Password is required for new users")
        user = User(
            username=payload.username,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            role="member",
            heart_color=random.choice(HEART_EMOJIS),
        )
        db.add(user)
        db.flush()

    already = db.query(ClubMembership).filter(
        ClubMembership.user_id == user.id,
        ClubMembership.club_id == club_id,
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="User is already a member of this club")

    new_membership = ClubMembership(
        user_id=user.id,
        club_id=club_id,
        display_name=payload.display_name,
        role="member",
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    prefs = new_membership.user.preferences
    prefs_out = (
        PreferencesOut(
            no_weeknights=prefs.no_weeknights,
            preferred_days=json.loads(prefs.preferred_days) if prefs.preferred_days else [],
            notes=prefs.notes,
            blackout_dates=json.loads(prefs.blackout_dates) if prefs.blackout_dates else [],
        )
        if prefs else None
    )
    return MemberWithPreferences(
        user_id=new_membership.user_id,
        username=new_membership.user.username,
        display_name=new_membership.display_name,
        heart_color=new_membership.user.heart_color,
        role=new_membership.role,
        email=new_membership.user.email,
        preferences=prefs_out,
    )


@router.delete("/{club_id}/members/{user_id}")
def remove_member_from_club(
    club_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_global_admin),
) -> dict:
    """Remove a member from a specific club (global admin only).

    Args:
        club_id: The ID of the target club.
        user_id: The ID of the user to remove.
        db: The database session.
        admin: The authenticated global admin user.

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If the membership is not found.
    """
    target = db.query(ClubMembership).filter(
        ClubMembership.user_id == user_id,
        ClubMembership.club_id == club_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Membership not found")
    db.delete(target)
    db.commit()
    return {"ok": True}


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

    # Group by (date, time_slot) -> {user_id: status}
    SLOTS = ("morning", "afternoon", "evening")
    date_slot_map: dict[str, dict[str, dict[int, str]]] = {}
    for r in records:
        if r.date not in date_slot_map:
            date_slot_map[r.date] = {s: {} for s in SLOTS}
        date_slot_map[r.date][r.time_slot][r.user_id] = r.status

    def _slot_counts(user_statuses: dict[int, str]) -> SlotCounts:
        counts: dict[str, int] = {"available": 0, "tentative": 0, "unavailable": 0}
        for s in user_statuses.values():
            if s in counts:
                counts[s] += 1
        # Members who didn't mark this slot are treated as tentative.
        counts["tentative"] += total_members - len(user_statuses)
        return SlotCounts(
            available=counts["available"],
            tentative=counts["tentative"],
            unavailable=counts["unavailable"],
        )

    result = []
    for d, slots in sorted(date_slot_map.items()):
        result.append(
            GroupAvailabilityDay(
                date=d,
                morning=_slot_counts(slots.get("morning", {})),
                afternoon=_slot_counts(slots.get("afternoon", {})),
                evening=_slot_counts(slots.get("evening", {})),
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
