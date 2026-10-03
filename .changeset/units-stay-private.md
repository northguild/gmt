---
"@northguild/gmt": minor
---

Remove the `DurationUnit` type from the public exports.

No public function takes or returns `DurationUnit`. It only typed two private lookup tables inside `formatDuration`, so it now lives there.

### Breaking changes

| Import | 1.17 | 1.18 |
| --- | --- | --- |
| `import type { DurationUnit } from "@northguild/gmt"`, likewise from `@northguild/gmt/types` | The union `"years" \| "months" \| "weeks" \| "days" \| "hours" \| "minutes" \| "seconds"` | Not exported |

For the unit keys a function accepts, import the type its signature names: `DateDurationUnit`, `TimeDurationUnit` or `DateTimeDurationUnit`. `DateTimeDurationUnit` is a wider union than `DurationUnit` was, so code that needs exactly the seven keys above declares that union itself.
