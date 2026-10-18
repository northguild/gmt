# CORE-87 — Core: The reference corpus and tool schemas shipped from the package

**Scope:** Ship the reference corpus and the chat tool schemas so another repo can consume them without copying `apps/dox/src/generated`. Either the package ships them, or a build step another repo runs against this one produces them. Adds no function and changes no output.

## Gap

The reference corpus (`apps/dox/src/generated/reference/gmt-corpus.json`) and the chat tool schemas (`apps/dox/src/lib/dox-tools.ts`) exist only inside the private Dox app. The npm package ships `dist`, `skills`, `LICENSE` and `README.md`. A server repo that wants a tool list and an OpenAPI document generated from the same source has nothing to read, so it would copy generated files by hand and drift.

## Scope

- **Pick one route and document it in `context/dox/`.** Either a subpath export of `@northguild/gmt` carries the corpus and the schemas, or a script in this repo writes them to a path a consumer repo names. The choice weighs package size against a build-time dependency on this repo's checkout.
- **One source.** Whatever ships is generated from the same generator that feeds Dox, never a second copy maintained by hand.
- **A test that the shipped file matches the generated one**, run by CI, so the two cannot drift.
- **The schemas are the chat's tool schemas as they are.** A consumer generates its tool list and OpenAPI from them; the shape of a schema does not change for this story.

## Design notes

- **A consumer reads, this repo writes.** No part of the server repo's generation runs here. The story ends at a file another repo can read.
- **Size is a budget question.** If the corpus goes into the package, it goes behind a subpath so the default import path carries none of it. `CORE-80` comes after this story, so this story measures the subpath itself: a bundled size for the subpath and for the default import path, reported in the PR, with the figure recorded in the spec. `CORE-80`'s budget then adopts that line when it lands. The build-step route needs no measurement, which counts for it when the route is picked.
- **No tool.** The story ships a file, not a function.

## What gmt provides (do not re-implement)

- The reference generator and the corpus it writes (`apps/dox/scripts/`, `apps/dox/src/generated/reference/`)
- The chat tool schemas (`apps/dox/src/lib/dox-tools.ts`)

## Verification

- The shipped corpus and schemas are byte-equal to the generated ones, and CI fails when they are not.
- A clean checkout of another repo can read them by the documented route with no copy from `apps/dox/src/generated`.
- If the package route is chosen, the default import path's bundled size is unchanged, and the subpath's bundled size is reported in the PR and recorded here for `CORE-80`'s budget.
- `pnpm run validate` stays green.
