# @northguild/gmt — Skill Spec

Temporal-based date and time utilities with timezone support and polyfill integration. String-in/string-out APIs powered by @js-temporal/polyfill.

## Domains

| Domain                | Description                                                           | Skills                                                                                         |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Core Date Operations  | Basic date/time operations — get/parse/format/compare/validate          | gmt-basics                                                                                     |
| Arithmetic            | Add/subtract, durations, interval range math                            | gmt-arithmetic                                                                                 |
| Zoned Date Operations | IANA timezone-aware date operations, DST disambiguation               | gmt-timezone                                                                                   |
| Integration           | Application framework integration, cache keys, lint package selection | gmt-integration                                                                                |
| Industry Layers       | One skill per industry layer, drawing on the core skills              | gmt-gnss, gmt-transport, gmt-intermodal, gmt-workforce                                         |
| Contributor           | Library maintainer workflows — issues, PRs, implementation, testing   | issue-creation, pr-contribution, new-method-implementation, unit-test-generation, api-expansion-workflow |

## Skill Inventory

| Skill                   | Type        | Domain                | What it covers                                                                                                   | Failure modes |
| ----------------------- | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| gmt-basics              | core        | Core Date Operations  | getNow, getToday, formatDate, formatRelativeDate, isAfterDate, isValidDate, isValidTimeZone, parseDateWithPattern, getLocaleMonthNames |               |
| gmt-arithmetic          | core        | Arithmetic            | addDate, subtractTime, diffDate, clampDate, closestDateTo, business calendars (addBusinessDays, rollDate, mergeCalendars), duration API, interval math |               |
| gmt-timezone            | core        | Zoned Date Operations | getZonedNow, formatZonedDateTime, convertPlainDateTimeToZoned, addZoned, startOfZoned, hasDaylightSaving         |               |
| gmt-integration         | composition | Integration           | Cache keys, router/query params, table-sort keys, foreign epochs, TAI and leap seconds (timescale/), lint package selection |               |
| gmt-gnss                | core        | Industry Layers       | utcToGnss, gnssToUtc, gnssWeekToUtc, utcToGnssWeek, rinexWeekToUtc, utcToRinexWeek (gnss/) |               |
| gmt-transport           | core        | Industry Layers       | transitTime, etaAtZone, dwellTime, scheduleDelivery, cutoffAt, classifyPunctuality, nextDeparture (transport/) |               |
| gmt-intermodal          | core        | Industry Layers       | freeTimeExpiry, chargeableDays, demurrageClock, billingTimeline, bolTimestamp, EDI and EPCIS timestamps (intermodal/) |               |
| gmt-workforce           | core        | Industry Layers       | evaluateDutyLog, dutyViolations, dutyDayFor, dutyTotals (workforce/) |               |
| issue-creation          | lifecycle   | Contributor           | Feature requests, missing methods, issue templates                                                             |               |
| pr-contribution         | lifecycle   | Contributor           | PR workflow, tests, contribution guidelines                                                                      |               |
| new-method-implementation | maintainer | Contributor        | Adding methods to gmt source                                                                                   |               |
| unit-test-generation    | maintainer | Contributor           | Writing tests for internal code                                                                                |               |
| api-expansion-workflow  | lifecycle   | Contributor           | Feature request workflow                                                                                       |               |

## Lifecycle Skills

| Skill           | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| issue-creation  | Guide consumers to create proper GitHub issues for missing functionality |
| pr-contribution | Guide consumers to open PRs with improvements                            |

## Contributor Skills (Maintainer-focused)

These skills live under `skills/contributor/` and are excluded from the npm
package via `.npmignore` — they are for library maintainers only, not shipped
consumers.

| Skill                     | Type       | Notes                           |
| ------------------------- | ---------- | ------------------------------- |
| new-method-implementation | maintainer | Adding methods to gmt source    |
| unit-test-generation      | maintainer | Writing tests for internal code |
| api-expansion-workflow    | lifecycle  | Feature request workflow        |

## Core and industry layers

Core namespaces hold general time primitives and stay in the topic skills
(`timescale/` leap seconds and TAI are in `gmt-integration`). Each industry
layer (`gnss/`, `transport/`, `intermodal/`, `workforce/`) has its own consumer
skill, and its functions are in no topic skill. A topic skill may keep a
one-line cross-reference to an industry skill, and no function lists or
examples of industry functions.

## Skill file structure

- **Consumer skills** (shipped in the npm tarball): `skills/gmt-basics/`,
  `skills/gmt-arithmetic/`, `skills/gmt-timezone/`, `skills/gmt-integration/`,
  `skills/gmt-gnss/`, `skills/gmt-transport/`, `skills/gmt-intermodal/`,
  `skills/gmt-workforce/`
  — lightweight routing pointers (~30-60 lines each) that point agents to the
  docs site and the JSDoc in the installed package for full API details.
- **Contributor skills** (excluded from the npm tarball via `.npmignore`):
  `skills/contributor/<slug>/SKILL.md` — maintainer workflows.

## Recommended Skill File Structure

- **Consumer skills:** gmt-basics, gmt-arithmetic, gmt-timezone, gmt-integration, gmt-gnss, gmt-transport, gmt-intermodal, gmt-workforce
- **Contributor skills:** issue-creation, pr-contribution, new-method-implementation, unit-test-generation, api-expansion-workflow

## Notes

Consumer-facing skills are deliberately slim routing pointers. They carry core
rules and point agents to two places for API signatures, locale matrices, and
code examples. The first is the docs site: `https://northguild.dev/gmt/llms.txt`
is the map, and the `.md` twin of a page holds its text. The second is the
JSDoc in the installed package (`node_modules/@northguild/gmt/dist/**/*.d.ts`).
The package README is a landing page and holds no API detail. Each skill lists
the docs guides it summarises under `sources`, beside its source files.
Contributor skills are kept separate and excluded from the published tarball
so they do not pollute consumer `intent list` output.
