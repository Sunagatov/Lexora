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

    app_password: str
    secret_key: str
    cookie_max_age: int = 60 * 60 * 24 * 30  # 30 days
    api_key: str

    smart_review_enabled: bool = True
    smart_review_size: int = 100
    smart_review_level_1_count: int = 25
    smart_review_level_2_count: int = 25
    smart_review_level_3_count: int = 25
    smart_review_level_4_count: int = 25
    smart_review_level_5_count: int = 0
    smart_review_cooldown_days: int = 2
    smart_review_max_per_topic: int = 10
    smart_review_queue_ttl_hours: int = 24

    trash_retention_days: int = 30

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


settings = Settings()
