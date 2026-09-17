---
"@northguild/gmt": patch
---

Name the standard behind each roll convention, and correct three wrong JSDoc examples.

`RollConvention`, `rollDate` and `isValidRollConvention` said `modifiedFollowing` with the end-of-month rule was "the common convention for interest-rate instruments", sourced to a vendor daycount page. That sourced a market habit, not the definition. The docs now cite the text that actually governs the conventions: `following`, `modifiedFollowing` and `preceding` are [ISDA 2006 Definitions §4.12(a)(i)–(iii)](https://www.isda.org/book/2006-isda-definitions/), `modifiedPreceding` — which §4.12(a) does not define — is FpML's `BusinessDayConventionEnum` `MODPRECEDING`, and `none` is what [OpenGamma Strata](https://strata.opengamma.io/apidocs/com/opengamma/strata/basics/date/BusinessDayConventions.html) calls `NO_ADJUST`. No TC39, ECMA or RFC standard governs any of them, and the camelCase spelling is GMT's — the standard fixes the behaviour, not the identifier.

`endOfMonth` is now labelled plainly as GMT's own, because it is neither an ISDA convention nor the industry "EOM rule" a reader is likely to assume it is. That rule is a *schedule* rule — hold every date in a schedule to its month's last day once the anchor is one — and `endOfMonth` is the per-date primitive you build it from, by testing the anchor for month-end yourself and applying it to the unadjusted target date.

Three `@example` lines asserted results the functions do not return:

```ts
// formatRelativeUtc: the old example had no `reference`, so its output moved with the clock
formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }); // "3 months ago"

// roundZoned: New York is -04:00 in June, not -05:00, and 12:34:56 rounds down to 12:30
roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", { smallestUnit: "minute", roundingIncrement: 15 }); // "2024-06-15T12:30:00-04:00[America/New_York]"
```

The docs site runs every `@example` live, so a wrong one is visible on the reference page as well as on hover.
