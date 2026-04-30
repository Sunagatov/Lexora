from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from jose import jwt

from app.shared import deps
from app.shared.auth import (
    AUTH_TYPE_SESSION,
    ERROR_INVALID_CSRF_TOKEN,
    ERROR_INVALID_SESSION,
    ERROR_MISSING_CSRF_TOKEN,
    ERROR_NOT_AUTHENTICATED,
    SESSION_SUBJECT_OWNER,
    build_csrf_token,
)
from app.shared.config import settings
from app.shared.logging_utils import get_request_context, reset_request_context


def _make_session_token(sub: str = SESSION_SUBJECT_OWNER) -> str:
    return jwt.encode({"sub": sub}, settings.secret_key, algorithm=deps.ALGORITHM)


def _make_request() -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace())


def test_verify_session_accepts_valid_owner_token() -> None:
    reset_request_context()
    token = _make_session_token()
    request = _make_request()
    deps.verify_session(request=request, session=token)
    assert get_request_context()["subject"] == SESSION_SUBJECT_OWNER
    assert get_request_context()["auth_type"] == AUTH_TYPE_SESSION
    assert request.state.subject == SESSION_SUBJECT_OWNER
    assert request.state.auth_type == AUTH_TYPE_SESSION
    reset_request_context()


def test_verify_session_rejects_missing_cookie() -> None:
    with pytest.raises(HTTPException) as exc_info:
        deps.verify_session(request=_make_request(), session=None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == ERROR_NOT_AUTHENTICATED


def test_verify_session_rejects_wrong_subject() -> None:
    token = _make_session_token(sub="someone-else")

    with pytest.raises(HTTPException) as exc_info:
        deps.verify_session(request=_make_request(), session=token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == ERROR_INVALID_SESSION


def test_verify_csrf_accepts_matching_token() -> None:
    session = _make_session_token()
    csrf = build_csrf_token(settings.secret_key, session)

    deps.verify_csrf(session=session, x_csrf_token=csrf)


def test_verify_csrf_rejects_missing_values() -> None:
    with pytest.raises(HTTPException) as exc_info:
        deps.verify_csrf(session=None, x_csrf_token=None)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == ERROR_MISSING_CSRF_TOKEN


def test_verify_csrf_rejects_invalid_token() -> None:
    session = _make_session_token()

    with pytest.raises(HTTPException) as exc_info:
        deps.verify_csrf(session=session, x_csrf_token="wrong-token")

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == ERROR_INVALID_CSRF_TOKEN


def test_verify_api_key_accepts_matching_value() -> None:
    deps.verify_api_key(x_api_key=settings.api_key)


def test_verify_api_key_rejects_missing_or_invalid_value() -> None:
    with pytest.raises(HTTPException) as exc_info:
        deps.verify_api_key(x_api_key=None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or missing API key"


def test_get_db_yields_session_and_closes_it(monkeypatch) -> None:
    class FakeSession:
        def __init__(self) -> None:
            self.closed = False

        def close(self) -> None:
            self.closed = True

    fake_session = FakeSession()
    monkeypatch.setattr(deps, "SessionLocal", lambda: fake_session)

    generator = deps.get_db()
    yielded = next(generator)

    assert yielded is fake_session

    with pytest.raises(StopIteration):
        next(generator)

    assert fake_session.closed is True
