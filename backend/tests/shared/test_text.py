from app.shared.text import normalize_term, slugify


def test_normalize_term_nfkc_whitespace_and_lowercase() -> None:
    assert normalize_term("  ＴeSt   VALUE  ") == "test value"


def test_slugify_ascii_normalization_and_cleanup() -> None:
    assert slugify("  Café crème !!! ") == "cafe-creme"


def test_slugify_truncates_to_max_length() -> None:
    assert slugify("one two three", max_len=7) == "one-two"


def test_slugify_returns_empty_string_when_no_ascii_characters_remain() -> None:
    assert slugify("!!!") == ""