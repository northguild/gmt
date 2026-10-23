# CORE-89 — Core: The Morocco 2026 clock-change checker in Dox

**Scope:** Dox gains a Morocco 2026 clock-change checker at `/gmt/check/morocco-2026-clock-change`, built from the Canada checker's parts, which become shared rather than copied. Adds no library function.

## Gap

Since 2026-09-20, Morocco and Western Sahara stay on UTC+00 all year and no longer change their clocks for Ramadan; tzdb 2026c records it. A runtime with older tz data shows `Africa/Casablanca` and `Africa/El_Aaiun` at `+01:00` outside Ramadan and `+00:00` during it, so it is an hour ahead for most of the year and right for a few weeks, which hides the fault. Measured: Chromium 153.0.8010.12 gives `+01:00` at 2026-10-22T12:00Z and 2027-06-01T12:00Z; Chromium 156.0.8078.4, WebKit 26.6 and Node 26.12.1 (tz 2026e) give `+00:00`. Casablanca is in the Canada API's `probe` only; the Canada page's table (`TABLE_ZONES`) leaves it out.

## Scope

- **The checker** at `/gmt/check/morocco-2026-clock-change`, MIT like the rest of Dox, with its chat pill and widget registration: the reader's runtime against tzdb 2026c for both zones, the clock changes that no longer happen, and which saved events moved (`classifyStoredZoned`). The Dox Worker computes it when the page is requested.
- **Shared parts.** The Canada checker's runtime probe, live clocks, saved-events check and help card become parts both pages use. The Canada page keeps its behaviour and its tests.
- **A test file** beside `packages/gmt/src/test/oh-canada.test.ts`: fixed instants through 2027, Ramadan included, every row failing on tz data older than 2026c. The page links to it.
- **The weekly native run.** A `KNOWN_HOST_FAILURES` group for Chromium, with evidence, if the run's Chromium still predates 2026c when the test lands.

## What gmt provides (do not re-implement)

- The Canada checker, its Worker endpoint and its page parts (`CORE-88`)
- `classifyStoredZoned` (`CORE-83`)
- `getTimeZoneOffset`, `getDstTransitions` and the zone helpers the Worker endpoint calls

## Verification

- The checker page and its Worker endpoint answer 200 live, and the Worker column matches tzdb 2026c for both zones.
- The Canada page renders and behaves as before on the shared parts.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.

## Decisions

Built.md Tier 2 (Morocco, shared checker parts) and Tier 6 hold the page, Worker and request-pipeline rules. These are the choices they do not carry.

**Library and native run**

- `packages/gmt/src/test/morocco-2026.test.ts` (48 tests) is the only `packages/gmt` source change. Every row passes on tz 2026c or later and fails on older data. A mid-Ramadan instant reads `+00:00` on old data too, so it never stands alone in a row. There is no changeset, because no exported API changed.
- `chromium-morocco-2026-tz-data` in `KNOWN_HOST_FAILURES` covers the weekly run's Chromium (153.0.8010.12), which predates 2026c.
- Authority for Morocco rules is tzdb 2026c `africa` (`Zone Africa/Casablanca`, `Africa/El_Aaiun`). The changes that no longer happen come from the 2026b `Rule Morocco 2027` lines.

**Shared parts**

- `ClockCheckFacts` has no `api` field. `mount.ts` builds ``withBase(`/api/${facts.id}-clock-change`)`` at the call site, because the dist-base bundled-script scan only exempts a literal that sits directly inside a `withBase(...)` call.
- `clock-check/template.ts` renders the saved-events zone row visible on load when `needsZonePicker(page.storedPreset)`. Morocco's preset ends with a zoneless line, and rendering the row hidden made the page grow by 71px on mount (`grow-measure.mjs`).
- `clock-check.css` sets `@container gmt-check (max-width: 21rem) { .gmt-check-table :is(th, td) { padding-inline: var(--gmt-space-1); } }`, and `canada-clock-change.css` sets `grid-template-columns: minmax(0, 1fr)` on `.gmt-canada-stage`. Together they remove WebKit's sideways scroll at 375px, which `main` already had.

**Chat**

- `dox-tools.ts` writes the two Morocco zone ids as a literal `z.enum`, not `z.enum(MOROCCO_ZONES)`. Importing the facts would pull them into the chat island's static graph, which `widget-graph.test.ts` forbids. A parity test in `src/lib/morocco-clock-change-mount.test.ts` pins the two lists together.
- The chat starter reads "Does my runtime still apply the old 2027 Ramadan clock changes for Africa/Casablanca?". `chat-starters.test.ts` requires each starter to name a concrete zone city or a digit, so the word "2027" is part of the text.

**Checks and data**

- `morocco-still.mjs` fixes its clock at 2026-09-20T00:58:30Z, 90 s before both zones leave `+01:00`. One advance then crosses the real change, and the readouts are checked across `+01:00` to `+00:00`.
- The runtime minimums carry OpenJDK 25.0.5 / 21.0.13 / 17.0.21, each the first tag containing the 2026c commit, RHEL 8 to 10 (RHBA-2026:51069) and Amazon Linux 2023 (2023.12.20260720). Each was checked against the project's own source.
