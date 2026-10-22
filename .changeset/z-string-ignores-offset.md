---
"@northguild/gmt": patch
---

Fix a zoned value ending in `Z` and carrying a calendar annotation, such as `+275760-09-12T23:00:00Z[America/Sao_Paulo][u-ca=hebrew]`, being refused near the end of the supported range. `addZoned` returned `""` for it, as did the other functions that read the calendar first, because GMT read the time of day in the zone instead of taking the instant the `Z` names, which is how the Temporal specification reads it. They now return the result.
