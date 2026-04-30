import hashlib
import logging
from fastapi import testclient

from app.main import app
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
            {"sub": "owner", "iat": now, "exp": now + 3600},
            settings.secret_key,
            algorithm=ALGORITHM,
        )

        client.cookies.set("session", valid_token)
        response = client.get("/auth/session")

        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] is True
        assert "csrf_token" in data

        # Verify csrf_token matches expected format
        expected_csrf = hashlib.sha256(f"{settings.secret_key}:{valid_token}".encode()).hexdigest()
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
        client.cookies.set("session", "invalid_token_format")
        response = client.get("/auth/session")

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid session"


def test_request_logging_returns_request_headers_and_access_log(caplog):
    with caplog.at_level(logging.INFO):
        with testclient.TestClient(app) as client:
            response = client.get("/auth/session", headers={CORRELATION_ID_HEADER: "frontend-123"})

    assert response.headers[CORRELATION_ID_HEADER] == "frontend-123"
    assert response.headers[REQUEST_ID_HEADER]

    access_record = next(record for record in caplog.records if record.name == "http.access")
    assert access_record.event == "http.request.completed"
    assert access_record.correlation_id == "frontend-123"
    assert access_record.request_id == response.headers[REQUEST_ID_HEADER]
    assert access_record.path == "/auth/session"
    assert access_record.route == "/auth/session"
    assert access_record.status_code == 401
    assert access_record.outcome == "CLIENT_ERROR"
