# JSDoc Standards

All public functions must have JSDoc with `@example` tags covering valid inputs, invalid inputs, and edge cases.

## Required Structure

```ts
/**
 * Brief description of what the function does.
 *
 * - Bullet covering key behavior or constraint.
 * - Another bullet for edge cases or validation rules.
 *
 * @param paramName Description of the parameter
 * @param options Optional: { optionName: Type } Description
 * @returns Description of return value, or <sentinel> on invalid input
 *
 * @example functionName(validInput) // expected output
 * @example functionName(validInput, { option: value }) // expected output
 * @example functionName(invalidInput) // "" | null | false
 */
export function functionName(...): ... {}
```

## Example with Full Permutations

```ts
/**
 * Return a PlainDate ISO string with `units` added.
 *
 * - Returns "" for invalid inputs.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results; the default
 *   clamps Jan 31 + 1 month to Feb 29/28 (TC39).
 *
 * @param value ISO PlainDate string (e.g. "2024-03-10")
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 * @example addDate("2024-01-31", { months: 1 }) // "2024-02-29"
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "reject" }) // ""
 */
```

## Key Rules

- **Show permutations**: valid input, invalid input, edge cases (empty array, boundary values).
- **@returns must name the sentinel**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`, `or [] on invalid input`, `or 0n on invalid input`.
- **Match the sentinel to the return type** using the single table in [coding-standards § API Contract](./coding-standards.md#api-contract).
- **Use `@example functionName(args) // result`** — inline comment style, one example per line.
- Do not write multi-paragraph prose blocks. Keep it tight.
