| Rule                    | Current behavior                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| String-first API        | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math                                      |
| Plain/zoned separation  | `plain/*` is timezone-free, `zoned/*` is timezone-aware                            |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing                         |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`
