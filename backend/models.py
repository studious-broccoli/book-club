from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Club(Base):
    __tablename__ = "clubs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    password: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memberships: Mapped[list[ClubMembership]] = relationship(back_populates="club", cascade="all, delete-orphan")


class ClubMembership(Base):
    __tablename__ = "club_memberships"
    __table_args__ = (UniqueConstraint("club_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="member")  # "admin" | "member"

    club: Mapped[Club] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="member")  # global role — "admin" can create clubs
    heart_color: Mapped[str] = mapped_column(String(10), default="💜")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memberships: Mapped[list[ClubMembership]] = relationship(back_populates="user")
    votes: Mapped[list[Vote]] = relationship(back_populates="user", cascade="all, delete-orphan")
    availabilities: Mapped[list[Availability]] = relationship(back_populates="user", cascade="all, delete-orphan")
    preferences: Mapped[MemberPreference | None] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"))
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
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"))
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


class UserAvailability(Base):
    __tablename__ = "user_availability"
    __table_args__ = (UniqueConstraint("user_id", "date", "time_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String(10))  # ISO format: "2026-04-12"
    time_slot: Mapped[str] = mapped_column(String(20), default="morning")  # "morning" | "afternoon" | "evening"
    status: Mapped[str] = mapped_column(String(20))  # "available", "tentative", "unavailable"

    user: Mapped[User] = relationship()


class MemberPreference(Base):
    __tablename__ = "member_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    no_weeknights: Mapped[bool] = mapped_column(Boolean, default=False)
    preferred_days: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    blackout_dates: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="preferences")


# ── Book Ranking ──────────────────────────────────────────────────────────────

class BookRanking(Base):
    __tablename__ = "book_rankings"
    __table_args__ = (UniqueConstraint("user_id", "club_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"))
    # JSON-encoded ordered list of book IDs, most preferred first
    book_ids_ordered: Mapped[str] = mapped_column(Text, default="[]")

    user: Mapped[User] = relationship()


# ── Poll ──────────────────────────────────────────────────────────────────────

class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"))
    book_ids: Mapped[str] = mapped_column(Text)  # JSON list of 3 book IDs
    end_date: Mapped[str] = mapped_column(String(10))  # ISO date "2026-05-01"
    winner_book_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("books.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    poll_votes: Mapped[list[PollVote]] = relationship(back_populates="poll", cascade="all, delete-orphan")
    created_by: Mapped[User] = relationship()


class PollVote(Base):
    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("poll_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    poll_id: Mapped[int] = mapped_column(Integer, ForeignKey("polls.id"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id"))

    poll: Mapped[Poll] = relationship(back_populates="poll_votes")
    user: Mapped[User] = relationship()


# ── Club Cadence ──────────────────────────────────────────────────────────────

class ClubCadence(Base):
    __tablename__ = "club_cadences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"), unique=True)
    frequency: Mapped[str] = mapped_column(String(20))  # "weekly" | "biweekly" | "monthly"
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon … 6=Sun
    week_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1–5 (Nth weekday of month)
    preferred_time: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "morning" | "afternoon" | "evening"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    club: Mapped[Club] = relationship()


# ── Final Selection ───────────────────────────────────────────────────────────

class FinalSelection(Base):
    __tablename__ = "final_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.id"), unique=True)
    book_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("books.id"), nullable=True)
    confirmed_datetime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    club: Mapped[Club] = relationship()
    book: Mapped[Book | None] = relationship()
