---
name: ui-standards
description: Check that the branch's apps/dox changes meet the Dox UI standards — each block has one home, animation plays on the shared frame loop, shared code takes its feature as input, layout comes from attributes, every export has a reader, panels have full borders and bevelled corners, data states each fact once, and modules stay under 400 lines. Use when the user says "ui-standards", "check the UI standards", "did we reuse the shared blocks", before a Dox story is reported done, or when finalizer, dox-builder or dox-tester reach their Reuse step.
---

# ui-standards — Reuse, never reinvent, as a check

```bash
node .agents/skills/ui-standards/scripts/run.mjs              # lines this branch adds under apps/dox
node .agents/skills/ui-standards/scripts/run.mjs --all        # every line under apps/dox (the backlog)
node .agents/skills/ui-standards/scripts/run.mjs --base REF   # another branch point (default origin/main)
```

Exit `0` PASS, `1` FAIL, `2` usage error. It reads committed, staged, unstaged and untracked
work, so run it before the commit too. `validate` runs it as the `ui-standards` check whenever a
change touches `apps/dox/`, so the finalizer's step 9 and CI both require a PASS.

The standards are [Reuse, never reinvent](../../../context/dox/built/index.md#reuse-never-reinvent).
Each check names the standard it holds the added lines to:

| Check | The standard | Rule |
| --- | --- | --- |
| `copies` | A block of 6 or more lines has one home in `apps/dox` | 2 |
| `own-loop` | Animation plays on `play` in `src/lib/slides/frames.ts` | 2 |
| `url-sniff` | Shared code takes its feature as a prop or registry row, not from `location` | 3 |
| `has-layout` | `src/styles` and `src/components` choose layout by an attribute, not `:has()` | 5 |
| `big-module` | A module stays within 400 lines, or splits into a core and feature files | 6 |
| `cache` | Committed JSON stays under 512 KB; a rebuilt file lives in a gitignored work folder | 7 |
| `repeated-fact` | A value shared by 20 or more rows is stated once, on the parent | 7 |
| `dead-export` | Every export has a reader in another file | 8 |
| `left-accent` | A panel's edge is a full border or a bottom edge | house |
| `rounded` | A panel's corners use `corner-shape: bevel` with the radius | house |

`feature-layers.test.ts` (shared folders import no feature folder) and `css-validity.test.ts`
cover the rest of the rules in `pnpm dox:test`.

## Meeting a check

1. **Change the code to meet it.** A repeated block moves to one shared home and both callers
   import it; a loop plays on `play`; a URL check becomes a prop or a registry row; a big module
   splits into a core and feature files; a repeated value moves up to the parent once.
2. **Record an exception only when the standard cannot apply.** Put
   `ui-standards-ok: <reason>` on the line or the line above, with a reason of at least 8
   characters that says why, for example
   `// ui-standards-ok: open-ended: it runs until the last shard settles`. A reviewer reads every
   one, so the reason must explain the case, not just assert it.
3. Re-run until PASS.

## When to run it

- dox-builder: before reporting a slice done.
- dox-tester: the Reuse line of its checklist is this check, PASS required.
- finalizer: step 9's `validate` runs it on a Dox story; on FAIL it hands the findings back,
  because the finalizer edits no code.
