import hashlib
import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from jose import JWTError, jwt

from app.shared.config import settings
from app.shared.deps import ALGORITHM
from app.features.auth.schemas import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])

logger = logging.getLogger(__name__)


def _build_csrf_token(token: str) -> str:
    return hashlib.sha256(f"{settings.secret_key}:{token}".encode()).hexdigest()


def _verify_session_token(session: str | None) -> str:
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("sub") != "owner":
            raise JWTError("unexpected subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return session


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if not hmac.compare_digest(payload.password, settings.app_password):
        logger.warning("auth.login.failed: reason=wrong_password")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")

    now = int(datetime.now(timezone.utc).timestamp())
    token = jwt.encode(
        {"sub": "owner", "iat": now, "exp": now + settings.cookie_max_age},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    csrf_token = _build_csrf_token(token)

    response.set_cookie(
        key="session",
        value=token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.cookie_max_age,
    )

    logger.info("auth.login.succeeded")
    return {"ok": True, "csrf_token": csrf_token}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie("session")
    logger.info("auth.logout.completed")
    return {"ok": True}


@router.get("/session")
def get_session(session: str | None = Cookie(default=None)) -> dict:
    token = _verify_session_token(session)
    return {"authenticated": True, "csrf_token": _build_csrf_token(token)}
