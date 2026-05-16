---
name: code-review
description: Perform code reviews for GMT Temporal projects (gmt, gmt-oxlint, gmt-eslint, gmt-biome). Focus on Temporal-specific patterns, string-only I/O, error handling, and test coverage.
---

# GMT Temporal Code Review

Follow these guidelines when reviewing code for GMT Temporal projects.

## Review Checklist

### Core Principles (Critical)

1. **String-Only Inputs/Outputs**
   - All functions MUST accept/return ISO 8601 strings (e.g., `"2024-03-10"`, `"2024-03-10T12:00:00+01:00[Europe/Paris]"`)
   - NO `Date` objects, `new Date()`, or `Date.now()` anywhere in the codebase
   - Zod schemas must validate all public API inputs

2. **Temporal-Only**
   - Use ONLY `@js-temporal/polyfill` - no `Date` imports or usage
   - ESLint/Biome rules block `Date` imports

3. **Plain/Zoned Separation**
   - Never mix `PlainDateTime` and `ZonedDateTime` in the same function/module
   - Maintain strict separation between `plain/` and `zoned/` directories

### Identifying Problems

- **Temporal errors**: Missing try-catch around `.from()`, `.add()`, `.subtract()`, `.since()`, `.until()` - these throw `RangeError` on invalid input
- **Error handling**: Functions returning `string` return `""` on invalid input, `number` returns `null`, `boolean` returns `false`
- **Timezone bugs**: Mixing plain and zoned types, incorrect timezone handling
- **Test gaps**: Missing locale matrix coverage, missing error path tests, missing edge cases

### Design Assessment

- Plain/zoned separation maintained in new code
- Functions follow the string-in, string-out pattern
- No direct `Date` usage anywhere
- Error handling follows type-safe sentinel pattern

### Test Coverage

Every PR must have:

- Tests using `it.each`` (template literal syntax) for iterative cases
- Mock functions from `@gmt/test/mocks` for error path testing (e.g., `mockTemporalPlainDateFromThrow()`)
- Full locale matrix coverage for locale-aware APIs (en-US, en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT, sv-SE, is-IS, zh-CN, zh-TW, ja-JP, ko-KR, ar-SA, he-IL, ru-RU, tr-TR)
- Edge case tests (leap years, DST transitions, invalid inputs)

### Long-Term Impact

Flag for senior review when changes involve:
- New Temporal API adoption patterns
- Cross-plain/zoned type mixing
- Public API signature changes
- New locale support requirements

## Feedback Guidelines

### Tone

- Be polite and empathetic
- Provide actionable suggestions, not vague criticism
- Phrase as questions when uncertain: "Have you considered...?"

### Approval

- Approve when only minor issues remain
- Don't block PRs for stylistic preferences
- Goal is risk reduction, not perfect code

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

- [GMT Temporal Agent Rules](../AGENTS.md)