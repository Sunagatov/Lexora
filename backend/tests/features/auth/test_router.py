import hashlib

import pytest
from fastapi import HTTPException, Response
from jose import jwt

from app.features.auth.router import login, logout
from app.features.auth.schemas import LoginRequest
from app.shared.config import settings
from app.shared.deps import ALGORITHM


def test_login_returns_csrf_and_sets_session_cookie() -> None:
    response = Response()

    result = login(LoginRequest(password=settings.app_password), response)

    assert result["ok"] is True
    assert "set-cookie" in response.headers

    set_cookie = response.headers["set-cookie"]
    assert "session=" in set_cookie

    token = set_cookie.split("session=")[1].split(";")[0]
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])

    assert payload["sub"] == "owner"
    assert payload["exp"] > payload["iat"]

    expected_csrf = hashlib.sha256(f"{settings.secret_key}:{token}".encode()).hexdigest()
    assert result["csrf_token"] == expected_csrf


def test_login_rejects_wrong_password() -> None:
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(password="wrong-password"), response)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Wrong password"


def test_logout_deletes_session_cookie() -> None:
    response = Response()

    result = logout(response)

    assert result == {"ok": True}
    assert "set-cookie" in response.headers
    assert "session=" in response.headers["set-cookie"]