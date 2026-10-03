---
"@northguild/gmt": minor
---

Read two adjacent single quotes in a parse pattern as one literal quote, wherever they appear.

`parseDateWithPattern`, `parseTimeWithPattern` and `parseDateTimeWithPattern` follow the Unicode UTS #35 date format pattern rules for literal text. UTS #35 gives `''` one meaning, a literal `'`, inside and outside quoted text. These functions applied it only inside quoted text such as `'o''clock'`, and read `''` anywhere else as nothing at all. A pattern such as `"MMM d, ''yy"` now reads `"Mar 15, '24"`.

### Breaking changes

A pattern with `''` outside quoted text now needs a `'` in the value at that position.

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `parseDateWithPattern("2024'01'15", "yyyy''MM''dd")` | `""` | `"2024-01-15"` |
| `parseDateWithPattern("20240115", "yyyy''MM''dd")` | `"2024-01-15"` | `""` |
| `parseTimeWithPattern("14'30", "HH''mm")` | `""` | `"14:30:00"` |
| `parseTimeWithPattern("1430", "HH''mm")` | `"14:30:00"` | `""` |
| `parseDateTimeWithPattern("2024-01-15'14:30:00", "yyyy-MM-dd''HH:mm:ss")` | `""` | `"2024-01-15T14:30:00"` |
| `parseDateTimeWithPattern("2024-01-1514:30:00", "yyyy-MM-dd''HH:mm:ss")` | `"2024-01-15T14:30:00"` | `""` |
| `parseDateWithPattern("''2024-01-15", "''''yyyy-MM-dd")` | `""` | `"2024-01-15"` |
| `parseDateWithPattern("'2024-01-15", "''''yyyy-MM-dd")` | `"2024-01-15"` | `""` |

Four quotes in a row are two literal quotes, not one. Quoted text is unchanged: `'at'` still reads `at`, `'o''clock'` still reads `o'clock`, and a quote that never closes still makes the pattern malformed.

To keep fields adjacent with nothing between them, remove the `''` from the pattern: `"yyyyMMdd"` reads `"20240115"`.
