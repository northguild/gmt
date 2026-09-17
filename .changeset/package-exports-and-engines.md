---
"@northguild/gmt": minor
---

List every import path explicitly, mark the package side-effect free, and state the Node versions it supports (Story CORE-8).

**The `exports` map names each subpath.** It used wildcard patterns, which also resolved folders nobody documented, such as `@northguild/gmt/plain/interval/validate`, and a `./regex/*` pattern that matched nothing. It now lists the root, the twelve namespace paths (`calendar`, `duration`, `instant`, `interval`, `plain`, `precision`, `regex`, `span`, `types`, `unix`, `utc`, `zoned`) and each namespace's category subpaths, such as `@northguild/gmt/plain/interval` or `@northguild/gmt/unix/convert`: 71 entries in all. Any other path fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**`typesVersions` mirrors the map,** so TypeScript with `moduleResolution: "node10"` resolves the same 71 paths as `node16`, `nodenext` and `bundler`.

**`sideEffects: false`.** An audit of every source module found only pure constant construction at load time, so bundlers may drop the modules an application does not use. An import cycle through the internal barrel is also gone.

**Every namespace re-exports the polyfill.** `Temporal`, `Intl` and `toTemporalInstant` are available from each namespace subpath, not only from the root and some namespaces, and they are the same objects everywhere. `@northguild/gmt/types` exports the `UnixUnit` type.

```typescript
import { Temporal } from "@northguild/gmt/span";
import type { UnixUnit } from "@northguild/gmt/types";

const unit: UnixUnit = "seconds";
Temporal.Instant.from("2024-01-01T00:00:00Z").epochMilliseconds; // 1704067200000
```

**`engines` is `node >=22.16.0`.** Node 22.16.0 ships ICU 77.1, the oldest ICU the test suite's locale and calendar expectations cover. CI runs the latest Node 22, 24 and 26.

### Breaking changes

| 1.15 | 1.16 |
| --- | --- |
| `import { … } from "@northguild/gmt/plain/interval/validate"` and other nested folders | `ERR_PACKAGE_PATH_NOT_EXPORTED`; import from `@northguild/gmt/plain/interval` or `@northguild/gmt/plain` |
| `import { chopUtc } from "@northguild/gmt/plain"` | not exported there; `import { chopUtc } from "@northguild/gmt/utc"` |
| Node below 22.16.0 | outside `engines`; upgrade Node |
