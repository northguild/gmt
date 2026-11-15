---
"@northguild/gmt": patch
---

GMT checks the installed `@js-temporal/polyfill` for one more bug in counting months or years between two dates in a non-ISO calendar. The polyfill's unreleased `main` loses a day when a Hebrew or Islamic count starts on the 30th and crosses a 29-day month (tc39/proposal-temporal#3327). GMT already uses its own count while the polyfill has the older bugs in it. With this check, a later release that fixes those but has this one still gets GMT's count, so results stay correct. On 0.5.1, the release GMT depends on today, no result changes.
