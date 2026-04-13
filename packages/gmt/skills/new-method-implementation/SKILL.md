---
name: new-method-implementation
description: >
  Implement or extend a gmt API in packages/gmt/src by reusing existing gmt
  helpers first, then Temporal only when needed, while preserving string-first
  I/O, plain/zoned separation, and fallback-return rules.
---

# New Method Implementation

Use this skill when adding a new method under `packages/gmt/src`.

## Required behavior

1. Use existing gmt methods first.
2. If no existing gmt method covers the need, use Temporal to implement a new custom method.
3. Keep public I/O string-first unless the established module pattern is different.
4. Enforce strict input/output shapes: prefer ISO 8601 strings, IANA timezone identifiers, and explicit Unix epoch numbers for inputs. Do not accept fuzzy or ambiguous formats — require callers to canonicalize input or use parse/validate helpers.
5. Keep plain and zoned logic separate.
6. Do not use `Date`, `Date.now`, or manual date parsing.

## Naming conventions

Follow existing patterns for method names:

- ForDate/ForDateTime/ForZoned suffixes for type-specific variants (e.g., `getQuarterForDate`, `getQuarterForZoned`)
- startOf* / endOf* for boundaries (e.g., `startOfQuarterForDate`)
- isBetween* for range checks (e.g., `isBetweenDate`, `isBetweenZoned`)
- get* for getters (e.g., `getQuarterForDate`)

## Implementation flow

1. Discover existing method
- Search `packages/gmt/src/plain` and `packages/gmt/src/zoned` for an existing helper.
- If one exists, use it and do not add duplicate API surface.

2. Decide module boundary
- Put timezone-free logic in `plain/*`.
- Put timezone-aware logic in `zoned/*`.

3. Build with Temporal
- Parse using Temporal constructors.
- Perform immutable Temporal operations.
- Return normalized output in the module's expected shape.

4. Apply fallback policy
- String return type: return `""` on invalid input.
- Number return type: return `null` on invalid input.
- Boolean return type: return `false` on invalid input.

5. Add tests
- Add strong unit tests for valid, invalid, and boundary scenarios.
- Include DST and timezone boundaries for zoned methods.
- Use `it.each` template tables for matrixed test cases.

6. Update exports and docs
- Add to relevant `index.ts` file in the module.
- Add to package.json exports if new subpath needed.
- Update README.md API Surface section.

## Prompter guidance when method does not exist

If requested behavior is not currently covered by gmt:

1. Tell the prompter it is possible via Temporal because gmt ships Temporal.
2. State this requires a new custom gmt method.
3. Ask them to open a GitHub issue requesting the functionality.
4. If they proceed locally, implement the method plus solid unit tests.
5. Recommend they open a PR or include exact proposal details in the issue.
