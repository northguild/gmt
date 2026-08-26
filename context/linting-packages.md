# Linting Packages

GMT publishes three opt-in linting packages that enforce the `Date` API ban at the AST level. All three are independent — consumers install whichever matches their linter. All three ban the same six patterns and point to the same GMT replacements.

## Packages at a Glance

| Package                  | Linter     | Mechanism                                          | npm                                                                |
| ------------------------ | ---------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `@northguild/gmt-eslint` | ESLint ≥ 9 | Flat config using built-in `no-restricted-*` rules | `npm i -D @northguild/gmt-eslint eslint @typescript-eslint/parser` |
| `@northguild/gmt-oxlint` | Oxlint ≥ 1 | JS plugin with custom rule modules (alpha)         | `npm i -D @northguild/gmt-oxlint oxlint`                           |
| `@northguild/gmt-biome`  | Biome ≥ 2  | GritQL `.grit` plugins in the `plugins` array      | `npm i -D @northguild/gmt-biome @biomejs/biome`                    |

## Banned Patterns (all three packages)

| Pattern                    | GMT replacement                                              |
| -------------------------- | ------------------------------------------------------------ |
| `Date` (bare global)       | `getNow()`, `getUnixNow()`, `getUtcNow()`, `getZonedNow(tz)` |
| `new Date(...)`            | `getUtcNow()`, `getNow()`, `getZonedNow(tz)`                 |
| `Date.now()`               | `getUnixNow('milliseconds' \| 'seconds')`                    |
| `Date.parse(...)`          | `convertZonedToUnix(value)`                                  |
| `Date.UTC(...)`            | `convertUtcDateTimeToUnix(value, unit)`                      |
| `date.getTimezoneOffset()` | `getZonedNow(tz)` or zoned helpers                           |

---

## `@northguild/gmt-eslint`

**Source:** `packages/gmt-eslint/eslint/index.mjs`

A single default-exported flat config array. Uses only ESLint's built-in rules — no custom rule modules, no plugin registration. Peer deps: `eslint ^9`, `@typescript-eslint/parser ^8`.

**How it works:** Three built-in ESLint rules do all the work:

- `no-restricted-globals` — bans the bare `Date` global identifier
- `no-restricted-properties` — bans `Date.now`, `Date.UTC`, `Date.parse`
- `no-restricted-syntax` — bans `new Date(...)` and `date.getTimezoneOffset()` via AST selectors

**Consumer usage:**

```js
// eslint.config.mjs
import gmtEslintConfig from "@northguild/gmt-eslint";
export default [...gmtEslintConfig];
```

**Authoring references:**

- ESLint flat config plugin guide: https://eslint.org/docs/latest/extend/plugins
- Writing custom rules: https://eslint.org/docs/latest/extend/custom-rules
- `no-restricted-globals`: https://eslint.org/docs/latest/rules/no-restricted-globals
- `no-restricted-properties`: https://eslint.org/docs/latest/rules/no-restricted-properties
- `no-restricted-syntax`: https://eslint.org/docs/latest/rules/no-restricted-syntax
- Configuring plugins (flat config): https://eslint.org/docs/latest/use/configure/plugins

**Adding a new ban:** Add an entry to the appropriate rule in `eslint/index.mjs`. No build step required — the package publishes the `.mjs` source directly.

---

## `@northguild/gmt-oxlint`

**Source:** `packages/gmt-oxlint/src/`

A TypeScript-authored Oxlint JS plugin. Each rule is its own module under `src/rules/`. Built with `tsup` into `dist/`. The plugin object follows the ESLint-compatible rule API that Oxlint's JS plugin system expects.

**How it works:** Each rule exports a `RuleModule` with a `meta` block and a `create(context)` function returning AST visitor methods. The plugin registers all rules under the `@northguild/gmt-oxlint` namespace. A `recommendedConfig` export bundles `jsPlugins` + `rules` for one-line setup.

**Rule structure:**

```ts
export const noNewDateRule: RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow new Date(...)." },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isIdentifier(node.callee, "Date")) return;
        context.report({ node, message: MSG_NEW_DATE });
      },
    };
  },
};
```

**Consumer usage (recommended):**

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
import { recommendedConfig } from "@northguild/gmt-oxlint";
export default defineConfig(recommendedConfig);
```

**Consumer usage (JSON):**

```json
{
  "jsPlugins": ["@northguild/gmt-oxlint"],
  "extends": ["./node_modules/@northguild/gmt-oxlint/config/recommended.json"]
}
```

> Note: Oxlint resolves `extends` as file paths, not npm specifiers. Use the `./node_modules/` path form.

**Authoring references:**

- Writing Oxlint JS plugins: https://oxc.rs/docs/guide/usage/linter/writing-js-plugins
- JS plugins overview (alpha status): https://oxc.rs/docs/guide/usage/linter/js-plugins
- Oxlint configuration reference: https://oxc.rs/docs/guide/usage/linter/config
- Alpha announcement: https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha

**Adding a new rule:**

1. Add `src/rules/no-<pattern>.ts` following the existing rule shape
2. Add a message constant to `src/messages.ts`
3. Register the rule in `src/index.ts` under `plugin.rules` and add it to `recommendedRules`
4. Add `"@northguild/gmt-oxlint/no-<pattern>": "error"` to `config/recommended.json`
5. Run `pnpm build` to rebuild `dist/`

**Important:** Oxlint JS plugins are in **alpha**. The plugin API may change between Oxlint releases. Pin `oxlint` in devDependencies and test after upgrades.

---

## `@northguild/gmt-biome`

**Source:** `packages/gmt-biome/plugins/`

A set of GritQL `.grit` files. No build step — the `.grit` source files are the published artifact. Biome resolves plugin paths as filesystem paths using `./node_modules/` prefixes; npm package specifiers are not supported in `plugins`.

**How it works:** Each `.grit` file contains a GritQL pattern. When Biome finds a match, the `register_diagnostic` call emits an error with the specified message. The combined `all.grit` file includes all individual patterns.

**Rule structure:**

```grit
`new Date($args)` where {
  register_diagnostic(
    span=`new Date`,
    message="Avoid new Date(). Use @northguild/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.",
    severity="error"
  )
}
```

**Consumer usage (recommended — all rules):**

```json
{
  "plugins": ["./node_modules/@northguild/gmt-biome/plugins/all.grit"]
}
```

**Consumer usage (selective):**

```json
{
  "plugins": [
    "./node_modules/@northguild/gmt-biome/plugins/no-new-date.grit",
    "./node_modules/@northguild/gmt-biome/plugins/no-date-now.grit"
  ]
}
```

> Note: `extends` cannot distribute GritQL plugins — plugin paths in extended configs resolve relative to the consuming project root, not the npm package. Always use `plugins` directly.

**Authoring references:**

- Biome linter plugins guide: https://biomejs.dev/linter/plugins/
- GritQL language reference (Biome): https://biomejs.dev/reference/gritql/
- GritQL plugin recipes: https://biomejs.dev/recipes/gritql-plugins/
- GritQL GitHub repo: https://github.com/biomejs/gritql

**Adding a new rule:**

1. Create `plugins/no-<pattern>.grit` with a GritQL pattern and `register_diagnostic`
2. Add an `import` or `include` for it in `plugins/all.grit`
3. Add the new subpath export to `package.json` `exports` (`"./plugins/no-<pattern>.grit": "./plugins/no-<pattern>.grit"`)
4. Update the README banned-patterns table

---

## Internal Architecture Notes

- All three packages target the same six `Date` patterns. When adding a new ban, update all three.
- `gmt-eslint` has no build step — changes take effect immediately.
- `gmt-oxlint` requires `pnpm build` (tsup) before publishing. The `prepack` script runs it automatically.
- `gmt-biome` has no build step — `.grit` files are published as-is.
- Peer dependency versions are kept deliberately loose (`eslint ^9`, `oxlint >=1.0.0`, `@biomejs/biome >=2.0.0`) to avoid forcing consumers onto a specific minor.
