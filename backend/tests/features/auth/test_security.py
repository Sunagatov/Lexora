from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.features.auth import service
from app.features.auth.model import AuthSession, LoginAttemptBucket
from app.features.auth.router import router
from app.shared.auth import build_csrf_token
from app.shared.config import Settings, settings
from app.shared.deps import verify_csrf, verify_session


@pytest.fixture
def auth_app():
    app = FastAPI()
    app.include_router(router)

    @app.get("/protected", dependencies=[Depends(verify_session), Depends(verify_csrf)])
    def protected():
        return {"ok": True}

    return app


def browser(app, peer="203.0.113.1"):
    return TestClient(app, base_url="https://lexora.zuf.uk", client=(peer, 1234))


def sign_in(client, password=None):
    response = client.post("/auth/login", json={"password": password or settings.app_password})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return client.cookies.get("session")


def test_logout_revokes_a_copied_cookie_but_preserves_another_device(auth_app, auth_db):
    first, second, copied = browser(auth_app), browser(auth_app), browser(auth_app)
    token = sign_in(first)
    assert sign_in(second) != token
    copied.cookies.set("session", token)
    copied.headers["X-CSRF-Token"] = first.headers["X-CSRF-Token"]
    assert copied.get("/protected").status_code == 200

    assert first.post("/auth/logout").status_code == 200
    assert copied.get("/auth/session").status_code == 401
    assert copied.get("/protected").status_code == 401
    assert second.get("/protected").status_code == 200
    assert auth_db.scalar(select(func.count()).select_from(AuthSession)) == 1
    assert first.post("/auth/logout").status_code == 200


def test_logout_all_revokes_every_previous_device_and_allows_fresh_login(auth_app):
    first, second = browser(auth_app), browser(auth_app)
    first_token, second_token = sign_in(first), sign_in(second)
    assert first.post("/auth/logout-all").status_code == 200
    for token in (first_token, second_token):
        copied = browser(auth_app)
        copied.cookies.set("session", token)
        assert copied.get("/auth/session").status_code == 401
        assert copied.get("/protected").status_code == 401
    assert sign_in(first) not in (first_token, second_token)
    assert first.get("/protected").status_code == 200


@pytest.mark.parametrize("csrf", [None, "wrong"])
def test_logout_all_requires_csrf_and_keeps_sessions_on_failure(auth_app, csrf):
    client = browser(auth_app)
    sign_in(client)
    client.headers.pop("X-CSRF-Token")
    if csrf:
        client.headers["X-CSRF-Token"] = csrf
    assert client.post("/auth/logout-all").status_code == 403
    assert client.get("/auth/session").status_code == 200


def test_cross_site_logout_cannot_revoke_a_session(auth_app):
    client = browser(auth_app)
    sign_in(client)
    client.headers.pop("X-CSRF-Token")
    assert (
        client.post("/auth/logout", headers={"Origin": "https://attacker.example"}).status_code
        == 403
    )
    assert client.get("/auth/session").status_code == 200


def test_deferred_same_origin_logout_works_after_local_csrf_is_cleared(auth_app):
    client = browser(auth_app)
    token = sign_in(client)
    client.headers.pop("X-CSRF-Token")
    assert (
        client.post("/auth/logout", headers={"Origin": "https://lexora.zuf.uk"}).status_code == 200
    )
    client.cookies.set("session", token)
    assert client.get("/auth/session").status_code == 401


@pytest.mark.parametrize("setting", ["app_password", "secret_key"])
def test_credential_change_invalidates_existing_sessions(auth_app, monkeypatch, setting):
    client = browser(auth_app)
    sign_in(client)
    monkeypatch.setattr(settings, setting, "changed-test-value")
    assert client.get("/auth/session").status_code == 401
    assert client.get("/protected").status_code == 401
    sign_in(client)
    assert client.get("/protected").status_code == 200


def test_old_password_and_unicode_inputs_are_handled_safely(auth_app, monkeypatch):
    monkeypatch.setattr(settings, "app_password", "длинный-тестовый-пароль")
    client = browser(auth_app)
    assert client.post("/auth/login", json={"password": "неверный"}).status_code == 401
    sign_in(client)
    assert client.get("/protected").status_code == 200


def test_configuration_rejects_passwords_the_form_cannot_send():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None, app_password="a" * 1025, secret_key="test-only", api_key="test-only"
        )


@pytest.mark.parametrize("setting", ["app_password", "secret_key"])
def test_credential_reuse_does_not_resurrect_sessions_after_restart(
    auth_app, auth_db, monkeypatch, setting
):
    from app.main import app

    client = browser(auth_app)
    token = sign_in(client)
    original = getattr(settings, setting)
    monkeypatch.setattr(settings, setting, "replacement-test-only")
    # Exercise real startup cleanup, as when restarting after a config change.
    with TestClient(app):
        pass
    monkeypatch.setattr(settings, setting, original)
    client.cookies.set("session", token)
    assert client.get("/auth/session").status_code == 401
    assert auth_db.scalar(select(func.count()).select_from(AuthSession)) == 0


def test_deferred_logout_supports_same_origin_custom_installations(auth_app):
    client = TestClient(auth_app, base_url="https://custom.example")
    token = sign_in(client)
    client.headers.pop("X-CSRF-Token")
    assert (
        client.post("/auth/logout", headers={"Origin": "https://custom.example"}).status_code == 200
    )
    client.cookies.set("session", token)
    assert client.get("/auth/session").status_code == 401


def test_auth_read_releases_the_connection_before_feature_queries(auth_app, tmp_path, monkeypatch):
    from app.shared import db as database

    engine = create_engine(
        f"sqlite:///{tmp_path / 'pool.sqlite'}",
        pool_size=1,
        max_overflow=0,
        pool_timeout=0.2,
        connect_args={"check_same_thread": False},
    )
    AuthSession.__table__.create(engine)
    monkeypatch.setattr(database, "SessionLocal", lambda: Session(engine))

    def feature_db():
        with Session(engine) as db:
            yield db

    @auth_app.get("/pool-check", dependencies=[Depends(verify_session), Depends(verify_csrf)])
    def pool_check(db: Annotated[Session, Depends(feature_db)]):
        return {"sessions": db.scalar(select(func.count()).select_from(AuthSession))}

    try:
        with Session(engine) as db:
            token = service.create_session(db)
        client = browser(auth_app)
        client.cookies.set("session", token)
        client.headers["X-CSRF-Token"] = build_csrf_token(settings.secret_key, token)
        response = client.get("/pool-check")
        assert response.status_code == 200
        assert response.json() == {"sessions": 1}
    finally:
        engine.dispose()


def test_auth_storage_failure_never_grants_access_or_sets_a_cookie(auth_app, monkeypatch, auth_db):
    from app.shared import db as database

    token = service.create_session(auth_db)
    empty = create_engine("sqlite://")
    monkeypatch.setattr(database, "SessionLocal", lambda: Session(empty))
    client = browser(auth_app)
    try:
        login = client.post("/auth/login", json={"password": settings.app_password})
        assert login.status_code == 503 and "set-cookie" not in login.headers
        client.cookies.set("session", token)
        client.headers["X-CSRF-Token"] = build_csrf_token(settings.secret_key, token)
        assert client.get("/auth/session").status_code == 503
        assert client.get("/protected").status_code == 503
    finally:
        empty.dispose()


def test_session_table_contains_only_token_hashes(auth_app, auth_db):
    token = sign_in(browser(auth_app))
    row = auth_db.scalar(select(AuthSession))
    assert len(token) == 43
    assert len(row.token_hash) == 64 and row.token_hash != token
    assert row.expires_at > service.time.time()


def test_expiry_is_enforced_at_the_exact_boundary(auth_app, monkeypatch):
    clock = [1000]
    monkeypatch.setattr(service, "time", SimpleNamespace(time=lambda: clock[0]))
    client = browser(auth_app)
    sign_in(client)
    clock[0] += settings.cookie_max_age - 1
    assert client.get("/auth/session").status_code == 200
    clock[0] += 1
    assert client.get("/auth/session").status_code == 401
    assert client.get("/protected").status_code == 401


@pytest.mark.parametrize("token", ["invalid", "a" * 43, "пароль", "a" * 10000])
def test_invalid_and_unregistered_cookies_are_rejected_by_both_boundaries(auth_app, token):
    client = browser(auth_app)
    # httpx will not send non-ASCII cookie octets; exercise that parser input directly.
    if not token.isascii():
        with pytest.raises(HTTPException) as error:
            service.authenticate_session(None, token)
        assert error.value.status_code == 401
        return
    client.cookies.set("session", token)
    assert client.get("/auth/session").status_code == 401
    assert client.get("/protected").status_code == 401


def test_legacy_signed_jwts_do_not_bypass_session_registration(auth_app):
    client = browser(auth_app)
    token = jwt.encode({"sub": "owner", "exp": 4102444800}, settings.secret_key, algorithm="HS256")
    client.cookies.set("session", token)
    assert client.get("/auth/session").status_code == 401
    assert client.get("/protected").status_code == 401


def test_attempt_limit_survives_other_client_instances_and_forwarded_header_spoofing(
    auth_app, monkeypatch
):
    monkeypatch.setattr(settings, "auth_login_attempts_per_ip", 2)
    client = browser(auth_app)
    for n in range(2):
        assert (
            client.post(
                "/auth/login",
                json={"password": "wrong"},
                headers={"X-Forwarded-For": f"10.0.0.{n}"},
            ).status_code
            == 401
        )
    blocked = browser(auth_app).post("/auth/login", json={"password": settings.app_password})
    assert blocked.status_code == 429
    assert 1 <= int(blocked.headers["Retry-After"]) <= settings.auth_login_window_seconds
    sign_in(browser(auth_app, "203.0.113.2"))


def test_owner_wide_limit_bounds_distributed_attempts_and_bucket_growth(
    auth_app, monkeypatch, auth_db
):
    monkeypatch.setattr(settings, "auth_login_attempts_global", 3)
    for n in range(3):
        response = browser(auth_app, f"203.0.113.{n}").post(
            "/auth/login", json={"password": "wrong"}
        )
        assert response.status_code == 401
    for n in range(3, 10):
        response = browser(auth_app, f"203.0.113.{n}").post(
            "/auth/login", json={"password": "wrong"}
        )
        assert response.status_code == 429
    assert auth_db.scalar(select(func.count()).select_from(LoginAttemptBucket)) == 4
    assert all(row.attempts <= 3 for row in auth_db.scalars(select(LoginAttemptBucket)))


def test_attempt_window_resets_and_expired_buckets_are_removed(auth_app, monkeypatch, auth_db):
    clock = [1000]
    monkeypatch.setattr(service, "time", SimpleNamespace(time=lambda: clock[0]))
    monkeypatch.setattr(settings, "auth_login_attempts_per_ip", 1)
    client = browser(auth_app)
    assert client.post("/auth/login", json={"password": "wrong"}).status_code == 401
    assert client.post("/auth/login", json={"password": "wrong"}).status_code == 429
    clock[0] += settings.auth_login_window_seconds
    sign_in(browser(auth_app, "203.0.113.2"))
    assert auth_db.scalar(select(func.count()).select_from(LoginAttemptBucket)) == 2


def test_concurrent_attempts_cannot_exceed_atomic_limit(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'auth.sqlite'}", connect_args={"timeout": 15})
    LoginAttemptBucket.__table__.create(engine)
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
        assert results.count(200) == 3
        assert results.count(429) == 17
        with Session(engine) as db:
            assert db.get(LoginAttemptBucket, "owner").attempts == 8
    finally:
        engine.dispose()
