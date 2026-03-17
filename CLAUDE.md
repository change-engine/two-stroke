# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

Two-stroke is a lightweight TypeScript framework for building type-safe APIs on Cloudflare Workers. It provides structured routing, authentication (PBKDF, JWT/JWK), Zod-based request/response validation, auto-generated OpenAPI docs, queue/cron/email handlers, and Sentry error tracking.

## Commands

All commands are exposed as bin scripts (no `npm run` prefix needed when installed):

- **`pnpm lint`** — ESLint + Prettier check (fails on violations)
- **`pnpm format`** — ESLint fix + Prettier write
- **`pnpm test`** — Builds with `wrangler deploy --dry-run`, then runs Vitest with Cloudflare Workers pool (Miniflare)
- **`pnpm type-check`** — `wrangler deploy --dry-run` + `tsc --noEmit`
- **`pnpm dev`** — Local dev server via `wrangler dev`
- **`pnpm deploy <env> <version>`** — Deploy with Sentry release tracking
- **`pnpm api-types <url>`** — Generate TypeScript types from an OpenAPI endpoint

There is no way to run a single test file directly — use Vitest's built-in filtering (e.g., `vitest run src/foo.test.ts`).

## Architecture

### Core source files (`src/`)

- **`index.ts`** — Main `twoStroke<T>()` factory. Returns `fetch`, `queue`, `scheduled`, `email` handlers plus route registration methods (`get`, `post`, `put`, `delete`) and auth builders (`noAuth`, `pbkdf`, `jwt`). Routes are regex-matched with path parameters like `{userId}`.
- **`types.ts`** — Core type definitions: `Env` (CF bindings union), `Route<T, A>`, `Handler<T, I, O, A, P>`, `ExtractParameterNames<S>` (extracts `{param}` from path strings).
- **`open-api.ts`** — Generates OpenAPI 3.1.0 spec from registered routes; served at `/doc`.
- **`test.ts`** — Test utilities: `setupTests()` (fetch mocking, OpenAPI client), `fakeJWK()` (RS256 test tokens), request recording helpers, `waitForQueue()`.
- **`cmd.mjs`** — Shared utility for spawning subprocesses in bin scripts.

### Request flow

1. Route matched by regex against URL pathname
2. Auth handler runs (returns claims or throws)
3. Request body parsed and validated against Zod input schema (POST/PUT)
4. Handler executes with typed context: `{ req, env, body, params, searchParams, claims, sentry, waitUntil }`
5. Response validated against Zod output schema
6. CORS + security headers applied automatically

### Key conventions

- **Zod v4** — imported as `zod/v4` (not `zod`)
- **ESM only** — `"type": "module"` with `verbatimModuleSyntax` in tsconfig
- **Strict TypeScript** — `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`
- **Node 24.9+** required, pnpm 10.30+ via Corepack
- **Prettier** — 100 char print width
- **ESLint config** — extends `eslint-config-two-stroke`
- **Testing** — Vitest with `@cloudflare/vitest-pool-workers` pool; globals enabled (no imports needed for `describe`, `it`, `expect`)
