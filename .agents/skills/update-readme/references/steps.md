# Steps

## 1. Ground the diff in real state

Run these in parallel:

```bash
git log --oneline main..HEAD
git diff main...HEAD --stat
```

Then read the changeset(s) in `.changeset/*.md` (skip `README.md` inside `.changeset/`). The changeset describes the user-visible change.

Build a working list of:

- **Namespaces added, removed or renamed.** Each one that exports functions changes the namespace links.
- **Functions renamed or removed, and functions whose result changed.** Check each against the sample block.
- **A change to `AGENT_PROMPT`** in `apps/dox/src/lib/agent-prompt.ts`.
- **A change to `apps/dox/src/data/library-measurements.json`**: a library added or removed, or new figures that change the order by tests.

New functions in an existing namespace need no README edit. Their figures arrive with the sync in step 3.

## 2. Read the landing page

Read `README.md` in full before you touch it. `packages/gmt/README.md` is identical to it; confirm that with `cmp README.md packages/gmt/README.md`, which prints nothing when they match. Make every hand edit in `README.md`. Step 11 copies it to the package file.

## 3. Sync the figures

The sync and both checks read the built library and the generated reference corpus. If the public API changed on this branch, build them once first:

```bash
pnpm --filter @northguild/gmt build && pnpm dox:generate
```

Then write the figures:

```bash
pnpm stats:sync
```

It rewrites the digits of every figure in both READMEs: the fact lines, each row of the comparison table and the days the other libraries were measured. It pads the table's columns and regenerates `apps/dox/src/data/gmt-stats.json`. It writes nothing else. Never edit a figure by hand afterwards.

## 4. Run the two checks

```bash
node scripts/stats.mjs check
node scripts/api-surface.mjs check
```

Fix what they report:

| The check says                                                                                             | What to do                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A figure is stale                                                                                          | Run `pnpm stats:sync` again. If it stays stale, the source is wrong, not the README                |
| A guarded line matched nothing                                                                             | Someone reworded the line. Restore its wording, or update its rule in `scripts/stats.mjs`          |
| A namespace has no link, a link names a namespace that exports no function, or a link is on the wrong line | Go to step 5                                                                                       |
| The comparison table has a row to add, delete or move, or the count word is wrong                          | Go to step 8                                                                                       |
| The two files differ                                                                                       | Copy the edited file over the other: `cp README.md packages/gmt/README.md`                         |
| A sample result is wrong, or a sampled import does not resolve                                             | Go to step 6                                                                                       |
| A link names no page                                                                                       | Correct the link. Every `/reference/<namespace>/` link must name a page of the generated reference |

## 5. Hand edit: a namespace added, removed or renamed

Only a namespace that exports functions has a link. `regex` and `types` have none.

1. Add or remove the link `[<namespace>](https://gmt-dox.northguild.workers.dev/reference/<namespace>/)`.
2. Put an industry namespace on the "By industry:" line. Put any other on the line of namespace links above it. Separate links with ` · `, as the line does now.
3. Give a new namespace its stub, as step 9 describes. Delete the stub of a removed namespace.
4. Run `node scripts/stats.mjs check` again.

## 6. Hand edit: a sampled function changed

This applies when the story renames or removes a function the sample shows, or changes what it returns.

1. Build the library if you have not: `pnpm --filter @northguild/gmt build`.
2. Run the call for real and print its result. From `packages/gmt`, the package name resolves to the built library:

   ```bash
   cd packages/gmt && TZ=UTC node --input-type=module -e \
     'import { addDate } from "@northguild/gmt"; console.log(JSON.stringify(addDate("2024-01-31", { months: 1 })));'
   ```

3. Paste the printed result into the sample's `// result` comment. Never type it from memory.
4. Keep the import line in step with the calls: it names every function the sample calls and no other.
5. If the function is gone, replace its line with another call. Pick one whose result does not depend on the clock, the system time zone or the runtime's ICU data.
6. Run `node scripts/api-surface.mjs check` again.

## 7. Hand edit: the agent prompt changed

`AGENT_PROMPT` in `apps/dox/src/lib/agent-prompt.ts` is the source. Three files carry a copy in a fenced block: `README.md`, `packages/gmt/README.md` and `CONTRIBUTING.md`.

1. Change the constant.
2. Paste the new text into the fenced block of `README.md` and of `CONTRIBUTING.md`. Each block must equal the constant byte for byte.
3. Copy the root file over the package file: `cp README.md packages/gmt/README.md`.
4. Run the guard: `pnpm --filter @gmt/dox exec vitest run src/lib/agent-prompt.test.ts`.

## 8. Hand edit: a library added, removed or re-ordered in the comparison table

`apps/dox/src/data/library-measurements.json` holds one entry per library. The table follows it.

1. **A library added:** add its row by hand. Write its name in the first column as the JSON's `name` gives it, and fill the "Built on" cell. Leave the figures for the sync.
2. **A library removed:** delete its row.
3. **Either of those:** correct the count word in the fact lines ("six") to the number of libraries in the JSON.
4. **A re-measurement that changes the order:** move the rows. GMT's row is first. The others follow by tests, most first.
5. Run `pnpm stats:sync`. It fills the figures, updates the measured-on days in the sentence under the table and pads the columns.
6. Run `node scripts/stats.mjs check` again.

## 9. Namespace READMEs

Namespace READMEs are one-line stubs pointing at the docs site. The docs build generates the full function reference.

For each affected `packages/gmt/src/<namespace>/README.md`:

- Ensure the stub follows the shape:

  ```markdown
  # <Namespace> API

  See the full reference at [/reference/<slug>](/reference/<slug>).
  ```

  where `<slug>` is the namespace directory name. Check `ls packages/gmt/src` for the current list.
- Do **not** expand the stub into a function list. The docs generator owns the function index.
- Update a namespace README only when its reference path changes, for example after a namespace rename.

## 10. Sub-package READMEs

`packages/gmt-biome/README.md`, `packages/gmt-eslint/README.md` and `packages/gmt-oxlint/README.md` document the lint plugins. Update one only when that plugin's own rules or options changed. A new lint plugin gets a link on the line under the install command.

## 11. Copy and verify

1. Copy the edited file over the package file, then confirm the two are identical:

   ```bash
   cp README.md packages/gmt/README.md
   cmp README.md packages/gmt/README.md
   ```

   `cmp` prints nothing when they match.

2. Grep the page for every renamed or removed function name:

   ```bash
   grep -n "<old-function-name>" README.md
   ```

3. Read the headings. The page may not hold a section for one function or one feature.
4. Run both checks from step 4 once more. Both must pass.

## 12. Report what changed

Print a short summary:

- Which README files you modified, and what changed in each.
- The result of both checks.
- The `measuredOn` date of each other library's figures, read from `apps/dox/src/data/library-measurements.json`. The owner decides when to re-measure.
- Any change on the branch that needs a docs guide and has none yet.
