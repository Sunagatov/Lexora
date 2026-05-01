from __future__ import annotations

import logging
from logging.config import dictConfig
from typing import Any

from app.shared.log_context import get_request_context

_previous_log_record_factory = logging.getLogRecordFactory()


def _request_context_log_record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
    record = _previous_log_record_factory(*args, **kwargs)
    for key, value in get_request_context().items():
        setattr(record, key, value)
    return record


def log_audit_event(event: str, **fields: Any) -> None:
    logging.getLogger("audit").info(
        event,
        extra={
            "event": event,
            **{key: value for key, value in fields.items() if value is not None},
        },
    )


def configure_logging(*, level: str, audit_level: str, log_format: str) -> None:
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
                "uvicorn.error": {
                    "level": "WARNING",
                    "propagate": True,
                },
                "httpx": {
                    "level": "WARNING",
                    "propagate": True,
                },
                "httpcore": {
                    "level": "WARNING",
                    "propagate": True,
                },
                "http.access": {
                    "level": level.upper(),
                    "propagate": True,
                },
                "audit": {
                    "level": audit_level.upper(),
                    "propagate": True,
                },
            },
        }
    )
