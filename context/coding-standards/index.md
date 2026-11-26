# Coding Standards

Rules for source in `packages/gmt/`. Load the one file the task touches.

| File | Read it when |
| --- | --- |
| [api-contract.md](./api-contract.md) | Always for source: the sentinel table, option-reading rules, `get/` accessors, try-catch, the UTC clock-reader exception |
| [calendar-and-zones.md](./calendar-and-zones.md) | A function does calendar arithmetic, zoned boundaries, repeated steps or intervals (rules 1 to 8) |
| [calendar-strings.md](./calendar-strings.md) | A string carries a `[u-ca=...]` annotation, or a function reads or writes one |
| [runtime-workarounds.md](./runtime-workarounds.md) | Always for a change that makes GMT answer differently from the polyfill or a runtime (`temporalCompat`, compat entries, refusals): the frozen approach |
| [design-rules.md](./design-rules.md) | Writing a loop, choosing a namespace, citing an authority; lint packages |
| [string-grammars.md](./string-grammars.md) | Parsing a fixed non-ISO grammar: `parse*WithPattern`, RFC 2822, HTTP date, time scales, TAI64, CCSDS, durations, identifiers, recurrence and cron |
| [string-grammars-industry.md](./string-grammars-industry.md) | EDI (EDIFACT, X12), finance (FIX, SWIFT) or aviation (SSIM, METAR, NOTAM) grammars |
| [string-grammars-health-rail.md](./string-grammars-health-rail.md) | HL7 v2, FHIR R4 or GTFS grammars |
| [changesets.md](./changesets.md) | Choosing the bump level or writing a changeset |
