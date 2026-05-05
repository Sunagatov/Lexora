import logging
from pathlib import Path
from tempfile import gettempdir
from threading import Lock

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.shared.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_sqlite_schema_lock = Lock()
_sqlite_schema_ready = False


def _sqlite_database_path() -> Path:
    return Path(gettempdir()) / "lexora-local.sqlite3"


def _build_postgres_engine() -> Engine:
    return create_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
        # Hosted Postgres poolers can close idle SSL connections underneath us.
        # Recycle them proactively and prefer reusing the freshest connections.
        pool_recycle=300,
        pool_use_lifo=True,
        connect_args={"prepare_threshold": None},
    )


def _build_sqlite_engine() -> Engine:
    return create_engine(
        f"sqlite+pysqlite:///{_sqlite_database_path()}",
        future=True,
        connect_args={"check_same_thread": False},
    )


def _probe_engine(candidate: Engine) -> None:
    with candidate.connect() as connection:
        connection.execute(text("SELECT 1"))


def build_engine() -> Engine:
    postgres_engine = _build_postgres_engine()
    try:
        _probe_engine(postgres_engine)
        return postgres_engine
    except OperationalError as exc:
        logger.warning(
            "database_fallback_activated",
            extra={
                "event": "database_fallback_activated",
                "database_backend": "postgresql",
                "fallback": "sqlite",
                "reason": type(exc).__name__,
            },
        )
        return _build_sqlite_engine()


engine = build_engine()
USING_SQLITE_FALLBACK = engine.dialect.name == "sqlite"


def _sqlite_schema_has_drift(candidate: Engine) -> bool:
    inspector = inspect(candidate)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        actual_columns = {column["name"] for column in inspector.get_columns(table.name)}
        expected_columns = {column.name for column in table.columns}
        if not expected_columns.issubset(actual_columns):
            return True
    return False


def _reset_sqlite_fallback_database() -> None:
    global engine

    sqlite_path = _sqlite_database_path()
    engine.dispose()
    if sqlite_path.exists():
        sqlite_path.unlink()
    engine = _build_sqlite_engine()
    SessionLocal.configure(bind=engine)


def ensure_database_schema() -> None:
    if not USING_SQLITE_FALLBACK:
        return

    global _sqlite_schema_ready
    if _sqlite_schema_ready:
        return

    with _sqlite_schema_lock:
        if _sqlite_schema_ready:
            return
        if _sqlite_schema_has_drift(engine):
            logger.warning(
                "sqlite_fallback_schema_reset",
                extra={
                    "event": "sqlite_fallback_schema_reset",
                    "reason": "schema_drift",
                },
            )
            _reset_sqlite_fallback_database()
        Base.metadata.create_all(bind=engine)
        _sqlite_schema_ready = True

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)
