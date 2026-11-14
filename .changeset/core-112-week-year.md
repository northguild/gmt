---
"@northguild/gmt": patch
---

Formatting no longer stops Node with a crash, and prints the right year, in languages whose date patterns print the year a week belongs to instead of the calendar year. `formatZonedRange`, `formatCalendar` and the `…ToParts` functions stopped Node 22, 24 and 26 with a crash for some languages and calendars, for example Burmese with the Buddhist calendar, and Galician with the Hebrew, Buddhist or ROC calendar and a full date style. Every format function also printed the wrong year near the start or end of a year, or all year in the Buddhist, Japanese and ROC calendars: Scottish Gaelic printed `Dùbh 2025` for 30 December 2024, and now prints `Dùbh 2024`.
