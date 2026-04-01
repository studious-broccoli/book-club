from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = "sqlite:///./bookclub.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    """Yield a database session and close it when done.

    Yields:
        A SQLAlchemy session bound to the local SQLite database.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
