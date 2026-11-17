# Checking the `@tanstack/intent` tool itself

The `intent` CLI (`devDependency` in `package.json` and every `packages/*/package.json`) is a separate concern from the *content* drift this skill otherwise handles — it can fall behind npm just like any other dependency, and its CLI/frontmatter contract does change between releases (e.g. the `type`/`library`/`library_version` frontmatter fields moved under a nested `metadata:` key at some point after 0.0.x). Check before doing anything else:

```bash
npm view @tanstack/intent version
grep '"@tanstack/intent"' package.json packages/*/package.json
```

If the installed `devDependency` version is behind latest, use context7/`find-docs` against `/tanstack/intent` to confirm what changed (CLI flags, frontmatter schema, new commands) before bumping — don't assume it's purely additive. Bump the version string in all five `package.json` files that declare it (`package.json`, `packages/gmt/package.json`, `packages/gmt-eslint/package.json`, `packages/gmt-biome/package.json`, `packages/gmt-oxlint/package.json`), run `pnpm install`, then run `pnpm exec intent validate packages/gmt/skills` — a schema-migration error here (like the `metadata:` nesting one) is expected and has a one-shot fix: `pnpm exec intent validate packages/gmt/skills --fix`.

## Validator fixes

If validation reports the `metadata:` nesting error, auto-fix it instead of hand-editing every file:

```bash
pnpm exec intent validate packages/gmt/skills --fix
```

To bump every skill's `metadata.library_version` in one pass instead of hand-editing each SKILL.md (step 3's version bump):

```bash
pnpm exec intent validate packages/gmt/skills --set-version <next-version>
```
