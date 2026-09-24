---
name: pr-contribution
description: >
  Contribute improvements to @northguild/gmt via pull requests, including new
  methods, bug fixes, and documentation updates.
metadata:
  library_version: 1.17.0
---

# PR Contribution

Use this skill when you want to contribute code directly to gmt.

> **For human contributors.** AI agents working inside the gmt repository do not run
> `git add`, `git commit`, `git push`, create a branch, or open a pull request unless the user
> asks them to — by default they leave changes unstaged and report them ready. See `AGENTS.md` § Git — Only on an Explicit Instruction.

## Contribution Types

- **New method**: Add a missing date/time operation
- **Bug fix**: Correct existing behavior
- **Documentation**: Improve docs or addexamples
- **Tests**: Add test coverage for missing cases

## Prerequisites

1. Install the development environment:
   ```bash
   pnpm install
   ```

2. Understand the project structure:
   ```
   packages/gmt/src/
   ├── calendar/   # ISO week/ordinal dates, quarters, fiscal periods, zone buckets
   ├── duration/   # ISO 8601 durations
   ├── instant/    # Offset-preserving instants, local-time resolution
   ├── plain/      # Timezone-free operations
   ├── precision/  # Nanosecond precision and foreign epochs
   ├── regex/      # Regex patterns
   ├── span/       # Elapsed and wall-clock spans
   ├── unix/       # Unix epoch operations
   ├── utc/        # UTC operations
   └── zoned/      # Timezone-aware operations

   Inside a namespace, `get/` holds only current-moment accessors (no date argument). A
   function that takes a date value goes in `calculate/` (or `parse/`, `format/`, …).
   ```

## Creating a PR

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_FORK/gmt.git
cd gmt
pnpm install
```

### 2. Create a Feature Branch

Human contributors only (see the note above).

```bash
git checkout -b feature/my-new-method
```

### 3. Implement the Method

Follow the `new-method-implementation` skill guidelines:

- Use Temporal under the hood
- String-in/string-out APIs
- Plain/zoned separation
- Proper error handling

**Example structure:**

```ts
// packages/gmt/src/plain/calculate/getHalfYear.ts
import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Get the half-year (1-2) for a PlainDate.
 *
 * @param dateStr ISO 8601 date string (e.g. "2024-03-15")
 * @returns Half-year 1-2, or null on invalid input
 *
 * @example getHalfYear("2024-03-15") // 1
 * @example getHalfYear("2024-07-01") // 2
 * @example getHalfYear("invalid") // null
 */
export function getHalfYear(dateStr: string): number | null {
  if (!isValidDate(dateStr)) {
    return null;
  }
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.month <= 6 ? 1 : 2;
  } catch {
    return null;
  }
}
```

### 4. Add Tests

Add comprehensive tests:

```ts
// packages/gmt/src/plain/calculate/getHalfYear.test.ts
import { describe, it, expect } from "vitest";
import { getHalfYear } from "./getHalfYear";

describe("getHalfYear", () => {
  it.each`
    input           | expected
    ${"2024-01-01"} | ${1}
    ${"2024-06-30"} | ${1}
    ${"2024-07-01"} | ${2}
    ${"2024-12-31"} | ${2}
  `("returns $expected for $input", ({ input, expected }) => {
    expect(getHalfYear(input)).toBe(expected);
  });

  it("returns null for invalid input", () => {
    expect(getHalfYear("invalid")).toBe(null);
  });
});
```

### 5. Run Tests

```bash
pnpm run test:gmt
```

### 6. Run Linting

```bash
pnpm run lint
```

### 7. Commit and Push

Human contributors only — AI agents stop at step 6 and report the work ready.

```bash
git add .
git commit -m "feat(plain): add getHalfYear function"
git push origin feature/my-new-method
```

### 8. Open PR

Use the PR template:

```markdown
## Summary
Brief description of what this adds/fixes

## Changes
- Added `getHalfYear` to plain/calculate

## Testing
- Added unit tests for happy, invalid, and boundary paths
- All tests pass

## Checklist
- [ ] Tests added
- [ ] Tests pass
- [ ] No Date APIs used
- [ ] String-in/string-out followed
```

## PR Requirements

1. **No Date APIs**: Use Temporal only
2. **Tests required**: Happy path, invalid path, boundary cases
3. **Documentation**: JSDoc with @example tags
4. **Lint passes**: No oxlint errors (`pnpm run lint`)

## Before Opening

- [ ] Tests pass: `pnpm run test:gmt`
- [ ] Lint passes: `pnpm run lint`
- [ ] Typecheck passes: `pnpm run typecheck`

## Related Skills

- **issue-creation**: If you want to discuss before implementing
- **new-method-implementation**: Implementation guidelines