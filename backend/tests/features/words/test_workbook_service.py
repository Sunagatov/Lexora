from types import SimpleNamespace

from openpyxl import Workbook

from app.features.words import workbook_service


def test_normalize_countability_canonicalizes_known_values() -> None:
    assert workbook_service._normalize_countability("countable") == "Countable"
    assert workbook_service._normalize_countability(" UnCountable ") == "Uncountable"
    assert workbook_service._normalize_countability("both") == "Both"
    assert workbook_service._normalize_countability("plural") == "Plural"
    assert workbook_service._normalize_countability("Collective") == "Collective"
    assert workbook_service._normalize_countability("") is None


def test_countability_validation_range_covers_all_export_values() -> None:
    workbook = Workbook()
    ws = workbook.active
    workbook_service._create_lists_sheet(workbook)
    workbook_service._add_validations(workbook, ws, 5)

    countability_values = [
        workbook[workbook_service.LISTS_SHEET_NAME].cell(row=row, column=2).value
        for row in range(1, len(workbook_service.COUNTABILITY_VALUES) + 1)
    ]
    assert countability_values == workbook_service.COUNTABILITY_VALUES

    countability_validation = [
        dv for dv in ws.data_validations.dataValidation
        if str(dv.sqref) == "F2:F5"
    ][0]
    assert countability_validation.formula1 == (
        f"={workbook_service.LISTS_SHEET_NAME}!$B$1:$B${len(workbook_service.COUNTABILITY_VALUES)}"
    )


def test_countability_for_export_uses_canonical_value() -> None:
    word = SimpleNamespace(countability="uncountable")

    assert workbook_service._countability_for_export(word) == "Uncountable"


def test_existing_word_duplicate_check_skips_unchanged_word_id_row() -> None:
    existing = SimpleNamespace(term="Dog")

    assert workbook_service._should_validate_existing_word_duplicate(
        existing,
        " dog ",
        topic_was_missing=False,
    ) is False


def test_existing_word_duplicate_check_runs_for_changed_term_or_new_topic() -> None:
    existing = SimpleNamespace(term="Dog")

    assert workbook_service._should_validate_existing_word_duplicate(
        existing,
        "hound",
        topic_was_missing=False,
    ) is True
    assert workbook_service._should_validate_existing_word_duplicate(
        existing,
        "dog",
        topic_was_missing=True,
    ) is True
