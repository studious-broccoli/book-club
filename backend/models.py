from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="member")
    heart_color: Mapped[str] = mapped_column(String(10), default="💜")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    votes: Mapped[list[Vote]] = relationship(back_populates="user", cascade="all, delete-orphan")
    availabilities: Mapped[list[Availability]] = relationship(back_populates="user", cascade="all, delete-orphan")
    preferences: Mapped[MemberPreference | None] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(200))
    genre: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_winner: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    votes: Mapped[list[Vote]] = relationship(back_populates="book", cascade="all, delete-orphan")
    created_by: Mapped[User] = relationship()


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("user_id", "book_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id"))

    user: Mapped[User] = relationship(back_populates="votes")
    book: Mapped[Book] = relationship(back_populates="votes")


class MeetingDate(Base):
    __tablename__ = "meeting_dates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    datetime_utc: Mapped[datetime] = mapped_column(DateTime)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    availabilities: Mapped[list[Availability]] = relationship(back_populates="meeting_date", cascade="all, delete-orphan")
    created_by: Mapped[User] = relationship()


class Availability(Base):
    __tablename__ = "availability"
    __table_args__ = (UniqueConstraint("user_id", "meeting_date_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    meeting_date_id: Mapped[int] = mapped_column(Integer, ForeignKey("meeting_dates.id"))
    status: Mapped[str] = mapped_column(String(10))  # "yes" or "no"

    user: Mapped[User] = relationship(back_populates="availabilities")
    meeting_date: Mapped[MeetingDate] = relationship(back_populates="availabilities")


class MemberPreference(Base):
    __tablename__ = "member_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    no_weeknights: Mapped[bool] = mapped_column(Boolean, default=False)
    preferred_days: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array string
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    blackout_dates: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array string

    user: Mapped[User] = relationship(back_populates="preferences")
