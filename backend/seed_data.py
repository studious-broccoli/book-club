"""One-time seed script to populate the database with initial clubs and members.

Run from the backend directory:
    python seed_data.py

This will wipe any existing data and recreate everything fresh.
"""

from __future__ import annotations

import os
import random
import sys

from dotenv import load_dotenv

load_dotenv()

from database import Base, SessionLocal, engine
from models import Club, ClubMembership, User

HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"]

CLUB_PASSWORD = os.getenv("CLUB_PASSWORD", "bookclub2026")


def run() -> None:
    """Drop all tables, recreate schema, and insert seed data."""
    print("Dropping and recreating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Clubs ────────────────────────────────────────────────────────────
        sister = Club(name="Sister Book Club", password=CLUB_PASSWORD)
        big_books = Club(name="We Like Big Books and We Cannot Lie", password=CLUB_PASSWORD)
        db.add_all([sister, big_books])
        db.flush()

        # ── Users ────────────────────────────────────────────────────────────
        used_emojis: list[str] = []

        def pick_emoji() -> str:
            remaining = [e for e in HEART_EMOJIS if e not in used_emojis]
            choice = random.choice(remaining if remaining else HEART_EMOJIS)
            used_emojis.append(choice)
            return choice

        arianna = User(username="arianna", hashed_password="unused", role="admin", heart_color=pick_emoji())
        amanda   = User(username="amanda",   hashed_password="unused", role="member", heart_color=pick_emoji())
        camila   = User(username="camila",   hashed_password="unused", role="member", heart_color=pick_emoji())
        carissa  = User(username="carissa",  hashed_password="unused", role="member", heart_color=pick_emoji())
        rhianna  = User(username="rhianna",  hashed_password="unused", role="member", heart_color=pick_emoji())

        db.add_all([arianna, amanda, camila, carissa, rhianna])
        db.flush()

        # ── Memberships ──────────────────────────────────────────────────────
        # Sister Book Club: Arianna (admin), Amanda, Camila, Carissa
        db.add_all([
            ClubMembership(user_id=arianna.id, club_id=sister.id, display_name="Arianna", role="admin"),
            ClubMembership(user_id=amanda.id,  club_id=sister.id, display_name="Amanda",  role="member"),
            ClubMembership(user_id=camila.id,  club_id=sister.id, display_name="Camila",  role="member"),
            ClubMembership(user_id=carissa.id, club_id=sister.id, display_name="Carissa", role="member"),
        ])

        # We Like Big Books: Arianna (admin), Rhianna
        db.add_all([
            ClubMembership(user_id=arianna.id, club_id=big_books.id, display_name="Arianna", role="admin"),
            ClubMembership(user_id=rhianna.id, club_id=big_books.id, display_name="Rhianna", role="member"),
        ])

        db.commit()

        print("\nDone! Here's what was created:")
        print(f"\n  Club 1 : Sister Book Club")
        print(f"    Members: Arianna (admin), Amanda, Camila, Carissa")
        print(f"\n  Club 2 : We Like Big Books and We Cannot Lie")
        print(f"    Members: Arianna (admin), Rhianna")
        print(f"\n  Password for both clubs: {CLUB_PASSWORD}")
        print(f"  (Change CLUB_PASSWORD in backend/.env to update)\n")

    finally:
        db.close()


if __name__ == "__main__":
    run()
