import logging

from app.shared.logging_utils import (
    bind_request_context,
    clear_request_context,
    get_request_context,
    log_audit_event,
    make_request_id,
    sanitize_header_value,
)


def test_log_audit_event_sets_event_name_and_drops_none_fields(caplog) -> None:
    with caplog.at_level(logging.INFO, logger="audit"):
        log_audit_event("audit.example", count=2, optional=None)

    matching = [r for r in caplog.records if r.name == "audit" and r.message == "audit.example"]
    assert matching
    record = matching[0]
    assert record.event == "audit.example"
    assert record.count == 2
    assert not hasattr(record, "optional")


def test_request_context_bind_and_clear_round_trip() -> None:
    token = bind_request_context(request_id="req-1", subject="user-1")
    try:
        assert get_request_context() == {"request_id": "req-1", "subject": "user-1"}
    finally:
        clear_request_context(token)

    assert get_request_context() == {}


def test_sanitize_header_value_rewrites_invalid_chars_and_enforces_length() -> None:
    assert sanitize_header_value(" abc/123?x ") == "abc_123_x"
    assert sanitize_header_value("!!!") == "___"
    assert sanitize_header_value("   ") is None
    assert sanitize_header_value("abcdef", max_length=4) == "abcd"


def test_make_request_id_returns_hex_token() -> None:
    request_id = make_request_id()

    assert len(request_id) == 32
    assert all(ch in "0123456789abcdef" for ch in request_id)
