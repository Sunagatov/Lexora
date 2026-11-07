import hmac
import re
import secrets
import time

from fastapi import HTTPException
from sqlalchemy import case, delete, or_, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.features.auth.model import AuthSession, LoginAttemptBucket
from app.shared.auth import ERROR_INVALID_SESSION, ERROR_NOT_AUTHENTICATED
from app.shared.config import settings


def _credential_key() -> bytes:
    return hmac.digest(settings.secret_key.encode(), settings.app_password.encode(), "sha256")


def _session_hash(token: str) -> str:
    # Neither the bearer token nor the password is stored in the session table.
    return hmac.digest(_credential_key(), token.encode(), "sha256").hex()


def _credential_tag() -> str:
    return hmac.digest(_credential_key(), b"session-credential-tag", "sha256").hex()


def _is_session_token(token: str) -> bool:
    return re.fullmatch(r"[A-Za-z0-9_-]{43}", token) is not None


def authenticate_session(db: Session, token: str | None) -> str:
    if token is None:
        raise HTTPException(status_code=401, detail=ERROR_NOT_AUTHENTICATED)
    if (
        not _is_session_token(token)
        or db.scalar(
            select(AuthSession.token_hash).where(
                AuthSession.token_hash == _session_hash(token),
                AuthSession.expires_at > int(time.time()),
            )
        )
        is None
    ):
        raise HTTPException(status_code=401, detail=ERROR_INVALID_SESSION)
    return token


def purge_stale_sessions(db: Session) -> None:
    db.execute(
        delete(AuthSession).where(
            or_(
                AuthSession.expires_at <= int(time.time()),
                AuthSession.credential_tag != _credential_tag(),
            )
        )
    )


def create_session(db: Session) -> str:
    now = int(time.time())
    purge_stale_sessions(db)
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            token_hash=_session_hash(token),
            credential_tag=_credential_tag(),
            expires_at=now + settings.cookie_max_age,
        )
    )
    db.commit()
    return token


def revoke_session(db: Session, token: str | None) -> None:
    if token is not None and _is_session_token(token):
        db.execute(delete(AuthSession).where(AuthSession.token_hash == _session_hash(token)))
        db.commit()


def revoke_all_sessions(db: Session) -> None:
    db.execute(delete(AuthSession))
    db.commit()


def _consume_attempt(db: Session, key: str, limit: int, now: int) -> int | None:
    bucket = LoginAttemptBucket
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else postgres_insert
    statement = (
        insert(bucket)
        .values(key=key, attempts=1, resets_at=now + settings.auth_login_window_seconds)
        .on_conflict_do_update(
            index_elements=[bucket.key],
            set_={
                "attempts": case((bucket.resets_at <= now, 1), else_=bucket.attempts + 1),
                "resets_at": case(
                    (bucket.resets_at <= now, now + settings.auth_login_window_seconds),
                    else_=bucket.resets_at,
                ),
            },
            where=or_(bucket.resets_at <= now, bucket.attempts < limit),
        )
        .returning(bucket.resets_at)
    )
    return db.scalar(statement)


def reserve_login_attempt(db: Session, peer: str) -> None:
    now = int(time.time())
    peer_key = hmac.digest(settings.secret_key.encode(), peer.encode(), "sha256").hex()
    # Reserve the owner-wide allowance first, bounding distributed attempts and
    # the number of per-peer rows. Every worker uses the same atomic counters.
    for key, limit in (
        ("owner", settings.auth_login_attempts_global),
        (peer_key, settings.auth_login_attempts_per_ip),
    ):
        if _consume_attempt(db, key, limit, now) is None:
            resets_at = db.scalar(
                select(LoginAttemptBucket.resets_at).where(LoginAttemptBucket.key == key)
            )
            db.commit()
            retry_after = max(1, (resets_at or now + 1) - now)
            raise HTTPException(
                status_code=429,
                detail=f"Too many sign-in attempts. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
    db.execute(delete(LoginAttemptBucket).where(LoginAttemptBucket.resets_at <= now))
    db.commit()
