from __future__ import annotations

from contextvars import ContextVar
from typing import Any
from uuid import uuid4

REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"

_request_context: ContextVar[dict[str, Any]] = ContextVar("request_context", default={})


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
