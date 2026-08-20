---
"@burglekitt/gmt": minor
---

Add `roundingMethod` option to the `formatRelative*` family (Story I2):

- `formatRelativeDate`, `formatRelativeDateTime`, `formatRelativeTime`, `formatRelativeZoned`, `formatRelativeUnix`, `formatRelativeUtc`

`roundingMethod?: "floor" | "ceil" | "round"` controls how the computed distance rounds to the display unit — applied to the signed fractional value, matching date-fns's `formatDistanceStrict`. Defaults to `"round"`, matching existing behavior; no call-signature changes.
