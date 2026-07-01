"""FastAPI application for AVE Studio.

Exposes the REST + WebSocket API and serves rendered media files. The
frontend is a standalone Next.js app (see ``src/web/studio/``). Also owns
the in-memory :class:`~src.web.jobs.JobRegistry` that runs pipeline
executions as sequential background tasks.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import get_settings
from src.logging_config import configure_logging
from src.web.jobs import JobRegistry
from src.web.persistence import JobPersistence
from src.web.routes.browse import router as browse_router
from src.web.routes.clips import router as clips_router
from src.web.routes.config import router as config_router
from src.web.routes.feedback import router as feedback_router
from src.web.routes.footage import router as footage_router
from src.web.routes.jobs import router as jobs_router
from src.web.routes.projects import router as projects_router
from src.web.routes.render import router as render_router
from src.web.routes.ws import router as ws_router

load_dotenv()
configure_logging(get_settings().log_level)

_settings = get_settings()
OUTPUT_DIR = _settings.ensure_output_dir()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Bring the :class:`JobRegistry` up on startup and down on shutdown.

    The registry's sequential asyncio worker must run inside the event
    loop that FastAPI starts, so we create and start it here rather than
    at module import time. Request handlers pull the live instance off
    ``app.state.job_registry`` via the :func:`get_registry` dependency.
    """
    persistence = JobPersistence()
    registry = JobRegistry(persistence=persistence)
    await registry.start()
    app.state.job_registry = registry
    app.state.job_persistence = persistence
    try:
        yield
    finally:
        await registry.stop()
        persistence.close()


app = FastAPI(
    title="AVE Studio",
    version="0.1.0",
    description="Agentic Video Editor web UI and API layer.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=OUTPUT_DIR), name="media")

app.include_router(config_router)
app.include_router(jobs_router)
app.include_router(feedback_router)
app.include_router(render_router)
app.include_router(clips_router)
app.include_router(footage_router)
app.include_router(browse_router)
app.include_router(projects_router)
app.include_router(ws_router)


@app.get("/api/health")
async def health(request: Request) -> dict[str, str | bool]:
    """Lightweight liveness probe used by the UI and deploy checks."""
    persistence = getattr(request.app.state, "job_persistence", None)
    return {
        "status": "ok",
        "redis_persistence": bool(persistence and persistence.enabled),
    }
