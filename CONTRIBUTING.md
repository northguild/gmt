# Contributing

Node.js 24.x (recommended for development; see `.nvmrc`)
pnpm (recommended package manager). Use Corepack or Volta to manage pnpm locally.

This guide covers local development, quality checks, and publishing for workspace packages.

Local setup (recommended):

```bash
# Activate Corepack and install workspace deps
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
```

Common workspace commands (run from repository root):

```bash
# Run targets across the workspace
pnpm -w exec nx run-many -t build
pnpm -w exec nx run-many -t test
pnpm -w exec nx run-many -t lint
pnpm -w exec nx run-many -t typecheck

# Affected projects only
pnpm -w exec nx affected -t build
pnpm -w exec nx affected -t test
pnpm -w exec nx affected -t lint
pnpm -w exec nx affected -t typecheck
```

Nx-focused workflow examples:

```bash
# Visual dependency graph
pnpm -w exec nx graph

# Sync TypeScript project references
pnpm -w exec nx sync
pnpm -w exec nx sync:check
```

Run commands inside a specific package directory:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Package-level development

Example for the `gmt` package:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Publishing

Publishing is managed with Changesets and is triggered manually — nothing publishes automatically.

**See [PUBLISHING.md](./PUBLISHING.md) for the full step-by-step guide** including one-time npm org setup, how to record changesets, how to cut a release, and how git tags work in this monorepo.

For copyable commands and a quick reference, see [PUBLISHING.md](./PUBLISHING.md).

## PR checklist

- Ensure tests pass for affected projects.
- Ensure lint/typecheck pass for affected projects.
- Keep APIs string-in/string-out and Temporal-only.
- Add or update tests for behavior changes.

