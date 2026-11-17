# Dox — the documentation site for `@northguild/gmt`

> The architecture map. What each tier ships, with its traps and runbooks, is
> [built/](built/index.md).

A **documentation site first** — real URLs, searchable, linkable — with more layered on top: a
live widget on every example, an interactive globe, real-world scenarios, and **Dox**, a chat
that answers from the docs and mounts widgets beside its answers. Every tier after Tier 0 can
be dropped without losing the docs, and deleting the chat leaves every other page intact.

## Architecture

The site is `apps/dox/` (Astro 7 + Starlight, a real multi-page site). `worker/` holds `/api/chat`
and `/api/brains`, where the model keys live. `src/pages/dox.astro` is the chat, the only React island.

**One deployment.** A single Cloudflare Worker, `gmt-dox`, serves the built site through an
`assets` binding and handles `/api/*` in the same isolate: same origin, no CORS, one pipeline.
A request matching a static asset is served before the Worker runs, so only `/api/*` reaches
it. **Merging to `main` deploys.**

**One extraction, many consumers.** `build-reference.ts` walks `packages/gmt/src` once and
emits one MDX page per exported function, `gmt-corpus.json`, a route manifest (every generated
URL) and `LIVE_PLAYGROUND_TEMPLATES`. The pages, `llms.txt`, the playground seeds and the chat's
retrieval chunks all come from it, so they cannot drift. The route manifest is also the chat's
citation boundary: a link the model emits that is not a real page renders as plain text.

## Decisions

| Area             | Choice                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Astro 7 + Starlight — routes, MDX, islands, static output                                                                       |
| Search           | Pagefind, built into the Starlight build                                                                                        |
| Reference        | Generated from JSDoc with the TypeScript compiler API. Not TypeDoc: `@example` is an inline `fn() // result` line, and the source has no tag graph |
| Pages            | One per function — exact-match search titles and a stable URL to cite. A type gets a page at `/reference/types/<Name>` only when two or more functions reach it; otherwise it is documented on its one function's page |
| Imports          | Module barrels only (`@northguild/gmt/plain/calculate`). The exports map forbids per-function paths, and a namespace barrel loads its whole namespace |
| Hosting          | Cloudflare Workers static assets plus `/api/*`, one Worker                                                                      |
| AI surface       | `llms.txt`, `llms-full.txt` and per-page raw `.md`, emitted from the corpus                                                     |
| Widgets          | A playground on every example, running the real library, plus purpose-built teaching widgets                                    |
| Globe            | A reusable WebGPU engine (`src/lib/globe/`) with NASA Blue Marble imagery in the dark theme, and the flat canvas-2D renderer as the fallback. Interactive and keyboard-selectable |
| Chat stack       | AI SDK (`ai`, `@ai-sdk/react`) + 12 vendored AI Elements components; Streamdown rendering                                        |
| React / Tailwind | Only inside the `/dox` island; Tailwind v4 without Preflight                                                                    |
| Model            | Nine Gemini brains plus one Workers AI brain, failing over inside a request                                                     |
| Grounding        | MiniSearch BM25 retrieval, a per-answer route allowlist, and a refusal instruction                                              |
| Chat role        | Answer, cite, mount a real widget. Augments the docs; never replaces them                                                       |
| Octane           | Not used, anywhere                                                                                                              |

## Visual language

Maximal chrome, disciplined content surface: frames, panels and motion go hard; body copy,
code, tables and plotted widget values stay high-contrast and plain. Spec:
[reference/visual-design.md](reference/visual-design.md). Implementation rules:
[reference/design-system.md](reference/design-system.md).

## Tracking

Statuses and issue numbers are in [tracker.md](tracker.md); what each tier ships is in
[built/](built/index.md). `apps/dox` is private, so no changesets unless a change also touches `packages/gmt`.
