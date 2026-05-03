import logging
import time
from contextlib import asynccontextmanager
from typing import Any, cast

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.shared.config import settings
from app.shared.deps import verify_csrf, verify_session
from app.features.auth.router import router as auth_router
from app.features.health.router import router as health_router
from app.features.topics.router import router as topics_router
from app.features.words.router import router as words_router
from app.features.words.agent_router import router as words_agent_router
from app.features.words.suggest.router import router as suggest_router
from app.features.words.enrich.router import router as enrich_router
from app.features.smart_review.router import router as smart_review_router
from app.features.trash.router import router as trash_router
from app.features.stats.router import router as stats_router
from app.features.words.ai_curation.router import router as ai_curation_router
from app.shared.db import USING_SQLITE_FALLBACK, ensure_database_schema
from app.shared.logging_utils import (
    CORRELATION_ID_HEADER,
    REQUEST_ID_HEADER,
    bind_request_context,
    clear_request_context,
    configure_logging,
    get_request_context,
    make_request_id,
    sanitize_header_value,
)


configure_logging(
    level=settings.log_level,
    audit_level=settings.audit_log_level,
    log_format=settings.log_format,
)
logger = logging.getLogger(__name__)
access_logger = logging.getLogger("http.access")

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "application_started",
        extra={
            "event": "application_started",
            "smart_review_enabled": settings.smart_review_enabled,
            "cors_origins_count": len(settings.cors_allowed_origins),
            "sqlite_fallback": USING_SQLITE_FALLBACK,
        },
    )
    ensure_database_schema()
    try:
        yield
    finally:
        logger.info("application_stopped", extra={"event": "application_stopped"})


app = FastAPI(
    title="Lexora API",
    version="0.1.0",
    description="Backend API for a personal English vocabulary learning application.",
    lifespan=lifespan,
)

app.add_middleware(
    cast(Any, CORSMiddleware),
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_logging_context(request: Request, call_next):
    request_id = sanitize_header_value(request.headers.get(REQUEST_ID_HEADER)) or make_request_id()
    correlation_id = sanitize_header_value(request.headers.get(CORRELATION_ID_HEADER)) or request_id
    token = bind_request_context(
        request_id=request_id,
        correlation_id=correlation_id,
        method=request.method,
        path=request.url.path,
    )
    start = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
    except Exception:
        logger.exception(
            "http_request_failed",
            extra={
                "event": "http_request_failed",
            },
        )
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or request.url.path
        status_code = response.status_code if response is not None else 500
        request_context = get_request_context()
        subject = getattr(request.state, "subject", request_context.get("subject"))
        authenticated = subject is not None
        outcome = (
            "SUCCESS"
            if status_code < 400
            else "CLIENT_ERROR"
            if status_code < 500
            else "SERVER_ERROR"
        )
        level = logging.DEBUG
        if duration_ms >= settings.log_slow_request_threshold_ms:
            level = logging.WARNING

        access_logger.log(
            level,
            "http_request_completed",
            extra={
                "event": "http_request_completed",
                "route": route_path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "authenticated": authenticated,
                "outcome": outcome,
            },
        )
        clear_request_context(token)


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(words_agent_router)
app.include_router(topics_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(words_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(suggest_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(enrich_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(smart_review_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(trash_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(stats_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(ai_curation_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
