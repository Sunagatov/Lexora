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
    smart_review_queue_size: int = 200
    smart_review_weak: int = 100
    smart_review_basic: int = 0
    smart_review_okay: int = 0
    smart_review_strong: int = 0
    smart_review_mastered: int = 0
    smart_review_cefr_a1: int = 10
    smart_review_cefr_a2: int = 20
    smart_review_cefr_b1: int = 30
    smart_review_cefr_b2: int = 25
    smart_review_cefr_c1: int = 10
    smart_review_cefr_c2: int = 5
    smart_review_cooldown_days: int = 1
    smart_review_max_per_topic: int = 5
    smart_review_queue_ttl_hours: int = 72  # queue lives 3 days — only regenerates when complete

    @property
    def smart_review_level_1_count(self) -> int:
        return round(self.smart_review_queue_size * self.smart_review_weak / 100)

    @property
    def smart_review_level_2_count(self) -> int:
        return round(self.smart_review_queue_size * self.smart_review_basic / 100)

    @property
    def smart_review_level_3_count(self) -> int:
        return round(self.smart_review_queue_size * self.smart_review_okay / 100)

    @property
    def smart_review_level_4_count(self) -> int:
        return round(self.smart_review_queue_size * self.smart_review_strong / 100)

    @property
    def smart_review_level_5_count(self) -> int:
        return round(self.smart_review_queue_size * self.smart_review_mastered / 100)

    @property
    def smart_review_cefr_weights(self) -> dict[str, int]:
        return {
            "A1": self.smart_review_cefr_a1,
            "A2": self.smart_review_cefr_a2,
            "B1": self.smart_review_cefr_b1,
            "B2": self.smart_review_cefr_b2,
            "C1": self.smart_review_cefr_c1,
            "C2": self.smart_review_cefr_c2,
        }

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

    # AI / word enrichment — uses Google Gemini free tier
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

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
