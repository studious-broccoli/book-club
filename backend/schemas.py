from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Auth ──────────────────────────────────────────────────────────────────────

class EnterRequest(BaseModel):
    password: str


class SelectRequest(BaseModel):
    user_id: int
    club_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: MeOut


# ── Club ──────────────────────────────────────────────────────────────────────

class ClubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class ClubCreate(BaseModel):
    name: str
    password: str


class ClubMemberOut(BaseModel):
    user_id: int
    username: str
    display_name: str
    heart_color: str
    role: str


class ClubEntryOut(BaseModel):
    club_id: int
    club_name: str
    members: list[ClubMemberOut]


# ── Users ─────────────────────────────────────────────────────────────────────

class MeOut(BaseModel):
    """Combined user + current club context returned from /auth/me and login."""
    id: int
    username: str
    email: str | None
    heart_color: str
    role: str           # global role
    display_name: str   # per-club display name
    club_role: str      # per-club role
    club_id: int
    club_name: str
    created_at: datetime


class UserOut(BaseModel):
    """Lightweight user info used in member listings."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str | None
    heart_color: str
    role: str
    created_at: datetime


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    email: str | None = None
    role: str = "member"


# ── Preferences ───────────────────────────────────────────────────────────────

class PreferencesIn(BaseModel):
    no_weeknights: bool = False
    preferred_days: list[str] = []
    notes: str | None = None
    blackout_dates: list[str] = []


class PreferencesOut(BaseModel):
    no_weeknights: bool
    preferred_days: list[str]
    notes: str | None
    blackout_dates: list[str]


class MemberWithPreferences(BaseModel):
    user_id: int
    username: str
    display_name: str
    heart_color: str
    role: str
    email: str | None
    preferences: PreferencesOut | None


# ── Books ─────────────────────────────────────────────────────────────────────

class BookCreate(BaseModel):
    title: str
    author: str
    genre: str | None = None
    pages: int | None = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    author: str
    genre: str | None
    pages: int | None
    is_winner: bool
    vote_count: int
    user_voted: bool
    suggested_by_id: int
    suggested_by_name: str
    suggested_by_heart: str
    created_at: datetime


# ── Schedule ──────────────────────────────────────────────────────────────────

class MeetingDateCreate(BaseModel):
    datetime_utc: datetime
    label: str | None = None


class AvailabilityEntry(BaseModel):
    user_id: int
    display_name: str
    status: str


class AvailabilitySummary(BaseModel):
    yes: int
    no: int
    total: int


class MeetingDateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    datetime_utc: datetime
    label: str | None
    availability_summary: AvailabilitySummary
    my_status: str | None
    availabilities: list[AvailabilityEntry]
    created_at: datetime


class AvailabilityIn(BaseModel):
    status: str | None


# ── Personal Availability ─────────────────────────────────────────────────────

class AvailabilityRecord(BaseModel):
    date: str
    time_slot: str  # "morning" | "afternoon" | "evening"
    status: str


class AvailabilitySetRequest(BaseModel):
    date: str
    time_slot: str  # "morning" | "afternoon" | "evening"
    status: str | None  # None = clear this slot


# ── Group Availability ────────────────────────────────────────────────────────

class GroupAvailabilityDay(BaseModel):
    date: str
    available: int
    tentative: int
    unavailable: int
    no_response: int
    total_members: int


# ── Book Ranking ──────────────────────────────────────────────────────────────

class BookRankingIn(BaseModel):
    book_ids_ordered: list[int]  # most preferred first


class BookRankingOut(BaseModel):
    book_ids_ordered: list[int]


# ── Poll ──────────────────────────────────────────────────────────────────────

class PollCreate(BaseModel):
    end_date: str  # ISO date "2026-05-01"


class PollVoteIn(BaseModel):
    book_id: int


class PollBookOption(BaseModel):
    book_id: int
    title: str
    author: str
    vote_count: int
    user_voted: bool


class PollOut(BaseModel):
    id: int
    book_options: list[PollBookOption]
    end_date: str
    winner_book_id: int | None
    total_members: int
    votes_cast: int
    is_complete: bool


# ── Cadence ───────────────────────────────────────────────────────────────────

class CadenceIn(BaseModel):
    frequency: str          # "weekly" | "biweekly" | "monthly"
    day_of_week: int | None = None      # 0=Mon … 6=Sun
    week_of_month: int | None = None    # 1–5 (Nth weekday of month; None = any)
    preferred_time: str | None = None   # "morning" | "afternoon" | "evening"
    notes: str | None = None


class CadenceOut(BaseModel):
    frequency: str
    day_of_week: int | None
    week_of_month: int | None
    preferred_time: str | None
    notes: str | None


# ── Final Selection ───────────────────────────────────────────────────────────

class FinalSelectionIn(BaseModel):
    book_id: int | None = None
    confirmed_datetime: datetime | None = None
    notes: str | None = None


class FinalSelectionOut(BaseModel):
    book_id: int | None
    book_title: str | None
    book_author: str | None
    confirmed_datetime: datetime | None
    notes: str | None
    updated_at: datetime
