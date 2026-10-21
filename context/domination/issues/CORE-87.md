# CORE-87 — Core: The reference corpus and tool schemas shipped from the package

**Scope:** Let another repo get the reference corpus and the chat tool schemas without copying `apps/dox/src/generated`. A build step that repo runs against a gmt checkout writes both to a directory it names. Nothing is added to the npm package. Adds no function and changes no output.

## Gap

The reference corpus (`apps/dox/src/generated/reference/gmt-corpus.json`) and the chat tool schemas (`apps/dox/src/lib/dox-tools.ts`) exist only inside the private Dox app. The npm package ships `dist`, `skills`, `LICENSE` and `README.md`. A server repo that wants a tool list and an OpenAPI document generated from the same source has nothing to read, so it would copy generated files by hand and drift.

## Scope

- **A build step, documented in `context/dox/reference-export.md`.** Another repo runs it against a gmt checkout at a release tag. It writes the corpus and the tool schemas (JSON Schema) to a directory the caller names. Nothing is added to the npm package.
- **One source.** The files come from the same generator that feeds Dox, never a second copy maintained by hand.
- **A test that the exported corpus matches the generated one**, run by CI, so the two cannot drift.
- **The schemas are the chat's tool schemas as they are.** A consumer generates its tool list and OpenAPI from them; the shape of a schema does not change for this story.

## Design notes

- **A consumer reads, this repo writes.** No part of the server repo's generation runs here. The story ends at a file another repo can read.
- **No tool.** The story ships a file, not a function.

## Decisions

- **Build step, not an npm subpath.** Nothing is added to `files` or `exports` of `packages/gmt/package.json`, so `scripts/bundle-size.mjs` and its budgets are untouched. No tool list or OpenAPI document is generated here; the other repo builds those from the files.
- **One source.** The files come from the generator Dox uses (`build-reference.ts`, exported as `generateReference()`), never a kept copy ([built.md, Generate, don't maintain](../../dox/built.md#rules-that-bind-every-change)).
- **Three files, flat in `--out`:** `manifest.json`, `gmt-corpus.json` (a byte copy of the generated corpus) and `tool-schemas.json`. All JSON is `JSON.stringify(value, null, 2) + "\n"`, UTF-8 (RFC 8259 section 8.1). The output is deterministic: no timestamps, no absolute paths.
- **`--out` is required and absolute.** pnpm runs the script with `apps/dox` as its working directory, so a relative path would land somewhere the caller did not mean. A missing or relative `--out` exits 1 with a one-line usage message. The step overwrites its three files and never deletes or touches anything else in the directory.
- **Pinning** is by a tag or a commit SHA. No gmt build, network or git tags are needed; the step runs `build-reference.ts` only, not the whole `generate` chain.
- **`manifest.json`** carries `format: 1` and `gmtVersion`. The files cross a repo boundary, so the reader must know when a shape changed. Bump `format` on a removed or renamed field or a changed meaning, never on an added field.
- **Schemas are exactly what the chat sends the model:** `asSchema(DOX_TOOLS[name].inputSchema).jsonSchema`, JSON Schema draft-07, with `$schema` `http://json-schema.org/draft-07/schema#`. `pattern` keeps the zod regex (ECMA-262 dialect, Validation draft-07 section 6.3.3). `.int()` becomes `"type": "integer"` with `maximum: 9007199254740991` when no max is set. `.optional()` is absent from `required`; `z.enum` becomes `enum`.
- **`additionalProperties: false` stays** in every `inputSchema`, because it is what the model receives. `reference-export.md` says it is stricter than the chat's zod check, which drops unknown keys.
- **Rules from the schema.** `.refine()` is not in the JSON Schema, so cross-field refinements ship as `rules: string[]` per tool, read from the zod schema's own checks, never a hand-kept list. A guard test fails when an offered tool has a refinement with no message, and the add-a-tool rule in `built.md` says so.
- **No zod upgrade.** The zod 4.5 bound-overwrite hazard is caught by a test comparing each field's JSON Schema to its zod bounds.
- **`when` and `args` ship beside `description`**, the same text the system prompt uses. Only `ENABLED_TOOL_DOCS` are exported, in prompt order.

## What gmt provides (do not re-implement)

- The reference generator and the corpus it writes (`apps/dox/scripts/`, `apps/dox/src/generated/reference/`)
- The chat tool schemas (`apps/dox/src/lib/dox-tools.ts`)

## Verification

- The exported corpus is byte-equal to the generated one, the exported schemas equal what the Worker gives `streamText`, and CI fails when either is not.
- A clean clone of another repo can run the documented command and read the files with no copy from `apps/dox/src/generated`.
- `pnpm run validate` stays green.
