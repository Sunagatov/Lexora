import logging

from app.shared.logging_utils import log_audit_event


def test_log_audit_event_sets_event_name_and_drops_none_fields(caplog) -> None:
    with caplog.at_level(logging.INFO, logger="audit"):
        log_audit_event("audit.example", count=2, optional=None)

    matching = [r for r in caplog.records if r.name == "audit" and r.message == "audit.example"]
    assert matching
    record = matching[0]
    assert record.event == "audit.example"
    assert record.count == 2
    assert not hasattr(record, "optional")
