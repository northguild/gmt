---
"@northguild/gmt": patch
---

`roundZoned` and `roundUnix` now round to the day as Temporal specifies when a clock change makes a date start twice, such as America/Goose_Bay on 6 November 2010.
