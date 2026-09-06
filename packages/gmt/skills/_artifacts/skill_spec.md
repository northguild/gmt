# @northguild/gmt — Skill Spec

Temporal-based date and time utilities with timezone support and polyfill integration. String-in/string-out APIs powered by @js-temporal/polyfill.

## Domains

| Domain                | Description                                                           | Skills                                                                                         |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Core Date Operations  | Basic date/time operations — get/parse/format/compare/validate          | gmt-basics                                                                                     |
| Arithmetic            | Add/subtract, durations, interval range math                            | gmt-arithmetic                                                                                 |
| Zoned Date Operations | IANA timezone-aware date operations, DST disambiguation               | gmt-timezone                                                                                   |
| Integration           | Application framework integration, cache keys, lint package selection | gmt-integration                                                                                |
| Contributor           | Library maintainer workflows — issues, PRs, implementation, testing   | issue-creation, pr-contribution, new-method-implementation, unit-test-generation, api-expansion-workflow |

## Skill Inventory

| Skill                   | Type        | Domain                | What it covers                                                                                                   | Failure modes |
| ----------------------- | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| gmt-basics              | core        | Core Date Operations  | getNow, getToday, formatDate, formatRelativeDate, isAfterDate, isValidDate, isValidTimeZone, parseDateWithPattern, getLocaleMonthNames |               |
| gmt-arithmetic          | core        | Arithmetic            | addDate, subtractTime, diffDate, clampDate, closestDateTo, addBusinessDays, duration API, interval math          |               |
| gmt-timezone            | core        | Zoned Date Operations | getZonedNow, formatZonedDateTime, convertPlainDateTimeToZoned, addZoned, startOfZoned, hasDaylightSaving         |               |
| gmt-integration         | composition | Integration           | Cache keys, router/query params, table-sort keys, lint package selection                                          |               |
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

## Skill file structure

- **Consumer skills** (shipped in the npm tarball): `skills/gmt-basics/`,
  `skills/gmt-arithmetic/`, `skills/gmt-timezone/`, `skills/gmt-integration/`
  — lightweight routing pointers (~30-60 lines each) that point agents to the
  README and source JSDoc for full API details.
- **Contributor skills** (excluded from the npm tarball via `.npmignore`):
  `skills/contributor/<slug>/SKILL.md` — maintainer workflows.

## Recommended Skill File Structure

- **Consumer skills:** gmt-basics, gmt-arithmetic, gmt-timezone, gmt-integration
- **Contributor skills:** issue-creation, pr-contribution, new-method-implementation, unit-test-generation, api-expansion-workflow

## Notes

Consumer-facing skills are deliberately slim routing pointers. They carry core
rules and point agents to `README.md` and source JSDoc for API signatures,
locale matrices, and code examples. Contributor skills are kept separate and
excluded from the published tarball so they do not pollute consumer
`intent list` output.
