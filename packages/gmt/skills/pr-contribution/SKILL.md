---
name: pr-contribution
description: >
  Contribute improvements to @burglekitt/gmt via pull requests,
  including new methods, bug fixes, and documentation updates.
---

# PR Contribution

Use this skill when you want to contribute code directly to gmt.

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
   ├── plain/       # Timezone-free operations
   ├── zoned/       # Timezone-aware operations
   ├── utc/        # UTC operations
   ├── unix/       # Unix epoch operations
   └── regex/     # Regex patterns
   ```

## Creating a PR

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_FORK/gmt.git
cd gmt
pnpm install
```

### 2. Create a Feature Branch

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
// packages/gmt/src/plain/get/getQuarter.ts
import { Temporal } from "@js-temporal/polyfill";
import { PlainDateSchema } from "../types";

/**
 * Get the ISO quarter (1-4) for a PlainDate.
 *
 * @param dateStr ISO 8601 date string (e.g. "2024-03-15")
 * @returns Quarter 1-4, or null on invalid input
 *
 * @example getQuarter("2024-03-15") // 1
 * @example getQuarter("2024-05-20") // 2
 */
export function getQuarter(dateStr: string): number | null {
  if (!PlainDateSchema.safeParse(dateStr).success) {
    return null;
  }
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return Math.ceil(date.month / 3);
  } catch {
    return null;
  }
}
```

### 4. Add Tests

Add comprehensive tests:

```ts
// packages/gmt/src/plain/get/getQuarter.test.ts
import { describe, it, expect } from "vitest";
import { getQuarter } from "./getQuarter";

describe("getQuarter", () => {
  it.each`
    input       | expected
    ${"2024-01-01"} | ${1}
    ${"2024-03-31"} | ${1}
    ${"2024-04-01"} | ${2}
    ${"2024-06-30"} | ${2}
    ${"2024-07-01"} | ${3}
    ${"2024-09-30"} | ${3}
    ${"2024-10-01"} | ${4}
    ${"2024-12-31"} | ${4}
  `("returns $expected for $input", ({ input, expected }) => {
    expect(getQuarter(input)).toBe(expected);
  });

  it("returns null for invalid input", () => {
    expect(getQuarter("invalid")).toBe(null);
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

```bash
git add .
git commit -m "feat(plain): add getQuarter function"
git push origin feature/my-new-method
```

### 8. Open PR

Use the PR template:

```markdown
## Summary
Brief description of what this adds/fixes

## Changes
- Added `getQuarter` to plain/get

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
4. **Lint passes**: No Biome errors

## Before Opening

- [ ] Tests pass: `pnpm run test:gmt`
- [ ] Lint passes: `pnpm run lint`
- [ ] Typecheck passes: `pnpm run typecheck`

## Related Skills

- **issue-creation**: If you want to discuss before implementing
- **new-method-implementation**: Implementation guidelines