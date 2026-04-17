# GMT Temporal Library: Agent Rules

**Strict Guidelines for Working with Temporal Data**

---

## 📜 Core Principles

1. **String-Only Inputs/Outputs**
   - **Rule**: All functions MUST accept/return **ISO 8601 strings** (e.g., `"2024-03-10"`, `"2024-03-10T12:00:00+01:00[Europe/Paris]"`).
   - **Why**: Avoids `Date` object pitfalls (mutability, timezones, DST bugs).
   - **Enforcement**: Zod schemas validate strings at runtime.

2. **Temporal-Only**
   - **Rule**: Use **only** `@js-temporal/polyfill` (never `Date`, `new Date()`, or `Date.now()`).
   - **Why**: Temporal is immutable, timezone-aware, and precise.
   - **Enforcement**: ESLint/Biome custom rules (block `Date` imports).

3. **Strict Plain/Zoned Separation**
   - **Rule**: Never mix `PlainDateTime` and `ZonedDateTime` in the same function/module.
   - **Why**: Prevents ambiguity in timezone handling.
   - **Enforcement**: Separate `plain/` and `zoned/` directories.

### 🧪 Test Rules

1. **Use `it.each`` (Template Literals) for Iterative Tests**
   - **Rule**: Always use backtick syntax (`it.each``) instead of array syntax (`it.each([])`).
   - **Why**: Improves readability, type inference, and maintainability.
   - **Example**:

     ```ts
     ✅ Correct:
     it.each`
       input       | expected
       \${"2024"}   | \${2024}
       \${"2025"}   | \${2025}
     `("returns \$expected for \$input", ({ input, expected }) => { ... });

     ❌ Avoid:
     it.each([
       ["2024", 2024],
       ["2025", 2025]
     ])("returns %s for %s", (input, expected) => { ... });
     ```

   - **Enforcement**: ESLint `vitest/prefer-it-each` rule (configured in `.eslintrc.json`).

2. **Never Override Real Functions in Tests**
     - **Rule**: Do not directly reassign or monkey-patch real functions (for example, `foo = ...`, `Temporal.Now.instant = ...`, `Intl.DateTimeFormat.prototype.resolvedOptions = ...`).
     - **Use instead**:
        - `vi.useFakeTimers()` + `vi.setSystemTime(...)` + `vi.useRealTimers()` for deterministic "now" behavior.
        - `vi.spyOn(...).mockReturnValue(...)`, `mockReturnValueOnce(...)`, `mockImplementation(...)`, `mockResolvedValue(...)`, `mockRejectedValue(...)` for controlled behavior.
        - **Pre-built mock functions** for testing error paths (see section below).
     - **Why**: Keeps tests deterministic without mutating runtime globals in unsafe ways.

3. **Use Pre-built Mock Functions for Error Path Testing**
     - **Rule**: Use the pre-built mock functions from `packages/gmt/src/test/mocks` to test error handling paths that throw.
     - **Available mocks**:
       - `mockTemporalNowInstantThrow()` — mocks `Temporal.Now.instant()` to throw
       - `mockTemporalNowPlainDateTimeISOThrow()` — mocks `Temporal.Now.plainDateTimeISO()` to throw
       - `mockTemporalNowZonedDateTimeISOThrow()` — mocks `Temporal.Now.zonedDateTimeISO()` to throw
       - `mockTemporalPlainDateFromThrow()` — mocks `Temporal.PlainDate.from()` to throw
       - `mockTemporalPlainDateTimeFromThrow()` — mocks `Temporal.PlainDateTime.from()` to throw
       - `mockTemporalPlainTimeFromThrow()` — mocks `Temporal.PlainTime.from()` to throw
       - `mockTemporalZonedDateTimeFromThrow()` — mocks `Temporal.ZonedDateTime.from()` to throw
       - `mockTemporalInstantFromThrow()` — mocks `Temporal.Instant.from()` to throw
     - **Usage**:
       ```ts
       import { mockTemporalPlainDateFromThrow } from "@gmt/test/mocks";
       
       it("returns empty string when Temporal.PlainDate.from throws", () => {
         mockTemporalPlainDateFromThrow();
         const result = addDays("2024-03-10", 1);
         expect(result).toBe("");
       });
       ```
     - **Why**: Ensures consistent error handling testing across all functions without duplicating mock logic.

3. **Locale Matrix Coverage Is Mandatory for Locale-Aware APIs**
      - **Rule**: Any function that accepts a `locale` argument MUST test the full locale matrix:
         - `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-PT`, `sv-SE`, `is-IS`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `ar-SA`, `he-IL`, `ru-RU`, `tr-TR`
      - **Implementation requirement**: Tests MUST reference named constants from the locale helper object (for example `MustTestLocales.enUS`) and list them explicitly in an `it.each`` table.
      - **Do not**: Build locale tests by iterating generic arrays that hide locale names.
      - **Why**: Explicit rows make locale intent and coverage visible, auditable, and easy to review for format regressions.


---

## 🛠 Implementation Rules

### ✅ **Allowed**

| Pattern                     | Example                                  |
|-----------------------------|------------------------------------------|
| ISO strings                 | `"2024-03-10"`                            |
| Temporal objects            | `Temporal.PlainDate.from("2024-03-10")`   |
| Zod validation              | `PlainDateSchema.parse(input)`            |
| Tree-shakable exports       | `export * "./plain"`       |

### ❌ **Forbidden**

| Pattern                     | Replacement                          |
|-----------------------------|---------------------------------------|
| `new Date()`                | `Temporal.Now.instant()`              |
| `date.getTime()`            | `Temporal.Instant.from(date).epochSeconds` |
| Manual string parsing       | `Temporal.PlainDate.from(string)`     |
| Mutating methods            | Use Temporal’s immutable methods      |
### 🚨 **Error Handling: Invalid Input Return Values**

**Rule**: Return values depend on the function's return type:

| Return Type | Invalid Input Behavior | Example |
|-------------|----------------------|---------|
| `string`    | Return empty string `""` | `addDate("invalid", 1, "day") → ""` |
| `number`    | Return `null` | `diffDate("invalid", "2024-01-01", "day") → null` |
| `boolean`   | Return `false` | `isValidDate("invalid") → false` |

**Why**: Consistent, type-safe error handling without exceptions. Allows chaining and null-coalescing operators.

### ⚠️ **Always Wrap Temporal Methods in Try-Catch**

**Rule**: Any code that calls Temporal methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) **MUST be wrapped in try-catch**.

**Why**: Temporal's static methods like `Temporal.PlainDate.from()` throw `RangeError` on invalid input (e.g., malformed strings, invalid calendars). These errors must be caught and converted to the appropriate sentinel value.

**Pattern**:

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

**Key rules**:
- Wrap the **entire block** after Zod validation (if any) that uses Temporal methods
- Return `""` for string returns, `null` for number returns, `false` for boolean returns
- Never let Temporal exceptions propagate to the caller
- The catch block should have no arguments (`catch { ... }`) since we don't need the error
---

## 🔍 Code Review Checklist

**For every PR, verify:**

1. **No `Date` objects** (search for `Date`, `new Date`, `.getTime()`).
2. **All inputs/outputs are strings** (or Temporal objects).
3. **Plain/zoned separation** (no cross-contamination).
4. **Zod validation** for all public APIs.
5. **100% test coverage** for edge cases (timezones, leap seconds).
6. **Error handling is type-safe**: 
   - Functions returning `string` return `""` on invalid input
   - Functions returning `number` return `null` on invalid input
   - Functions returning `boolean` return `false` on invalid input

---

## 📋 Example: Valid vs. Invalid

### ✅ **Valid**

```ts
import { Temporal } from "@js-temporal/polyfill";

// Convert string → Temporal → string
export const addDays = (dateStr: string, days: number): string => {
  const date = Temporal.PlainDate.from(dateStr);
  return date.add({ days }).toString();
};
```

---

## 📝 JSDoc Conventions

All public methods MUST have comprehensive JSDoc comments with `@example` tags. This ensures proper documentation generation and helps users understand usage patterns.

### Required JSDoc structure

```ts
/**
 * Brief description of what the function does.
 *
 * - Bullet points covering behavior, validation, edge cases, etc.
 * - Each bullet on its own line with proper indentation.
 *
 * @param paramName Description of the parameter
 * @param optionsArg Optional: { optionName: Type } Description
 * @returns Description of return value, or <sentinel> on invalid input
 *
 * @example functionName(input) // expected output
 * @example functionName(input, { optionName: value }) // expected output
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

1. **Show permutations**: valid inputs, invalid inputs, edge cases, empty cases
2. **Include return type in @returns**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`
3. **Match return sentinel**: `""` for strings, `null` for numbers, `false` for booleans
4. **Use consistent format**: `@example functionName(args) // result`
