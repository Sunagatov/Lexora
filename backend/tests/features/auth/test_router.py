import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request
from jose import jwt

from app.features.auth.router import login, logout
from app.features.auth.schemas import LoginRequest
from app.shared.auth import SESSION_COOKIE_NAME, SESSION_SUBJECT_OWNER, build_csrf_token
from app.shared.config import settings
from app.shared.deps import ALGORITHM


def _make_request() -> Request:
    return Request({"type": "http", "headers": [], "state": {}})


def test_login_returns_csrf_and_sets_session_cookie() -> None:
    response = Response()

    result = login(LoginRequest(password=settings.app_password), _make_request(), response)

    assert result["ok"] is True
    assert "set-cookie" in response.headers

    set_cookie = response.headers["set-cookie"]
    assert f"{SESSION_COOKIE_NAME}=" in set_cookie

    token = set_cookie.split(f"{SESSION_COOKIE_NAME}=")[1].split(";")[0]
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])

    assert payload["sub"] == SESSION_SUBJECT_OWNER
    assert payload["exp"] > payload["iat"]

    expected_csrf = build_csrf_token(settings.secret_key, token)
    assert result["csrf_token"] == expected_csrf


def test_login_rejects_wrong_password() -> None:
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(password="wrong-password"), _make_request(), response)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Wrong password"


def test_logout_deletes_session_cookie() -> None:
    response = Response()

    result = logout(response)

    assert result == {"ok": True}
    assert "set-cookie" in response.headers
    assert f"{SESSION_COOKIE_NAME}=" in response.headers["set-cookie"]
