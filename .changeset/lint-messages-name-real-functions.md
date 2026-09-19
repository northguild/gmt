---
"@northguild/gmt-oxlint": patch
"@northguild/gmt-eslint": patch
"@northguild/gmt-biome": patch
---

Point the `Date.now()` and `Date.UTC()` diagnostics at `@northguild/gmt` calls that exist (Story CORE-8).

The `Date.UTC()` message and README row recommended `convertUtcDateTimeToUnix`, which `@northguild/gmt` has never exported. They now name `convertUtcToUnix`, with the `Z` the UTC string needs. The `Date.now()` and `Date` messages recommended `getUnixNow('milliseconds' | 'seconds')`, a positional form that `@northguild/gmt` 1.16.0 replaces with an options object.

| Diagnostic | Before | After |
| --- | --- | --- |
| `Date.UTC(...)` | `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' \| 'seconds')` | `convertUtcToUnix('YYYY-MM-DDTHH:mm:ssZ', { epochUnit: 'milliseconds' \| 'seconds' })` |
| `Date.now()` and the `Date` global | `getUnixNow('milliseconds' \| 'seconds')` | `getUnixNow({ epochUnit: 'milliseconds' \| 'seconds' })` |

The rules match the same code as before. Only the suggestion text changed, in `@northguild/gmt-oxlint`, `@northguild/gmt-eslint` and `@northguild/gmt-biome` alike.
