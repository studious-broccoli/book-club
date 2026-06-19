import os
from datetime import datetime, timedelta
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import ClubMembership, User

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


@lru_cache(maxsize=1)
def _fetch_jwks() -> list[dict]:
    """Fetch and cache the Supabase public JWKS for RS256 token verification."""
    with httpx.Client() as client:
        r = client.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=10)
        r.raise_for_status()
        return r.json()["keys"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer()


def get_supabase_admin_client():
    """Return a Supabase client authenticated as the service role.

    Used for admin operations such as inviting users by email.

    Returns:
        A Supabase Client instance.

    Raises:
        HTTPException: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.
    """
    from supabase import create_client
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase admin not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_NO_PASSWORD_SENTINEL = "unused"


def hash_password(password: str) -> str:
    """Hash a password with bcrypt.

    Args:
        password: The plaintext password.

    Returns:
        A bcrypt hash string.
    """
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Args:
        plain: The plaintext password to check.
        hashed: The stored bcrypt hash.

    Returns:
        True if the password matches, False otherwise.
    """
    return _pwd_context.verify(plain, hashed)


def user_has_password(user: User) -> bool:
    """Return whether the user has set a personal login password.

    Args:
        user: The user to check.

    Returns:
        True if a real password hash is stored.
    """
    return bool(user.hashed_password) and user.hashed_password != _NO_PASSWORD_SENTINEL


def set_no_password(user: User) -> None:
    """Clear the user's personal password, restoring the sentinel value.

    Args:
        user: The user whose password should be cleared.
    """
    user.hashed_password = _NO_PASSWORD_SENTINEL


def create_user_token(user_id: int, club_id: int) -> str:
    """Create a signed JWT token encoding both user and club context.

    Args:
        user_id: The ID of the authenticated user.
        club_id: The ID of the club the session is scoped to.

    Returns:
        A signed JWT string.
    """
    payload = {
        "sub": str(user_id),
        "club_id": club_id,
        "exp": datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> tuple[int, int]:
    """Decode a legacy JWT and return (user_id, club_id).

    Args:
        token: The raw JWT string.

    Returns:
        A tuple of (user_id, club_id).

    Raises:
        HTTPException: If the token is invalid or missing required fields.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        club_id = payload.get("club_id")
        if user_id is None or club_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return int(user_id), int(club_id)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def _is_supabase_token(token: str) -> bool:
    """Return True if the token appears to be a Supabase-issued JWT.

    Peeks at the unverified audience claim without validating the signature.

    Args:
        token: The raw JWT string.

    Returns:
        True if the token's aud claim is 'authenticated'.
    """
    try:
        claims = jwt.get_unverified_claims(token)
        return claims.get("aud") == "authenticated"
    except Exception:
        return False


def create_registration_token(club_id: int) -> str:
    """Create a short-lived signed token encoding a club registration intent.

    Args:
        club_id: The club the user is registering for.

    Returns:
        A signed JWT string valid for 15 minutes.
    """
    payload = {
        "type": "reg",
        "club_id": club_id,
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_registration_token(token: str) -> int:
    """Verify a registration token and return the club_id.

    Args:
        token: The raw registration token string.

    Returns:
        The club_id encoded in the token.

    Raises:
        HTTPException: If the token is invalid, expired, or wrong type.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration token expired or invalid")
    if payload.get("type") != "reg" or payload.get("club_id") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid registration token")
    return int(payload["club_id"])


def decode_supabase_token(token: str) -> tuple[str, str]:
    """Verify a Supabase JWT and return (supabase_uid, email).

    Auto-detects HS256 (uses SUPABASE_JWT_SECRET) vs RS256 (fetches JWKS from
    the Supabase project URL). Validates signature, expiration, audience, and
    email confirmation.

    Args:
        token: The raw Supabase JWT string.

    Returns:
        A tuple of (supabase_uid, normalized email).

    Raises:
        HTTPException: If the token is invalid, expired, or the email is unverified.
    """
    if not SUPABASE_URL:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase auth not configured")
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "RS256")
        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SUPABASE_JWT_SECRET not set")
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        else:
            keys = _fetch_jwks()
            kid = header.get("kid")
            key = next((k for k in keys if k.get("kid") == kid), keys[0])
            payload = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    supabase_uid: str | None = payload.get("sub")
    email: str = (payload.get("email") or "").lower().strip()
    user_metadata: dict = payload.get("user_metadata") or {}
    email_verified: bool = bool(
        payload.get("email_confirmed_at")          # legacy HS256 tokens
        or user_metadata.get("email_verified")     # new RS256 tokens
    )

    if not supabase_uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    return supabase_uid, email


def get_current_membership(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> ClubMembership:
    """Resolve the current user's club membership from the Bearer token.

    Supports both legacy JWTs (club_id embedded in token) and Supabase JWTs
    (identity only; club scoped via X-Club-Id request header).

    Args:
        request: The incoming HTTP request, used to read X-Club-Id header.
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The ClubMembership for the current user and club.

    Raises:
        HTTPException: If the token is invalid, the membership is not found,
            or X-Club-Id is missing when using a Supabase token.
    """
    token = credentials.credentials

    if _is_supabase_token(token):
        supabase_uid, email = decode_supabase_token(token)

        club_id_header = request.headers.get("X-Club-Id")
        if not club_id_header:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Club-Id header required")
        try:
            club_id = int(club_id_header)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Club-Id header")

        user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not provisioned")

        # Sync email if it changed in Supabase
        if email and user.email != email:
            user.email = email
            db.commit()

        user_id = user.id
    else:
        user_id, club_id = _decode_token(token)

    membership = (
        db.query(ClubMembership)
        .filter(ClubMembership.user_id == user_id, ClubMembership.club_id == club_id)
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Membership not found")
    return membership


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> int:
    """Extract the user_id from the token (no club check).

    Used for endpoints that need to work across clubs, like listing all clubs
    a user belongs to. Supports both legacy and Supabase tokens.

    Args:
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The authenticated user's ID.
    """
    token = credentials.credentials
    if _is_supabase_token(token):
        supabase_uid, _ = decode_supabase_token(token)
        user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not provisioned")
        return user.id
    user_id, _ = _decode_token(token)
    return user_id


def require_club_admin(
    membership: ClubMembership = Depends(get_current_membership),
) -> ClubMembership:
    """Dependency that enforces club-admin role.

    Args:
        membership: The current user's club membership.

    Returns:
        The membership if the user is a club admin.

    Raises:
        HTTPException: If the user is not an admin of the current club.
    """
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Club admin access required")
    return membership


def require_global_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that enforces the global admin role (for creating clubs).

    Supports both legacy and Supabase tokens.

    Args:
        credentials: The HTTP Authorization header credentials.
        db: The database session.

    Returns:
        The User if they have the global admin role.

    Raises:
        HTTPException: If the user is not a global admin.
    """
    token = credentials.credentials
    if _is_supabase_token(token):
        supabase_uid, _ = decode_supabase_token(token)
        user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
        if not user or user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Global admin access required")
        return user
    user_id, _ = _decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Global admin access required")
    return user
