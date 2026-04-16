from app.shared.config import Settings


def test_database_url_builds_expected_psycopg_url() -> None:
    settings = Settings(
        app_password="test-password",
        secret_key="test-secret",
        api_key="test-api-key",
        postgres_db="lexora_db",
        postgres_user="lexora_user",
        postgres_password="lexora_pass",
        postgres_host="db.example.internal",
        postgres_port=5433,
    )

    assert settings.database_url == (
        "postgresql+psycopg://lexora_user:lexora_pass@db.example.internal:5433/lexora_db"
    )