---
"@northguild/gmt": patch
---

Return `""` from the `formatRelative*` functions for a `roundingMethod` that is not `"floor"`, `"ceil"` or `"round"`.

Before, the value was used as the name of a `Math` function. Any name `Math` has was accepted, so `"abs"`, `"trunc"`, `"sign"`, `"random"` and inherited keys such as `"constructor"` produced a wrong phrase instead of the empty string that invalid input returns. The method is now matched against the three listed values only.

This applies to `formatRelativeDate`, `formatRelativeTime`, `formatRelativeDateTime`, `formatRelativeZoned`, `formatRelativeUtc` and `formatRelativeUnix`.

```typescript
import { formatRelativeUtc } from "@northguild/gmt";

const options = {
  reference: "2024-03-17T12:00:00Z",
  largestUnit: "hour",
  numeric: "always",
} as const;

// 10:30 is 1.5 hours before the reference
formatRelativeUtc("2024-03-17T10:30:00Z", "en-US", options); // "1 hour ago" (−1.5 rounds to −1), unchanged
formatRelativeUtc("2024-03-17T10:30:00Z", "en-US", { ...options, roundingMethod: "floor" }); // "2 hours ago", unchanged
formatRelativeUtc("2024-03-17T10:30:00Z", "en-US", { ...options, roundingMethod: "abs" as never }); // "" — was "in 1.5 hours"
formatRelativeUtc("2024-03-17T10:30:00Z", "en-US", { ...options, roundingMethod: "trunc" as never }); // "" — was "1 hour ago"
formatRelativeUtc("2024-03-17T10:30:00Z", "en-US", { ...options, roundingMethod: undefined }); // "1 hour ago", the default, unchanged
```

Unchanged: `"floor"`, `"ceil"`, `"round"`, an omitted `roundingMethod`, and `roundingMethod: undefined`, which is read as omitted and takes the default `"round"`.
