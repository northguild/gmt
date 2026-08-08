---
"@burglekitt/gmt": minor
---

`addZoned` and `subtractZoned` accept a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how a fall-back (DST-end) overlap is resolved when the arithmetic result lands on an ambiguous local time. `"reject"` returns `""` for an ambiguous result instead of silently picking one.

This option has no effect on a spring-forward (DST-start) gap: Temporal's arithmetic always resolves a gap landing unambiguously before disambiguation is evaluated, so all four values produce the same result in that case.
