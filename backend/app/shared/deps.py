import hmac
from collections.abc import Generator
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.features.auth.service import authenticate_session
from app.features.languages.catalog import configure_language
from app.shared.auth import (
    AUTH_TYPE_SESSION,
    ERROR_INVALID_CSRF_TOKEN,
    ERROR_MISSING_CSRF_TOKEN,
    SESSION_SUBJECT_OWNER,
    build_csrf_token,
)
from app.shared.config import settings
from app.shared.db import SessionLocal, ensure_database_schema
from app.shared.logging_utils import bind_request_context


def get_db(request: Request = None) -> Generator[Session, None, None]:
    ensure_database_schema()
    db = SessionLocal()
    try:
        configure_language(
            db,
            request.headers.get("X-Lexora-Language", "en") if request else "en",
            request.headers.get("X-Lexora-Translation-Language", "ru") if request else "ru",
        )
        yield db
    finally:
        db.close()


def get_auth_db() -> Generator[Session, None, None]:
    # Auth does not configure a learning language or touch vocabulary tables.
    from app.shared import db

    db.ensure_database_schema()
    with db.SessionLocal() as session:
        try:
            yield session
        except SQLAlchemyError:
            session.rollback()
            raise HTTPException(status_code=503, detail="Sign-in service is unavailable") from None


def verify_session(
    request: Request,
    db: Annotated[Session, Depends(get_auth_db)],
    session: str | None = Cookie(default=None),
) -> str:
    try:
        token = authenticate_session(db, session)
    finally:
        # Release the read connection before a feature obtains its own session.
        # Auth and vocabulary requests must not hold two pooled connections.
        db.rollback()
    bind_request_context(subject=SESSION_SUBJECT_OWNER, auth_type=AUTH_TYPE_SESSION)
    request.state.subject = SESSION_SUBJECT_OWNER
    request.state.auth_type = AUTH_TYPE_SESSION
    return token


def verify_csrf(
    session: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None),
) -> None:
    if session is None or x_csrf_token is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=ERROR_MISSING_CSRF_TOKEN)
    expected = build_csrf_token(settings.secret_key, session)
    if not hmac.compare_digest(expected, x_csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=ERROR_INVALID_CSRF_TOKEN)


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if x_api_key is None or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key"
        )
