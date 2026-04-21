import logging
from contextlib import asynccontextmanager
from logging.config import dictConfig
from typing import Any, cast

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.shared.config import settings
from app.shared.deps import verify_csrf, verify_session
from app.features.auth.router import router as auth_router
from app.features.health.router import router as health_router
from app.features.topics.router import router as topics_router
from app.features.words.router import router as words_router
from app.features.words.suggest.router import router as suggest_router
from app.features.smart_review.router import router as smart_review_router
from app.features.trash.router import router as trash_router
from app.features.stats.router import router as stats_router
from app.features.words.ai_curation.router import router as ai_curation_router


def configure_logging() -> None:
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(levelname)s %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                }
            },
            "loggers": {
                "app": {
                    "handlers": ["console"],
                    "level": "INFO",
                    "propagate": False,
                },
                "uvicorn.access": {
                    "handlers": [],
                    "level": "WARNING",
                    "propagate": False,
                },
            },
        }
    )


configure_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "app.started: smartReviewEnabled=%s, corsOriginsCount=%s",
        settings.smart_review_enabled,
        len(settings.cors_allowed_origins),
    )
    try:
        yield
    finally:
        logger.info("app.stopped")


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
async def log_unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception(
            "http.request.failed: method=%s, path=%s",
            request.method,
            request.url.path,
        )
        raise


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(topics_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(words_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(suggest_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(smart_review_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(trash_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(stats_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
app.include_router(ai_curation_router, dependencies=[Depends(verify_session), Depends(verify_csrf)])
