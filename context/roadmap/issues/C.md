### C1 — `convertPlainDateTimeToZoned` disambiguation

**GitHub Issue:** #38

**Title:**

```
C1 Add disambiguation parameter to convertPlainDateTimeToZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group C, item C1. First story in the recommended sequencing — smallest, no new namespace.

## Gap
`convertPlainDateTimeToZoned` (src/zoned/convert/convertPlainDateTimeToZoned.ts) silently uses Temporal's default `"compatible"` resolution for DST gaps/overlaps, with no way for callers to opt into `"earlier"`, `"later"`, or `"reject"`. This is a known bug-report source in Luxon's tracker; react-aria exposes this explicitly via `toZoned`/`toDate`.

## Scope
- Add optional `disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject'` parameter, defaulting to `'compatible'` (matches current behavior — non-breaking).
- Thread through to `Temporal.ZonedDateTime.from(..., { disambiguation })`.
- Write explicit DST gap/overlap test cases: spring-forward gap and fall-back overlap, for at least 2-3 timezones, per `context/testing-standards/index.md`'s locale-matrix approach.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Read the current implementation at `packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts` first.

## Definition of done
Tests covering all four disambiguation values across DST gap and overlap scenarios, JSDoc updated with `@example` for the new parameter, README/changeset updated, lint/test pass.
```

### C2 — `addZoned` / `subtractZoned` disambiguation

**GitHub Issue:** #39

**Status: Done.** `Temporal.ZonedDateTime.prototype.add()`/`.subtract()` accept only `ArithmeticOptions` (`{ overflow?: 'constrain' | 'reject' }`) — confirmed there is no `disambiguation` field on these methods, in the spec or the `@js-temporal/polyfill` type declarations, and empirically (passing `{ disambiguation: "reject" }` to `.add()` is silently ignored). Checked how Luxon, react-aria, and date-fns handle this (context7, 2026-08-07): none expose disambiguation control on arithmetic — Luxon's docs call ambiguous-time behavior during `.plus`/`.minus` explicitly undefined, react-aria only exposes it on construction. Rather than settle for docs-only or a detector function, implemented a working `disambiguation` parameter on `addZoned`/`subtractZoned` via a rebuild technique: after `.add()`/`.subtract()`, if `disambiguation !== "compatible"`, drop the result's offset and reconstruct via `Temporal.ZonedDateTime.from(plainDateTimeString + "[timeZone]", { disambiguation })`, which genuinely forces re-resolution. This works for **fall-back overlaps** (the arithmetic result lands on an ambiguous local time) but has **no effect on spring-forward gaps** (Temporal's arithmetic already resolves gap landings unambiguously before disambiguation is evaluated) — documented explicitly in JSDoc, tested, and covered in `docs/dst-disambiguation.md`.

**Title:**

```
C2 Add disambiguation parameter to addZoned, subtractZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group C, item C2. Depends on C1 establishing the pattern.

## Gap
Originally: same as C1, but for arithmetic that crosses a DST boundary. `addZoned` (src/zoned/calculate/addZoned.ts) and `subtractZoned` currently have no caller-facing DST disambiguation control.

## IMPORTANT — re-verify this first
Before writing any code, re-confirm (via `find-docs`/context7 against `/js-temporal/temporal-polyfill`, and an empirical test against the installed polyfill) whether `Temporal.ZonedDateTime.prototype.add()`/`.subtract()` accept a `disambiguation` option. As of 2026-08-07 they do not — `ArithmeticOptions` only has `overflow`, and arithmetic always resolves ambiguity as `'compatible'` per spec, with no override. If this is still true, **do not implement `disambiguation` on `addZoned`/`subtractZoned` as originally scoped** — there is no Temporal API surface to thread it through to.

## Scope (pending the re-verification above)
If Temporal still has no `disambiguation` option on arithmetic, choose one of:
- (a) Close this story as infeasible upstream, noting the spec limitation, and skip straight to C3.
- (b) Re-scope to a documentation-only fix: add a JSDoc note on `addZoned`/`subtractZoned` explaining that arithmetic across a DST gap/overlap always resolves as `'compatible'` with no override, so callers aren't surprised.
- (c) Re-scope to a new, different function — e.g. a boolean check like `doesZonedArithmeticCrossDstBoundary(value, units)` — that lets callers detect the ambiguity case and react (e.g. reject the operation themselves), since Temporal gives no resolution lever to pull.
Do not force a `disambiguation` parameter onto `addZoned`/`subtractZoned` that silently has no effect — that would be worse than not having the parameter at all (a false promise of control).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

## Definition of done
Depends on which path (a/b/c) is chosen above — document the decision and rationale in the PR description either way.
```

### C3 — Audit remaining zoned functions for disambiguation

**GitHub Issue:** #40

**Status: scope expanded.** A full-codebase audit (2026-08-07) confirmed `disambiguation` is only meaningful for `Temporal.ZonedDateTime.prototype.with()` calls against a real (non-UTC) IANA timezone — confirmed empirically that `.with()`, unlike `.add()`/`.subtract()` (see C2), does respect `disambiguation` (`{ disambiguation: "reject" }` correctly throws when `.with()` would land in a gap). The audit found **9 functions** with this exact pattern and no disambiguation control, **4 of which are outside** the directories the story originally named (`zoned/convert/*`, `zoned/calculate/*`) — see the full list below. Scope this story to all 9, not just the two named directories.

**Title:**

```
C3 Audit zoned calculate, zoned map, and unix calculate for remaining disambiguation gaps
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group C, item C3. Depends on C1 establishing the pattern (C2 landed as a partial `disambiguation` story for `addZoned`/`subtractZoned` via a different mechanism — see C2's status note — but this story's `.with()`-based pattern still traces back to C1, not C2).

## Gap
C1 added explicit DST disambiguation control to `convertPlainDateTimeToZoned`. A full-codebase audit found the same implicit-disambiguation gap in every function that calls `Temporal.ZonedDateTime.prototype.with()` to jump to a unit/quarter boundary against a real (non-UTC) IANA timezone:

- `packages/gmt/src/zoned/calculate/startOfZoned.ts`
- `packages/gmt/src/zoned/calculate/endOfZoned.ts`
- `packages/gmt/src/zoned/calculate/startOfQuarterForZoned.ts`
- `packages/gmt/src/zoned/calculate/endOfQuarterForZoned.ts`
- `packages/gmt/src/zoned/map/mapZonedHoursInDay.ts` (the midnight anchor `.with({ hour: 0, ... })`)
- `packages/gmt/src/unix/calculate/startOfUnix.ts` — NOT under `zoned/`, derives a ZonedDateTime via `instant.toZonedDateTimeISO(timeZone)` then applies the same unhandled `.with()` pattern
- `packages/gmt/src/unix/calculate/endOfUnix.ts` — same as above
- `packages/gmt/src/unix/calculate/startOfQuarterForUnix.ts` — same as above
- `packages/gmt/src/unix/calculate/endOfQuarterForUnix.ts` — same as above

Explicitly NOT in scope (verified not real gaps, do not touch):
- `packages/gmt/src/utc/calculate/startOfUtc.ts`/`endOfUtc.ts`/`startOfQuarterForUtc.ts`/`endOfQuarterForUtc.ts` — same `.with()` shape but timezone is hardcoded to `"UTC"`, which has no DST transitions; the option would be a permanent no-op.
- `packages/gmt/src/zoned/validate/isValidTimeZone.ts` — combines plain fields + timeZone but only to probe a fixed non-DST date (`2020-02-28`) for validity — disambiguation behavior doesn't affect its correctness.
- `addZoned`/`subtractZoned` — out of scope for this story; C2 already added `disambiguation` to both via a different mechanism (rebuild-through-`.from()`, not a direct `.with()` call), since Temporal's `.add()`/`.subtract()` have no `disambiguation` option at all.

## Scope
- Re-verify the 9-function list above is still accurate (`grep -rn '\.with(' packages/gmt/src/zoned packages/gmt/src/unix` and check each call site's timezone is a real IANA zone, not hardcoded UTC) before starting — library surfaces and this audit's findings could both have moved.
- Extend each of the 9 functions with the same optional `disambiguation` parameter and `'compatible'` default established in C1.
- Note these functions have a `switch (unit)` with multiple `.with()` call sites per function (e.g. `startOfZoned.ts` has 6+ separate `.with()` calls, one per unit case) — the `disambiguation` option must be threaded into all of them, not just the first.
- One PR covering all 9 call sites (still one PR per the roadmap's original intent — it's mechanical repetition of an established pattern once C1's shape is set).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Confirm C1 has landed first — this story's pattern depends on its exact parameter shape and JSDoc format. C2 has landed too (see its status note) but via a different mechanism (`.with()`-rebuild after arithmetic, not a direct `.with()` call) — this story's 9 functions call `.with()` directly, so they follow C1's pattern one-for-one, not C2's.

## Definition of done
Every touched function (all 9) has matching tests to C1's gap/overlap pattern, JSDoc updated, README/changeset updated, lint/test pass.
```
