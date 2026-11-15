---
"@northguild/gmt": patch
---

Formatting no longer stops Node with a crash, and prints the right year, in languages whose date patterns print the year a week belongs to instead of the calendar year. `formatZonedRange`, `formatCalendar` and the `…ToParts` functions stopped Node 22, 24 and 26 with a crash for some languages and calendars, for example Burmese with the Buddhist calendar, and Galician with the Hebrew, Buddhist or ROC calendar and a full date style. Every format function also printed the wrong year near the start or end of a year, or all year in the Buddhist, Japanese and ROC calendars: Scottish Gaelic printed `Dùbh 2025` for 30 December 2024, and now prints `Dùbh 2024`.

Some calendars and languages printed a year or a range that the specifications do not give, and now print the specifications' text:

- The Japanese calendar before 1873, when Japan adopted it, printed an era year: `Dec 31, 5 Meiji` for 31 December 1872 is now `Dec 31, 1872 AD`.
- An Islamic date before the Hijra printed a negative year such as `-23 AH`, and is now the empty value.
- Japanese with the Japanese calendar and a two-digit year printed `令和6年`, and now prints `令和06年`. The first year of an era stays `元年`. With another numbering system the era year printed Latin digits, and now prints that system's digits: `ja-u-ca-japanese-nu-arab` printed `令和6年` and now prints `令和٦年`.
- The Chinese and Dangi calendars with a two-digit year padded the related year, which has no two-digit form: `05(yi-chou)` for the year 5 is now `5(yi-chou)`.
- A range whose language's interval pattern drops or repeats a field, such as the year of a Chinese-calendar range across two years, prints both dates in full, joined by the language's own range separator.
- A language with the `islamic` calendar printed the astronomical Hijri date (`Muh. 5, 1446 AH` for 10 July 2024). It now prints the tabular `islamic-tbla` date (`Muh. 4, 1446 AH`), and `islamic-rgsa` prints the language's default calendar.
