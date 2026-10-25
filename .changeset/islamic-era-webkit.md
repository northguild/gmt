---
"@northguild/gmt": patch
---

Islamic calendar dates before the Hijra (622 CE) read and compute correctly in WebKit (Safari). WebKit prints such a date as a positive year in a second era and the polyfill takes the year as printed, so `calendarDate` fields were wrong and `diffDateAsDuration`, `addDate` and the other date arithmetic across that epoch in `islamic-civil`, `islamic-tbla` or `islamic-umalqura` never returned. GMT now reads the era, corrects the year and runs the specification's arithmetic itself for those years. Output is unchanged on every other engine (temporalCompat workaround D18).
