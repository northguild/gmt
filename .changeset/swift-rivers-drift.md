---
"@burglekitt/gmt": minor
---

`convertPlainDateTimeToZoned` accepts a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how DST gaps (spring-forward) and overlaps (fall-back) are resolved when attaching a timezone to a plain datetime. `"reject"` returns `""` for any ambiguous or nonexistent local time instead of silently picking one.
