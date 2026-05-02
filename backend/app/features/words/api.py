from __future__ import annotations

from app.features.words.domain import (
    assert_word_restore_allowed as assert_word_restore_allowed,
    existing_normalized_terms as existing_normalized_terms,
)
from app.features.words.repository import (
    count_active_words as count_active_words,
    create_word as create_word,
    get_deleted_words as get_deleted_words,
    get_word_by_id_including_deleted as get_word_by_id_including_deleted,
    hard_delete_deleted_words as hard_delete_deleted_words,
    hard_delete_words_by_ids as hard_delete_words_by_ids,
    list_active_word_topic_levels as list_active_word_topic_levels,
    restore_word as restore_word,
    sync_word_multivalue_fields as sync_word_multivalue_fields,
    update_word as update_word,
)
