from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from database import get_db
from models import Book, User, Vote
from schemas import BookCreate, BookOut

router = APIRouter()


def _build_book_out(book: Book, current_user: User) -> BookOut:
    """Serialize a Book ORM object into a BookOut schema.

    Args:
        book: The SQLAlchemy Book instance.
        current_user: The requesting user, used to determine user_voted.

    Returns:
        A BookOut instance with vote counts and user vote status.
    """
    voted_user_ids = {v.user_id for v in book.votes}
    return BookOut(
        id=book.id,
        title=book.title,
        author=book.author,
        genre=book.genre,
        pages=book.pages,
        is_winner=book.is_winner,
        vote_count=len(book.votes),
        user_voted=current_user.id in voted_user_ids,
        created_at=book.created_at,
    )


@router.get("", response_model=list[BookOut])
def list_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookOut]:
    """Return all books with vote counts and current user's vote status.

    Args:
        db: The database session.
        current_user: The authenticated user.

    Returns:
        A list of BookOut objects.
    """
    books = db.query(Book).order_by(Book.created_at.desc()).all()
    return [_build_book_out(b, current_user) for b in books]


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> BookOut:
    """Create a new book nomination (admin only).

    Args:
        payload: The book details.
        db: The database session.
        current_user: The authenticated admin user.

    Returns:
        The created BookOut object.
    """
    book = Book(
        title=payload.title,
        author=payload.author,
        genre=payload.genre,
        pages=payload.pages,
        created_by_id=current_user.id,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return _build_book_out(book, current_user)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    """Delete a book nomination (admin only).

    Args:
        book_id: The ID of the book to delete.
        db: The database session.
        _: The authenticated admin user.

    Raises:
        HTTPException: If the book is not found.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()


@router.post("/{book_id}/vote", response_model=BookOut)
def toggle_vote(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    """Toggle the current user's vote on a book.

    Args:
        book_id: The ID of the book to vote on.
        db: The database session.
        current_user: The authenticated user.

    Returns:
        The updated BookOut object.

    Raises:
        HTTPException: If the book is not found.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    existing = db.query(Vote).filter(Vote.user_id == current_user.id, Vote.book_id == book_id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(Vote(user_id=current_user.id, book_id=book_id))
    db.commit()
    db.refresh(book)
    return _build_book_out(book, current_user)


@router.patch("/{book_id}/winner", response_model=BookOut)
def set_winner(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> BookOut:
    """Mark a book as the cycle winner, clearing any previous winner (admin only).

    Args:
        book_id: The ID of the book to mark as winner.
        db: The database session.
        current_user: The authenticated admin user.

    Returns:
        The updated BookOut object.

    Raises:
        HTTPException: If the book is not found.
    """
    db.query(Book).update({Book.is_winner: False})
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book.is_winner = True
    db.commit()
    db.refresh(book)
    return _build_book_out(book, current_user)
