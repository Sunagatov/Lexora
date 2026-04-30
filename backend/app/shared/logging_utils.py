from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime
from logging.config import dictConfig
from typing import Any
from uuid import uuid4

REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"

_request_context: ContextVar[dict[str, Any]] = ContextVar("request_context", default={})
_previous_log_record_factory = logging.getLogRecordFactory()

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


def bind_request_context(**values: Any):
    current = dict(_request_context.get())
    current.update({key: value for key, value in values.items() if value is not None})
    return _request_context.set(current)


def clear_request_context(token) -> None:
    _request_context.reset(token)


def get_request_context() -> dict[str, Any]:
    return dict(_request_context.get())


def reset_request_context() -> None:
    _request_context.set({})


def sanitize_header_value(value: str | None, *, max_length: int = 128) -> str | None:
    if value is None:
        return None
    cleaned = "".join(ch if ch.isalnum() or ch in "._-:" else "_" for ch in value.strip())
    if not cleaned:
        return None
    return cleaned[:max_length]


def make_request_id() -> str:
    return uuid4().hex


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


def _request_context_log_record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
    record = _previous_log_record_factory(*args, **kwargs)
    for key, value in get_request_context().items():
        setattr(record, key, value)
    return record


def configure_logging(*, level: str, log_format: str) -> None:
    logging.setLogRecordFactory(_request_context_log_record_factory)
    formatter_class = (
        "app.shared.logging_utils.JsonFormatter"
        if log_format.lower() == "json"
        else "app.shared.logging_utils.PrettyFormatter"
    )
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {
                "request_context": {
                    "()": "app.shared.logging_utils.RequestContextFilter",
                }
            },
            "formatters": {
                "default": {
                    "()": formatter_class,
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "filters": ["request_context"],
                    "formatter": "default",
                }
            },
            "root": {
                "handlers": ["console"],
                "level": level.upper(),
            },
            "loggers": {
                "uvicorn.access": {
                    "handlers": [],
                    "level": "WARNING",
                    "propagate": False,
                },
                "http.access": {
                    "level": level.upper(),
                    "propagate": True,
                },
            },
        }
    )
