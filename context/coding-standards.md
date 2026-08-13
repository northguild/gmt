# Coding Standards

## API Contract

- All public functions accept **ISO 8601 strings** (or numeric Unix epochs where the domain requires it).
- Return types: ISO strings, numbers, booleans, or arrays — never `Date` objects or Temporal objects.
- Invalid input returns a typed sentinel — never throws:

| Return type | Sentinel |
|---|---|
| `string` | `""` |
| `number` | `null` |
| `boolean` | `false` |
| `array` | `[]` |

## Allowed vs. Forbidden Patterns

### Allowed

| Pattern | Example |
|---|---|
| ISO strings | `"2024-03-10"` |
| Temporal objects (internal only) | `Temporal.PlainDate.from("2024-03-10")` |
| Tree-shakable exports | `export * from "./plain"` |

### Forbidden

| Pattern | Replacement |
|---|---|
| `new Date()` | `Temporal.Now.instant()` |
| `date.getTime()` | `Temporal.Instant.from(date).epochSeconds` |
| Manual string parsing | `Temporal.PlainDate.from(string)` |
| Mutating methods | Use Temporal's immutable methods |

## Always Wrap Temporal Calls in Try-Catch

Temporal's static methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) throw `RangeError` on invalid input. Every call must be wrapped:

```ts
export function addDays(dateStr: string, days: number): string {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
}
```

- Wrap the entire block that uses Temporal methods.
- The catch block takes no argument (`catch { ... }`) — we never need the error value.
- Return the appropriate sentinel for the function's return type.

## Loop Style

Avoid `while` loops in new code. Prefer `for` loops or array methods (`map`, `filter`, `reduce`, etc.). `while` loops are more error-prone and harder to reason about than bounded `for` loops.

## Plain / Zoned Separation

- `plain/` — timezone-free operations (`PlainDate`, `PlainTime`, `PlainDateTime`)
- `zoned/` — IANA timezone-aware operations (`ZonedDateTime`)
- Never mix the two in the same function or module.

## Linting Enforcement

The `Date` API ban is enforced at the AST level by three optional linting packages:

- `@burglekitt/gmt-eslint` — ESLint flat config
- `@burglekitt/gmt-biome` — Biome + GritQL plugins
- `@burglekitt/gmt-oxlint` — Oxlint JS plugin

If the linter passes, no `Date` object crept in.
