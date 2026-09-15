---
"@northguild/gmt": minor
---

Export the `nanosecondDecimal` pattern from `@northguild/gmt/regex` and the package root.

`isValidNanoPattern` documented it as a `regex/` pattern, but the `regex` barrel never re-exported its file, so it could not be imported. It now can.
