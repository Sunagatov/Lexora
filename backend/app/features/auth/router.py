import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Response, status
from jose import jwt

from app.shared.config import settings
from app.shared.deps import ALGORITHM
from app.features.auth.schemas import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if not hmac.compare_digest(payload.password, settings.app_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")
    now = int(datetime.now(timezone.utc).timestamp())
    token = jwt.encode(
        {"sub": "owner", "iat": now, "exp": now + settings.cookie_max_age},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    csrf_token = hashlib.sha256(f"{settings.secret_key}:{token}".encode()).hexdigest()
    response.set_cookie(
        key="session", value=token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.cookie_max_age,
    )
    return {"ok": True, "csrf_token": csrf_token}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie("session")
    return {"ok": True}
