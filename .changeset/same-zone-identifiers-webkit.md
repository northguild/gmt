---
"@northguild/gmt": patch
---

Fix `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` returning `null` for a calendar unit between two names of one time zone, such as `UTC` and `Etc/UTC` or `Asia/Kolkata` and `Asia/Calcutta`, when GMT runs on the polyfill in WebKit. The polyfill finds a zone name's primary form through `Intl.DateTimeFormat`, which JavaScriptCore returns as written, so it took the two names for two zones. GMT checks for this once. Where the check fails:

- `Etc/UTC`, `Etc/GMT` and `GMT` count as `UTC`, as ECMA-402 requires. This works in every WebKit, Safari 27 included.
- For any other pair, GMT asks the browser's own `Temporal`. This works in WebKit builds that ship `Temporal`, such as Playwright WebKit 26.6. Safari 27 has no `Temporal`, and no other browser API there names a zone's primary form, so in Safari 27 a pair such as `Asia/Kolkata` and `Asia/Calcutta` still counts as two zones.

On Chrome, Firefox and Node nothing changes.
