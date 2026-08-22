---
"@burglekitt/gmt": minor
---

Add named machine-format format/parse pairs: `formatRfc2822`/`parseRfc2822` (zoned), `formatHttp`/`parseHttp` (utc), `formatSql`/`parseSql` (plain), `formatRfc3339`/`parseRfc3339` (zoned) (Story J13).

These are **fixed, non-locale-adaptive grammars** — RFC 5322 and RFC 7231 mandate English weekday/month abbreviations regardless of locale, by specification — so none of the eight take a `locale` argument, unlike GMT's `Intl`-backed formatters. `""` on invalid input for every function.

- `formatRfc2822`/`parseRfc2822` — RFC 5322 (RFC 2822) email `Date:` header format, e.g. `"Fri, 15 Mar 2024 14:30:00 -0400"`. Parsing accepts a 1- or 2-digit day and RFC 5322's obsolete named zones (`GMT`, `UT`, and the eight North American zones); formatting always emits a zero-padded, numeric offset.
- `formatHttp`/`parseHttp` — RFC 7231 IMF-fixdate, e.g. `"Fri, 15 Mar 2024 14:30:00 GMT"`, for `Last-Modified`/`Date`/`Expires` headers. Strict 2-digit fields and a literal `GMT` only; the obsolete RFC 850/asctime HTTP-date forms are a documented limitation, not accepted.
- `formatSql`/`parseSql` — ANSI SQL / ODBC datetime literal, e.g. `"2024-03-15 14:30:00"`, for `DATETIME`/`TIMESTAMP` columns without a time zone. SQL's offset-carrying `TIMESTAMPTZ` literal is out of scope.
- `formatRfc3339`/`parseRfc3339` — strict RFC 3339. This is *not* a passthrough on GMT's existing ISO output: GMT's own zoned strings always carry a bracketed IANA zone annotation (`...+00:00[UTC]`) that RFC 3339 does not permit, so `formatRfc3339` strips it. A parallel `utc`/`unix` wrapper was deliberately not added — `Temporal.Instant.prototype.toString()` is already fully RFC 3339 compliant with no bracket to strip, so a wrapper there would be a pure passthrough.
