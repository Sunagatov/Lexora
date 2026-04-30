from __future__ import annotations

from dataclasses import dataclass

from app.features.words.ai_curation.schemas import AiCurationImportResponse, CreatedTopicResult


@dataclass(frozen=True)
class AiCurationImportExecution:
    created_topic_results: list[CreatedTopicResult]
    created_word_ids: list[int]
    updated_word_ids: list[int]
    reassigned_word_ids: list[int]
    unchanged: int


def build_import_response(
    source_topic,
    payload,
    execution: AiCurationImportExecution,
) -> AiCurationImportResponse:
    created_topics_for_response, created_word_ids_for_response = _response_created_entities(
        payload,
        execution.created_topic_results,
        execution.created_word_ids,
    )
    return AiCurationImportResponse(
        source_topic_id=source_topic.id,
        source_topic_name=source_topic.name,
        dry_run=payload.dry_run,
        created_topics=created_topics_for_response,
        created_words=len(execution.created_word_ids),
        updated_words=len(execution.updated_word_ids),
        reassigned_words=len(execution.reassigned_word_ids),
        unchanged=execution.unchanged,
        created_word_ids=created_word_ids_for_response,
        updated_word_ids=execution.updated_word_ids,
        reassigned_word_ids=execution.reassigned_word_ids,
    )


def finalize_import_transaction(
    db,
    payload,
    created_topic_results: list[CreatedTopicResult],
    created_word_ids: list[int],
) -> tuple[list[CreatedTopicResult], list[int]]:
    if payload.dry_run:
        db.rollback()
        return (
            [
                CreatedTopicResult(
                    client_key=item.client_key,
                    id=None,
                    name=item.name,
                    slug=item.slug,
                )
                for item in created_topic_results
            ],
            [],
        )

    db.commit()
    return created_topic_results, created_word_ids


def _response_created_entities(
    payload,
    created_topic_results: list[CreatedTopicResult],
    created_word_ids: list[int],
) -> tuple[list[CreatedTopicResult], list[int]]:
    if payload.dry_run:
        return (
            [
                CreatedTopicResult(
                    client_key=item.client_key,
                    id=None,
                    name=item.name,
                    slug=item.slug,
                )
                for item in created_topic_results
            ],
            [],
        )
    return created_topic_results, created_word_ids
