# NestJS + Better Auth + Drizzle

A Node.js API template using NestJS 12, Express, Better Auth, Drizzle and PostgreSQL. Bun manages packages and scripts; Vite+ owns formatting, type-aware linting and Vitest testing. The application compiles to native ESM and runs on Node, including in production.

## Requirements

- Node **24.22.0** (`.node-version`)
- Bun **1.4.3** (`.bun-version` and `packageManager`)
- PostgreSQL 16, or Docker Compose

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Replace the auth placeholder before starting. Generate an auth secret with `openssl rand -hex 32`. Configuration validation reports invalid field names without printing their values.

## Local development

```sh
docker compose up -d postgres
bun run db:migrate
bun run start:dev
```

The default API is `http://localhost:43127`. `DATABASE_URL` in `.env` uses localhost for host commands. Compose overrides the app's database connection to use its internal PostgreSQL service. URL-encode special characters in database credentials.

To run the application in Docker too:

```sh
docker compose up --build
```

Set `APP_ENV_FILE` to use a different app environment file (default: `.env`). Compose uses the development image, source watching, and a separate dependency volume. After changing dependencies, refresh that volume with `docker compose run --rm app bun install --frozen-lockfile`, then recreate the app. Do not remove `postgres_data` to refresh application dependencies.

## Commands

| Command                               | Purpose                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `bun run format`                      | Format supported source, configuration and documentation  |
| `bun run format:check`                | Check formatting                                          |
| `bun run lint` / `bun run lint:check` | Fix lint / check lint without edits                       |
| `bun run check`                       | Check formatting, types and type-aware lint rules         |
| `bun run test`                        | Run unit tests once                                       |
| `bun run test:watch`                  | Watch unit tests                                          |
| `bun run test:cov`                    | Unit coverage in `coverage/`                              |
| `bun run test:e2e`                    | Real PostgreSQL authentication and compiled startup tests |
| `bun run build`                       | Compile with Nest CLI and its Swagger plugin              |
| `bun run start:prod`                  | Run the compiled application on Node                      |
| `bun run verify`                      | Static checks, unit tests, build and integration tests    |

Use `bun run test`, not Bun's built-in test runner. Tests import APIs from `vite-plus/test`; SWC preserves the decorator metadata Nest dependency injection requires. Vite+ static checking includes test and tooling TypeScript too. Git hooks run Vite+ staged checks and conventional-commit validation.

## Authentication and API

- `GET /`: public greeting.
- `GET /me`: greeting for the authenticated session; returns 401 without a valid session.
- `/api/auth/*`: Better Auth handlers and session cookies.
- `GET /api/auth/get-session`: current session.
- `/docs`: Swagger UI in development/test. Production requires `SWAGGER_ENABLED=true`.

Email/password, admin (`admin` and `superAdmin`), organizations, two-factor authentication, JWT and OpenAPI plugins are enabled. Browser applications must be listed in `BETTER_AUTH_TRUSTED_ORIGINS`; use an explicit comma-separated HTTP(S) allowlist. Cookie-authenticated mutations need a trusted `Origin` header. The global guard protects application routes unless marked anonymous.

```sh
curl -X POST http://localhost:43127/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:43127' \
  -c cookies.txt \
  -d '{"name":"Ada","email":"ada@example.com","password":"strong-password-123"}'
curl http://localhost:43127/me -b cookies.txt
curl -X POST http://localhost:43127/api/auth/sign-out \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:43127' \
  -b cookies.txt -d '{}'
```

Do not add a body parser before Better Auth: the application disables Nest's default parser and lets the adapter handle auth raw bodies and normal JSON routes in order. Unexpected application failures return generic 500 responses. Authentication logs omit upstream error payloads, which can contain database or request secrets. Startup failures exit unsuccessfully; SIGTERM closes the HTTP server and PostgreSQL pool.

## Database and schema upgrades

```sh
bun run auth:schema       # after changing auth plugins/options
bun run db:generate       # review generated SQL before applying
bun run db:migrate
bun run drizzle:studio
```

Schema generation uses `auth.config.ts` and the same auth factory as the app. Supply the required environment configuration for CLI commands. Migration commands use `DATABASE_URL`; migrations are an explicit deployment step and do not run automatically when application replicas start.

The original migration is preserved. The modernization migration adds the admin/impersonation fields, JWT key metadata and two-factor lockout fields. It also removes the redundant organization slug index; the unique constraint still enforces uniqueness. Existing database contents are retained. Back up an existing database and apply the new migration before deploying this version.

## Integration tests

Provide `TEST_DATABASE_URL` separately from the application URL, pointing at a disposable PostgreSQL server. The account needs `CREATE DATABASE` permission: tests create a randomly named database, apply the real migration history, and drop only that database during cleanup. Tests do not truncate application tables.

For the Compose PostgreSQL service:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres bun run verify
```

Tests cover actual signup/signin/signout, session cookies, unauthorized access, browser origins, migrations, Swagger settings, startup errors and shutdown. Authentication and database integration tests use real application providers. No application secrets are needed for tests. `test:e2e` expects a current `dist/` build; `verify` builds first.

## Production and CI

```sh
bun run build
NODE_ENV=production bun run start:prod
docker build --target production -t core-api .
docker run --rm --env-file .env --env NODE_ENV=production -p 43127:43127 core-api
```

Production commands explicitly override the development `NODE_ENV` from `.env`; Docker's `--env-file` can override image defaults. A container's `DATABASE_URL` must address a reachable server, not its own localhost. The production image contains runtime dependencies and compiled output, runs as the `node` user, and launches Node directly. It includes neither Bun nor development tools nor `.env` files. Supply secrets at runtime; apply migrations separately.

CI verifies pull requests with pinned Node/Bun, frozen installs, static checks, unit/coverage tests, real PostgreSQL integration tests, and a production container smoke test. Main-branch CD calls that same verification workflow before publishing a GHCR image tagged `latest` and by commit SHA.

## Troubleshooting

- **Invalid environment:** replace example credentials and check the named fields in `.env`.
- **Database connection failed:** check `DATABASE_URL`, service readiness, host/container hostname and TLS parameters.
- **Integration setup fails:** set `TEST_DATABASE_URL`, ensure the server is disposable, and grant database-creation permission.
- **Port already in use:** change `APP_PORT` and the matching `BETTER_AUTH_URL`.
- **Native tooling/install failures:** use the pinned Node/Bun versions and `bun install --frozen-lockfile`. Only Nest, SWC and esbuild dependency lifecycle scripts are trusted; telemetry scripts remain blocked.
- **ESM imports:** local TypeScript imports use `.js` extensions for the emitted Node modules.
