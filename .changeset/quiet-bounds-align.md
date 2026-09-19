---
"@northguild/gmt": patch
---

Correct the positional interval documentation's cross-references and tiling notes.

- `intervalSplitAtDate`, `intervalSplitAtDateTime` and `intervalSplitAtTime` named a `divideEqually` function that does not exist. They now name `intervalDivideEquallyDate`, `intervalDivideEquallyDateTime` and `intervalDivideEquallyTime`.
- `intervalSplitAt*`, `splitIntervalByUnit*` and `intervalDivideEqually*` say that each piece's `end` is the next piece's `start`, so the pieces partition the interval under the half-open rule.

The boundary behaviour of every positional interval function is described in the half-open intervals entry of this release.
