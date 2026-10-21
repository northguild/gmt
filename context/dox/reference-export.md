# Reference export: the corpus and tool schemas for another repo

A command writes the reference corpus and the chat's tool schemas to a directory the caller
names. Another repo runs it against a gmt checkout and builds from the files, such as its own
tool list. The files are not in the npm package. No library user needs the corpus at runtime,
and shipping it would make the file format public package API.

## Run it

Pin the checkout by a tag or a commit SHA.

```sh
# a tag
git clone --depth 1 --branch "@northguild/gmt@X.Y.Z" https://github.com/northguild/gmt.git gmt

# a commit SHA
git clone --depth 1 https://github.com/northguild/gmt.git gmt
git -C gmt fetch --depth 1 origin <sha>
git -C gmt checkout FETCH_HEAD

pnpm --dir gmt install --frozen-lockfile
pnpm --dir gmt dox:export --out "$PWD/vendor/gmt-reference"
```

- `--out` is required and must be an absolute path. pnpm runs the script from `apps/dox`, so a
  relative path would land in the wrong place. A missing or relative `--out` exits 1 with a
  one-line usage message.
- Use the Node and pnpm versions the root `package.json` sets (`engines`, `packageManager`).
- The step creates the directory if it is missing and overwrites the three files below. It
  never deletes or touches anything else in it.
- It needs no gmt build, no network and no git tags. A shallow clone is enough.
- The output is deterministic: the same checkout gives the same bytes. It holds no timestamp
  and no absolute path.

## The files

All three sit flat in `--out`. JSON is UTF-8, indented by two spaces, with a final newline.

| File                | Content                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `manifest.json`     | `{ "format": 1, "gmtVersion": "…", "files": { "corpus": …, "toolSchemas": … } }`           |
| `gmt-corpus.json`   | The reference corpus, a `CorpusEntry[]`: one entry per documented export (function, type, regex) |
| `tool-schemas.json` | `{ "tools": [ … ] }`: one entry per tool the chat offers, in the order its prompt lists them |

`gmtVersion` is the version in `packages/gmt/package.json`.

**`gmt-corpus.json`** is a byte copy of the corpus the generator just wrote. The field list is
`CorpusEntry` in [`apps/dox/src/reference-types.ts`](../../apps/dox/src/reference-types.ts); it
is not copied here. The `url` and `page` fields are routes without the site base. To link to the
live page, prefix `SITE_URL` from [`apps/dox/src/lib/site.ts`](../../apps/dox/src/lib/site.ts).

**`tool-schemas.json`** entries have six fields:

- `name`: the tool's name, for example `showGlobe`.
- `description`: the tool's description, as the model receives it.
- `when`: when the chat's system prompt says to call the tool.
- `args`: the prompt's guidance on the arguments.
- `rules`: the messages of cross-field rules the schema cannot carry. Usually empty.
- `inputSchema`: JSON Schema draft-07, exactly as the `ai` SDK sends it to the model.

## What the JSON Schema does not say

- A cross-field rule written with `.refine()` has no JSON Schema keyword. It is carried as text
  in `rules`.
- `additionalProperties: false` rejects an unknown key. The chat's own zod check accepts the
  call and drops the key. The schema is the stricter of the two.

A reader that validates calls should enforce `rules` itself. It may relax
`additionalProperties` to match the chat.

## The format number

`format` in `manifest.json` starts at 1. It goes up when a field is removed or renamed, or when
a field's meaning changes. Adding a field does not change it. The constant is `EXPORT_FORMAT` in
`apps/dox/scripts/export-reference.ts`, and `export-reference.test.ts` pins the field lists, so a
change to the shape fails until the number is dealt with.

## Where it comes from

Nothing is kept by hand.

- `generateReference` in `apps/dox/scripts/build-reference.ts` writes the corpus.
- `toolSchemaFile` in `apps/dox/scripts/export-tool-schemas.ts` converts `ENABLED_TOOL_DOCS` and
  `DOX_TOOLS` from `apps/dox/src/lib/dox-tools.ts`. `refinementMessages` in the same file reads
  `rules` from the zod schema's own checks and throws when a rule has no message.

Two tests keep the files honest:

- `export-reference.test.ts` proves the exported corpus equals the generated one, checks the
  manifest and the command-line errors, and proves the output is deterministic.
- `export-tool-schemas.test.ts` proves the schemas equal what the Worker gives `streamText`,
  that each field's JSON Schema matches its zod bounds, and that every rule has a message.
