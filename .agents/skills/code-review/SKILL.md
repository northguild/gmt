---
name: code-review
description: Perform code reviews for GMT Temporal projects (gmt, gmt-oxlint, gmt-eslint, gmt-biome). Focus on Temporal-specific patterns, string-only I/O, error handling, and test coverage.
---

# GMT Temporal Code Review

Follow these guidelines when reviewing code for GMT Temporal projects.

## Review Checklist

**The canonical, up-to-date checklist is [context/code-review-checklist.md](../../../context/code-review-checklist.md) — read and apply it in full for every review.** It covers API Contract, Architecture, Tests, Documentation (including README and TanStack Intent skill freshness), Long-Term Impact flags, and reviewer Tone. Do not rely on a separate copy here; that file is the single source of truth so it doesn't drift out of sync with this skill.

The rest of this skill supplements that checklist with worked examples of common violations — useful for recognizing patterns quickly, not a substitute for the checklist itself. Reviewer tone and approval guidance also live in the checklist's Tone section — don't duplicate it here.

## Common Patterns to Flag

### Temporal Error Handling

```typescript
// ❌ Bad: No try-catch
export const addDays = (dateStr: string, days: number): string => {
  const date = Temporal.PlainDate.from(dateStr); // Can throw!
  return date.add({ days }).toString();
};

// ✅ Good: Wrapped in try-catch
export const addDays = (dateStr: string, days: number): string => {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
};
```

### Date Object Usage

```typescript
// ❌ Bad: Date object usage
export const getNow = (): string => {
  return new Date().toISOString();
};

// ✅ Good: Temporal-only
export const getNow = (): string => {
  return Temporal.Now.instant().toString();
};
```

### Plain/Zoned Mixing

```typescript
// ❌ Bad: Mixing plain and zoned
export const badFunction = (plainDate: string, zonedDateTime: string): string => {
  const p = Temporal.PlainDate.from(plainDate);
  const z = Temporal.ZonedDateTime.from(zonedDateTime);
  // Logic mixing these is error-prone
};

// ✅ Good: Separate concerns
export const goodFunction = (zonedDateTime: string): string => {
  try {
    const z = Temporal.ZonedDateTime.from(zonedDateTime);
    return z.add({ days: 1 }).toString();
  } catch {
    return "";
  }
};
```

### Test Patterns

```typescript
// ❌ Bad: Array syntax for it.each
it.each([
  ["2024-03-10", 10],
  ["2024-03-15", 15],
])("returns $expected for $input", (input, expected) => {
  expect(getDay(input)).toBe(expected);
});

// ✅ Good: Template literal syntax
it.each`
  input       | expected
  ${"2024-03-10"} | ${10}
  ${"2024-03-15"} | ${15}
`("returns $expected for $input", ({ input, expected }) => {
  expect(getDay(input)).toBe(expected);
});
```

### Error Path Testing

```typescript
// ✅ Use pre-built mocks from @gmt/test/mocks
import { mockTemporalPlainDateFromThrow } from "@gmt/test/mocks";

it("returns empty string when Temporal.PlainDate.from throws", () => {
  mockTemporalPlainDateFromThrow();
  const result = addDays("2024-03-10", 1);
  expect(result).toBe("");
});
```

## References

- [Code Review Checklist](../../../context/code-review-checklist.md) — the canonical checklist this skill defers to
- [GMT Temporal Agent Rules](../../../AGENTS.md)