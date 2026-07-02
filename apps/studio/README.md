# AVE Studio (Frontend)

Next.js frontend for the Agentic Video Editor. See the [root README](../../../README.md) for full project documentation.

## Development

```bash
npm install
npm run dev -- --port 3000
```

Requires the FastAPI backend on port 8000. API calls are proxied via `next.config.ts` rewrites.

## Quality checks

```bash
npm run lint        # TypeScript + ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Vitest unit tests
npm run build       # Production build
```

Run the full repository validation suite from the repo root:

```bash
# macOS / Linux
./scripts/validate.sh

# Windows
./scripts/validate.ps1
```

## Optional Redis cache

When `REDIS_ENABLED=true`, Studio exposes:

- `GET /api/cache/status` — connectivity probe
- `GET/PUT/DELETE /api/cache` — JSON cache operations

Configure via the root `.env` file (see `.env.example`).

## Tech stack

- Next.js 16, React 19, TypeScript (strict)
- Tailwind CSS 4
- Zustand, @dnd-kit, Recharts, Lucide
- Redis client for optional persistence
