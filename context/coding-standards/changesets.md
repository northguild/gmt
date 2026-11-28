# Coding Standards: Changesets

## Changesets

The one rule; other docs link here.

| Change                                                         | Changeset                                              |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Bug fix, including a behaviour correction to shipped API       | `patch`                                                |
| Speed or size gain; no output, option or signature change      | `patch`                                                |
| New public API (function, option, namespace)                   | `minor`                                                |
| Breaking change (removed option, changed output or signature)  | `minor`, with a **Breaking changes** migration section |
| Anything else: refactor, docs, tests, CI, agents, Dox          | empty                                                  |

`major` is never used. GMT's users are internal, so a breaking change ships in the next minor
release (owner decision, 2026-09-17). Fix to the standard: no compatibility shim, no deprecation
period, and no "removed in a later version" wording. The changeset's **Breaking changes** section
names every affected function and shows each old call or output next to its replacement.

**Every PR carries at least one changeset.** A change with no release carries an empty one
(`pnpm changeset:add --empty`): two `---` lines and no package, then one line that starts "No
release." and says what changed. That holds for a change outside `packages/` too: a Dox-only,
canary, CI, docs or agent-config PR gets an empty changeset. Any file under `packages/` counts as a
package change, even a README, a test or a comment, and CI's **Story consistency** check
(`changeset status`) fails without a changeset. Never write "no changeset" in a spec, tracker, issue
or PR description; a PR's Release section names the changeset file and its level ("empty, no
bump"). An old spec that says "no changeset" means an empty one.

A speed or size changeset states the savings: before → after for size (minified and gzipped) and for speed.

Every epic story so far adds API, so its changeset is `minor`. A fix to an earlier story is still `patch`. Run `pnpm changeset:status` on every change, whatever the level, to prove coverage. It sees only files git tracks, so a new changeset counts once it is staged or committed. See `PUBLISHING.md` for the release flow.
