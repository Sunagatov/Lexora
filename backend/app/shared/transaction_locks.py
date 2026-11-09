"""Serialize read/validate/write operations for a language until transaction end."""
from sqlalchemy import text
from sqlalchemy.orm import Session


def lock_language_transaction(db: Session, namespace: int, language: str) -> None:
    if not isinstance(db, Session):
        return  # Lightweight repository doubles do not own database transactions.
    connection = db.connection()
    if connection.dialect.name == "postgresql":
        connection.execute(text("SELECT pg_advisory_xact_lock(:namespace, :language)"), {
            "namespace": namespace, "language": int.from_bytes(language.encode("ascii"), "big"),
        })
    elif connection.dialect.name == "sqlite" and not connection.connection.driver_connection.in_transaction:
        # SQLite SELECTs do not begin a DBAPI transaction. Reserve the writer
        # before reading state so another request cannot validate the same snapshot.
        connection.exec_driver_sql("BEGIN IMMEDIATE")
