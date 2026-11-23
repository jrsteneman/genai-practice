# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Public Schedule AI limits

- `SCHEDULE_AI_BUDGET_MICRO_USD` is the maximum cumulative Schedule AI budget in USD millionths. Default: `5000000` ($5); `0` disables requests. The budget does not reset on a date, redeploy, or server restart. To add capacity, raise the ceiling rather than deleting or replacing the ledger. Keep the configuration consistent across replicas.
- `SCHEDULE_AI_VISITOR_DAILY_LIMIT` defaults to `50` requests per UTC day; `0` disables requests. The app is anonymous, so this limit uses the client IPv4 address or IPv6 `/64` reported by the trusted Replit edge. People on the same network may share a quota. Do not expose the API service directly or change the proxy topology without rechecking address attribution.
- Each request reserves worst-case cost for all model calls (one analysis, two for a question) before sending any. The reservation shrinks to a conservative token-based charge when the provider reports trustworthy usage; missing usage or an interrupted process can leave extra budget committed. Near the ceiling, a request may be denied even when some capacity remains.
- The ledger covers only these Schedule AI endpoints in one database/environment, not the entire Replit account. The code uses upper rates of $1 per million GPT-5 mini input tokens and $8 per million output tokens. Recheck the provider’s context window, usage semantics, and managed rates before changing the model or gateway. Never replace the production ledger with development data to apply schema changes.
- `pnpm --filter @workspace/api-server run test:budget` verifies both routes with a local model stub and a disposable PostgreSQL cluster. Requires `initdb` and `pg_ctl` on `PATH`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
