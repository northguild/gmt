---
"@northguild/gmt": patch
---

Calls that check their input first are faster. Each input is now parsed once, where before a function checked it and then parsed it again, or called another public function that did the same. No function, signature or result changes.

- Two edge cases change, and only for an object whose getters return different values on each read. Interval functions read an interval's `start` and `end` once per call. `demurrageClock` reads each event's `.at` once per call. Plain strings and ordinary objects behave as before.
