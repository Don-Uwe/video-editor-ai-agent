# Internal Repository Audit

> Generated during the production-readiness fork. Not published to PyPI/npm.

## Current Architecture

| Layer | Technology | Entry point |
|-------|------------|-------------|
| CLI | Python 3.11+, Click, Pydantic | `src/main.py` → `ave edit` |
| Pipeline | YAML manifests, Gemini ADK agents | `src/pipeline/runner.py` |
| Web API | FastAPI + Uvicorn | `src/web/app.py` |
| Web UI | Next.js 16, React 19, TypeScript | `src/web/studio/` |

Data flow: raw footage → preprocess (scene detect + Whisper) → Director → Trim Refiner → Editor → Reviewer (with retry loop) → MP4 output.

The web layer wraps the same pipeline via an in-process `JobRegistry` (asyncio worker, sequential execution) and a Next.js NLE-style frontend.

## Major Weaknesses

1. **No persistence** — jobs and projects live in memory; restart loses state.
2. **Orphaned legacy UI** — Alpine.js static files under `src/web/static/` were not mounted by FastAPI.
3. **Dev-only security** — open CORS, unrestricted filesystem browse API, no authentication.
4. **Environment mismatch** — README documents `.env` but nothing loaded it automatically.
5. **No lint/CI** — no ESLint, Ruff, or GitHub Actions quality gates.
6. **Core pipeline untested** — CLI and runner lack unit tests (Gemini/FFmpeg integration deferred).
7. **Loose dependency pins** — Python direct deps use wide `>=` ranges.
8. **Unused frontend dependency** — `react-resizable-panels` was installed but never imported.

## Recommended Improvements

| Priority | Change | Status |
|----------|--------|--------|
| High | Centralized config + dotenv loading | Implemented |
| High | Redis persistence layer (TypeScript + optional Python sync) | Implemented |
| High | Remove orphaned static UI | Implemented |
| High | Restrict browse API and configurable CORS | Implemented |
| Medium | ESLint, typecheck, and CI scripts | Implemented |
| Medium | Structured logging | Implemented |
| Medium | README redesign with Mermaid diagrams | Implemented |
| Lower | Pipeline runner unit tests with mocked agents | Future work |
