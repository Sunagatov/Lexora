from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy import engine_from_config, pool

from app.shared.config import settings
from app.shared.db import Base
from app.features.topics.model import Topic  # noqa: F401
from app.features.words.model import Word  # noqa: F401
from app.features.smart_review.model import StudyQueue, StudyQueueItem  # noqa: F401
from app.features.stats.model import AppUsageEvent, WordProgressEvent  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"prepare_threshold": None},  # disable prepared statements for Supabase transaction pooler
    )

    with connectable.connect() as connection:
        connection.execute(text("SET statement_timeout = 0"))
        connection.execute(text("SET lock_timeout = 0"))
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
