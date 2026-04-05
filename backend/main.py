from __future__ import annotations

import logging
import os
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

load_dotenv()

from auth import create_user_token, get_current_membership, hash_password, require_global_admin
from database import Base, SessionLocal, engine, get_db
from models import Club, ClubMembership, User
from routers import availability, books, clubs, members, polls, schedule
from schemas import ClubEntryOut, ClubMemberOut, MeOut, ProfileUpdate, SelectRequest, EnterRequest, TokenResponse, UserOut

HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]

app = FastAPI(title="Book Club API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://thespicybookcoven.com",
        "https://www.thespicybookcoven.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}


app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(schedule.router, prefix="/dates", tags=["schedule"])
app.include_router(members.router, prefix="/members", tags=["members"])
app.include_router(availability.router, prefix="/availability", tags=["availability"])
app.include_router(clubs.router, prefix="/clubs", tags=["clubs"])
app.include_router(polls.router, prefix="/polls", tags=["polls"])


def _build_me_out(membership: ClubMembership) -> MeOut:
    """Build a MeOut response from a ClubMembership.

    Args:
        membership: The ClubMembership with user and club loaded.

    Returns:
        A MeOut instance combining user and club context.
    """
    return MeOut(
        id=membership.user.id,
        username=membership.user.username,
        email=membership.user.email,
        heart_color=membership.user.heart_color,
        role=membership.user.role,
        display_name=membership.display_name,
        club_role=membership.role,
        club_id=membership.club_id,
        club_name=membership.club.name,
        created_at=membership.user.created_at,
    )


def seed_admin(db: Session) -> None:
    """Create the default admin user and first club if none exist.

    Args:
        db: The database session.
    """
    if db.query(User).count() > 0:
        return

    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    club_name = os.getenv("CLUB_NAME", "The Spicy Book Coven")
    club_password = os.getenv("CLUB_PASSWORD", "bookclub2026")

    admin = User(
        username=admin_username,
        hashed_password=hash_password("unused"),
        role="admin",
        heart_color=random.choice(HEART_EMOJIS),
    )
    db.add(admin)
    db.flush()

    club = Club(name=club_name, password=club_password)
    db.add(club)
    db.flush()

    membership = ClubMembership(
        user_id=admin.id,
        club_id=club.id,
        display_name=admin_username,
        role="admin",
    )
    db.add(membership)
    db.commit()

    print(f"\n{'='*50}")
    print("First club created!")
    print(f"  Club    : {club_name}")
    print(f"  Password: {club_password}")
    print(f"  Admin   : {admin_username}")
    print("Change CLUB_PASSWORD in backend/.env before sharing!")
    print(f"{'='*50}\n")


@app.on_event("startup")
def startup() -> None:
    """Initialize the database and seed on first run."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()


@app.post("/auth/enter", response_model=list[ClubEntryOut])
def enter(payload: EnterRequest, db: Session = Depends(get_db)) -> list[ClubEntryOut]:
    """Verify a club password and return matching clubs with their member lists.

    Args:
        payload: Contains the club password to check.
        db: The database session.

    Returns:
        A list of ClubEntryOut objects for all clubs matching the password.

    Raises:
        HTTPException: If no club matches the password.
    """
    matched = db.query(Club).filter(Club.password == payload.password).all()
    if not matched:
        raise HTTPException(status_code=401, detail="Wrong password")

    result = []
    for club in matched:
        members_out = [
            ClubMemberOut(
                user_id=m.user_id,
                username=m.user.username,
                display_name=m.display_name,
                heart_color=m.user.heart_color,
                role=m.role,
            )
            for m in club.memberships
        ]
        result.append(ClubEntryOut(club_id=club.id, club_name=club.name, members=members_out))
    return result


@app.post("/auth/select", response_model=TokenResponse)
def select_user(payload: SelectRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Issue a session token for the selected user and club.

    Args:
        payload: Contains user_id and club_id.
        db: The database session.

    Returns:
        A TokenResponse with access token and user/club context.

    Raises:
        HTTPException: If the user is not a member of the club.
    """
    membership = (
        db.query(ClubMembership)
        .filter(
            ClubMembership.user_id == payload.user_id,
            ClubMembership.club_id == payload.club_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    token = create_user_token(membership.user_id, membership.club_id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_build_me_out(membership),
    )


@app.get("/auth/me", response_model=MeOut)
def me(membership: ClubMembership = Depends(get_current_membership)) -> MeOut:
    """Return the current user and club context.

    Args:
        membership: The current club membership from the token.

    Returns:
        A MeOut combining user and club context.
    """
    return _build_me_out(membership)


@app.put("/auth/profile", response_model=MeOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    membership: ClubMembership = Depends(get_current_membership),
) -> MeOut:
    """Update the current user's display name, email, and heart emoji.

    display_name is per-club; email and heart_color are global to the user account.

    Args:
        payload: The fields to update.
        db: The database session.
        membership: The current user's club membership.

    Returns:
        The updated MeOut object.
    """
    membership.display_name = payload.display_name
    if payload.email is not None:
        membership.user.email = payload.email
    if payload.heart_color is not None:
        membership.user.heart_color = payload.heart_color
    db.commit()
    db.refresh(membership)
    return _build_me_out(membership)


@app.get("/users", response_model=list[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_global_admin),
) -> list[UserOut]:
    """Return all user accounts in the system (global admin only).

    Args:
        db: The database session.
        admin: The authenticated global admin user.

    Returns:
        A list of UserOut objects.
    """
    return db.query(User).all()
