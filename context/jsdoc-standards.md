# JSDoc Standards

All public functions must have JSDoc with `@example` tags covering valid inputs, invalid inputs, and edge cases.

Every public type, every member of a public object type and every option property must have its own JSDoc. The docs site builds its Options and Members tables from these comments, and editors show them on hover.

## Required Structure

```ts
/**
 * Brief description of what the function does.
 *
 * - Bullet covering key behavior or constraint.
 * - Another bullet for edge cases or validation rules.
 *
 * @param paramName Description of the parameter
 * @param options What the options object controls, in one phrase
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
 *
 * @param value ISO PlainDate string (e.g. "2024-03-10")
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @param options How an out-of-range result is handled
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 * @example addDate("2024-01-31", { months: 1 }) // "2024-02-29"
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "reject" }) // ""
 */
export function addDate(
  value: string,
  units: Partial<Record<DateDurationUnit, number>>,
  options?: {
    /**
     * What to do when the result is not a real date. `"constrain"` clamps Jan 31 + 1 month to
     * Feb 29/28 (TC39); `"reject"` returns "".
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {}
```

## Options and members

The property's own JSDoc is the single source for what an option or member means and what its default is. This follows TSDoc: [`@defaultValue`](https://tsdoc.org/pages/tags/defaultvalue/) documents the default of a field or property, and [`@param`](https://tsdoc.org/pages/tags/param/) describes the parameter as a whole.

- **Every property has a description.** This covers each property of an options object (inline type literal, interface or type alias) and each member of a public object type. Write one to three sentences. Do not use a list: the description renders in a table cell.
- **Do not repeat the name or the type.** Say what the value controls and what each allowed value does.
- **Every optional input property has `@defaultValue`.** An input property is one a caller passes: an option, or a member of an object the function takes. Write the default in one of four forms:

  | Default | Form | Example |
  | --- | --- | --- |
  | A fixed literal | The literal in backticks | `` @defaultValue `false` `` |
  | Computed at call time | A noun phrase | `@defaultValue The current instant.` |
  | Passed through to Temporal or Intl | The literal, then its owner | `` @defaultValue `"compatible"`, Temporal's default. `` |
  | No default | "None.", then what omitting it does | `@defaultValue None. The result is not rounded.` |

- **Read the default from the code.** Take it from the function body and the `internal/` helper it calls, or from the Temporal or ECMA-402 specification for a value passed through. Never copy it from existing prose.
- **Use `@defaultValue`, never `@default`.** One tag keeps the source consistent.
- **Members of a returned type take no `@defaultValue`.** For an optional member, the description says when it is absent.
- **`@param options` describes the object in one phrase.** It does not list option names, types or defaults. The tag name matches the parameter name exactly (`@param optionsArg` for a parameter named `optionsArg`).
- **A bullet that explains only one option moves to that property.** Behaviour bullets describe the function as a whole.
- **Every public type has a description** in a `/** */` block above its declaration. A `//` line comment is not read.

`pnpm dox:docs-check` reports every public type, member and option that breaks these rules, with its file and line.

## Key Rules

- **Show permutations**: valid input, invalid input, edge cases (empty array, boundary values).
- **@returns must name the sentinel**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`, `or [] on invalid input`, `or 0n on invalid input`.
- **Match the sentinel to the return type** using the single table in [coding-standards § API Contract](./coding-standards.md#api-contract).
- **Use `@example functionName(args) // result`** — inline comment style, one example per line.
- Do not write multi-paragraph prose blocks. Keep it tight.
