# Roadmap: GMT Parity with Luxon & react-aria `@internationalized/date`

## Context

GMT (`@burglekitt/gmt`) is a pre-alpha Temporal-first date library with strong plain/zoned/unix/utc coverage already. The goal is to reach — and exceed — feature parity with **Luxon**, **react-aria's `@internationalized/date`**, **Moment.js**, and **date-fns** — the four most relevant comparison libraries (see `context/project-overview.md`) — and to stay ahead of emerging Temporal-first competitors.

Research via context7 against these libraries' current docs, cross-referenced with GMT's existing `src/` surface, surfaced four real functional gaps (not just API-shape differences):

1. **No Duration type or ISO 8601 duration string support.** GMT's `add*`/`diff*` functions take/return plain `{unit: number}` objects. Luxon has a full `Duration` class (`fromObject`, `fromISO`, `fromMillis`, `.plus/.minus/.negate/.shiftTo/.rescale/.normalize/.toISO/.toHuman`). GMT has no way to parse or emit `"P1DT2H30M"` style strings, and no way to humanize a duration standalone (only relative-to-now formatting exists today).
2. **No Interval/range type.** Luxon's `Interval` supports `contains`, `overlaps`, `union`, `intersection`, `splitBy`, `divideEqually`, `length`, `count`, and constructing an interval from a point + duration (`.after`/`.before`). date-fns's `areIntervalsOverlapping` additionally exposes an `inclusive` option (edge-adjacent intervals count as overlapping or not). GMT only has scalar `isBetween*` checks and `mapDatesInRange`/`mapZonedDatesInRange` — no range-vs-range math.
3. **No DST disambiguation control.** Functions that produce a `ZonedDateTime` from a plain/local value (`convertPlainDateTimeToZoned`, `addZoned`, etc.) silently take Temporal's default `"compatible"` resolution for DST gaps/overlaps, with no way for callers to opt into `"earlier"`, `"later"`, or `"reject"`. This is a known bug-report source in Luxon's tracker — exposing it explicitly is a differentiator.
4. **No locale-aware calendar helpers.** react-aria has `isWeekend(date, locale)`, `startOfWeek(date, locale)`, `endOfWeek(date, locale)`, `getDayOfWeek(date, locale)` — all locale-sensitive (first day of week and weekend days vary by region: en-US week starts Sunday, fr-FR starts Monday, he-IL's weekend is Fri/Sat). GMT's `getDayOfWeek`/`getWeekOfYear` are ISO-8601-only (Monday-start), no locale parameter.

**Moment.js**: confirmed via context7 (2026-08-08) to be officially in maintenance mode — no new features, no immutability, bug fixes deprioritized. Not a source of new gaps; GMT (immutable, Temporal-backed) already supersedes it in kind. No dedicated story group needed.

**Emerging competitor watch:** `temporal-kit` (KristjanESPERANTO, ~11KB, functional/tree-shakable, Temporal-first) is the nearest direct competitor in GMT's own category — a Temporal-wrapping utility library rather than a legacy `Date`-based one. Surfaced via web search (2026-08-08) as it's too new/small to appear in context7's library index. It already ships `startOf`/`endOf`/`add`/`subtract`/`isBefore`/`isAfter`/`isBetween`/`isWeekend`/`addBusinessDays`. GMT already exceeds its scope (DST disambiguation, Duration, zoned/unix/utc namespaces are absent from temporal-kit) with one confirmed exception: **business-day arithmetic** (`addBusinessDays`), which GMT has no equivalent of — tracked as Story Group F in [story-groups.md](story-groups.md). Re-check this library's surface periodically (it's small and could grow quickly) rather than treating this snapshot as durable.

**Explicitly out of scope** (per user decision): non-Gregorian calendar systems (Buddhist, Hebrew, Islamic, Japanese, etc. via react-aria's `toCalendar`) — tracked as a single stretch story at the end, not a priority.

**Organizational note:** New functionality follows the existing folder convention (`src/duration/`, `src/interval/` mirroring `src/plain/`, `src/zoned/`, etc.) purely for internal consistency (tests, JSDoc, barrel exports per `context/coding-standards.md` and `context/testing-standards.md`). Consumers import everything from the package root regardless, so this has no user-facing effect.

Each story is scoped to be a single, reviewable PR: one coherent slice of functionality, following the existing per-function file pattern (implementation + `.test.ts` + JSDoc `@example` + barrel `index.ts` export), consistent with how `getTimeZones`/`getSystemTimeZone` etc. were added.

## Instructions for the agent picking up a story

This roadmap is intentionally a skeleton, not a spec. Before implementing any story:

1. **Re-verify the gap is still real.** Library surfaces move. Re-check the target function/behavior still doesn't exist in GMT (`grep`/`find` in `packages/gmt/src`) and still exists in Luxon/react-aria (use the `context7-mcp`/`find-docs` skill — do not rely on this document's research being current).
2. **Read the scoped context files** relevant to the change: `context/coding-standards.md` (always), `context/testing-standards.md` (always), `context/jsdoc-standards.md` (always), `context/code-review-checklist.md` (before opening the PR).
3. **Find the nearest existing analog** in `packages/gmt/src` (e.g. for a new `plain/interval/*` function, look at `plain/compare/isBetweenDate.ts` and `plain/map/mapDatesInRange.ts`) and match its file structure, error-handling shape (try-catch, sentinel returns), and JSDoc format exactly.
4. **Expand the one-line story into a full spec** before writing code: exact function signature(s), which Temporal API(s) it wraps, the sentinel return value, the locale matrix if locale-aware, and the specific edge cases the tests must cover (invalid input, DST boundaries, leap years/seconds, etc. as applicable).
5. **One story = one PR = one changeset.** Do not bundle multiple stories into one PR even if they touch the same namespace, unless the story list explicitly groups them (e.g. C1-C3 are sequenced together but are still separate, reviewable commits).
6. **Update `packages/gmt/README.md`** (via `/update-readme`) and add a changeset (via `/changelog`) as part of the same PR, not a follow-up.
7. **Update the TanStack Intent agent skills** (via `/tanstack-intent`, or manually following `.agents/skills/tanstack-intent/SKILL.md`) as part of the same PR whenever the story adds/renames/removes an exported function, adds an option to an existing one, or introduces a new domain concept. Skills that fall behind the actual API surface actively mislead agents consuming `@burglekitt/gmt` — this is not optional cleanup. The skill's own step 0 also checks whether the `@tanstack/intent` **tool** itself (the devDependency, not just the skill content) has drifted behind npm — run it periodically even outside of a specific story, since tool drift and content drift are independent failure modes.

See [story-groups.md](story-groups.md) for the Story Groups (A–G), [tracker.md](tracker.md) for the issue/status table, and `issues/<letter>.md` for each story's full GitHub-issue-ready spec.

## Suggested Sequencing

1. **C1–C3** (DST disambiguation) first — smallest, additive, no new namespace, immediately closes a correctness gap in existing code.
2. **A1–A5** (Duration parse/validate/add/subtract/normalize/format/diff-bridge) — foundational, kept together so Group A publishes as a single clean release with no other group's changesets riding along.
3. **D1–D3** (locale calendar helpers) — independent of A/B; sequenced after Group A finishes so each group's publish stays isolated (see [tracker.md](tracker.md)'s Publish column note).
4. **F1–F4** (business-day arithmetic, clamp/closest, time rounding) — small, independent of A/B/D; closes all four confirmed `temporal-kit` competitive gaps early rather than leaving them exposed through the whole B-group build-out.
5. **B1–B6** (Interval) — largest group, benefits from Duration existing (B6 splits by duration unit).
6. **G1–G2** (Interval rounding-out) — depends on B-group's namespace/conventions and (for G2) Group A's Duration strings; sequenced immediately after B so Group B's changesets don't sit half-published waiting on G.
7. **E1** — backlog, not scheduled.

## Verification (per story)

- Follow `context/testing-standards.md`: full locale matrix (17 locales) for any locale-aware function (D-group, A4), `hasFullIcu` ternaries where ICU-dependent output differs.
- Follow `context/coding-standards.md`: every new public function wraps Temporal calls in try-catch, returns typed sentinel (`""`/`null`/`false`/`[]`) on invalid input, never throws.
- Every function: `.test.ts` alongside it, JSDoc with `@example` covering valid/invalid/edge cases, exported from the namespace's `index.ts` per `context/jsdoc-standards.md`.
- Run `pnpm test` and `pnpm lint` (gmt-eslint/gmt-oxlint/gmt-biome Date-ban checks) before considering a story done.
- Update `packages/gmt/README.md` API surface section and add a `.changeset/*.md` entry per story, per repo convention (`/update-readme`, `/changelog` skills).
