import hashlib
from fastapi import testclient

from app.main import app
from app.shared.config import settings


def test_get_session_returns_csrf_token_when_authenticated():
    """GET /auth/session returns csrf_token when session cookie is valid."""
    from jose import jwt
    from datetime import datetime, timezone
    from app.shared.deps import ALGORITHM

    client = testclient.TestClient(app)

    # Create a valid session token
    now = int(datetime.now(timezone.utc).timestamp())
    valid_token = jwt.encode(
        {"sub": "owner", "iat": now, "exp": now + 3600},
        settings.secret_key,
        algorithm=ALGORITHM,
    )

    # Make request with session cookie
    response = client.get(
        "/auth/session",
        cookies={"session": valid_token}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert "csrf_token" in data

    # Verify csrf_token matches expected format
    expected_csrf = hashlib.sha256(f"{settings.secret_key}:{valid_token}".encode()).hexdigest()
    assert data["csrf_token"] == expected_csrf


def test_get_session_returns_401_when_no_session_cookie():
    """GET /auth/session returns 401 when session cookie is missing."""
    client = testclient.TestClient(app)

    response = client.get("/auth/session")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_get_session_returns_401_when_session_invalid():
    """GET /auth/session returns 401 when session cookie is invalid."""
    client = testclient.TestClient(app)

    response = client.get(
        "/auth/session",
        cookies={"session": "invalid_token_format"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid session"
