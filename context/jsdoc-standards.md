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
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The latest date string, or null on invalid input
 *
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "2024-03-15", "2024-03-12"])    // "2024-03-15"
 * @example maxDate(["invalid", "also invalid"])                 // null
 * @example maxDate([])                                          // null
 */
```

## Key Rules

- **Show permutations**: valid input, invalid input, edge cases (empty array, boundary values).
- **@returns must name the sentinel**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`.
- **Match the sentinel to the return type**: `""` for strings, `null` for numbers/arrays, `false` for booleans.
- **Use `@example functionName(args) // result`** — inline comment style, one example per line.
- Do not write multi-paragraph prose blocks. Keep it tight.
