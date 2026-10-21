---
"@northguild/gmt": patch
---

`formatCalendar` reads a `timeStyle` given as an object, such as `new String("long")`, as the plain string. Before, it printed the UTC zone name it uses internally, as in "tomorrow at 2:30:00 PM UTC".
