# CORE-88 — Core: The hosted server linked from the READMEs and the docs

**Scope:** Once the hosted server is live on `northguild.dev` (`/api/*` and `/mcp/*`), link it from `README.md`, `packages/gmt/README.md` and the docs pages, next to the Docs, API reference and Tools links, so the library names the hosted tool as the thing it powers. Adds no function and changes no output.

## Gap

The library's READMEs and docs link the docs site, the API reference and the tools, and nothing else. When a hosted server exists, a reader of the package page has no path to it.

## Scope

- Both READMEs, kept identical, gain the link in the same place as the existing Docs, API reference and Tools links.
- The docs pages that list where to go next gain the same link.
- The skills and the agent prompt name it where they name the docs site.
- A patch changeset for `@northguild/gmt`, since the README ships with the package.

## Design notes

- **It waits on a repo outside this one.** The server is built elsewhere, from the corpus `CORE-87` ships, on the paths `CORE-86` reserves. Nothing in this story starts before a live URL answers. The `Blocked by` column shows only the gmt stories it waits on, so the row's Status is `Waiting`, which keeps it out of `pnpm deps:ready` until the server is live; flip it to `Not started` then.
- **One link per place, no copy.** The READMEs describe what the server is in one line and link it; no server documentation moves into this repo.
- **No tool.** The story ships links, not a function.

## What gmt provides (do not re-implement)

- The site at `northguild.dev/gmt` with `/api/*` and `/mcp/*` reserved (`CORE-86`)
- The corpus the server is generated from (`CORE-87`)

## Verification

- Every added link returns 200 live.
- `README.md` and `packages/gmt/README.md` are identical.
- The `/tanstack-intent` validate passes after the skills change.
- `pnpm run validate` stays green.
