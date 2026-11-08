import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.features.auth.schemas import LoginRequest
from app.features.auth.service import (
    create_session,
    reserve_login_attempt,
    revoke_all_sessions,
    revoke_session,
)
from app.shared.auth import (
    AUTH_TYPE_SESSION,
    SESSION_COOKIE_NAME,
    SESSION_SUBJECT_OWNER,
    build_csrf_token,
)
from app.shared.config import settings
from app.shared.deps import get_auth_db, verify_csrf, verify_session
from app.shared.logging_utils import (
    bind_request_context,
    clear_request_context,
    get_request_context,
)

router = APIRouter(prefix="/auth", tags=["auth"])

logger = logging.getLogger(__name__)


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_auth_db)],
) -> dict:
    # Never let caller-supplied forwarding headers choose fresh throttle buckets.
    reserve_login_attempt(db, request.client.host if request.client else "unknown")
    if not hmac.compare_digest(payload.password.encode(), settings.app_password.encode()):
        logger.warning(
            "login_failed",
            extra={
                "event": "login_failed",
                "reason": "wrong_password",
            },
        )
        raise HTTPException(status_code=401, detail="Wrong password")

    token = create_session(db)
    csrf_token = build_csrf_token(settings.secret_key, token)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.cookie_max_age,
    )

    clear_context_after_log = "request_id" not in get_request_context()
    token_handle = bind_request_context(subject=SESSION_SUBJECT_OWNER, auth_type=AUTH_TYPE_SESSION)
    request.state.subject = SESSION_SUBJECT_OWNER
    request.state.auth_type = AUTH_TYPE_SESSION
    try:
        logger.info("login_succeeded", extra={"event": "login_succeeded"})
    finally:
        if clear_context_after_log:
            clear_request_context(token_handle)
    return {"ok": True, "csrf_token": csrf_token}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_auth_db)],
    session: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None),
) -> dict:
    if session is not None:
        # A deferred offline logout has cleared local CSRF storage. Its browser
        # still sends a trusted Origin; other callers must supply the CSRF token.
        origin = request.headers.get("origin")
        scheme = "https" if settings.cookie_secure else request.url.scheme
        same_origin = f"{scheme}://{request.url.netloc}"
        if origin != same_origin and origin not in settings.cors_allowed_origins:
            verify_csrf(session, x_csrf_token)
        revoke_session(db, session)
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        secure=settings.cookie_secure,
        httponly=settings.cookie_httponly,
        samesite=settings.cookie_samesite,
    )
    logger.debug("logout_completed", extra={"event": "logout_completed"})
    return {"ok": True}


@router.get("/session")
def get_session(token: str = Depends(verify_session)) -> dict:
    return {"authenticated": True, "csrf_token": build_csrf_token(settings.secret_key, token)}


@router.post("/logout-all", dependencies=[Depends(verify_session), Depends(verify_csrf)])
def logout_all(response: Response, db: Annotated[Session, Depends(get_auth_db)]) -> dict:
    revoke_all_sessions(db)
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        secure=settings.cookie_secure,
        httponly=settings.cookie_httponly,
        samesite=settings.cookie_samesite,
    )
    return {"ok": True}
