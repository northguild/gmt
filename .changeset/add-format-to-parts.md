---
"@burglekitt/gmt": minor
---

Add `formatDateToParts`, `formatDateTimeToParts`, `formatZonedToParts` (Story J12).

Each returns the locale-ordered `Array<{ type, value }>` parts behind `formatDate`/`formatDateTime`/`formatZonedDateTime`'s finished strings, mirroring those functions' `(value, locale?, options?)` signature exactly. `formatZonedToParts` also emits `timeZoneName` parts when `options.timeZoneName` is set. All three return `[]` on invalid input.

This is GMT's sanctioned substitute for a token formatter (Luxon `toFormat`, date-fns `format`), which remains deliberately excluded (roadmap Decision 1): a token pattern like `"MM/dd/yyyy"` hard-codes US field order and ships it to every locale. `formatToParts` gives the caller full control over presentation while the locale keeps control of field order — iterate the returned array instead of reassembling parts in a fixed order.
