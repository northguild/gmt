---
"@northguild/gmt": patch
---

Keep the millisecond default of `getZonedNow` when `smallestUnit` is passed as `undefined`, and read no option but `smallestUnit`.

Before, `{ smallestUnit: undefined }` replaced the default, and the string was written with as many fractional digits as the clock reading needed: none on a whole second. An option whose value is `undefined` is now read as absent, as `GetOption` reads it in ECMA-402 and in the Temporal specification, so the documented default applies.

```typescript
import { getZonedNow } from "@northguild/gmt";

// With the clock at 2024-02-29T00:00:00Z
getZonedNow("UTC"); // "2024-02-29T00:00:00.000+00:00[UTC]"
getZonedNow("UTC", { smallestUnit: undefined }); // "2024-02-29T00:00:00.000+00:00[UTC]" — was "2024-02-29T00:00:00+00:00[UTC]"
getZonedNow("UTC", { smallestUnit: "second" }); // "2024-02-29T00:00:00+00:00[UTC]", unchanged
```

Before, the whole options object also went to Temporal's `toString`, so a key the function does not document changed the string. TypeScript rejects these keys; a JavaScript caller, or an object built elsewhere and passed through, could still carry them. Now only `smallestUnit` is read. The string always has the offset and the bracketed time zone, and units smaller than `smallestUnit` are always truncated, as the documentation says.

```typescript
// With the clock at 2024-02-29T00:00:00.999Z
const rounding = { smallestUnit: "second", roundingMode: "ceil" };
getZonedNow("UTC", rounding as never); // "2024-02-29T00:00:00+00:00[UTC]" — was "2024-02-29T00:00:01+00:00[UTC]"
getZonedNow("UTC", { timeZoneName: "never" } as never); // "2024-02-29T00:00:00.999+00:00[UTC]" — was "2024-02-29T00:00:00.999+00:00"
getZonedNow("UTC", { offset: "never" } as never); // "2024-02-29T00:00:00.999+00:00[UTC]" — was "2024-02-29T00:00:00.999[UTC]"
getZonedNow("UTC", { roundingMode: "bogus" } as never); // "2024-02-29T00:00:00.999+00:00[UTC]" — was ""
```

Unchanged: a call with no options, with `{}`, or with any `smallestUnit` from `"minute"` to `"nanosecond"`. A `smallestUnit` outside that range still returns `""`.
