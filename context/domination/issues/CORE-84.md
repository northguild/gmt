# CORE-84 — Core: Recurrence rules and cron lines in a zone

**Scope:** Expand an RFC 5545 `RRULE` and a POSIX cron line into instants in a caller's IANA zone, with every occurrence a time zone transition touched marked and resolved by a stated policy.

## Gap

Recurring schedules are written as local rules: "every weekday at 02:30", `0 2 * * 1-5`, `FREQ=MONTHLY;BYDAY=-1FR`. Expanding one across a daylight-saving transition produces a local time that does not exist or occurs twice, and the answer depends on a policy most implementations never state.

- **Recurrence.** RFC 5545 §3.3.10 contradicted itself on a nonexistent local time. Erratum 4271 settles it: such an instance is handled as §3.3.5 says, the first occurrence for a repeated time and the offset before the gap for a skipped one.
- **Cron.** No standard states a rule, and one implementation's own pages contradict each other. POSIX defines no time zone behaviour. cronie's crontab(5) gives the matching rule: a time that does not exist never matches, and a time that occurs twice runs its jobs twice. cron(8), in cronie and in Debian alike, says the daemon does otherwise: a job in a skipped interval runs immediately after the change, and a repeated time does not run it again. Both daemons limit that to clock changes under three hours, and to some jobs only: cronie to jobs at a specific time or less often than hourly, Debian to jobs with no `*` in the minute or hour field and not `@hourly`. Every other job runs on the new time as usual, so the same daemon treats `*/5 * * * *` and `30 2 * * *` differently on the same night. GitHub Actions and Kubernetes both take a zone for a five-field schedule.
- **Demand.** Weekly npm downloads for 2026-09-28 to 2026-10-04: rrule 3.7M, cron-parser 26.6M, croner 11.6M and node-cron 6.3M.

([RFC 5545 §3.3.10, §3.3.5](https://www.rfc-editor.org/rfc/rfc5545.txt), [Erratum 4271](https://www.rfc-editor.org/errata/eid4271), [POSIX crontab](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/crontab.html), [cronie crontab(5)](https://github.com/cronie-crond/cronie/blob/master/man/crontab.5), [cronie cron(8)](https://github.com/cronie-crond/cronie/blob/master/man/cron.8), [Debian cron(8)](https://manpages.debian.org/trixie/cron/cron.8.en.html), [GitHub Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Kubernetes CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/))

## Scope

New top-level namespace `packages/gmt/src/recurrence/`.

1. **RRULE parsing.** `parseRecurrenceRule(value: string)` reads an RFC 5545 §3.3.10 RECUR value with all 14 rule parts (`FREQ`, `UNTIL`, `COUNT`, `INTERVAL`, `BYSECOND`, `BYMINUTE`, `BYHOUR`, `BYDAY`, `BYMONTHDAY`, `BYYEARDAY`, `BYWEEKNO`, `BYMONTH`, `BYSETPOS`, `WKST`) and the clause's validity rules: `FREQ` required once, `UNTIL` and `COUNT` exclusive, `BYWEEKNO` only with `YEARLY`, numeric `BYDAY` only with `MONTHLY` or `YEARLY`, and the rest. The sentinel for anything else.
2. **RRULE expansion.** `expandRecurrence` takes a rule, a `DTSTART` local date-time, an IANA zone, optional `RDATE` and `EXDATE` lists, and either two bounds or a count after an instant. It returns occurrences as instants, each marked when a transition made its local time nonexistent or ambiguous.
3. **Cron parsing.** `parseCronExpression(value: string)` reads five POSIX fields with the crontab(5) extensions: ranges, lists, `/step`, three-letter month and weekday names, `7` as Sunday, and the nicknames `@hourly`, `@daily`, `@midnight`, `@weekly`, `@monthly`, `@yearly`, `@annually`.
4. **Cron runs.** `cronRuns` takes a parsed line, an IANA zone and either two bounds or a count after an instant, with the POSIX day rule: when day of month and day of week are both restricted, a day matching either runs.

Not in scope: iCalendar files, `VTIMEZONE`, alarms, `EXRULE` (deprecated by RFC 5545 Appendix A.3), RFC 7529 `RSCALE` and `SKIP`, natural-language rules, a seconds field, `@reboot`, and the `L`, `W`, `#` and `?` tokens.

## Tool

**Recurrence Expander.** Enter an `RRULE`, a start, a zone and a policy, and see the next occurrences on the local-day grid with the transition nights highlighted and each touched occurrence's readings shown. Calls `parseRecurrenceRule`, `expandRecurrence`.

**Cron in a Zone.** Enter a cron line and a zone, and see the next runs, with the run in a gap or an overlap shown under each policy side by side. Calls `parseCronExpression`, `cronRuns`. Teaches: a cron line has no daylight-saving rule until someone states one.

## Design notes

- **RRULE follows the RFC.** A touched occurrence resolves as §3.3.5 says, which is Temporal's `compatible` disambiguation. A caller may pass `earlier`, `later` or `reject` instead; the result marks the occurrence either way.
- **Cron has no default.** The policy is a required parameter, because no standard and no common practice supplies one. The architect counts the policies from the two documented behaviours, the crontab(5) matching rule (skip a gap; run twice in an overlap) and the cron(8) daemon rule (run late after a gap; run once in an overlap), and from the daemon rule applying only to some jobs, and names them in a narrow union, per the no-catch-all rule.
- **An invalid date is skipped, not shifted.** `BYMONTHDAY=31` produces nothing in a 30-day month, as §3.3.10 requires.
- **POSIX is the base, crontab(5) the extensions.** POSIX defines no `/step`, names or nicknames; each is cited to cronie's crontab(5). Where Debian's crontab(5) disagrees (it allows no ranges or lists of names, so `mon-fri` and `mon,wed,fri` are both out), GMT follows the wider form and the docs page says so.
- **Expansion is bounded.** Every call takes bounds or a count; an `RRULE` with neither `UNTIL` nor `COUNT` never expands without one.
- **`WKST` matters only for `WEEKLY` with `INTERVAL` above one and for `BYWEEKNO`.** The RFC's own example shows two results; both are tests.

## What gmt provides (do not re-implement)

- CORE-54 — `nthWeekdayOfMonth`, for `BYDAY` with an ordinal
- `classifyLocal` and `resolveLocal` (`instant/convert/`) — wall time to instant with a stated disambiguation
- `Disambiguation` (`types/disambiguation.ts`)
- `getIsoWeekDate` and the `plain/` weekday helpers — `BYWEEKNO` and weekday arithmetic

## Verification

- Every example in RFC 5545 §3.8.5.3 is a test row, with the RFC's listed dates as expected values.
- The Erratum 4271 case: a daily 02:30 rule across a spring-forward night in America/New_York gives 03:30 EDT under the default.
- The §3.3.5 overlap case: 01:30 on a fall-back night gives the first occurrence.
- `WKST=MO` versus `WKST=SU` on the RFC's `WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU` example.
- Negative `BYSETPOS`, `COUNT` versus `UNTIL`, `RDATE` added and `EXDATE` removed.
- Cron: a 02:30 job on a spring-forward night and a 01:30 job on a fall-back night under each policy; a `*/5` job and a `30 2` job on the same spring-forward night; `*/5`, names, nicknames, `7` as Sunday; POSIX's `0 0 1,15 * 1` example runs on the 1st, the 15th and every Monday.
- Sentinel rows: a seconds field, `@reboot`, `L`, `W`, `#`, `?`, `UNTIL` with `COUNT`, `EXRULE`.
- Full matrix: CI's 10 zones × Node 22, 24 and 26.
- `pnpm run validate` stays green.
