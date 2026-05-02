from __future__ import annotations

from app.features.words.ai_curation.schemas import (
    AiCurationTopicSummary,
    AiCurationWord,
    AiCurationWordLean,
)
from app.features.words.enrichment import (
    EXAMPLE_TARGET_COUNT,
    example_count,
    example_enrichment_status,
    needs_example_enrichment,
)
from app.features.words.model import Word


def _topic_summary_from_row(row) -> AiCurationTopicSummary:
    return AiCurationTopicSummary(
        id=int(row.id),
        name=str(row.name),
        slug=str(row.slug),
        description=row.description,
        is_active=bool(row.is_active),
        word_count=int(row.word_count),
    )


def _source_topic_summary(topic, total: int) -> AiCurationTopicSummary:
    return AiCurationTopicSummary(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        description=topic.description,
        is_active=topic.is_active,
        word_count=total,
    )


def _word_to_export(word: Word) -> AiCurationWord:
    ec = example_count(word)
    vf = word.verb_form
    return AiCurationWord(
        id=word.id,
        topic_ids=[int(t.id) for t in word.topics if t.deleted_at is None],
        term=str(word.term),
        language=word.language,
        definition=word.definition,
        translation_entries=[item.value for item in getattr(word, "translation_items", [])],
        pattern=word.pattern,
        example_entries=[item.value for item in getattr(word, "example_items", [])],
        example_count=ec,
        example_target_count=EXAMPLE_TARGET_COUNT,
        example_status=example_enrichment_status(ec),
        needs_example_enrichment=needs_example_enrichment(word),
        countability=word.countability,
        part_of_speech=word.part_of_speech.name if word.part_of_speech else None,
        cefr_level=word.cefr_level,
        register=word.register,
        frequency_rank=word.frequency_rank,
        verb_form={
            "past_simple": vf.past_simple,
            "past_participle": vf.past_participle,
            "present_participle": vf.present_participle,
            "third_person": vf.third_person,
        } if vf else None,
        synonym_entries=[item.value for item in getattr(word, "synonym_items", [])],
        antonym_entries=[item.value for item in getattr(word, "antonym_items", [])],
        collocation_entries=[item.value for item in getattr(word, "collocation_items", [])],
        confusable_entries=[
            {"value": item.value, "explanation": item.explanation}
            for item in getattr(word, "confusable_items", [])
        ],
        notes=word.notes,
        knowledge_level=word.knowledge_level,
        is_active=word.is_active,
    )


def _word_to_lean_export(word: Word) -> AiCurationWordLean:
    count = example_count(word)
    return AiCurationWordLean(
        id=word.id,
        term=word.term,
        example_entries=[item.value for item in getattr(word, "example_items", [])] or None,
        example_count=count,
        example_target_count=EXAMPLE_TARGET_COUNT,
        example_status=example_enrichment_status(count),
        needs_example_enrichment=needs_example_enrichment(word),
    )
