# Bun and Vite+ migration

Implements the approved in-chat modernization plan, October 15, 2026.

- [x] Dependencies, pinned Node/Bun, lockfile and Vite+ configuration.
- [x] Validated configuration, injected database/auth, lifecycle and errors.
- [x] Unit and real PostgreSQL integration tests, schema compatibility.
- [x] Development/production Docker, gated CI/CD, hooks and documentation.
- [x] Clean-install, static checks, coverage, integration/build/container verification and review.

Ruling: Work on a dedicated branch in the existing checkout; the filesystem restricts external worktrees. Do not commit or publish without a request.

The template uses native ESM, explicit .js imports, Nest CLI compilation and Swagger transforms.

Ruling: TypeScript stays on the integration-supported 6.x major. Preserve PostgreSQL 16 data volumes. No prereleases.

Ruling: Keep native ESM and the ESM commitlint config for compatibility with the upgraded NestJS ecosystem.
Ruling: Regenerate the upgraded lockfile after pnpm import omitted Husky binary metadata. Trust esbuild native installers; keep Scarf telemetry blocked.

## Verification

- Frozen Bun install succeeds; a disposable mismatched manifest is rejected.
- Vite+ formatting, linting and type checks pass with zero warnings/errors.
- Full `bun run verify`: 13 unit tests and 13 real database/startup tests pass; unit coverage is generated separately from integration coverage.
- Existing migration data survives the upgrade; repeated migration application succeeds; Drizzle reports no remaining schema drift.
- Production image builds from clean Linux dependencies and passes greeting/auth/Swagger/non-root/runtime-only/SIGTERM smoke checks.
- Development Compose uses separate fixture ports/volumes; its watch compiler starts without errors. Verification containers and volumes are removed afterward.
- Independent final review identified a production README environment override issue; documentation now explicitly sets NODE_ENV=production for both host and Docker commands.
- GitHub Actions execution itself requires pushing the branch; workflows are configured to use the locally verified commands. Nothing is committed, merged, pushed or published.

Additional decisions: migrations retain the original history and remove only a redundant organization slug index (the unique constraint remains). Integration tests create/drop their own random database because the original SQL explicitly references public-schema tables. Test origin protection is explicitly enabled because Better Auth otherwise skips it in test mode. All dependency versions are pinned; TypeScript remains on its integration-supported major.

Hook verification caught an inherited duplicate --edit flag that caused commitlint to ignore the supplied message path. The script now exposes the CLI directly; the hook supplies --edit exactly once. A valid conventional message passes and an invalid message is rejected.

Follow-up: billing integration removed from providers, dependency manifest/lockfile, environment validation, schema, fixtures and documentation. The uncommitted modernization migration was regenerated from the original history with only active auth plugin changes. Authentication tests run without external service doubles or billing credentials.
