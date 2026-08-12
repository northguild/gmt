---
"@burglekitt/gmt": minor
---

Add `intervalContainsDate`, `intervalContainsTime`, `intervalContainsDateTime`
(plain), `intervalContainsUtc` (utc), `intervalContainsUnix` (unix), and
`intervalContainsZoned` (zoned) — interval containment checks. Each supports
two modes via an optional fourth argument:

- 3-arg: `intervalContains(start, end, point)` — true when `start <= point <= end`
- 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the
  inner interval is fully contained within the outer interval
