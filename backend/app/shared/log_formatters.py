from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from app.shared.log_context import get_request_context

_DEFAULT_LOG_RECORD_KEYS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
    "taskName",
}


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in get_request_context().items():
            setattr(record, key, value)
        return True


class PrettyFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds")
        message = record.getMessage()
        context = _format_context(_collect_record_context(record))
        line = f"{timestamp} {record.levelname} [{record.name}] {message}"
        if context:
            line = f"{line} {context}"
        if record.exc_info:
            return f"{line}\n{self.formatException(record.exc_info)}"
        return line


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if event := getattr(record, "event", None):
            payload["event"] = event

        payload.update(_collect_record_context(record))

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True, default=str)


def _collect_record_context(record: logging.LogRecord) -> dict[str, Any]:
    extras: dict[str, Any] = {}
    for key, value in record.__dict__.items():
        if key in _DEFAULT_LOG_RECORD_KEYS or key.startswith("_"):
            continue
        extras[key] = value
    return extras


def _format_context(context: dict[str, Any]) -> str:
    return " ".join(f"{key}={value}" for key, value in context.items() if value is not None)
