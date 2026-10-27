"""Bind exported workbooks to their learning and translation languages."""

from app.features.languages.catalog import learning_language, translation_language

LANGUAGE_SHEET = "_Lexora_Language"


def add_language_metadata(book, db):
    sheet = book.create_sheet(LANGUAGE_SHEET)
    sheet.append(["language", learning_language(db)])
    sheet.append(["translation_language", translation_language(db)])
    sheet.sheet_state = "hidden"
