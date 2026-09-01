# OTEL-D — Browser utility + polish

**Audited 2026-09-01.** All functions map to existing gmt APIs. No invented types. See [overview.md](../overview.md) for the full corrected spec.

Each story below is one logical unit; its sub-stories are nested under it and ordered as
they should be built. The issue stays open until its last sub-story lands.

## Definition of done — binding for every story in this file

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. Neither new package perturbs `packages/gmt`.
- **Changesets required.** Both packages are published to npm, so every story that
  modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, or arrays.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.

---

### OTEL-D1 — Browser utility (`getCurrentBrowserTimezone`)

**Title:**

```
OTEL-D1 Implement getCurrentBrowserTimezone browser utility
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 6.
Depends on OTEL-A2 (re-export gmt-time) and GMTIME-A1 (package skeleton).

## Gap
Browser code needs a way to discover the user's IANA timezone without Node.js APIs.
We need a browser-compatible utility that reads the timezone from the browser environment.

## Scope
- `src/browser.ts`:
  - `getCurrentBrowserTimezone(): string` — returns the user's IANA timezone string using
    `Intl.DateTimeFormat().resolvedOptions().timeZone`. This is available in all modern
    browsers and Node.js >= 16.
  - Conditional export: this function should be exported via a browser-specific entry point
    (e.g., `@northguild/gmt-otel/browser`) so bundlers can tree-shake it out for server-side
    builds. Use package.json `"exports"` field with conditional exports.
- No OTel dependency needed — this is a pure browser utility.

## What gmt-time provides (do not re-implement)
- `zoned/validate` — `isValidTimeZone(tz)` can be used to validate the returned timezone
  if needed (though `Intl.DateTimeFormat().resolvedOptions().timeZone` always returns a
  valid IANA timezone string).

## Verification
- Returns a valid IANA timezone string in browser environments
- Conditional export works: bundlers can tree-shake for server-side builds
- No Node.js-specific APIs used (browser-compatible)
```

---

### OTEL-D2 — README, LICENSE, CI polish

**Title:**

```
OTEL-D2 Add README, LICENSE, final integration tests, and CI wiring for both packages
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 6.
Depends on all previous stories (GMTIME-A1-A4, GMTIME-B1-B2, OTEL-A1-A2, OTEL-B1-B2, OTEL-C1-C2, D1).

## Gap
Both packages need final polish before they can be published to npm.

## Scope
- `packages/gmt-time/README.md`:
  - Package description: "GMT Time — general-purpose ISO 8601 ↔ nanosecond conversion"
  - Installation: `pnpm add @northguild/gmt-time` (zero OTel dependency)
  - Quick start example showing timestamp conversion + duration conversion
  - API reference linking to JSDoc
  - Use cases: geospatial, scientific computing, IoT, finance, observability
- `packages/gmt-otel/README.md`:
  - Package description: "GMT OTel — timezone-aware OpenTelemetry integration"
  - Installation: `pnpm add @northguild/gmt-otel` (re-exports gmt-time + optional OTel peer)
  - Quick start example showing timestamp conversion + span timezone helper
  - API reference linking to JSDoc
  - Browser usage note (conditional export)
- Both packages: `LICENSE` — copy from root (same license as gmt package).
- Integration tests:
  - End-to-end test showing full flow: parse ISO → convert to nanoseconds → set on span → propagate timezone via baggage
  - Test that gmt-time builds and passes all tests without OTel installed (zero dependency)
  - Test that gmt-otel builds and passes all tests without OTel installed (optional peer dep)
- CI wiring:
  - Verify `pnpm nx run-many -t lint test typecheck build` works for the full workspace
  - Ensure changeset workflow works (every story should have a `.changeset/*.md`)
  - Verify npm publish would work (package.json fields, exports, etc.)

## Verification
- All tests pass
- `pnpm nx run-many -t lint test typecheck build` stays green for the full workspace
- Both READMEs are clear and include working examples
- Both packages are ready for npm publication
```
