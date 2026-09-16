---
"@northguild/gmt": patch
---

Correct about 70 JSDoc `@example` results that disagreed with what the function returns (Story CORE-8).

Every public function's examples were executed against the build and compared with their documented result. They also feed the reference site and the playground's default inputs. The wrong ones fell into a few classes:

- **Singular unit names.** `diffDate`, `diffDateTime`, `diffTime`, `diffUtc`, `diffUnix` and `subtractDate` take Temporal's plural duration units (`"days"`, `{ days: 5 }`). Examples passing `"day"` documented a number where the call returns `null`.
- **Invalid locales.** Twelve locale-aware functions documented their sentinel for `"not-a-locale"`. That tag is well-formed BCP 47, so ECMA-402 falls back instead of throwing, and the functions return a real value. The examples now use a malformed tag.
- **Microseconds and nanoseconds.** The `parseMicrosecondFrom*` and `parseNanosecondFrom*` examples documented `"123"` for `"…45.123"`. That fraction is 123 milliseconds, so both fields are `"000"`.
- **Zone-dependent Unix parsers.** The `unix/parse` examples were written in a local zone. They now pass `timeZone: "UTC"` and document the UTC fields.
- **CLDR wording.** Range, date-time and parts examples now match CLDR 42 and later, including the narrow no-break space (U+202F) before `AM`/`PM`.
- **Arithmetic and transcription errors.** Among others: `roundUtc`, `roundUnix`, `minZoned` across a DST change, `convertZonedToUnix`, `intervalIntersectionUnix`, and `areUnixEqual`, whose `epochUnit` applies to both values. The `formatCalendarUtc` and `formatCalendarZoned` examples referenced an undefined variable.

No function's behaviour changed in this entry.
