# Project Structure Decisions

## Layout

```
agentic-video-editor/
├── docs/internal/          # Maintainer-only audit and structure notes
├── pipelines/              # YAML pipeline manifests (user-extensible)
├── styles/                 # Director style templates
├── src/
│   ├── config/             # Environment-driven settings (Python)
│   ├── agents/             # Gemini ADK agent implementations
│   ├── models/             # Pydantic schemas shared by CLI and web
│   ├── pipeline/           # Preprocess + orchestration runner
│   ├── tools/              # Agent tool functions (analyze, render, captions)
│   ├── main.py             # CLI entry point
│   └── web/
│       ├── app.py          # FastAPI application
│       ├── jobs.py         # Background job registry
│       ├── persistence/    # Optional Redis-backed job snapshots (Python)
│       └── studio/         # Next.js frontend + Redis client (TypeScript)
└── tests/                  # pytest suite (web API focus)
```

## Rationale

- **Config in `src/config/`** — single source of truth for environment variables used by CLI and web.
- **Removed `src/web/static/`** — legacy Alpine UI was not served; Next.js Studio is the supported web interface.
- **Redis in two layers** — TypeScript client in Studio for cache/API routes; Python persistence module mirrors job snapshots when `REDIS_URL` is set.
- **Internal docs under `docs/internal/`** — audit artifacts stay out of the user-facing README.
