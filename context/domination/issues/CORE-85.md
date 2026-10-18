# CORE-85 — Core: Human duration strings

**Scope:** Parse the duration strings people write, such as `2h 30m`, `1.5h` or `3 days`, into ISO 8601 durations under a grammar GMT publishes, and format a duration back into the compact form.

## Gap

Configuration files, CLIs and timeouts are written as `30s`, `2h 30m` or `7d`, not `PT30S` or `P7D`. `parseDuration` accepts ISO 8601 only, so every caller writes a parser, and each one decides alone what `1m` means.

The most-used parser on npm, `ms` at 557.6M weekly downloads (2026-10-17), documents no grammar. In those strings `1m` is a minute, while ISO 8601's `P1M` is a month. A grammar that is not written down is a guess at what the writer meant.

([Temporal duration grammar](https://tc39.es/proposal-temporal/#sec-temporal-iso8601grammar), [RFC 3339 Appendix A](https://www.rfc-editor.org/rfc/rfc3339.txt))

## Scope

- `packages/gmt/src/duration/parse/parseHumanDuration.ts`:
  - `parseHumanDuration(text: string): string` — an ISO 8601 duration string, or the sentinel. Each unit is kept as written: `3 days` is `P3D`, never `PT72H`.
- `packages/gmt/src/duration/format/formatHumanDuration.ts`:
  - `formatHumanDuration(duration: string): string` — the compact form, largest unit first, zero units omitted: `PT2H30M` is `2h 30m`.
- The grammar, published on the function page in EBNF:
  - an optional leading sign, then one or more number-and-unit pairs separated by spaces, commas or `and`;
  - units, case-insensitive: `y`, `yr`, `yrs`, `year`, `years`; `mo`, `month`, `months`; `w`, `wk`, `wks`, `week`, `weeks`; `d`, `day`, `days`; `h`, `hr`, `hrs`, `hour`, `hours`; `m`, `min`, `mins`, `minute`, `minutes`; `s`, `sec`, `secs`, `second`, `seconds`; `ms`, `millisecond`, `milliseconds`;
  - `m` is always a minute and `mo` always a month, so `M` is a minute too.

Not in scope: clock forms such as `1:30:00`, locale words, and locale-aware output, which `formatDuration` already provides.

## Tool

**Duration Parser Bench.** Type a duration string and see the ISO duration, the compact form and the locale rendering; the `1m`, `1mo` and `P1M` rows show which unit each one is and why. Calls `parseHumanDuration`, `formatHumanDuration`, `formatDuration`. Teaches: a duration string without a grammar is a guess.

## Design notes

- **GMT's own grammar, not a locale's.** No standard defines these strings; the grammar is stated in full on the docs page so the answer is never a guess. Locale rendering stays with `formatDuration`, which uses `Intl.NumberFormat` and `Intl.ListFormat`.
- **Fractions follow Temporal's duration rule.** Only hours, minutes and seconds may carry a fraction. `1.5h` parses to `PT1H30M`; `1.5d` is rejected, because a day has no fixed length in a zone.
- **Each unit at most once, largest first.** `30m 2h` and `2h 3h` are rejected, so a typo is never summed.
- **All eight units are accepted with no option.** Months and years parse to calendar units; how long they are is decided when the duration is added to a date, as for any ISO duration.
- **Round trip.** `parseHumanDuration(formatHumanDuration(d))` returns `d` for every duration the parser can produce.

## What gmt provides (do not re-implement)

- `parseDuration` and `normalizeDuration` (`duration/`) — ISO 8601 validation of the result
- `formatDuration` (`duration/format/`) — locale rendering for the tool
- `getDurationSign` (`duration/calculate/`) — the sign for formatting

## Verification

- A table of `1m`, `1M`, `1mo`, `1 month`, `1min`: minute or month as the grammar says.
- Separators: spaces, commas, `and`, none (`2h30m`).
- Fractions: `1.5h`, `0.25m`, `1.5s`; rejected `1.5d`, `1.5w`, `1.5mo`, `1.5y`.
- Sign: `-2h`, `+2h`; rejected `2h -30m`.
- Sentinel rows: empty, an unknown unit, a repeated unit, units out of order, `1:30`, a number with no unit.
- The round trip over every accepted row.
- Full matrix: CI's 10 zones × Node 22, 24 and 26.
- `pnpm run validate` stays green.
