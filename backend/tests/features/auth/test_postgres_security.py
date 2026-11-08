"""Optional integration check against a disposable, loopback-only test Postgres."""

import os
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.auth import service
from app.shared.config import settings
from tests.test_auth_migration import auth_migration


def test_postgres_atomic_limits_and_cross_connection_revocation(monkeypatch):
    port = os.environ.get("LEXORA_AUTH_TEST_POSTGRES_PORT")
    if not port:
        pytest.skip("Disposable PostgreSQL port not supplied")
    assert port.isdecimal() and 1024 <= int(port) <= 65535
    engine = create_engine(
        f"postgresql+psycopg://lexora_auth_test:local-test-only@127.0.0.1:{port}/lexora_auth_test"
    )
    with engine.begin() as connection:
        auth_migration(connection).upgrade()
    monkeypatch.setattr(settings, "auth_login_attempts_per_ip", 3)
    monkeypatch.setattr(settings, "auth_login_attempts_global", 8)

    def attempt(_):
        with Session(engine) as db:
            try:
                service.reserve_login_attempt(db, "same-peer")
                return 200
            except HTTPException as error:
                return error.status_code

    try:
        with ThreadPoolExecutor(max_workers=12) as workers:
            results = list(workers.map(attempt, range(20)))
        assert results.count(200) == 3 and results.count(429) == 17
        with Session(engine) as issuing, Session(engine) as checking, Session(engine) as revoking:
            first, second = service.create_session(issuing), service.create_session(issuing)
            assert service.authenticate_session(checking, first) == first
            service.revoke_session(revoking, first)
            with pytest.raises(HTTPException) as error:
                service.authenticate_session(checking, first)
            assert error.value.status_code == 401
            assert service.authenticate_session(checking, second) == second
            service.revoke_all_sessions(revoking)
            with pytest.raises(HTTPException):
                service.authenticate_session(checking, second)
    finally:
        with engine.begin() as connection:
            auth_migration(connection).downgrade()
        engine.dispose()
