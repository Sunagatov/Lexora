import logging
from fastapi import testclient

from app.features.stats import router as stats_router
from app.features.stats.schemas import StatsResponse
from app.main import app
from app.shared.auth import SESSION_COOKIE_NAME, SESSION_SUBJECT_OWNER, build_csrf_token
from app.shared.config import settings
from app.shared.logging_utils import CORRELATION_ID_HEADER, REQUEST_ID_HEADER


def test_get_session_returns_csrf_token_when_authenticated():
    """GET /auth/session returns csrf_token when session cookie is valid."""
    from jose import jwt
    from datetime import datetime, timezone
    from app.shared.deps import ALGORITHM

    with testclient.TestClient(app) as client:
        # Create a valid session token
        now = int(datetime.now(timezone.utc).timestamp())
        valid_token = jwt.encode(
            {"sub": SESSION_SUBJECT_OWNER, "iat": now, "exp": now + 3600},
            settings.secret_key,
            algorithm=ALGORITHM,
        )

        client.cookies.set(SESSION_COOKIE_NAME, valid_token)
        response = client.get("/auth/session")

        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] is True
        assert "csrf_token" in data

        # Verify csrf_token matches expected format
        expected_csrf = build_csrf_token(settings.secret_key, valid_token)
        assert data["csrf_token"] == expected_csrf


def test_get_session_returns_401_when_no_session_cookie():
    """GET /auth/session returns 401 when session cookie is missing."""
    with testclient.TestClient(app) as client:
        response = client.get("/auth/session")

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"


def test_get_session_returns_401_when_session_invalid():
    """GET /auth/session returns 401 when session cookie is invalid."""
    with testclient.TestClient(app) as client:
        client.cookies.set(SESSION_COOKIE_NAME, "invalid_token_format")
        response = client.get("/auth/session")

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid session"


def test_request_logging_returns_request_headers_and_access_log(caplog):
    with caplog.at_level(logging.DEBUG, logger="http.access"):
        with testclient.TestClient(app) as client:
            response = client.get("/auth/session", headers={CORRELATION_ID_HEADER: "frontend-123"})

    assert response.headers[CORRELATION_ID_HEADER] == "frontend-123"
    assert response.headers[REQUEST_ID_HEADER]

    access_record = next(record for record in caplog.records if record.name == "http.access")
    assert access_record.event == "http_request_completed"
    assert access_record.correlation_id == "frontend-123"
    assert access_record.request_id == response.headers[REQUEST_ID_HEADER]
    assert access_record.path == "/auth/session"
    assert access_record.route == "/auth/session"
    assert access_record.status_code == 401
    assert access_record.authenticated is False
    assert access_record.outcome == "CLIENT_ERROR"


def test_request_logging_propagates_incoming_request_id() -> None:
    with testclient.TestClient(app) as client:
        response = client.get(
            "/auth/session",
            headers={REQUEST_ID_HEADER: "frontend-request-7"},
        )

    assert response.headers[REQUEST_ID_HEADER] == "frontend-request-7"


def test_successful_protected_request_does_not_emit_info_access_log(caplog, monkeypatch):
    from datetime import datetime, timezone

    from jose import jwt

    from app.shared.deps import ALGORITHM

    monkeypatch.setattr(stats_router, "compute_stats", lambda db: StatsResponse())

    now = int(datetime.now(timezone.utc).timestamp())
    valid_token = jwt.encode(
        {"sub": SESSION_SUBJECT_OWNER, "iat": now, "exp": now + 3600},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    csrf = build_csrf_token(settings.secret_key, valid_token)

    with caplog.at_level(logging.INFO):
        with testclient.TestClient(app) as client:
            client.cookies.set(SESSION_COOKIE_NAME, valid_token)
            response = client.get(
                "/api/stats",
                headers={
                    "x-csrf-token": csrf,
                    CORRELATION_ID_HEADER: "frontend-456",
                },
            )

    assert response.status_code == 200
    assert not any(
        record.name == "http.access" and getattr(record, "path", None) == "/api/stats"
        for record in caplog.records
    )


def test_client_error_request_does_not_emit_info_access_log_by_default(caplog) -> None:
    with caplog.at_level(logging.INFO):
        with testclient.TestClient(app) as client:
            response = client.get("/auth/session")

    assert response.status_code == 401
    assert not any(record.name == "http.access" for record in caplog.records)
