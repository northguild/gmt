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
    - **Why**: Keeps tests deterministic without mutating runtime globals in unsafe ways.

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
