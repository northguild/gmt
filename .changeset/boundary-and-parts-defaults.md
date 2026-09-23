---
"@northguild/gmt": patch
---

Fix three defaults that returned the wrong value (Story CORE-8). Each one has a documented option that restores the previous output.

**`endOf*` printed a moment earlier than the end.** An end is the next start minus one nanosecond, but `endOfTime`, `endOfDateTime`, `endOfUtc`, `endOfZoned` and `endOfQuarterForZoned` printed only the digits the unit names, so `endOfTime("12:34:56", "hour")` returned `"12:59:59"`: 999,999,999 nanoseconds before the real end. They now default to nanosecond precision, which `endOfQuarterForUtc` already used.

```typescript
endOfUtc("2024-03-15T14:30:45Z", "month"); // "2024-03-31T23:59:59.999999999Z"
endOfUtc("2024-03-15T14:30:45Z", "month", { fractionalSecondDigits: 0 }); // "2024-03-31T23:59:59Z" — previous output
```

To keep the previous string, pass the digits the unit names: `0` for `second` and coarser, `3` for `millisecond`, `6` for `microsecond`. For `endOfQuarterForZoned`, always pass `0`.

**`formatDateTimeToParts` and `formatZonedToParts` dropped the time.** Called with no field options, they returned only the date parts. For a date-time value, ECMA-402's `GetDateTimeFormat`, as amended by Temporal, defaults year, month, day, hour, minute and second to `"numeric"`, and adds a short time zone name for a zoned value. They now do the same.

```typescript
formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US");
// month, day, year, hour, minute, second, dayPeriod, timeZoneName "EDT"
formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { year: "numeric", month: "numeric", day: "numeric" });
// month, day, year — previous output
```

**`getLocaleWeekYear` and `getWeeksInLocaleWeekYear` answered differently by Node version.** They read a locale's `minimalDays` from the runtime. Node 22 still reported it, while Node 24 and later do not, so `getLocaleWeekYear("2022-01-01", "en-US")` returned `2022` on one runtime and `2021` on another. The default is now the ISO 8601 value `4` on every runtime. Pass `{ minimalDays: 1 }` to keep the Node 22 result for `en-US` and other locales whose rule is `1`.
