---
"@northguild/gmt": patch
---

Fix `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` returning `null` for a calendar unit between two names of one time zone, such as `UTC` and `Etc/UTC` or `Asia/Kolkata` and `Asia/Calcutta`, when GMT runs in WebKit. The polyfill finds a zone name's primary form through `Intl.DateTimeFormat`, which JavaScriptCore returns as written, so it took the two names for two zones. GMT checks for this once and, where the check fails, asks the browser's own `Temporal` whether the two names are one zone. On Chrome, Firefox and Node nothing changes. Safari has no `Temporal` yet, so there the two names still count as two zones.
