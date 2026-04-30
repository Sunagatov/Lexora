import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from jose import JWTError, jwt

from app.shared.auth import (
    ALGORITHM,
    AUTH_TYPE_SESSION,
    ERROR_INVALID_SESSION,
    ERROR_NOT_AUTHENTICATED,
    SESSION_COOKIE_NAME,
    SESSION_SUBJECT_OWNER,
    build_csrf_token,
)
from app.shared.config import settings
from app.shared.logging_utils import bind_request_context
from app.features.auth.schemas import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])

logger = logging.getLogger(__name__)

def _verify_session_token(session: str | None, request: Request | None = None) -> str:
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=ERROR_NOT_AUTHENTICATED)
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("sub") != SESSION_SUBJECT_OWNER:
            raise JWTError("unexpected subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=ERROR_INVALID_SESSION)
    bind_request_context(subject=SESSION_SUBJECT_OWNER, auth_type=AUTH_TYPE_SESSION)
    if request is not None:
        request.state.subject = SESSION_SUBJECT_OWNER
        request.state.auth_type = AUTH_TYPE_SESSION
    return session


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if not hmac.compare_digest(payload.password, settings.app_password):
        logger.warning(
            "auth.login.failed",
            extra={
                "event": "auth.login.failed",
                "reason": "wrong_password",
            },
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")

    now = int(datetime.now(timezone.utc).timestamp())
    token = jwt.encode(
        {"sub": SESSION_SUBJECT_OWNER, "iat": now, "exp": now + settings.cookie_max_age},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    csrf_token = build_csrf_token(settings.secret_key, token)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.cookie_max_age,
    )

    logger.info("auth.login.succeeded", extra={"event": "auth.login.succeeded"})
    return {"ok": True, "csrf_token": csrf_token}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE_NAME)
    logger.info("auth.logout.completed", extra={"event": "auth.logout.completed"})
    return {"ok": True}


@router.get("/session")
def get_session(request: Request, session: str | None = Cookie(default=None)) -> dict:
    token = _verify_session_token(session, request)
    return {"authenticated": True, "csrf_token": build_csrf_token(settings.secret_key, token)}
