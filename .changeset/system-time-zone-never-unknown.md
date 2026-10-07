---
"@northguild/gmt": patch
---

`getSystemTimeZone()` now returns `""` when the host reports a time zone that is not usable, as its documentation says. It used to pass ICU's placeholder `"Etc/Unknown"` through.

Node reports `"Etc/Unknown"` when the `TZ` environment variable is set but empty, for example `TZ: ${TZ}` in a compose file where the variable is not defined. `"Etc/Unknown"` is not an IANA time zone, so Temporal and `Intl.DateTimeFormat` both throw a `RangeError` when it is passed to them.

```typescript
import { getSystemTimeZone } from "@northguild/gmt";

// On a host started with TZ=""
getSystemTimeZone(); // "" (was "Etc/Unknown")
```

`getSystemTimeZone()` now returns a zone only when `isValidTimeZone` accepts it. Every other function is unchanged: `getNow`, `getToday` and the other readers of the system time zone already returned `""` or `null` on such a host.
