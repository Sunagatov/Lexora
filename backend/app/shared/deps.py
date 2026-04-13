import hmac
from collections.abc import Generator

from fastapi import Cookie, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.shared.db import SessionLocal

ALGORITHM = "HS256"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_session(session: str | None = Cookie(default=None)) -> None:
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("sub") != "owner":
            raise JWTError("unexpected subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if x_api_key is None or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")
