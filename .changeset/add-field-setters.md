---
"@burglekitt/gmt": minor
---

Add field setters: `setDate`, `setDateTime`, `setTime`, `setZoned`, `setUnix`, `setUtc` (Story J1).

Each takes a partial fields object and wraps `Temporal.*.prototype.with()`, resolving every supplied field in a single atomic overflow pass — the safe alternative to composing `add*` calls field-by-field, which resolves each field's overflow independently and can silently diverge on multi-field updates (e.g. setting month-then-day vs. day-then-month on the same target).

All six take `overflow` ("constrain" (default) | "reject"). `setZoned`, `setUnix`, and `setUtc` additionally take `disambiguation` and `offset` (default `"ignore"`, same rule as the `startOfZoned` family — see `docs/dst-disambiguation.md`) for DST gap/overlap control; `setUtc`'s `disambiguation`/`offset` are accepted for signature consistency but are permanently inert, since `"UTC"` has no DST transitions.

An empty fields object is a no-op on all six.
