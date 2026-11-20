# Phase 4 — filings data, compat text, Dox pages, changeset

Read with [index.md](index.md). Built last, after phases 1–3 pass: every guard named here must
exist as a repros group first (`scripts/upstream.mjs` `checkGuard` reads `repros.ts`). Text rules:
plain English (ISO 24495-1), no judgement of any library, no law, specs and standards only.

## 1. `apps/dox/src/data/upstream-filings.json`

`checkGuard` requires exactly one of `gmtGuard` and `gmtNote`, and a guard that is a group in
`repros.ts`.

| Filing | Change |
| --- | --- |
| fullcalendar/temporal-polyfill #128 (issue), #132 (PR) | `gmtGuard: "D33"`, `gmtNote: null` |
| WebKit 331724 | `gmtGuard: "D18"` → `"D32"` (331724 is the Islamic epoch-day switch, which D32 repairs) |
| tc39/proposal-temporal #3327 | `gmtGuard: "D1"` → `["D1", "D6"]` (needs § 2; Open question 8). If the owner says no, keep `"D1"` |
| tc39/proposal-temporal #3329 | `gmtGuard: "D10"`, `gmtNote: null` (D10 is a probe group and the canary that watches it) |
| tc39/proposal-temporal #3301 | `gmtGuard: null`; `gmtNote`: "GMT treats two zone names as one zone only when they are the same name in any letter case, or both are a name ECMA-402 resolves to UTC, so it gives the same answer on every host and does not depend on how a runtime canonicalizes zone names." |
| WebKit 330688 | `gmtGuard: "D35"`, `gmtNote: null` |
| tc39/proposal-temporal #3342 (new) | the owner runs `pnpm upstream:sync`, which adds the row with its tracker fields. Then fill the hand-written fields: `work: "report"`, `summary` below, `gmtGuard: null`, `gmtNote` below |

Issue 3342 is "Polyfill: `multiple instants found` is thrown for a wall-clock time that has no
instant", opened 2026-11-19.

- `summary`: "Reading a local time that a clock change skipped, with `disambiguation` set to
  `reject`, throws an error saying several instants were found, when there are none. The same
  message is right for a time that happens twice, so a reader cannot tell the two cases apart."
- `gmtNote`: "GMT returns its empty value for a local time that has no instant and never shows the
  polyfill's message, so the wording cannot reach GMT's users."

Checked against the filed body (Helsinki 2027-03-28T03:30; `DisambiguatePossibleEpochNanoseconds`;
the fix is a message only). Do not touch the `gmtUnguarded` rows (deck branch only).

## 2. Widening `gmtGuard` to a list (Open question 8, default yes)

Type: `gmtGuard: string | readonly string[] | null`. A list holds two or more ids, never one
(a single id stays a string, so no existing row changes). Badge text joins with ` + `:
"Guarded · D1 + D6". Every reader normalizes with one helper, `guardIds(f): string[]`, exported
from `upstream-filings.ts` beside the type; no reader branches on `Array.isArray` itself.

| File | Change |
| --- | --- |
| `apps/dox/src/data/upstream-filings.ts:53` | the type; JSDoc names the list form |
| `upstream-filings.ts:473–492` | the distinct-guard list flattens with `guardIds` |
| `scripts/upstream.mjs:153`, `:165`, `:172`, `:294` | read and write the field (sync must keep a list as written) |
| `scripts/upstream.mjs:945–958` `checkGuard` | every id of the list must be a group; a one-item list is a problem ("write one id as a string") |
| `apps/dox/src/lib/upstream-badges.ts:126` | badge text from `guardIds(f).join(" + ")` |
| `apps/dox/src/components/UpstreamDefects.astro:17`, `UpstreamDefectRow.astro:24`, `UpstreamFilingRow.astro:48` | `guardIds` |
| `apps/dox/src/lib/mdx-jsx.ts:361` | `guardIds` |
| `scripts/lib/upstream-trackers.mjs:45` | `guardIds` (scripts may not import TS: a three-line local twin, with a test that both agree) |
| tests: `upstream-filings.test.ts`, `upstream-badges.test.ts`, the `upstream.mjs` check test, `upstream-trackers.test.ts` | a list row renders "Guarded · D1 + D6"; a list with an unknown id fails the check; a one-item list fails; a string row is unchanged |

## 3. D13 wording

The El_Aaiun stall is filed; the skipped pairs are not. README Removal-trigger row D13
(`temporalCompat/README.md:203`): replace "(bug doc § K; not filed)" with "(tc39/proposal-temporal#3332)".
After the trigger's first sentence, add: "Two offset changes inside one 14-day step that the search
skips (`America/Boa_Vista`, `Europe/Riga`) are not filed." `scripts/lib/workarounds.mjs:167`, the
D13 trigger: "(not filed)" becomes "(tc39/proposal-temporal#3332)", and the same second sentence
is appended.

## 4. `WHAT_BREAKS` (`apps/dox/src/data/temporal-compat.ts`)

| Key | Text |
| --- | --- |
| D19 | delete the entry |
| D26 | "Islamic calendar dates before the Hijra (622 CE). Node and Chrome print them as a negative year and have no name for the era before the Hijra; Safari names it. GMT returns its empty value on every browser, so the answer is the same everywhere" |
| D28 | append: "GMT does not print Chinese or Korean calendar dates while D33 holds, so this repair is not used for now" |
| D29 | drop "such as a Chinese calendar range a year apart without the Gregorian year, or"; keep the Yoruba example: "…a part of one date, such as a Yoruba range with the weekday twice. GMT prints…" |
| D33 (new) | "Chinese and Korean (Dangi) calendar dates, which runtimes print differently: Node and Chrome put the Chinese New Year 2027 on 7 February, Safari and the standard on 6 February. GMT has no calendar data of its own, so it returns its empty value for these dates on every runtime" |
| D34 (new) | "Coptic calendar dates on the first day of the year 1 AM (ISO 284-08-29), which Safari prints for its first hours with the long era name Anno Martyrum, and ranges across that day, which Safari prints with the era twice. GMT prints AM for the whole day" |
| D35 (new) | "The time zone names CST6CDT, EST5EDT, MST7MDT, PST8PDT, CET, EET, MET, WET and Factory, which some runtimes accept and others reject. GMT treats them as invalid on every runtime" |

If phase 2's bisect adds D36, its entry is written then, in this table's style.
`temporal-compat.test.ts` fails a group with no entry, so every new repros group needs its line.

## 5. Dox pages

- `apps/dox/src/content/docs/guides/core-date-operations/calendar-systems.mdx:45`: after
  "`chinese`, `dangi`, `islamic` and `islamic-rgsa` are not supported." add "A format function
  given a `chinese` or `dangi` locale or `calendar` option returns its empty value for any date
  field, because runtimes print different dates for these calendars. A time or a weekday alone
  still prints."
- `apps/dox/src/content/docs/upstream.mdx:91–93`, the "Chinese and Dangi" bullet: keep the first
  two sentences and the links; add "GMT does not print these calendars on any runtime until every
  runtime agrees, so this does not block the switch."
- `upstream.mdx:94–96`, "Zone names that are links": replace the last sentence with "GMT now treats
  a link and its target as two zones on every runtime, so this matches GMT's own rule."
- `upstream.mdx:192–194`, the WebKit 330688 bullet: add "GMT treats these names, and `CET`, `EET`,
  `MET`, `WET` and `Factory`, as invalid on every runtime."
- Dox globe: `apps/dox/src/lib/globe-zones.ts` takes its zones from `getTimeZones()`, which now
  leaves the nine names out. `TZ_COORDINATES` keeps its rows (generated from tzdb, unused rows are
  harmless). Run `globe.test.ts`.

## 6. Bug docs (`context/domination/polyfill-bugs/`)

- `ac-ae.md:99–105` § "POSIX zone ids: WebKit bug 330688": the sentence "the other legacy ids
  (`CET`, `EET`, `MET`, `WET`, …) work" is true of macOS only. Replace with: "On Linux WebKit 26.6
  also rejects `CET`, `EET`, `MET` and `WET`; macOS accepts them." Add: "GMT refuses all nine names
  on every host (compat D35)."
- `status.md:108` (WebKit 330688 row): the GMT column becomes "AE (D35, refused everywhere)".
- `status.md`: the D34 row from [coptic-epoch-era.md](coptic-epoch-era.md).
- The fullcalendar #128 row (status.md:102): "swap check (Chinese, Dangi)" becomes "D33".
- `ac-ae.md` § 330688 also names the cause: `isValidTimeZoneNameFromICUTimeZone` in WebKit's
  `Source/JavaScriptCore/runtime/IntlObject.cpp` drops every name without a `/` except `UTC` and
  `GMT`. The owner posts this approved comment on the bug himself (his account):

  > The cause seems to be `isValidTimeZoneNameFromICUTimeZone` in Source/JavaScriptCore/runtime/IntlObject.cpp. It drops every time zone name that has no `/`, except `UTC` and `GMT`, on the assumption that ICU has already resolved such names through backward links. So a name with no slash works only when the host's time zone data makes it a link to a name with a slash.
  >
  > That would explain what I see:
  > - tzdb 2024b made the System V names links, and macOS 26 accepts them.
  > - tzdb 2026d made EST5EDT, CST6CDT, MST7MDT and PST8PDT zones again, and macOS 27 refuses them.
  > - Playwright's Linux build of WebKit 26.6 also refuses CET, EET, MET and WET, but accepts EST, MST and HST.
  >
  > test262 covers the four names in test/intl402/Temporal/ZonedDateTime/iana-legacy-names.js, which expects `new Temporal.ZonedDateTime(0n, "EST5EDT").timeZoneId` to be "EST5EDT". JSTests/test262/expectations.yaml does not list it, so it should start failing on bots that run macOS 27.

## 7. Changeset `.changeset/chinese-dangi-one-answer.md`

```md
---
"@northguild/gmt": patch
---

Chinese and Dangi (Korean) calendar dates now format to GMT's empty value on every runtime.
```

Then one short paragraph each, plain English, no defect ids in the lead:

- Chinese and Dangi: runtimes print different dates (example: the Chinese New Year 2027), and GMT
  has no calendar data of its own. A time or a weekday alone still formats.
- Coptic: the first day of the year 1 AM prints `AM` for the whole day on every runtime.
- The nine zone names are invalid on every runtime; list them.
- An Islamic date before the Hijra formats to the empty value on Safari too.
- Two zone names are one zone only when they are the same name in any letter case, or both are
  `UTC`, `Etc/UTC`, `Etc/GMT` or `GMT`. A link and its target, such as `Asia/Calcutta` and
  `Asia/Kolkata`, are now two zones on Node and Chrome as well, so `areZonedEqual` returns `false`
  for them and a day-based difference between them returns the empty value.

The finalizer runs `/changelog` on it.

## 8. Snapshot

`temporal-compat.json` (the Dox snapshot) gains D33, D34, D35 rows and loses D19. It is written
by `node scripts/temporal-compat.mjs check` after the one build. The owner runs the build (his
`pnpm dox:dev` reads `packages/gmt/dist`); no agent runs it.
