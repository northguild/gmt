---
"@burglekitt/gmt": minor
---

Adds `getTimeZones` to the `zoned` namespace, returning the full list of IANA timezone identifiers supported by the runtime (via `Intl.supportedValuesOf("timeZone")`, `[]` on unsupported runtimes).

`getSystemTimeZone` moves from the `plain` namespace to `zoned` alongside it. It remains available from the package root (`@burglekitt/gmt`) and from `@burglekitt/gmt/zoned`, but is no longer exported from `@burglekitt/gmt/plain` — update imports accordingly if you were importing it from the `plain` subpath.
