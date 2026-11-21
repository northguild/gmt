---
"@northguild/gmt": patch
---

Three more locale and calendar pairs format right on Node and other V8 builds that lack the week-year fix.

- **Coptic and Ethiopic dates in `ksh`, `my` and `te`.** `formatDate`, `formatDateToParts` and the other date formats returned `""` (`[]` for parts). They now print the date, with the Coptic or Ethiopic year.
- **Weekday names that hold a digit on some days.** In `lg`, `luy` and `sg`, some weekday names contain a digit (`Lw2` in `lg`) and others do not. The parts functions returned `[]` for a date that fell on such a day. They now return the parts, with the weekday name in one piece.
- **A zone name in `my` with the Buddhist calendar.** `formatZonedToParts` with `timeZoneName` crashed the process. It now returns the parts.

A runtime that already formats these dates right keeps its own text.
