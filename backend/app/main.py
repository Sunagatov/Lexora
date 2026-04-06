from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.topics import router as topics_router
from app.routes.words import router as words_router

app = FastAPI(
    title="Lexora API",
    version="0.1.0",
    description="Backend API for a personal English vocabulary learning application.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(topics_router)
app.include_router(words_router)