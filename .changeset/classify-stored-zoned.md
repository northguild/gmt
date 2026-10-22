---
"@northguild/gmt": minor
---

Add `classifyStoredZoned`, which says why a stored zoned time no longer resolves (Story CORE-83). It is in the new `@northguild/gmt/zoned/classify` subpath, and the root and `@northguild/gmt/zoned` export it too.

Apps store a future event as an RFC 9557 string with both an offset and a zone, such as `2016-12-01T09:00:00+02:00[Europe/Istanbul]`. When the zone's rules change after the string is written, the offset and the zone can disagree, or the local time can land in a new gap or overlap. `toOffsetInstant` returns `null` for such a string and does not say why. `classifyStoredZoned` names the cause and returns every reading, so your code chooses one.

```typescript
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";

classifyStoredZoned("2016-12-01T09:00:00+02:00[Europe/Istanbul]");
// { kind: "offsetMismatch", storedOffset: "+02:00", zoneOffset: "+03:00",
//   atStoredOffset: "2016-12-01T07:00:00Z", atZoneOffset: "2016-12-01T06:00:00Z" }

classifyStoredZoned("2026-03-29T01:30:00+00:00[Europe/London]");
// { kind: "nonexistent", earlier: "2026-03-29T00:30:00Z",
//   later: "2026-03-29T01:30:00Z", atStoredOffset: "2026-03-29T01:30:00Z" }

classifyStoredZoned("2026-03-29T01:30:00[Europe/London]"); // null (no offset)
```

The result has one of five kinds: `valid`, `validInOverlap`, `offsetMismatch`, `ambiguous` and `nonexistent`. Every kind carries `atStoredOffset`, the instant that Temporal's `offset: "use"` gives. From the returned fields you can reproduce each of Temporal's four `offset` options. The function returns `null` for a string that lacks an offset or a zone, names an unknown zone, or uses a calendar other than `iso8601`.

The answer depends on the time zone rules of the host, so the same string can be `valid` on one runtime and `offsetMismatch` on another. On Node, `process.versions.tz` names the tzdb release. A string ending in `Z` before the zone is always `valid`, as the Temporal specification reads it.

The `StoredZonedClassification` type is exported from `@northguild/gmt`. The docs add the Stored Time Audit tool at `/tools/stored-time-audit/` and a section in the offset-instants guide.
