from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    credential_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class LoginAttemptBucket(Base):
    __tablename__ = "auth_login_attempts"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    resets_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
