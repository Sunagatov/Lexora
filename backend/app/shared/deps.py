import hmac
from collections.abc import Generator

from fastapi import Cookie, Header, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.shared.auth import (
    ALGORITHM,
    AUTH_TYPE_SESSION,
    ERROR_INVALID_CSRF_TOKEN,
    ERROR_INVALID_SESSION,
    ERROR_MISSING_CSRF_TOKEN,
    ERROR_NOT_AUTHENTICATED,
    SESSION_SUBJECT_OWNER,
    build_csrf_token,
)
from app.shared.config import settings
from app.shared.db import SessionLocal, ensure_database_schema
from app.shared.logging_utils import bind_request_context


def get_db() -> Generator[Session, None, None]:
    ensure_database_schema()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_session(
    request: Request,
    session: str | None = Cookie(default=None),
) -> None:
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=ERROR_NOT_AUTHENTICATED)
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("sub") != SESSION_SUBJECT_OWNER:
            raise JWTError("unexpected subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=ERROR_INVALID_SESSION)
    bind_request_context(subject=SESSION_SUBJECT_OWNER, auth_type=AUTH_TYPE_SESSION)
    request.state.subject = SESSION_SUBJECT_OWNER
    request.state.auth_type = AUTH_TYPE_SESSION


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")
