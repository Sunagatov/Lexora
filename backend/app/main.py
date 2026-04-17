import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.shared.config import settings
from app.shared.deps import verify_csrf, verify_session
from app.features.auth.router import router as auth_router
from app.features.health.router import router as health_router
from app.features.topics.router import router as topics_router
from app.features.words.router import router as words_router
from app.features.words.suggest_router import router as suggest_router
from app.features.smart_review.router import router as smart_review_router
from app.features.trash.router import router as trash_router
from app.features.stats.router import router as stats_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Lexora API",
    version="0.1.0",
    description="Backend API for a personal English vocabulary learning application.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "app.started: smartReviewEnabled=%s, corsOriginsCount=%s",
        settings.smart_review_enabled,
        len(settings.cors_allowed_origins),
    )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("app.stopped")


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