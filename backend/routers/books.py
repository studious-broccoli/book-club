from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_membership, require_club_admin
from database import get_db
from models import Book, BookRanking, ClubMembership, Vote
from schemas import BookCreate, BookOut, BookRankingIn, BookRankingOut

router = APIRouter()


def _build_book_out(book: Book, user_id: int, club_id: int, db: Session) -> BookOut:
    """Serialize a Book ORM object into a BookOut schema.

    Args:
        book: The SQLAlchemy Book instance.
        user_id: The requesting user's ID, used to determine user_voted.
        club_id: The current club ID, used to resolve the submitter's display name.
        db: Database session for looking up submitter membership.

    Returns:
        A BookOut instance with vote counts, user vote status, and submitter info.
    """
    voted_user_ids = {v.user_id for v in book.votes}

    creator_membership = (
        db.query(ClubMembership)
        .filter(
            ClubMembership.user_id == book.created_by_id,
            ClubMembership.club_id == club_id,
        )
        .first()
    )
    suggested_by_name = creator_membership.display_name if creator_membership else book.created_by.username
    suggested_by_heart = book.created_by.heart_color

    return BookOut(
        id=book.id,
        title=book.title,
        author=book.author,
        genre=book.genre,
        pages=book.pages,
        is_winner=book.is_winner,
        vote_count=len(book.votes),
        user_voted=user_id in voted_user_ids,
        suggested_by_id=book.created_by_id,
        suggested_by_name=suggested_by_name,
        suggested_by_heart=suggested_by_heart,
        created_at=book.created_at,
    )


@router.get("", response_model=list[BookOut])
def list_books(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> list[BookOut]:
    """Return all books for the current club.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A list of BookOut objects.
    """
    books = db.query(Book).filter(Book.club_id == membership.club_id).order_by(Book.created_at.desc()).all()
    return [_build_book_out(b, membership.user_id, membership.club_id, db) for b in books]


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> BookOut:
    """Create a new book nomination for the current club.

    Any member can suggest a book. Rejects duplicates (case-insensitive title match).

    Args:
        payload: The book details.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The created BookOut object.

    Raises:
        HTTPException: If a book with the same title already exists in this club.
    """
    duplicate = (
        db.query(Book)
        .filter(
            Book.club_id == membership.club_id,
            Book.title.ilike(payload.title.strip()),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail=f'"{duplicate.title}" is already on the list.')

    book = Book(
        club_id=membership.club_id,
        title=payload.title.strip(),
        author=payload.author.strip(),
        genre=payload.genre,
        pages=payload.pages,
        created_by_id=membership.user_id,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return _build_book_out(book, membership.user_id, membership.club_id, db)


@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> dict:
    """Delete a book nomination (admin only).

    Args:
        book_id: The ID of the book to delete.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        A confirmation dict.

    Raises:
        HTTPException: If the book is not found in this club.
    """
    book = db.query(Book).filter(Book.id == book_id, Book.club_id == membership.club_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
    return {"ok": True}


@router.post("/{book_id}/vote", response_model=BookOut)
def toggle_vote(
    book_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> BookOut:
    """Toggle the current user's vote on a book.

    Args:
        book_id: The ID of the book to vote on.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The updated BookOut object.

    Raises:
        HTTPException: If the book is not found in this club.
    """
    book = db.query(Book).filter(Book.id == book_id, Book.club_id == membership.club_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    existing = db.query(Vote).filter(Vote.user_id == membership.user_id, Vote.book_id == book_id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(Vote(user_id=membership.user_id, book_id=book_id))
    db.commit()
    db.refresh(book)
    return _build_book_out(book, membership.user_id, membership.club_id, db)


@router.patch("/{book_id}/winner", response_model=BookOut)
def set_winner(
    book_id: int,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(require_club_admin),
) -> BookOut:
    """Mark a book as the cycle winner (admin only).

    Args:
        book_id: The ID of the book to mark as winner.
        db: The database session.
        membership: The current user's club membership (admin required).

    Returns:
        The updated BookOut object.

    Raises:
        HTTPException: If the book is not found in this club.
    """
    db.query(Book).filter(Book.club_id == membership.club_id).update({Book.is_winner: False})
    book = db.query(Book).filter(Book.id == book_id, Book.club_id == membership.club_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book.is_winner = True
    db.commit()
    db.refresh(book)
    return _build_book_out(book, membership.user_id, membership.club_id, db)


# ── Rankings ──────────────────────────────────────────────────────────────────

@router.get("/my-ranking", response_model=BookRankingOut)
def get_my_ranking(
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> BookRankingOut:
    """Return the current user's preferred book order for this club.

    Args:
        db: The database session.
        membership: The current user's club membership.

    Returns:
        A BookRankingOut with book IDs in preference order (most preferred first).
    """
    ranking = (
        db.query(BookRanking)
        .filter(BookRanking.user_id == membership.user_id, BookRanking.club_id == membership.club_id)
        .first()
    )
    if not ranking:
        return BookRankingOut(book_ids_ordered=[])
    return BookRankingOut(book_ids_ordered=json.loads(ranking.book_ids_ordered))


@router.put("/my-ranking", response_model=BookRankingOut)
def save_my_ranking(
    payload: BookRankingIn,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> BookRankingOut:
    """Save the current user's preferred book order for this club.

    Args:
        payload: Ordered list of book IDs (most preferred first).
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The saved BookRankingOut.
    """
    ranking = (
        db.query(BookRanking)
        .filter(BookRanking.user_id == membership.user_id, BookRanking.club_id == membership.club_id)
        .first()
    )
    serialized = json.dumps(payload.book_ids_ordered)
    if ranking:
        ranking.book_ids_ordered = serialized
    else:
        db.add(BookRanking(
            user_id=membership.user_id,
            club_id=membership.club_id,
            book_ids_ordered=serialized,
        ))
    db.commit()
    return BookRankingOut(book_ids_ordered=payload.book_ids_ordered)
