# @burglekitt/gmt — Skill Spec

Temporal-based date and time utilities with timezone support and polyfill integration. String-in/string-out APIs powered by @js-temporal/polyfill.

## Domains

| Domain | Description | Skills |
|--------|-------------|--------|
| Core Date Operations | Basic date/time operations using plain (timezone-free) Temporal types | get-current, parse-date-time, format-date-time, calculate-dates, compare-dates, validate-dates |
| Zoned Date Operations | IANA timezone-aware date operations | zoned-date-ops |
| Conversion | Converting between temporal types, unix time, and UTC | convert-types |
| Integration | Integrating gmt with application frameworks and linting tools | app-integration, lint-package-suggestion |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
|-------|------|-------|--------------|-------------|
| get-current | core | Core Date Operations | getNow, getToday, getUnixNow, getUtcNow | |
| parse-date-time | core | Core Date Operations | parseYearFromDate, parseMonthFromDate, parseDayFromDate, parseHourFromTime... | |
| format-date-time | core | Core Date Operations | formatDate, formatTime, formatDateTime | |
| calculate-dates | core | Core Date Operations | addDays, addMonths, addYears, subtractTime | |
| compare-dates | core | Core Date Operations | isAfterDate, isBeforeDate, areDatesEqual | |
| validate-dates | core | Core Date Operations | isValidDate, isValidTime, isValidDateTime | |
| zoned-date-ops | core | Zoned Date Operations | getZonedNow, formatZonedDateTime, isValidTimezone, convertUtcToZoned... | |
| convert-types | core | Conversion | convertPlainToZoned, convertZonedToPlain, convertUtcToUnix... | |
| app-integration | composition | Integration | Framework integration, cache keys, router params | |
| lint-package-suggestion | composition | Integration | ESLint, Biome, Oxlint package selection | |
| issue-creation | lifecycle | Core Date Operations | Feature requests, missing methods | |
| pr-contribution | lifecycle | Integration | PR workflow, tests, contribution | |

## Lifecycle Skills

| Skill | Purpose |
|-------|---------|
| issue-creation | Guide consumers to create proper GitHub issues for missing functionality |
| pr-contribution | Guide consumers to open PRs with improvements |

## Existing Skills (Maintainer-focused)

| Skill | Type | Notes |
|-------|------|-------|
| new-method-implementation | maintainer | Adding methods to gmt source |
| unit-test-generation | maintainer | Writing tests for internal code |
| api-expansion-workflow | maintainer | Feature request workflow |

## Recommended Skill File Structure

- **Core consumer skills:** get-current, parse-date-time, format-date-time, calculate-dates, compare-dates, validate-dates
- **Timezone skills:** zoned-date-ops, convert-types
- **Integration skills:** app-integration, lint-package-suggestion
- **Lifecycle skills:** issue-creation, pr-contribution
- **Maintainer skills:** new-method-implementation, unit-test-generation (in packages/gmt/skills/)

## Gaps Identified

- Consumer-facing skills for basic operations need to be documented
- issue-creation and pr-contribution are the priority additions

## Notes

This is a lightweight domain map derived from existing skills. The library is well-structured with clear separation between plain/zoned/unix/utc operations. Core consumer use cases center on:
1. Getting current date/time
2. Parsing date components
3. Formatting for display
4. Date arithmetic
5. Timezone handling