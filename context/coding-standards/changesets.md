# Coding Standards: Changesets

## Changesets

The one rule; other docs link here.

| Change                                                         | Changeset                                              |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Bug fix, including a behaviour correction to shipped API       | `patch`                                                |
| Speed or size gain; no output, option or signature change      | `patch`                                                |
| Refactor, docs, tests or agent config with no behaviour change | empty, when a file under `packages/` changed; else none |
| New public API (function, option, namespace)                   | `minor`                                                |
| Breaking change (removed option, changed output or signature)  | `minor`, with a **Breaking changes** migration section |

`major` is never used. GMT's users are internal, so a breaking change ships in the next minor
release (owner decision, 2026-09-17). Fix to the standard: no compatibility shim, no deprecation
period, and no "removed in a later version" wording. The changeset's **Breaking changes** section
names every affected function and shows each old call or output next to its replacement.

Any file under `packages/` counts as a package change, even a README, a test or a comment, and CI's
**Story consistency** check (`changeset status`) fails without a changeset. So a change with no
release still carries an empty one (`pnpm changeset:add --empty`): two `---` lines and no package,
then one line that starts "No release." and says what changed. `apps/dox` is private, so a Dox-only
change needs none. A spec that says "no changeset" means no bump, never no file.

A speed or size changeset states the savings: before → after for size (minified and gzipped) and for speed.

Every epic story so far adds API, so its changeset is `minor`. A fix to an earlier story is still `patch`. Run `pnpm changeset:status` on every change, whatever the level, to prove coverage. It sees only files git tracks, so a new changeset counts once it is staged or committed. See `PUBLISHING.md` for the release flow.
