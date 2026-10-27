---
"@northguild/gmt": patch
---

`areZonedEqual` now compares the instant, the time zone and the calendar, as Temporal's `ZonedDateTime.prototype.equals` does, instead of the wall-clock fields and the zone name. Two readings of a repeated wall clock, such as `02:30+02:00` and `02:30+01:00` in Europe/Berlin on 2024-10-27, are an hour apart and no longer compare equal. Two names for one time zone, such as `UTC` and `Etc/UTC`, now compare equal on every host, and so do IANA link names such as `Europe/Kiev` and `Europe/Kyiv` wherever the host resolves them (Safari 27 without `Temporal` keeps two such names as written). `areZonedEqualBy`, `mapZonedDatesInRange` and `formatZonedRange` treat two names for one time zone as the same zone too, so a range or comparison that used to return the empty result or compare by clock label now works.

`diffZoned` and `diffZonedAsDuration` do the same: between two names of one time zone they accept a calendar unit and round by months as they do within one name, so `2024-01-31T00:00:00+00:00[UTC]` to `2024-02-29T12:00:00+00:00[Etc/UTC]` rounds up to `P2M` and truncates to `P1M`. The same holds for `intervalLengthZoned`.
