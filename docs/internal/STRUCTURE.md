# Project Structure

TypeScript monorepo aligned with production Node project conventions (`config/`, `logging/`, `errors/`, `redis/`, domain services).

```
agentic-video-editor/
├── apps/
│   ├── api/                 # Hono REST + WebSocket server (@ave/api)
│   └── studio/              # Next.js NLE frontend (@ave/studio)
├── packages/
│   ├── core/                # Shared infrastructure (@ave/core)
│   │   └── src/
│   │       ├── config/      # Zod-validated environment
│   │       ├── logging/     # Structured JSON logger
│   │       ├── errors/      # AppError hierarchy + HTTP helpers
│   │       ├── redis/       # Client, cache, job persistence
│   │       └── schemas/     # Zod models shared across apps
│   ├── domain/              # Pipeline, agents, FFmpeg tools (@ave/domain)
│   └── cli/                 # `ave` CLI entry point (@ave/cli)
├── pipelines/               # YAML pipeline manifests
├── styles/                  # Director style templates
├── tests/unit/              # Vitest unit tests
└── scripts/                 # validate.ps1 / validate.sh
```

## Design decisions

- **Python removed** — CLI, API, agents, and tools are TypeScript; FFmpeg/ffprobe run via subprocess.
- **Single schema module** — `@ave/core` Zod schemas replace parallel Pydantic + TS types.
- **Single Redis module** — job persistence and Studio cache share `@ave/core` Redis client code.
- **Deterministic editor** — `runEditor` executes EditPlans via FFmpeg without an agent loop.
