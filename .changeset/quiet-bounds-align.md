---
"@northguild/gmt": patch
---

Correct the documentation of the positional interval functions in `plain/`, `utc/`, `zoned/` and `unix/`, so it describes what they already do.

This entry covers documentation only. The behaviour fixes found in the same pass, at the edges of the representable range, are listed in their own entry. Several descriptions and examples had drifted from the code:

- **`intervalsOverlap*` returns `true` for touching intervals.** The docs said intervals whose end equals the other's start do not overlap, and the Time and Unix examples showed `false`. The code has always returned `true`: these functions treat an interval as closed, so the shared endpoint belongs to both.
- **`intervalAbuts*` means a one-unit gap, not a shared endpoint.** Two intervals abut when one ends exactly one nanosecond before the other starts: one day for `intervalAbutsDate`, one unit for `intervalAbutsUnix`. Intervals that share an endpoint return `false`. The summary said otherwise, and the reverse-order example in the Time, Utc, DateTime and Zoned variants claimed `true` for an input that returns `false`.
- **`intervalDifference*` and `intervalXor*` step one unit in from each cut.** The Utc, DateTime, Time and Unix examples showed outputs without that step, and `intervalDifferenceUnix` omitted the right-hand piece.
- **`intervalSplitAt*` pieces share their boundaries**, and the Date, DateTime and Time variants named a `divideEqually` function that does not exist. They now name `intervalDivideEquallyDate`, `intervalDivideEquallyDateTime` and `intervalDivideEquallyTime`.

Where a function's boundary behaviour was left unstated, it now is:

- `intervalDifference*` and `intervalXor*` say their endpoints are inclusive, so each returned piece stops one unit short of the interval it borders.
- `intervalEngulfs*` says B may share A's endpoints.
- `intervalSplitAt*` and `splitIntervalByUnit*` say each piece's `end` is the next piece's `start`.

The package README and the interval guides on the docs site had the same errors and are corrected to match.
