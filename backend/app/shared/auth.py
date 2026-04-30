from __future__ import annotations

import hashlib

ALGORITHM = "HS256"

SESSION_COOKIE_NAME = "session"
CSRF_HEADER_NAME = "X-CSRF-Token"
SESSION_SUBJECT_OWNER = "owner"
AUTH_TYPE_SESSION = "session"

ERROR_NOT_AUTHENTICATED = "Not authenticated"
ERROR_INVALID_SESSION = "Invalid session"
ERROR_MISSING_CSRF_TOKEN = "Missing CSRF token"
ERROR_INVALID_CSRF_TOKEN = "Invalid CSRF token"


def build_csrf_token(secret_key: str, token: str) -> str:
    return hashlib.sha256(f"{secret_key}:{token}".encode()).hexdigest()
