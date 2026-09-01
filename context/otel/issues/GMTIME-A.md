# GMTIME-A — Package skeleton + timestamp conversion

**Audited 2026-09-01.** All functions map to existing gmt APIs. No `GMTDate`, no invented types, no OTel dependency. See [overview.md](../overview.md) for the full corrected spec.

Each story below is one logical unit; its sub-stories are nested under it and ordered as
they should be built. The issue stays open until its last sub-story lands.

## Definition of done — binding for every story in this file

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. `packages/gmt-time` must not perturb `packages/gmt`.
- **Changesets required.** `@northguild/gmt-time` is published to npm, so every story
  that modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, or arrays.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- Full IANA timezone coverage for timezone-aware functions (not locale matrix — output
  is not locale-dependent).

---

### GMTIME-A1 — Package skeleton + CI wiring

**Title:**

```
GMTIME-A1 Create packages/gmt-time workspace package with pnpm/nx/oxlint wiring
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 1.

## Gap
`packages/gmt-time` does not exist. We need a workspace package that depends on
`@northguild/gmt` and has zero OTel dependency.

## Scope
- Create `packages/gmt-time` as `@northguild/gmt-time` (`"type": "module"`).
- `package.json`:
  - `"dependencies": { "@northguild/gmt": "workspace:*" }`
  - **No OTel dependency.** This is a general-purpose package.
  - `"devDependencies"` includes `typescript`, `vitest`
  - `"engines": { "node": ">=22.12.0" }` (same as gmt)
- `tsconfig.json` extending `../../tsconfig.base.json` (standard for workspace packages).
- `tsconfig.build.json` for the build output.
- `vitest.config.ts` following the repo pattern.
- `project.json` — **required.** Nx's `@nx/js/typescript` plugin infers build/typecheck
  from `tsconfig.build.json`. Declare `build`, `test`, `typecheck`, and `lint` with
  `dependsOn: ["^build"]` so `@northguild/gmt` builds first.
- Add `packages/gmt-time/dist` to `.gitignore`.
- Update root `pnpm-workspace.yaml` — add `packages/gmt-time` if not already in the
  `packages/*` glob (it should be, but verify).
- Update root `package.json` — verify `packages/*` glob covers it.
- Update `oxlint.config.js` — add `packages/gmt-time` to the include glob; add
  `packages/gmt-time/dist` to ignore.

## Before starting
Verify that `pnpm-workspace.yaml` already covers `packages/*` via glob. If the workspace
uses explicit entries instead, add `packages/gmt-time`. Check that root `package.json`
scripts don't need updating.

## Verification
- `pnpm install` succeeds
- `pnpm nx run gmt-time:typecheck` runs (even with empty src)
- `pnpm nx run gmt-time:build` produces output directory
- `pnpm nx run-many -t lint test typecheck build` stays green

## Decisions
- Zero OTel dependency. This is a general-purpose timestamp conversion library.
  Any industry can use this: geospatial, scientific computing, IoT, finance, observability.
```

---

### GMTIME-A2 — Timestamp conversion (`toNanoseconds` + `fromNanoseconds`)

**Title:**

```
GMTIME-A2 Implement toNanoseconds and fromNanoseconds
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 1.
Depends on GMTIME-A1 (package skeleton).

## Gap
Systems store timestamps as nanosecond counts since Unix epoch. gmt works with ISO 8601
strings. We need to bridge that gap — without any OTel dependency.

## Scope
- `src/timestamps.ts`:
  - `toNanoseconds(isoString: string): bigint` — converts any ISO 8601 string (plain,
    zoned, or UTC) to nanoseconds since Unix epoch. Uses `@northguild/gmt/zoned/convert`
    internally: parse the input via `zoned/fromISO` (which handles all three formats),
    then convert to nanoseconds using Temporal's internal arithmetic.
  - `fromNanoseconds(nanoseconds: bigint, timezone?: string): string` — converts nanosecond
    timestamp to an ISO string. If `timezone` is provided, the result is in that timezone;
    otherwise it's UTC.
- Both functions throw `RangeError` on invalid input — gmt-time does not use sentinels
  for its own API (it's a thin bridge, not a date library).

## What gmt provides (do not re-implement)
- `zoned/fromISO` — parses ISO 8601 strings into Temporal.ZonedDateTime (handles plain,
  zoned, and UTC inputs). Returns sentinel `""` on invalid input.
- `utc/fromISO` — parses UTC datetime strings.
- `plain/toISO` / `zoned/toISO` / `utc/toISO` — serialize back to ISO strings.

## Verification
- Round-trip: `fromNanoseconds(toNanoseconds(iso), tz) === iso` for valid inputs
- Invalid input throws `RangeError`
- Edge cases: epoch (0), max safe nanoseconds, DST transition boundaries
```

---

### GMTIME-A3 — Nanosecond tuple conversion (`toNanosecondTuple` + `fromNanosecondTuple`)

**Title:**

```
GMTIME-A3 Implement toNanosecondTuple and fromNanosecondTuple
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 1.
Depends on GMTIME-A2 (timestamp conversion).

## Gap
Some systems (including OTel's `hrTime()` API) use `[seconds, nanoseconds]` tuples
instead of bigint. We need explicit wrappers for this pattern — still no OTel dependency.

## Scope
- `src/timestamps.ts`:
  - `toNanosecondTuple(isoString: string): [number, number]` — converts ISO string to a
    `[seconds, nanoseconds]` tuple. Returns a tuple of two numbers.
  - `fromNanosecondTuple(tuple: [number, number], timezone?: string): string` — converts
    a `[seconds, nanoseconds]` tuple back to ISO string.
- These are thin wrappers around the bigint versions in GMTIME-A2 — convert to/from bigint
  internally.

## Verification
- Round-trip: `fromNanosecondTuple(toNanosecondTuple(iso), tz) === iso` for valid inputs
- Invalid input throws `RangeError`
- Tuple structure is correct: `[seconds, nanoseconds]` where nanoseconds < 1_000_000_000
```

---

### GMTIME-A4 — Timestamp conversion tests

**Title:**

```
GMTIME-A4 Add comprehensive tests for timestamp and tuple conversion
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 1.
Depends on GMTIME-A2 and GMTIME-A3 (timestamp + tuple implementation).

## Gap
No tests exist yet for any gmt-time function.

## Scope
- `test/timestamps.test.ts`:
  - Round-trip tests: `fromNanoseconds(toNanoseconds(iso)) === iso` for valid inputs
  - Round-trip tests: `fromNanosecondTuple(toNanosecondTuple(iso)) === iso` for valid inputs
  - Invalid input throws `RangeError` (not sentinels — gmt-time is a thin bridge)
  - Edge cases: epoch (0), max safe nanoseconds, DST transition boundaries
  - Timezone variants: UTC, offset timezones, IANA timezones with DST
  - Tuple validation: nanoseconds < 1_000_000_000

## Verification
- All tests pass
- `pnpm nx run gmt-time:test` covers all exported timestamp functions
```
