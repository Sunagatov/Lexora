from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    postgres_db: str = "english_learning"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True
    log_level: str = "INFO"
    audit_log_level: str = "INFO"
    log_format: Literal["pretty", "json"] = "pretty"
    log_slow_request_threshold_ms: int = 500

    app_password: str = Field(default="")
    secret_key: str = Field(default="")
    cookie_max_age: int = 60 * 60 * 24 * 30  # 30 days
    cookie_httponly: bool = True
    cookie_secure: bool = False  # set True in production via env
    cookie_samesite: str = "lax"
    api_key: str = Field(default="")

    smart_review_enabled: bool = True
    smart_review_level_1_count: int = 5
    smart_review_level_2_count: int = 5
    smart_review_level_3_count: int = 5
    smart_review_level_4_count: int = 5
    smart_review_level_5_count: int = 0
    smart_review_cooldown_days: int = 1
    smart_review_max_per_topic: int = 5
    smart_review_queue_ttl_hours: int = 72  # queue lives 3 days — only regenerates when complete

    trash_retention_days: int = 30

    cors_allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://lexora.zuf.uk",
    ]

    # AI / topic suggestion — uses GitHub Models (OpenAI-compatible)
    openai_api_key: str = ""
    openai_base_url: str = "https://models.inference.ai.azure.com"
    openai_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @model_validator(mode="after")
    def _validate_required_values(self) -> "Settings":
        required = {
            "app_password": self.app_password,
            "secret_key": self.secret_key,
            "api_key": self.api_key,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required settings: {', '.join(missing)}")
        return self


settings = Settings()
