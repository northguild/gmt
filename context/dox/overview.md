# Dox — the documentation site for `@northguild/gmt`

> The architecture map. What each tier ships, with its traps and runbooks, is
> [built.md](built.md).

A **documentation site first** — real URLs, searchable, linkable — with more layered on top: a
live widget on every example, an interactive globe, real-world scenarios, and **Dox**, a chat
that answers from the docs and mounts widgets beside its answers. Every tier after Tier 0 can
be dropped without losing the docs, and deleting the chat leaves every other page intact.

## Architecture

```text
apps/dox/                        Astro 7 + Starlight — a real multi-page site
  ├── astro.config.mjs
  ├── wrangler.jsonc             assets → dist/; AI binding; KV usage ledger
  ├── scripts/build-reference.ts TS compiler API → MDX pages + corpus + route manifest
  ├── scripts/probe-brains.ts    live probe of the chat's models
  ├── worker/                    /api/chat, /api/brains — model keys live here
  └── src/
      ├── content/docs/          landing, guides, scenarios, tools, reference (generated)
      ├── components/            Astro shells; ai-elements/ + ui/ (vendored); ask/ (the chat)
      ├── lib/                   widget mount modules, retrieval, chat plumbing
      ├── pages/dox.astro        the chat — the only React island
      └── styles/                token layer, HUD theme, chat sheets
```

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
| Pages            | One per function — exact-match search titles and a stable URL to cite                                                           |
| Imports          | Module barrels only (`@northguild/gmt/plain/calculate`). The exports map forbids per-function paths; namespace barrels re-export the 2.98 MB polyfill |
| Hosting          | Cloudflare Workers static assets plus `/api/*`, one Worker                                                                      |
| AI surface       | `llms.txt`, `llms-full.txt` and per-page raw `.md`, emitted from the corpus                                                     |
| Widgets          | A playground on every example, running the real library, plus purpose-built teaching widgets                                    |
| Globe            | `d3-geo` orthographic on canvas — interactive and keyboard-selectable, no WebGL                                                 |
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

## Tiers

| Tier | Stories                | Ships                                                                            |
| ---- | ---------------------- | -------------------------------------------------------------------------------- |
| 0    | `DOX-A1`–`A3a`         | Workspace, Cloudflare deploy, reference generator — **the MVP**                  |
| 1    | `DOX-A5`, `A4a`, `A3b` | Tokens and typography, guides, `llms.txt`                                        |
| 2    | `DOX-B1a`, `B2a`–`d`   | A playground on every example, DST inspector, interval visualizer, converter bench |
| 3    | `DOX-D1`, `D2`         | Glass chrome, focus motion                                                       |
| 4    | `DOX-E1a`, `E1b`       | Interactive globe, multi-zone scrubber                                           |
| 5    | `DOX-A4b`–`d`          | Scenarios, ported pitfalls, mentor index                                         |
| 6    | `DOX-C0`–`C4`          | Dox, the chat that mounts widgets                                                |

Every tier is done; statuses and issue numbers are in [tracker.md](tracker.md). `apps/dox` is
private, so no changesets unless a change also touches `packages/gmt`.
