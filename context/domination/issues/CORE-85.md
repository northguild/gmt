# CORE-85 — Core: Human duration strings

**Scope:** Parse the duration strings people write, such as `2h 30m`, `1.5h` or `3 days`, into ISO 8601 durations under a grammar GMT publishes, and format a duration back into the compact form.

## Gap

Configuration files, CLIs and timeouts are written as `30s`, `2h 30m` or `7d`, not `PT30S` or `P7D`. `parseDuration` accepts ISO 8601 only, so every caller writes a parser, and each one decides alone what `1m` means.

The most-used parser on npm, `ms` at 670.1M weekly downloads (2026-09-28 to 2026-10-04), documents no grammar. In those strings `1m` is a minute, while ISO 8601's `P1M` is a month. A grammar that is not written down is a guess at what the writer meant.

([Temporal duration grammar](https://tc39.es/proposal-temporal/#sec-temporal-iso8601grammar), [RFC 3339 Appendix A](https://www.rfc-editor.org/rfc/rfc3339.txt))

## Scope

- `packages/gmt/src/duration/parse/parseHumanDuration.ts`:
  - `parseHumanDuration(text: string): string` — an ISO 8601 duration string, or the sentinel. Each unit is kept as written: `3 days` is `P3D`, never `PT72H`. Two things change the units: a fraction spreads into smaller units (`1.5h` is `PT1H30M`), and a zero unit drops (`2h 0m` is `PT2H`). Milliseconds are the exception: ISO 8601 has no millisecond designator, so `500ms` is `PT0.5S` and `1s 500ms` is `PT1.5S`.
- `packages/gmt/src/duration/format/formatHumanDuration.ts`:
  - `formatHumanDuration(duration: string): string` — the compact form, largest unit first, zero units omitted: `PT2H30M` is `2h 30m`. A fraction of a second prints on seconds, never as `ms`: `PT1.5S` is `1.5s` and `PT1.0005S` is `1.0005s`.
- The grammar, published on the function page in EBNF:
  - an optional leading sign, then one or more number-and-unit pairs separated by spaces, commas or `and`;
  - units, case-insensitive: `y`, `yr`, `yrs`, `year`, `years`; `mo`, `month`, `months`; `w`, `wk`, `wks`, `week`, `weeks`; `d`, `day`, `days`; `h`, `hr`, `hrs`, `hour`, `hours`; `m`, `min`, `mins`, `minute`, `minutes`; `s`, `sec`, `secs`, `second`, `seconds`; `ms`, `millisecond`, `milliseconds`;
  - `m` is always a minute and `mo` always a month, so `M` is a minute too.

Not in scope: clock forms such as `1:30:00`, locale words, and locale-aware output, which `formatDuration` already provides.

## Tool

**Duration Parser Bench.** Type a duration string and see the ISO duration, the compact form and the locale rendering; the `1m`, `1mo` and `P1M` rows show which unit each one is and why. Calls `parseHumanDuration`, `formatHumanDuration`, `parseDuration`, `formatDuration`, `getDurationUnit` and `totalDuration`. The last two draw the unit cells and the laytime hours. Teaches: a duration string without a grammar is a guess.

## Design notes

- **GMT's own grammar, not a locale's.** No standard defines these strings; the grammar is stated in full on the docs page so the answer is never a guess. Locale rendering stays with `formatDuration`, which uses `Intl.NumberFormat` and `Intl.ListFormat`.
- **Fractions follow Temporal's duration rule.** Only hours, minutes and seconds may carry a fraction, and only the smallest unit in the string may. `1.5h` parses to `PT1H30M` and `2h 1.5m` to `PT2H1M30S`. `1.5h 30m` is rejected, as Temporal rejects `PT1.5H30M`; `1.5d` is rejected, because a day has no fixed length in a zone.
- **Each unit at most once, largest first.** `30m 2h` and `2h 3h` are rejected, so a typo is never summed.
- **All eight units are accepted with no option.** Months and years parse to calendar units; how long they are is decided when the duration is added to a date, as for any ISO duration.
- **Round trip.** `parseHumanDuration(formatHumanDuration(d))` returns `d` for every duration the parser can produce.

## What gmt provides (do not re-implement)

- `parseDuration` (`duration/parse/`) — the ISO 8601 reader the tool shows beside the human one, and the oracle of the round trip. Neither new function calls it.
- `formatDuration` (`duration/format/`) — locale rendering for the tool
- `getDurationUnit` (`duration/calculate/`) and `totalDuration` — the tool's unit cells and laytime hours
- `exactSeconds` (`internal/exactSeconds.ts`) — seconds plus sub-second fields in BigInt nanoseconds, moved out of `formatDuration.ts` so `formatHumanDuration` shares it

`Temporal.Duration.from` does the ISO reading inside both functions. `normalizeDuration` and `getDurationSign` are not used: `normalizeDuration` balances units, which the story forbids, and the formatter reads `duration.sign`.

## Verification

- A table of `1m`, `1M`, `1mo`, `1 month`, `1min`: minute or month as the grammar says.
- Separators: spaces, commas, `and`, none (`2h30m`).
- Fractions: `1.5h`, `0.25m`, `1.5s`, `2h 1.5m`; rejected `1.5h 30m`, `1.5s 500ms`, `1.5ms`, `1.5d`, `1.5w`, `1.5mo`, `1.5y`.
- Milliseconds: `500ms` is `PT0.5S`, `1s 500ms` is `PT1.5S`; `formatHumanDuration` gives `0.5s` and `1.5s` for them.
- Sign: `-2h`, `+2h`; rejected `2h -30m`.
- Sentinel rows: empty, an unknown unit, a repeated unit, units out of order, `1:30`, a number with no unit.
- The round trip over every accepted row.
- Full matrix: CI's 10 zones × Node 22, 24 and 26.
- `pnpm run validate` stays green.

## Decisions

Settled while building the story (2026-10-22). The JSDoc of `parseHumanDuration` holds the grammar; these are the rules behind it.

The tests, the fixture and the code comments cite the grammar's rules by these labels:

- **G1** A unit is the longest spelling that matches, and no ASCII letter may follow it (`1mo` is a month, `1mx` returns `""`).
- **G2** Ranks strictly increase left to right: each unit at most once, largest first.
- **G3** A fraction only on hours, minutes or seconds, and only on the last pair.
- **G4** One sign covers the whole duration and sits directly before the first digit.
- **G5** Milliseconds fold into seconds in BigInt, written with up to three fraction digits.
- **G6** The result is `Temporal.Duration.from(iso).toString()`: zero units drop, a fraction spreads, `-0s` is `PT0S`, and anything past Temporal's limits returns `""`.
- **G7** Unit spellings and `and` are ASCII case-insensitive (the `i` flag, never `u` or `v`).
- **G8** `M` is a minute, `MO` a month and `MS` a millisecond.
- **G9** A space is U+0020 only.

- **The grammar is GMT's own.** No standard defines these strings, so the grammar is written once, in ISO/IEC 14977 EBNF, in `parseHumanDuration`'s JSDoc. `internal/humanDuration.ts` holds the one unit table (`HUMAN_DURATION_UNITS`), the pair and separator regexes, and `humanDurationToIso`; both functions take their spellings and symbols from the table. The scoped exception in `context/coding-standards.md` lets this one parser read text by regex.
- **The output is an ISO 8601 duration as Temporal writes it.** The matched digits are rebuilt as an ISO string and handed whole to `Temporal.Duration.from`, which applies the fraction, the sign and the limits. Never a property bag: a bag takes no fraction, and a Number loses digits past 2^53.
- **`m` is a minute, `mo` a month, `ms` a millisecond.** The longest spelling that matches wins, and no ASCII letter may follow it (`1mx` returns `""`). Unit spellings and the word `and` are ASCII case-insensitive: the regexes carry the `i` flag and never `u` or `v`, so `ſ` and the Kelvin sign do not match.
- **Each unit once, largest first.** `2h 3h` and `30m 2h` return `""`, so a typo is never summed.
- **Fractions follow Temporal.** Only hours, minutes and seconds, only on the last pair, at most 9 digits, a digit on both sides of `.`. A decimal comma is refused: `,` is a list separator, and `1,500ms` reads 1500 in some locales and 1.5 in others.
- **Milliseconds fold into seconds in BigInt** and take no fraction. A cost guard refuses a count too long to pass Temporal's limits before any BigInt arithmetic.
- **One sign covers the whole duration.** `+` or `-` (U+002D) directly before the first digit. U+2212 and `- 2h` return `""`.
- **A space is U+0020 only.** A run of them is fine between pairs and between a number and its unit. A leading or trailing space, a tab, a newline or U+00A0 returns `""`, so the caller trims first. The compact form is `2h`, never `2 h`.
- **Separators:** spaces, a comma, `and`, or none (`2h30m`).
- **No string is valid in both grammars**, so a caller that takes either form chains `parseDuration(s) || parseHumanDuration(s)`. The parser returns `""` for any ISO string.
- **Both functions return `""`** for a non-string, input outside the grammar, or a duration past Temporal's limits. They take no options and no locale.
- **`formatHumanDuration` does not balance.** `PT90M` is `90m`. A sub-second part prints on seconds with every digit (`PT1.5S` is `1.5s`) and `ms` is never written. A negative duration has one leading `-`, and a zero duration is `0s`. To carry, run `normalizeDuration("PT90M", { largestUnit: "hour" })` first, which gives `PT1H30M` and formats as `1h 30m`. Temporal spreads a fraction before formatting: `PT1.5H` is `1h 30m`.
- **The round trip holds for every valid ISO 8601 duration:** `parseHumanDuration(formatHumanDuration(d))` equals `parseDuration(d)`. The tests iterate the shared fixture `src/test/humanDurationRows.ts` and the ISO rows.
- **Neither function calls another public function** (the loop-cost rule): the parser calls `Temporal.Duration.from`, and the formatter reads `duration.sign`.
- **Bundle budget.** The `root` budget in `scripts/bundle-size.budgets.json` went from 505900 to 511400 B by hand. Root measures 506305 B, and the new budget is that size times 1.01, rounded up to the next 100.
- **Tool.** The Duration Parser Bench is built in Dox; its choices are in `context/dox/built.md`.
