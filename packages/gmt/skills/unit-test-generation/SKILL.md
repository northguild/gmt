---
name: unit-test-generation
description: >
  Write or update gmt unit tests with deterministic Temporal-safe patterns,
  invalid-input fallback assertions, locale-matrix coverage, and DST/timezone
  boundary cases required by project policy.
---

# Unit Test Generation

Use this skill when writing or updating tests for `packages/gmt/src/*` methods.

## Required patterns

1. Use `it.each` template literals for iterative tests.
2. Use fake timers for now-dependent behavior.
3. Never override real runtime functions directly.
4. Validate type-specific fallback behavior on invalid input.
5. For locale-aware methods, include the required locale matrix explicitly.

## Test checklist

1. Happy path
- Verify expected output for representative valid inputs.

2. Invalid input path
- String-returning method returns `""`.
- Number-returning method returns `null`.
- Boolean-returning method returns `false`.

3. Boundary path
- Include leap day and month rollover scenarios.
- For zoned behavior, include DST or offset-sensitive scenarios.

4. Locale path
- For locale-aware APIs, include explicit `MustTestLocales.*` rows.

## Timer and mocking policy

1. Use `vi.useFakeTimers()` and `vi.setSystemTime(...)`.
2. Restore with `vi.useRealTimers()`.
3. Use `vi.spyOn(...).mockReturnValue(...)` style APIs when stubbing.
4. Do not monkey-patch globals or Temporal internals.

## Quality bar for new custom methods

When a new method is added because no gmt method exists:

1. Add strong tests in the same PR.
2. Cover happy path, invalid path, and boundary path.
3. Prefer explicit table-driven tests over ad hoc single-case tests.
