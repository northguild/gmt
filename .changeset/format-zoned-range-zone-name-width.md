---
"@northguild/gmt": patch
---

Fix `formatZonedRange` losing the zone name you asked for on Chrome, Node and Safari. With `timeZoneName: "long"` or `"longGeneric"` the range printed a short name (`EST`, `ET`), and with `"shortOffset"` or `"longOffset"` it printed no zone at all. A range now keeps the requested style, as Firefox does: `10:00 AM - 12:00 PM Eastern Standard Time`, `... GMT-5`, `... GMT-05:00`. The cause is an ICU bug (ICU-20548) that cuts the zone width from ranges; GMT checks for it once per style and only repairs on an engine that has it. Output with no `timeZoneName`, or with `short` or `shortGeneric`, is unchanged.

Also fix `formatZonedRange` on Firefox when `dayPeriod` and `timeZoneName` are both set and `hourCycle` and `hour12` are not: the range printed `10 AM GMT-5 - 12 PM GMT-5` instead of the flexible day periods `10 in the morning GMT-5 - 12 noon GMT-5` that a single `formatZoned` call gives. GMT checks for it once and only repairs on an engine that has it.
