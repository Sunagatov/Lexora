import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from app.features.auth.router import login, logout
from app.features.auth.schemas import LoginRequest
from app.features.auth.service import authenticate_session
from app.shared.auth import SESSION_COOKIE_NAME, build_csrf_token
from app.shared.config import settings


def _make_request() -> Request:
    return Request({"type": "http", "headers": [], "state": {}})


def test_login_returns_csrf_and_sets_session_cookie(auth_db) -> None:
    response = Response()

    result = login(LoginRequest(password=settings.app_password), _make_request(), response, auth_db)

    assert result["ok"] is True
    assert "set-cookie" in response.headers

    set_cookie = response.headers["set-cookie"]
    assert f"{SESSION_COOKIE_NAME}=" in set_cookie

    token = set_cookie.split(f"{SESSION_COOKIE_NAME}=")[1].split(";")[0]
    assert authenticate_session(auth_db, token) == token

    expected_csrf = build_csrf_token(settings.secret_key, token)
    assert result["csrf_token"] == expected_csrf


def test_login_rejects_wrong_password(auth_db) -> None:
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(password="wrong-password"), _make_request(), response, auth_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Wrong password"


def test_logout_deletes_session_cookie(auth_db) -> None:
    response = Response()

    result = logout(_make_request(), response, session=None, x_csrf_token=None, db=auth_db)

    assert result == {"ok": True}
    assert "set-cookie" in response.headers
    assert f"{SESSION_COOKIE_NAME}=" in response.headers["set-cookie"]
