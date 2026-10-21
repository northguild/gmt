# CORE-87 — Core: The reference corpus exported for another repo

**Scope:** Let another repo get the reference corpus without copying `apps/dox/src/generated`. A build step that repo runs against a gmt checkout writes it to a directory it names. Nothing is added to the npm package. Adds no function and changes no output.

## Gap

The reference corpus (`apps/dox/src/generated/reference/gmt-corpus.json`) exists only inside the private Dox app. The npm package ships `dist`, `skills`, `LICENSE` and `README.md`. A repo that wants to build from the same reference has nothing to read, so it would copy generated files by hand and drift.

## Scope

- **A build step, documented in `context/dox/reference-export.md`.** Another repo runs it against a gmt checkout at a release tag. It writes the corpus to a directory the caller names. Nothing is added to the npm package.
- **One source.** The file comes from the same generator that feeds Dox, never a second copy maintained by hand.
- **A test that the exported corpus matches the generated one**, run by CI, so the two cannot drift.

## Design notes

- **A consumer reads, this repo writes.** No part of the other repo's generation runs here. The story ends at a file another repo can read.
- **No tool.** The story ships a file, not a function.

## Decisions

- **Build step, not an npm subpath.** Nothing is added to `files` or `exports` of `packages/gmt/package.json`, so `scripts/bundle-size.mjs` and its budgets are untouched.
- **The corpus only.** The chat's tool schemas are not exported. A repo that serves tools defines its own.
- **One source.** The corpus comes from the generator Dox uses (`build-reference.ts`, exported as `generateReference()`), never a kept copy ([built.md, Generate, don't maintain](../../dox/built.md#rules-that-bind-every-change)).
- **Two files, flat in `--out`:** `manifest.json` and `gmt-corpus.json`, a byte copy of the generated corpus. All JSON is `JSON.stringify(value, null, 2) + "\n"`, UTF-8 (RFC 8259 section 8.1). The output is deterministic: no timestamps, no absolute paths.
- **`--out` is required and absolute.** pnpm runs the script with `apps/dox` as its working directory, so a relative path would land somewhere the caller did not mean. A missing or relative `--out` exits 1 with a one-line usage message. The step overwrites its two files and never deletes or touches anything else in the directory.
- **Pinning** is by a tag or a commit SHA. No gmt build, network or git tags are needed; the step runs `build-reference.ts` only, not the whole `generate` chain.
- **Only the command regenerates.** `cli()` calls `generateReference()`, then `exportReference(outDir)` copies what is there. A test that calls `exportReference` never rewrites the generated tree other test files read in parallel; `pnpm test` runs `generate` first.
- **`manifest.json`** carries `format: 1` and `gmtVersion`. The files cross a repo boundary, so the reader must know when a shape changed. Bump `format` on a removed or renamed field or a changed meaning, never on an added field.

## What gmt provides (do not re-implement)

- The reference generator and the corpus it writes (`apps/dox/scripts/`, `apps/dox/src/generated/reference/`)

## Verification

- The exported corpus is byte-equal to the generated one, and CI fails when it is not.
- A clean clone of another repo can run the documented command and read the corpus with no copy from `apps/dox/src/generated`.
- `pnpm run validate` stays green.
