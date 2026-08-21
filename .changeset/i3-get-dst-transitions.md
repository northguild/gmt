---
"@burglekitt/gmt": minor
---

Add `getDstTransitions` — enumerate daylight-saving-time transition points for an IANA timezone in a given year (Story I3):

- `getDstTransitions`

Returns an array of `{ instant, offsetBefore, offsetAfter }` objects representing each DST transition. Returns `[]` for zones with no transitions in the requested year or on invalid input.
