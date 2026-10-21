# Reference export: the corpus for another repo

A command writes the reference corpus to a directory the caller names. Another repo runs it
against a gmt checkout and builds from the file. The corpus is not in the npm package. No
library user needs it at runtime, and shipping it would make the file format public package API.

The chat's tool schemas are not exported. A repo that serves tools defines its own.

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
- The step creates the directory if it is missing and overwrites the two files below. It never
  deletes or touches anything else in it.
- It needs no gmt build, no network and no git tags. A shallow clone is enough.
- The output is deterministic: the same checkout gives the same bytes. It holds no timestamp
  and no absolute path.

## The files

Both sit flat in `--out`. JSON is UTF-8, indented by two spaces, with a final newline.

| File              | Content                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `manifest.json`   | `{ "format": 1, "gmtVersion": "…", "files": { "corpus": "gmt-corpus.json" } }`                |
| `gmt-corpus.json` | The reference corpus, a `CorpusEntry[]`: one entry per documented export (function, type, regex) |

`gmtVersion` is the version in `packages/gmt/package.json`.

**`gmt-corpus.json`** is a byte copy of the corpus the generator just wrote. The field list is
`CorpusEntry` in [`apps/dox/src/reference-types.ts`](../../apps/dox/src/reference-types.ts); it
is not copied here. The `url` and `page` fields are routes without the site base. To link to the
live page, prefix `SITE_URL` from [`apps/dox/src/lib/site.ts`](../../apps/dox/src/lib/site.ts).

## The format number

`format` in `manifest.json` starts at 1. It goes up when a field is removed or renamed, or when
a field's meaning changes. Adding a field does not change it. The constant is `EXPORT_FORMAT` in
`apps/dox/scripts/export-reference.ts`, and `export-reference.test.ts` pins the field lists, so a
change to the shape fails until the number is dealt with.

## Where it comes from

Nothing is kept by hand. `generateReference` in `apps/dox/scripts/build-reference.ts` writes the
corpus, and `export-reference.ts` copies it. `export-reference.test.ts` proves the exported corpus
equals the generated one, checks the manifest and the command-line errors, and proves the output
is deterministic.
