from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Auth ──────────────────────────────────────────────────────────────────────

class EnterRequest(BaseModel):
    password: str


class SelectRequest(BaseModel):
    user_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ── Users ─────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None
    role: str
    heart_color: str
    created_at: datetime


class UserCreate(BaseModel):
    username: str
    password: str
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


class UserWithPreferences(UserOut):
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
    created_at: datetime


# ── Schedule ──────────────────────────────────────────────────────────────────

class MeetingDateCreate(BaseModel):
    datetime_utc: datetime
    label: str | None = None


class AvailabilityEntry(BaseModel):
    user_id: int
    username: str
    status: str  # "yes" or "no"


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
    status: str | None  # "yes", "no", or None to clear
