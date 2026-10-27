from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

LANGUAGES = {
    "en": {"name": "English", "locale": "en-GB", "direction": "ltr"},
    "zh": {"name": "Mandarin Chinese", "locale": "zh-CN", "direction": "ltr"},
    "es": {"name": "Spanish", "locale": "es-ES", "direction": "ltr"},
    "de": {"name": "German", "locale": "de-DE", "direction": "ltr"},
    "tr": {"name": "Turkish", "locale": "tr-TR", "direction": "ltr"},
    "tt": {"name": "Tatar", "locale": "tt-RU", "direction": "ltr"},
    "ar": {"name": "Arabic", "locale": "ar-SA", "direction": "rtl"},
    "fr": {"name": "French", "locale": "fr-FR", "direction": "ltr"},
    "pt": {"name": "Portuguese", "locale": "pt-PT", "direction": "ltr"},
    "ru": {"name": "Russian", "locale": "ru-RU", "direction": "ltr"},
}
Language = Literal["en", "zh", "es", "de", "tr", "tt", "ar", "fr", "pt", "ru"]
TranslationLanguage = Literal["ru", "en"]


def learning_language(db: Session) -> str:
    """A session belongs to one learning language; old clients default to English."""
    value = db.info.get("language", "en") if isinstance(db, Session) else "en"
    return value if isinstance(value, str) and value in LANGUAGES else "en"


def translation_language(db: Session) -> str:
    value = db.info.get("translation_language", "ru") if isinstance(db, Session) else "ru"
    return value if value in ("ru", "en") else "ru"


def configure_language(db: Session, language: str = "en", translations: str = "ru") -> None:
    if language not in LANGUAGES:
        raise HTTPException(400, "Unsupported learning language")
    db.info["language"] = language
    if translations not in ("ru", "en"):
        raise HTTPException(400, "Unsupported translation language")
    db.info["translation_language"] = translations
