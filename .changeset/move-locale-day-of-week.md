---
"@burglekitt/gmt": minor
---

Move `getLocaleDayOfWeek`, `getLocaleZonedDayOfWeek`, and `getHoursInZonedDay` from the `get/` namespace to `calculate/` (Story J0b):

- `plain/get/getLocaleDayOfWeek.ts` → `plain/calculate/getLocaleDayOfWeek.ts`
- `zoned/get/getLocaleZonedDayOfWeek.ts` → `zoned/calculate/getLocaleZonedDayOfWeek.ts`
- `zoned/get/getHoursInZonedDay.ts` → `zoned/calculate/getHoursInZonedDay.ts`

`get/` namespaces are now current-moment accessors only (no argument, or timezone only, reporting a value for *now*); any function taking a date value belongs in `calculate/`. Function names, signatures, and behavior are unchanged.

**Technically breaking for deep-subpath consumers.** Root imports (`from "@burglekitt/gmt"`) are unaffected. But anyone importing from `@burglekitt/gmt/plain/get` or `@burglekitt/gmt/zoned/get` loses these symbols — switch those imports to `@burglekitt/gmt/plain/calculate` and `@burglekitt/gmt/zoned/calculate` respectively.
