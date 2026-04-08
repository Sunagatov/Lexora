from fastapi import APIRouter, HTTPException, Response, status
from jose import jwt
from pydantic import BaseModel

from app.shared.config import settings
from app.shared.deps import ALGORITHM

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    password: str

@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if payload.password != settings.app_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")
    token = jwt.encode({"sub": "owner"}, settings.secret_key, algorithm=ALGORITHM)
    response.set_cookie(key="session", value=token, httponly=True, secure=True, samesite="lax", max_age=settings.cookie_max_age)
    return {"ok": True}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie("session")
    return {"ok": True}
