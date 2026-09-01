# OTEL-A — Package skeleton + re-export gmt-time

**Audited 2026-09-01.** gmt-otel is a thin OTel layer on top of gmt-time. All timestamp/duration functions are re-exported from gmt-time. See [overview.md](../overview.md) for the full corrected spec.

Each story below is one logical unit; its sub-stories are nested under it and ordered as
they should be built. The issue stays open until its last sub-story lands.

## Definition of done — binding for every story in this file

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. `packages/gmt-otel` must not perturb `packages/gmt`.
- **Changesets required.** `@northguild/gmt-otel` is published to npm, so every story
  that modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, or arrays.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- OTel API is an optional peer dependency — span/baggage functions check for it at runtime
  and throw a clear `TypeError` if not found.

---

### OTEL-A1 — Package skeleton + CI wiring

**Title:**

```
OTEL-A1 Create packages/gmt-otel workspace package with pnpm/nx/oxlint wiring
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 3.
Depends on GMTIME-A1 (gmt-time package skeleton).

## Gap
`packages/gmt-otel` does not exist. We need a workspace package that depends on
`@northguild/gmt-time` and optionally peers on `@opentelemetry/api`.

## Scope
- Create `packages/gmt-otel` as `@northguild/gmt-otel` (`"type": "module"`).
- `package.json`:
  - `"dependencies": { "@northguild/gmt-time": "workspace:*" }`
  - `"peerDependencies": { "@opentelemetry/api": "^1.9 || ^1.10" }`
  - `"peerDependenciesMeta": { "@opentelemetry/api": { "optional": true } }`
  - `"devDependencies"` includes `@opentelemetry/api` (for type checking/tests),
    `typescript`, `vitest`
  - `"engines": { "node": ">=22.12.0" }` (same as gmt)
- `tsconfig.json` extending `../../tsconfig.base.json` (standard for workspace packages).
- `tsconfig.build.json` for the build output.
- `vitest.config.ts` following the repo pattern.
- `project.json` — **required.** Nx's `@nx/js/typescript` plugin infers build/typecheck
  from `tsconfig.build.json`. Declare `build`, `test`, `typecheck`, and `lint` with
  `dependsOn: ["^build"]` so `@northguild/gmt-time` builds first.
- Add `packages/gmt-otel/dist` to `.gitignore`.
- Update root `pnpm-workspace.yaml` — add `packages/gmt-otel` if not already in the
  `packages/*` glob (it should be, but verify).
- Update root `package.json` — verify `packages/*` glob covers it.
- Update `oxlint.config.js` — add `packages/gmt-otel` to the include glob; add
  `packages/gmt-otel/dist` to ignore.

## Before starting
Verify that `pnpm-workspace.yaml` already covers `packages/*` via glob. If the workspace
uses explicit entries instead, add `packages/gmt-otel`. Check that root `package.json`
scripts don't need updating.

## Verification
- `pnpm install` succeeds
- `pnpm nx run gmt-otel:typecheck` runs (even with empty src)
- `pnpm nx run gmt-otel:build` produces output directory
- `pnpm nx run-many -t lint test typecheck build` stays green

## Decisions
- OTel API is an **optional peer dependency**. The package must build and pass tests
  without OTel installed. Span/baggage functions check for `@opentelemetry/api` at
  runtime and throw a clear `TypeError` if not found (rather than silently failing).
```

---

### OTEL-A2 — Re-export all of gmt-time

**Title:**

```
OTEL-A2 Re-export all of @northguild/gmt-time from @northguild/gmt-otel
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 3.
Depends on OTEL-A1 (package skeleton) and GMTIME-A2 (timestamp conversion).

## Gap
gmt-otel is a thin OTel layer on top of gmt-time. Consumers who use gmt-otel should get
all of gmt-time's functions automatically — they shouldn't need to install both packages.

## Scope
- `src/index.ts`:
  - `export * from '@northguild/gmt-time';` — re-export all timestamp/duration functions
  - This means consumers get `toNanoseconds`, `fromNanoseconds`, `toNanosecondTuple`,
    `fromNanosecondTuple`, `toDurationNanoseconds`, `fromDurationNanoseconds` automatically
  - No duplication — gmt-otel is a thin wrapper, not a reimplementation

## What gmt-time provides (do not re-implement)
- `toNanoseconds(isoString: string): bigint` — ISO string to nanoseconds
- `fromNanoseconds(nanoseconds: bigint, timezone?: string): string` — nanoseconds to ISO string
- `toNanosecondTuple(isoString: string): [number, number]` — ISO string to tuple
- `fromNanosecondTuple(tuple: [number, number], timezone?: string): string` — tuple to ISO string
- `toDurationNanoseconds(durationString: string): number` — duration string to nanoseconds
- `fromDurationNanoseconds(nanoseconds: number): string` — nanoseconds to duration string

## Verification
- `import { toNanoseconds } from '@northguild/gmt-otel'` works (re-exported from gmt-time)
- All re-exported functions behave identically to calling them directly from gmt-time
- No OTel dependency required for re-exports (gmt-time has zero OTel dependency)
```
