---
"@burglekitt/gmt": minor
---

Add `intervalCount`: `intervalCountDate`, `intervalCountTime`, `intervalCountDateTime`, `intervalCountUtc`, `intervalCountUnix`, `intervalCountZoned` — count how many calendar-unit boundaries the half-open interval `[start, end)` crosses, distinct from `diff*`'s exact elapsed duration. An interval from 23:59 to 00:01 is two minutes long but crosses two day boundaries. DST-aware for zoned and unix values, and `null` on invalid input.
