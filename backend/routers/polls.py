from __future__ import annotations

import json
import random
from datetime import date
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, require_club_admin
from database import get_db
from models import Book, BookRanking, ClubMembership, Poll, PollVote
from schemas import PollBookOption, PollCreate, PollOut, PollVoteIn

router = APIRouter()


def _total_members(db: Session, club_id: int) -> int:
    """Count members in a club.

    Args:
        db: The database session.
        club_id: The club ID.

    Returns:
        Number of members.
    """
    return db.query(ClubMembership).filter(ClubMembership.club_id == club_id).count()


def _finalize_poll_winner(db: Session, poll: Poll, tally: dict[int, int]) -> None:
    """Persist the poll winner and mark the book as is_winner (idempotent).

    Args:
        db: The database session.
        poll: The Poll ORM instance.
        tally: Map of book_id -> vote count.
    """
    if poll.winner_book_id is not None or not tally:
        return
    winner_id = max(tally, key=lambda bid: tally[bid])
    poll.winner_book_id = winner_id
    # Mark winning book and clear any previous winners in the club
    club_books = db.query(Book).filter(Book.club_id == poll.club_id).all()
    for book in club_books:
        book.is_winner = book.id == winner_id
    db.commit()


def _build_poll_out(
    poll: Poll,
    membership: ClubMembership,
    books: list[Book],
    total_members: int,
    db: Session | None = None,
) -> PollOut:
    """Serialize a Poll ORM object into a PollOut schema.

    Args:
        poll: The SQLAlchemy Poll instance.
        membership: The requesting user's club membership.
        books: The 3 Book instances included in this poll.
        total_members: Total member count for the club.

    Returns:
        A PollOut instance with vote tallies and completion state.
    """
    book_ids: list[int] = json.loads(poll.book_ids)
    today = date.today().isoformat()

    tally: dict[int, int] = {bid: 0 for bid in book_ids}
    user_voted_book: int | None = None
    unique_voters: set[int] = set()

    for v in poll.poll_votes:
        unique_voters.add(v.user_id)
        if v.book_id in tally:
            tally[v.book_id] += 1
        if v.user_id == membership.user_id:
            user_voted_book = v.book_id

    votes_cast = len(unique_voters)
    is_complete = votes_cast >= total_members or poll.end_date < today

    winner_book_id = poll.winner_book_id
    if is_complete and winner_book_id is None and tally:
        if db is not None:
            _finalize_poll_winner(db, poll, tally)
        winner_book_id = max(tally, key=lambda bid: tally[bid])
    winner_book_id = poll.winner_book_id if poll.winner_book_id is not None else winner_book_id

    book_map = {b.id: b for b in books}
    options = [
        PollBookOption(
            book_id=bid,
            title=book_map[bid].title,
            author=book_map[bid].author,
            vote_count=tally.get(bid, 0),
            user_voted=(bid == user_voted_book),
        )
        for bid in book_ids
        if bid in book_map
    ]

    return PollOut(
        id=poll.id,
        book_options=options,
        end_date=poll.end_date,
        winner_book_id=winner_book_id,
        total_members=total_members,
        votes_cast=votes_cast,
        is_complete=is_complete,
    )


@router.get("/active", response_model=PollOut | None)
def get_active_poll(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> PollOut | None:
    """Return the most recent poll for the current club, or None.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The most recent PollOut, or None if no poll exists.
    """
    poll = (
        db.query(Poll)
        .filter(Poll.club_id == membership.club_id)
        .order_by(Poll.created_at.desc())
        .first()
    )
    if not poll:
        return None

    book_ids: list[int] = json.loads(poll.book_ids)
    books = db.query(Book).filter(Book.id.in_(book_ids)).all()
    total = _total_members(db, membership.club_id)
    return _build_poll_out(poll, membership, books, total, db=db)


def _pick_top_books(db: Session, club_id: int, eligible: list[Book], n: int) -> list[Book]:
    """Pick the top-n books by aggregate member ranking (Borda count).

    Members who haven't submitted a ranking are ignored. Falls back to random
    selection when there are no rankings at all.

    Args:
        db: The database session.
        club_id: The club whose member rankings to consider.
        eligible: The candidate Book objects (non-winner books).
        n: How many books to select.

    Returns:
        A list of n Book objects in no particular order.
    """
    rankings = db.query(BookRanking).filter(BookRanking.club_id == club_id).all()
    if not rankings:
        return random.sample(eligible, n)

    eligible_ids = {b.id for b in eligible}
    # Borda count: position 0 → highest score
    scores: dict[int, float] = defaultdict(float)
    for r in rankings:
        ordered = [bid for bid in json.loads(r.book_ids_ordered) if bid in eligible_ids]
        total = len(ordered)
        for idx, bid in enumerate(ordered):
            scores[bid] += total - idx  # higher rank = more points

    # Sort by score descending; break ties randomly
    scored_books = sorted(
        [b for b in eligible if b.id in scores],
        key=lambda b: (-scores[b.id], random.random()),
    )
    unranked = [b for b in eligible if b.id not in scores]
    random.shuffle(unranked)

    combined = scored_books + unranked
    return combined[:n]


@router.post("", response_model=PollOut, status_code=status.HTTP_201_CREATED)
def create_poll(
    payload: PollCreate,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> PollOut:
    """Create a new poll by randomly selecting 3 non-winner books (admin only).

    Args:
        payload: Contains the end_date for the poll.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        The created PollOut object.

    Raises:
        HTTPException: If fewer than 3 non-winner books exist for this club.
    """
    eligible = (
        db.query(Book)
        .filter(Book.club_id == membership.club_id, Book.is_winner.is_(False))
        .all()
    )
    if len(eligible) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 3 non-winner books to start a poll (have {len(eligible)})",
        )

    selected = _pick_top_books(db, membership.club_id, eligible, n=3)
    poll = Poll(
        club_id=membership.club_id,
        book_ids=json.dumps([b.id for b in selected]),
        end_date=payload.end_date,
        created_by_id=membership.user_id,
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)

    total = _total_members(db, membership.club_id)
    return _build_poll_out(poll, membership, selected, total)


@router.post("/{poll_id}/vote", response_model=PollOut)
def cast_vote(
    poll_id: int,
    payload: PollVoteIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> PollOut:
    """Cast or change the current user's vote in a poll.

    Args:
        poll_id: The ID of the poll.
        payload: Contains the book_id to vote for.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The updated PollOut object.

    Raises:
        HTTPException: If the poll is not found, book is not in the poll, or poll has ended.
    """
    poll = db.query(Poll).filter(Poll.id == poll_id, Poll.club_id == membership.club_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    book_ids: list[int] = json.loads(poll.book_ids)
    if payload.book_id not in book_ids:
        raise HTTPException(status_code=400, detail="Book is not in this poll")

    if poll.end_date < date.today().isoformat():
        raise HTTPException(status_code=400, detail="Poll has ended")

    existing = (
        db.query(PollVote)
        .filter(PollVote.poll_id == poll_id, PollVote.user_id == membership.user_id)
        .first()
    )
    if existing:
        existing.book_id = payload.book_id
    else:
        db.add(PollVote(poll_id=poll_id, user_id=membership.user_id, book_id=payload.book_id))

    db.commit()
    db.refresh(poll)

    books = db.query(Book).filter(Book.id.in_(book_ids)).all()
    total = _total_members(db, membership.club_id)
    return _build_poll_out(poll, membership, books, total, db=db)


@router.delete("/{poll_id}")
def delete_poll(
    poll_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Delete a poll (admin only).

    Args:
        poll_id: The ID of the poll to delete.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If the poll is not found in this club.
    """
    poll = db.query(Poll).filter(Poll.id == poll_id, Poll.club_id == membership.club_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    db.delete(poll)
    db.commit()
    return {"ok": True}
