# EPIC — Dox: the documentation site for `@northguild/gmt`

> This directory follows the same progressive-disclosure structure as
> `context/roadmap/`. Start at [index.md](index.md). This file (overview.md) is the
> **architecture** map — context, decisions, hosting, prior-art verdicts, and the
> tier table. The deep sections that used to live here have moved to
> [`reference/`](reference/); load them only when the story needs them.
>
> **Supersedes the 2026-08-12 "AI documentation chat" draft**, which specified a
> single-screen, routeless chat console with a full-bleed reactive 3D scene, a bespoke
> design system built before any product UI, and a two-tier voice synthesis stack.
> That plan was not a documentation site: it had no URLs, nothing indexable, nothing
> linkable, and shipped nothing usable until roughly story 7 of 15. Its genuinely useful
> parts are preserved here and in [appendix-parked.md](appendix-parked.md); its
> sequencing is not.
>
> **Re-audited against the repo and the npm registry on 2026-08-26.** Every count in the
> 2026-08-21 draft had gone stale, one risk was pointed at the wrong thing, and the
> ambition ceiling was set below what this site is meant to be. The MVP got smaller and
> the ceiling got much higher. See [`reference/verified-findings.md`](reference/verified-findings.md)
> §1 "What the 2026-08-26 audit changed".

## 1. Context and the ordering principle

See [`reference/verified-findings.md`](reference/verified-findings.md) for the raw
material (504 functions, 1,860 examples, 42 public types), the verified findings that
shaped the plan (exports map, empty tag graph, Astro 7 Node floor, etc.), the real
generator risk, and the 2026-08-26 audit changelog. Counts in that file **drift**;
`DOX-A3a` re-derives them from source.

## 2. Architecture

```text
apps/dox/                  Astro 7 + @astrojs/starlight 0.41 — a real multi-page site
  ├── astro.config.mjs
  ├── project.json                    explicit Nx targets (see §4.3)
  ├── wrangler.jsonc                  assets binding → dist/; /api/* once C exists
  ├── scripts/build-reference.ts      TS compiler API → generated MDX + corpus + manifest
  ├── worker/                         same deployment — holds the model API key (Tier 6)
  └── src/
      ├── content.config.ts           docsLoader() + docsSchema()
      ├── content/docs/
      │   ├── index.mdx               landing page (globe hero, Tier 4)
      │   ├── guides/                 hand-curated (README, skills, DST doc)
      │   ├── scenarios/              mentor layer — real-world tasks (Tier 5)
      │   └── reference/              GENERATED, gitignored — one page per function
      ├── components/                 Playground + purpose-built widgets, chat panel
      └── styles/                     token layer, then the HUD theme
```

**One deployment, not two.** A single Cloudflare Worker serves the built site through an
`assets` binding and — once Tier 6 exists — handles `/api/*` in the same isolate. Through
Tier 5 the Worker has no `main` at all: it is assets-only, with
`not_found_handling: "404-page"`. See "Hosting" below for why this matters more than it
looks.

**Data flow.** One build step, three consumers. `build-reference.ts` walks
`packages/gmt/src` with the TypeScript compiler API and emits:

- **(a)** one MDX page per exported function into the Starlight content collection;
- **(b)** `gmt-corpus.json` — the same content as retrieval chunks, each carrying the URL
  of the page it came from;
- **(c)** a **route manifest** — the set of every URL (a) produced;

The site is built from (a). `llms-full.txt` is built from (b), and so is retrieval if
Tier 6 lands. Every link is validated against (c) — at build time as a link check, and at
runtime against anything a model emits, so a hallucinated citation renders as plain text
rather than a 404 (see "Citation integrity" below). Tier 2's auto-embedded playgrounds use
`LIVE_PLAYGROUND_TEMPLATES` — a raw call-string template per function that seeds the
textarea with a starting expression.

That shared artifact is the load-bearing idea. The superseded plan built a corpus for a
model only; here the corpus, the site, the AI surface and the playground templates are all
the same extraction, which means they cannot drift.

Widgets run the **real** library — `apps/dox` depends on `@northguild/gmt` via
`workspace:*`, so a playground's output is never simulated and can never drift from
shipped behavior.

### Decisions taken

| Area               | Choice                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Astro `7.2.7` + `@astrojs/starlight` `0.41.9`** — routes, MDX, islands, static output                                 |
| Search             | **Pagefind**, built into the Starlight build. Static index, zero infra                                                  |
| Reference          | **Generated** from JSDoc via the TS compiler API. **Not TypeDoc** — see §1                                              |
| Page granularity   | **One page per function**, as date-fns and Luxon do — exact-match search titles, and a stable URL to cite               |
| Nav                | Starlight `autogenerate: { directory: 'reference' }` over the generated tree                                            |
| Import granularity | **Module barrels only** (`@northguild/gmt/plain/calculate`). Never namespace — see §1                                   |
| Octane             | **Not used.** Off the critical path entirely                                                                            |
| **Hosting**        | **Cloudflare Workers static assets.** One deployment serves the site and `/api/*`                                       |
| **AI surface**     | **`llms.txt` + `llms-full.txt` + per-page raw `.md`** (DOX-A3b), emitted from the same corpus                           |
| **Scenario layer** | **Real-world task pages** with live proof of failure (DOX-A4b–d), from the 63 graded `SKILL.md` mistakes                |
| **Widgets**        | **Live on every example** via a simple textarea island — type a JS expression, run the real library, see the result. No URL state, no permalinks. |
| **3D**             | **Interactive globe** — click a zone, read live time, offset and DST state. A product feature, not decoration           |
| Model              | Gemini 2.5 Flash was the 2026-08-21 choice. **Re-open in DOX-C1** — widgets mean tool calls, which changes the calculus |
| Key custody        | Same-origin Worker. Key never reaches the client                                                                        |
| Grounding          | Retrieval over `gmt-corpus.json` + `systemInstruction` + refusal instruction                                            |
| **Chat role**      | **Answer + cite + _mount a real widget_.** Augments the site; never replaces it                                         |
| Audio              | Parked. See [appendix-parked.md](appendix-parked.md)                                                                    |

### Hosting — why one origin, not two

The 2026-08-21 draft put the site on GitHub Pages and the chat on a separate Cloudflare
Worker. That split buys, for nothing: an explicit CORS allowlist, a `Vary: Origin` header,
two deploy pipelines, an origin-mismatch failure mode, and DOX-C1's open question of where
the corpus lives at runtime.

A single Worker with an `assets` binding removes all of it. `/api/chat` is same-origin, so
there is no CORS at all; there is one pipeline; and the Worker can fetch the corpus from
the very site it is serving, which resolves DOX-C1's option (b) with no extra hop and no
staleness coupling.

Verified 2026-08-26: **GitHub Pages was never enabled on this repo** (`gh api
repos/northguild/gmt/pages` → 404), so there is nothing to migrate away from. A Cloudflare
account is now a hard dependency for _deployment_, not merely for chat — that is the one
real cost of this decision and it is recorded in
[`reference/verification-and-risks.md`](reference/verification-and-risks.md).

**Use `pnpm` for all install and registry commands.**

### Reviewed prior art — the Worktree CLI docs site

`reference/prior-art/worktree-cli-snapshot-2026-08-21.md` documents how a sibling
`@northguild/worktree` repo built its docs site and AI chat. It is a working system, and
it was reviewed in full on 2026-08-21. It is **an example, not a target** — its own
warning notes it lacks a real textarea, multiline chat, and copyable code blocks, and it
does not meet this project's design or functional needs.

What was taken from it, and what was deliberately not:

| From the sibling repo                                                                                                          | Verdict                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Generated route allowlist + client-side `resolveHref()`** — a hallucinated link degrades to plain text rather than a 404     | **Adopted, and it upgraded the plan.** See §2 "Citation integrity" below                                                                                                                                                                                                                                     |
| Pure, side-effect-free, unit-tested SSE line parser returning a discriminated union                                            | **Adopted** into DOX-C2. "Do this from day one" is correct                                                                                                                                                                                                                                                   |
| Generated-file stub aliased in the test config, so tests run on a clean checkout with no build                                 | **Adopted** into DOX-A3a/DOX-C2 — our generated output is gitignored, so we have exactly this problem                                                                                                                                                                                                        |
| Explicit worker validation pipeline (method, message count, content length, role and model allowlists, mapped upstream errors) | **Adopted** into DOX-C2 as a checklist                                                                                                                                                                                                                                                                       |
| Dual timeouts: overall request cap plus a shorter _idle_ timeout that resets per chunk                                         | **Adopted** into DOX-C3a — catches stalled streams without killing long answers                                                                                                                                                                                                                              |
| Error-vs-warning classification, with warnings excluded from history sent upstream                                             | **Adopted** into DOX-C3a                                                                                                                                                                                                                                                                                     |
| SKILL.md placed _before_ reference material so the model learns vocabulary first                                               | **Adopted** into DOX-C2                                                                                                                                                                                                                                                                                      |
| Generated version map so the site can never show a stale version                                                               | **Adopted** as a small DOX-A1 addition                                                                                                                                                                                                                                                                       |
| **Nextra 4 + Next.js 16 App Router**                                                                                           | **Rejected.** Astro + Starlight was chosen deliberately; Starlight gives sidebar, search, and the a11y baseline without hand-maintained `_meta.ts` at every level                                                                                                                                            |
| **"The AI has no retrieval layer"** — whole corpus baked into one system prompt                                                | **Rejected, using their own arithmetic.** Their §5 measures one package at ~29 KB and four at 80–150 KB "which you pay for on **every** request," and puts real retrieval at "past ~500 KB of docs." We have 504 functions and 1,860 examples — well past that line. DOX-C1 measures it rather than assuming |
| Package-scoped prompt bundles                                                                                                  | **Rejected as primary**, retained as DOX-C1's documented fallback if retrieval underperforms                                                                                                                                                                                                                 |
| Tailwind v4, React Query, TanStack Form for the chat client                                                                    | **Rejected.** Weight without payoff for one streaming panel; DOX-A5's token layer already covers styling                                                                                                                                                                                                     |
| **Site and chat on separate origins** (their Pages + Worker split)                                                             | **Rejected.** We serve both from one Cloudflare Worker, which removes CORS, the second pipeline, and DOX-C1's corpus-location question outright — see "Hosting" above                                                                                                                                        |
| Auto-linking **bold** phrases that match page titles                                                                           | **Rejected.** Turning prose the model did not intend as a link into a link is a correctness risk, not a nicety                                                                                                                                                                                               |

The deepest idea worth restating, because it is the same principle DOX-A3a already runs on:
**generate, don't maintain — one source of truth, now four consumers** (pages, AI surface,
playground templates, retrieval).

### Citation integrity — a structural guarantee, not a test

The prior art changed this plan in one concrete way, and it is worth calling out.

The original DOX-C3 spec asserted "every citation must resolve" as a **test**. A test samples;
it cannot cover what a model emits at runtime. The sibling repo does better: it derives a
route allowlist from the same filesystem scan that produces the pages, ships it to the
client, and runs **every** href the model emits through a resolver. A link that is not in
the allowlist renders as plain text instead of a broken link.

That is a structural guarantee rather than a hope, and it costs almost nothing here
because DOX-A3a already knows every route it generated. **DOX-A3a therefore emits a route
manifest as a third artifact.** The test stays, but it is no longer the only thing standing
between a reader and a 404.

**The manifest now has three consumers, not one**, which is why it earns its place in
Tier 0 even though the chat is in Tier 6:

- **DOX-A3a itself** — a build-time link check asserting the manifest exactly equals the set
  of pages generated. A manifest that has drifted from reality is worse than no manifest:
  it would silently suppress valid links and admit dead ones.
- **DOX-A3b** — `llms.txt` and every per-page raw `.md` route are emitted from the same URL
  set, so the AI surface cannot point at a page that does not exist.
- **DOX-C3a** — runtime hardening of anything a model emits, as originally specified.

Note the ordering consequence: because the manifest ships in Tier 0, none of the later
tiers has to reconstruct it, and Tier 6 can be dropped entirely without losing it.

---

## 3. Visual design language

See [`reference/visual-design.md`](reference/visual-design.md) for the language spec
(palette, typography, glass, animated borders, chamfer, controls, widget chrome, motion,
performance notes). Implementation rules live in
[`reference/design-system.md`](reference/design-system.md) — load that when actually
styling components.

---

## 4. Workspace integration (do first — four files, easy to miss)

See [`reference/workspace-integration.md`](reference/workspace-integration.md). Load
**only on `DOX-A1`** — every other story consumes the result. Covers
`pnpm-workspace.yaml`, root `package.json`, `oxlint.config.js`, `apps/dox/project.json`,
and the `tsconfig.base.json` / `customConditions` constraints.

---

## 5. Work breakdown

**22 units of work across 7 tiers, mapped onto the original 13 GitHub issues — no new
issues are created.** New work enters as a lettered sub-story on the issue it naturally
belongs to (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`–`DOX-B2d`, …), the same pattern
`context/roadmap/` already used for `J0a`/`J0b`. Sub-story IDs are for planning
legibility only; GitHub still tracks work at the issue level.

- [story-groups.md](story-groups.md) — one paragraph per tier, naming the stories and
  pointing at the issue file
- [tracker.md](tracker.md) — issue/status table, build order, 23 rows over 13 issues
- `issues/DOX-A.md` … `issues/DOX-E.md` — full GitHub-issue-ready spec per story
- [appendix-parked.md](appendix-parked.md) — unscheduled work

| Tier | Covers                                                                                                                  | Ships                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0    | `DOX-A1`, `DOX-A2`, `DOX-A3a` — skeleton, Cloudflare deploy, reference generator                                        | **The MVP: a live, searchable docs site**            |
| 1    | `DOX-A5` tokens, `DOX-A4a` guides, `DOX-A3b` `llms.txt`/raw markdown                                                    | Substance, and an AI-readable surface                |
| 2    | `DOX-B1a` textarea playground, `DOX-B2a`–`d` auto-embed + DST inspector + interval visualizer + converter bench | **The widget platform** — every example runnable     |
| 3    | `DOX-D1`, `DOX-D2` — glass, borders, chamfer, motion                                                                    | The HUD identity                                     |
| 4    | `DOX-E1a`/`b` — interactive globe, multi-zone scrubber                                                                  | **The flagship** — a product feature, not a flourish |
| 5    | `DOX-A4b`–`d` — scenario template, ported pitfalls, mentor index                                                        | The real-world teaching layer                        |
| 6    | `DOX-C1`–`DOX-C3a`/`b` — retrieval, Worker, chat panel, widget registry                                                 | **The chat that mounts widgets**                     |

**Tier 0 is order-locked and is the only hard sequencing constraint.** `DOX-A1` → `DOX-A2`
→ `DOX-A3a` must land in that order so every later tier is visible on a live site. **Tier 1
onward may be reordered**, and **Tier 5 (scenarios) may run in parallel with Tiers 2–4**
once `DOX-B1a` exists, since its content-writing skill profile does not compete with the
component work in Tiers 2–4. Each story is independently verifiable; do not start the next
sub-story on an issue until the current one's Definition of Done passes.

**Three issues now span more than one tier** as a direct consequence of folding 22 units of
work into 13 issues: `#132` (`DOX-A3`, Tier 0 + 1), `#133` (`DOX-A4`, Tier 1 + 5), and
`#136` (`DOX-B2`, Tier 2). **An issue closes when its last sub-story lands, not its
first** — see [tracker.md](tracker.md).

Unlike `context/roadmap/`, these stories do **not** publish to npm — `apps/dox` is
private. No changesets are needed unless a story also modifies `packages/gmt`.

---

## 6. Verification and 7. Risks

See [`reference/verification-and-risks.md`](reference/verification-and-risks.md) for the
epic-level cross-cutting list. Per-story Definition of Done lives in each
`issues/DOX-*.md`.
