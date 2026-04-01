from __future__ import annotations

import os
import random

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

load_dotenv()

from auth import create_user_token, get_current_user, hash_password, verify_club_password
from database import Base, SessionLocal, engine, get_db
from models import User
from routers import books, members, schedule
from schemas import EnterRequest, SelectRequest, TokenResponse, UserOut

# Heart emojis used when seeding the admin — must stay in sync with frontend config
HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]

app = FastAPI(title="Book Club API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(schedule.router, prefix="/dates", tags=["schedule"])
app.include_router(members.router, prefix="/members", tags=["members"])


def seed_admin(db: Session) -> None:
    """Create the default admin user if no users exist.

    Args:
        db: The database session to use for seeding.
    """
    if db.query(User).count() > 0:
        return

    username = os.getenv("ADMIN_USERNAME", "admin")
    club_password = os.getenv("CLUB_PASSWORD", "bookclub2026")

    admin = User(
        username=username,
        hashed_password=hash_password("unused-in-simple-auth"),
        role="admin",
        heart_color=random.choice(HEART_EMOJIS),
    )
    db.add(admin)
    db.commit()
    print(f"\n{'='*50}")
    print("Admin account created:")
    print(f"  Username : {username}")
    print(f"  Club password: {club_password}")
    print("Change CLUB_PASSWORD in your .env file before sharing!")
    print(f"{'='*50}\n")


@app.on_event("startup")
def startup() -> None:
    """Initialize the database and seed the admin user on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()


@app.post("/auth/enter", response_model=list[UserOut])
def enter(payload: EnterRequest, db: Session = Depends(get_db)) -> list[UserOut]:
    """Verify the club password and return the list of members to pick from.

    Args:
        payload: Contains the club password.
        db: The database session.

    Returns:
        A list of all users, ordered by username.

    Raises:
        HTTPException: If the club password is wrong.
    """
    if not verify_club_password(payload.password):
        raise HTTPException(status_code=401, detail="Wrong club password")
    users = db.query(User).order_by(User.username).all()
    return [UserOut.model_validate(u) for u in users]


@app.post("/auth/select", response_model=TokenResponse)
def select_user(payload: SelectRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Issue a session token for the selected user (no password required).

    Args:
        payload: Contains the user_id to select.
        db: The database session.

    Returns:
        A TokenResponse with an access token and user info.

    Raises:
        HTTPException: If the user_id does not exist.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_user_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@app.get("/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the currently authenticated user.

    Args:
        current_user: The authenticated user from the token.

    Returns:
        The current user's profile.
    """
    return UserOut.model_validate(current_user)
