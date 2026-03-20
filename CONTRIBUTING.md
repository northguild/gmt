# Contributing

Thanks for contributing to the Burglekitt monorepo.

This guide covers local development, quality checks, and publishing for workspace packages.

## Requirements

- Node.js 18+
- Bun (recommended package manager and script runner)

## Local setup

```bash
bun install
```

## Development workflow

Run from repo root.

### Core checks

```bash
bun run build
bun run typecheck
bun run test
bun run lint
bun run format
```

### Recommended pre-PR gate

```bash
bun run validate
```

### Nx-focused commands

```bash
# All projects
bun nx run-many -t build
bun nx run-many -t test
bun nx run-many -t lint
bun nx run-many -t typecheck

# Affected projects only
bun run affected:build
bun run affected:test
bun run affected:lint
bun run affected:typecheck
```

## Package-level development

Example for GMT package:

```bash
cd packages/gmt
bun run build
bun run test
bun run lint
```

## Publishing

Publishing is manual and package-scoped.

### Package publish scripts

For publishable packages (for example, `packages/gmt-biome` and `packages/gmt-eslint`):

```bash
# from the package directory
bun run publish:dry-run
bun run publish:public
```

These scripts run `npm publish --access public` under the hood.

### Monorepo config usage (maintainers)

When wiring local package configs inside this monorepo:

```json
{
	"$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
	"extends": ["./packages/gmt-biome/biome.json"]
}
```

```js
// eslint.config.mjs
import gmtEslintConfig from "./packages/gmt-eslint/eslint/index.mjs";

export default [...gmtEslintConfig];
```

## PR checklist

- Ensure tests pass for affected projects.
- Ensure lint/typecheck pass for affected projects.
- Keep APIs string-in/string-out and Temporal-only.
- Add or update tests for behavior changes.

