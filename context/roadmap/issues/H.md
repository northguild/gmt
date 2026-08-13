### H1 — `getLocaleMonthNames` / `getLocaleWeekdayNames` / `getLocaleMeridiems`

**GitHub Issue:** Issue #72

**Title:**

```
H1 Add getLocaleMonthNames, getLocaleWeekdayNames, getLocaleMeridiems
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group H, item H1. Surfaced via a context7 sanity pass (2026-08-12) checking whether Story Groups A–G plus E would be sufficient to claim GMT surpasses Luxon/react-aria/date-fns/Moment.js outright — this did not exist anywhere in GMT and was not covered by any planned story.

## Gap
Luxon's `Info` class exposes standalone, locale-aware calendar name lookups independent of any specific date value: `Info.months('long', { locale })` (e.g. `['janvier', 'février', ...]` for fr), `Info.weekdays('short', { locale })` (e.g. `['Mo', 'Di', 'Mi', ...]` for de), and `Info.meridiems({ locale })` (`['AM', 'PM']`, locale-varying). GMT has locale-aware *behavior* (Story Group D: `isWeekend`, `getLocaleStartOfWeek`, `getLocaleDayOfWeek`) but nothing that returns locale-formatted calendar *names* standalone — confirmed via full-codebase grep (2026-08-12), no `getMonthNames`/`getWeekdayNames`/`monthNames` equivalent anywhere in `packages/gmt/src`.

This is a real product gap distinct from GMT's existing `format*` functions: those format a specific date value, but there's no way today to just ask "what are November's name and its abbreviation in de-DE" without constructing a throwaway date first.

## Scope
Three standalone functions, no date value input required — locale (and optional style) in, array of strings out:
- `getLocaleMonthNames(locale: string, style?: 'long' | 'short' | 'narrow'): string[]` — 12-element array, calendar-order (not alphabetical). Default calendar (Gregorian) only; non-Gregorian variants are out of scope here and belong with Story Group E's calendars if ever needed (do not couple this story to E).
- `getLocaleWeekdayNames(locale: string, style?: 'long' | 'short' | 'narrow'): string[]` — 7-element array. Decide during spec expansion whether the array is ISO-order (Monday-first) or locale-first-day-order (matching D2/D3's locale-first-day convention) — this is a real design choice, not a detail; document whichever is chosen since callers will assume one or the other.
- `getLocaleMeridiems(locale: string): string[]` — 2-element `[AM-label, PM-label]`, locale-varying (confirmed via Luxon docs that these vary, not just en-US `AM`/`PM`).
- Implementation: `Intl.DateTimeFormat` with `formatToParts` over a fixed reference date/each month, rather than shipping a bundled locale-name table — matches GMT's existing pattern of delegating to host `Intl` (see `context/project-overview.md`'s Intl APIs section) rather than adding a data dependency.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: existing `format*` functions under `plain/format/` for the `Intl.DateTimeFormat` usage pattern, and D1's `weekInfo`/locale-matrix handling for the locale-variance test approach. Re-verify Luxon's exact `Info.months`/`.weekdays`/`.meridiems` signatures via context7 before finalizing the style-parameter shape, since this spec's `'long' | 'short' | 'narrow'` values are carried over from `Intl.DateTimeFormat`'s own options, not verified 1:1 against Luxon's naming.

## Definition of done
Full 17-locale test matrix per `context/testing-standards/index.md`, including at least one locale with a non-Latin calendar name set and one with non-AM/PM meridiem labels if any target locale has them (verify during implementation — document if none do, don't skip the check). `hasFullIcu` ternaries where ICU-dependent output differs, per the established D1/A4 pattern. JSDoc with `@example`, exports, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### H2 — `getLocaleEraNames`

**GitHub Issue:** Issue #73

**Title:**

```
H2 Add getLocaleEraNames
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group H, item H2. Surfaced in the same context7 sanity pass as H1.

## Gap
Luxon's `Info.eras('long', { locale })` returns locale-aware era names (e.g. `['Before Christ', 'Anno Domini']` for en; other locales/calendars vary). GMT has no equivalent.

## Scope
- `getLocaleEraNames(locale: string, style?: 'long' | 'short' | 'narrow'): string[]`, Gregorian calendar only (BCE/CE-equivalent pair) — matching H1's explicit non-coupling to Story Group E's non-Gregorian calendars. If Group E later needs era names for Japanese/etc., that's scoped there, not retrofitted here.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Small, natural pairing with H1 — consider whether this should just be a fourth function folded into H1's PR rather than a separate one; kept as a separate story here only because era-name locale variance (some locales have no distinct era strings at all) may need its own investigation before committing to a signature. Confirm via context7 and decide at spec-expansion time.

## Definition of done
Locale test matrix (including at least one locale confirmed to have no distinct era-name behavior, documented as a fallback case rather than skipped), JSDoc, exports, README/changeset, lint/test pass.
```

### H3 — `hasDaylightSaving`

**GitHub Issue:** _fill in_

**Title:**

```
H3 Add hasDaylightSaving
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group H, item H3. Surfaced in the same context7 sanity pass as H1/H2.

## Gap
Luxon's `Info.hasDST(zone)` reports whether an IANA timezone observes daylight saving at all (e.g. `America/New_York` → `true`, `Asia/Tokyo` → `false`). GMT has `isValidTimeZone` (validity, not DST behavior) but confirmed via full-codebase grep (2026-08-12) that no DST-detection function exists anywhere in `packages/gmt/src` — the closest matches were all incidental substring hits on `isValidTimeZone`/`normalizeTimeZone`, not real equivalents.

This is a real, independent gap: GMT's DST-*disambiguation* handling (Story Group C — `disambiguation`/`offset` params) controls what happens when a DST transition is ambiguous, but nothing today tells a caller whether a given timezone has DST transitions to worry about in the first place.

## Scope
- `hasDaylightSaving(timeZone: string): boolean` — `false` on an invalid/unresolvable timezone identifier per GMT's boolean-return sentinel convention (not a thrown error, consistent with `isValidTimeZone`'s existing pattern).
- Implementation approach to confirm at spec-expansion time: likely comparing UTC offsets at two known dates six months apart for the given zone (a zone has DST iff its offset differs between them) via `Temporal.ZonedDateTime`/`Instant` — verify this is robust against southern-hemisphere DST (opposite season alignment vs. northern-hemisphere zones) before committing to specific reference dates.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `zoned/validate/isValidTimeZone.ts` for the validity-check/sentinel-return pattern, and Story Group C's docs (`docs/dst-disambiguation.md`) for DST-related terminology consistency.

## Definition of done
Tests covering: a northern-hemisphere DST zone (e.g. `America/Chicago` → `true`), a southern-hemisphere DST zone (e.g. `Australia/Sydney` → `true`, opposite-season transition), a non-DST zone (e.g. `Asia/Tokyo` → `false`), UTC (`false`), and invalid timezone identifiers (`false`). JSDoc, exports, README/changeset, lint/test pass.
```
