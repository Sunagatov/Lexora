from __future__ import annotations

from collections import Counter

from sqlalchemy import select

from app.features.topics.model import Topic
from app.features.words.ai_review.schemas import AiReviewImportRequest
from app.features.words.constants import PROGRESS_SOURCE_JSON_IMPORT
from app.features.words.model import Word, word_topics
from app.features.words.repository import _with_details
from app.features.words.schemas import WordUpdate


def load_import_words(db, topic_id: int, word_ids: list[int], subtree_topic_ids: list[int]) -> dict[int, Word]:
    words = db.scalars(
        _with_details(
            select(Word)
            .join(word_topics, word_topics.c.word_id == Word.id)
            .join(Topic, Topic.id == word_topics.c.topic_id)
            .where(Word.id.in_(word_ids))
            .where(Word.deleted_at.is_(None))
            .where(Topic.deleted_at.is_(None))
            .where(Topic.id.in_(subtree_topic_ids))
            .distinct()
        )
    ).all()
    return {word.id: word for word in words}


def assert_unique_word_ids(word_ids: list[int], error_cls) -> None:
    duplicates = sorted(word_id for word_id, count in Counter(word_ids).items() if count > 1)
    if duplicates:
        raise error_cls(f"Duplicate word ids in payload: {duplicates}")


def assert_import_words_present(
    payload: AiReviewImportRequest,
    words_by_id: dict[int, Word],
    topic_name: str,
    error_cls,
) -> None:
    word_ids = [word.id for word in payload.words]
    missing_ids = sorted(set(word_ids) - set(words_by_id))
    if missing_ids:
        raise error_cls(f"These word ids do not exist in topic '{topic_name}': {missing_ids}")


def assert_term_matches(payload: AiReviewImportRequest, words_by_id: dict[int, Word], error_cls) -> None:
    for item in payload.words:
        word = words_by_id[item.id]
        if item.term != word.term:
            raise error_cls(f"Word {item.id} term mismatch: expected '{word.term}', got '{item.term}'")


def assert_not_stale(payload: AiReviewImportRequest, words_by_id: dict[int, Word], error_cls) -> None:
    if payload.exported_at is None:
        return
    for item in payload.words:
        word = words_by_id[item.id]
        if word.updated_at is not None and word.updated_at > payload.exported_at:
            raise error_cls(
                f"Word {word.id} ('{word.term}') was modified after export "
                f"(word.updated_at={word.updated_at.isoformat()}, "
                f"exported_at={payload.exported_at.isoformat()}). Re-export and re-run."
            )


def has_changes(word: Word, item) -> bool:
    for field in item.model_fields_set - {"id", "term"}:
        if getattr(item, field) != current_value(word, field):
            return True
    return False


def build_update_payload(item) -> WordUpdate:
    data = item.model_dump(exclude_unset=True, exclude={"id", "term"})
    data["progress_source"] = PROGRESS_SOURCE_JSON_IMPORT
    return WordUpdate(**data)


def current_value(word: Word, field: str):
    if field == "translation_entries":
        return [item.value for item in getattr(word, "translation_items", [])]
    if field == "example_entries":
        return [item.value for item in getattr(word, "example_items", [])]
    return getattr(word, field)
