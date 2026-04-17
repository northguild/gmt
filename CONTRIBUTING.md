# Contributing

Node.js 24.x (recommended for development; see `.nvmrc`)
pnpm (recommended package manager). Use Corepack or Volta to manage pnpm locally.

This guide covers local development, quality checks, and publishing for workspace packages.

Local setup (recommended):

```bash
# Activate Corepack and install workspace deps
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
```

Common workspace commands (run from repository root):

```bash
# Run targets across the workspace
pnpm -w exec nx run-many -t build
pnpm -w exec nx run-many -t test
pnpm -w exec nx run-many -t lint
pnpm -w exec nx run-many -t typecheck

# Affected projects only
pnpm -w exec nx affected -t build
pnpm -w exec nx affected -t test
pnpm -w exec nx affected -t lint
pnpm -w exec nx affected -t typecheck
```

Nx-focused workflow examples:

```bash
# Visual dependency graph
pnpm -w exec nx graph

# Sync TypeScript project references
pnpm -w exec nx sync
pnpm -w exec nx sync:check
```

Run commands inside a specific package directory:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Package-level development

Example for the `gmt` package:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Publishing

Publishing is managed with Changesets and is triggered manually — nothing publishes automatically.

**See [PUBLISHING.md](./PUBLISHING.md) for the full step-by-step guide** including one-time npm org setup, how to record changesets, how to cut a release, and how git tags work in this monorepo.

For copyable commands and a quick reference, see [PUBLISHING.md](./PUBLISHING.md).

## Development conventions

- Use `pnpm` for package management and scripts.
- Use `pnpm -w exec <binary>` instead of `npx`.
- Avoid Bun-specific runtime APIs (e.g. `Bun.serve`, `bun:sqlite`) — prefer standard Node.js libraries.

## PR checklist

- Ensure tests pass for affected projects.
- Ensure lint/typecheck pass for affected projects.
- Keep APIs string-in/string-out and Temporal-only.
- Add or update tests for behavior changes.

## Testing: Pre-built Mock Functions for Error Path Testing

Use the pre-built mock functions from `packages/gmt/src/test/mocks` to test error handling paths that throw.

**Available mocks**:
- `mockTemporalNowInstantThrow()` — mocks `Temporal.Now.instant()` to throw
- `mockTemporalNowPlainDateTimeISOThrow()` — mocks `Temporal.Now.plainDateTimeISO()` to throw
- `mockTemporalNowZonedDateTimeISOThrow()` — mocks `Temporal.Now.zonedDateTimeISO()` to throw
- `mockTemporalPlainDateFromThrow()` — mocks `Temporal.PlainDate.from()` to throw
- `mockTemporalPlainDateTimeFromThrow()` — mocks `Temporal.PlainDateTime.from()` to throw
- `mockTemporalPlainTimeFromThrow()` — mocks `Temporal.PlainTime.from()` to throw
- `mockTemporalZonedDateTimeFromThrow()` — mocks `Temporal.ZonedDateTime.from()` to throw
- `mockTemporalInstantFromThrow()` — mocks `Temporal.Instant.from()` to throw

**Usage**:
```ts
import { mockTemporalPlainDateFromThrow } from "@gmt/test/mocks";

it("returns empty string when Temporal.PlainDate.from throws", () => {
  mockTemporalPlainDateFromThrow();
  const result = addDays("2024-03-10", 1);
  expect(result).toBe("");
});
```

## JSDoc conventions

All public methods must have comprehensive JSDoc comments with `@example` tags. This ensures proper documentation generation and helps users understand usage patterns.

### Required JSDoc structure

```ts
/**
 * Brief description of what the function does.
 *
 * - Bullet points covering behavior, validation, edge cases, etc.
 * - Each bullet on its own line.
 *
 * @param paramName Description of the parameter
 * @returns Description of return value, or "or <sentinel> on invalid input"
 * 
 * @example functionName(input) // expected output
 * @example functionName(input, options) // expected output
 * @example functionName(invalidInput) // expected output (error case)
 */
export function functionName(...): ... {}
```

### Example with permutations

```ts
/**
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The latest date string, or null on invalid input
 * 
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "also invalid"]) // null
 * @example maxDate([]) // null
 */
```

### Key rules

1. **Use `it.each` backtick syntax** in tests (see AGENTS.md for details)
2. **Show permutations**: valid inputs, invalid inputs, edge cases, empty cases
3. **Include return type in @returns**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`
4. **No Date objects**: Use Temporal or ISO strings only (enforced elsewhere)
5. **Match return sentinel**: `""` for strings, `null` for numbers, `false` for booleans

## Error handling: Always wrap Temporal methods

Any code that calls Temporal methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) **MUST be wrapped in try-catch**.

Temporal's static methods like `Temporal.PlainDate.from()` throw `RangeError` on invalid input (e.g., malformed strings, invalid calendars). These errors must be caught and converted to the appropriate sentinel value.

**Pattern for string returns**:

```ts
export const addDays = (dateStr: string, days: number): string => {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
};
```

**Pattern for number returns**:

```ts
export function getDay = (dateStr: string): number | null {
  if (!isValidDate(dateStr)) {
    return null;
  }
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.day;
  } catch {
    return null;
  }
};
```

**Key rules**:
- Wrap the **entire block** after Zod validation (if any) that uses Temporal methods
- Return `""` for string returns, `null` for number returns, `false` for boolean returns
- Never let Temporal exceptions propagate to the caller
- The catch block should have no arguments (`catch { ... }`) since we don't need the error

