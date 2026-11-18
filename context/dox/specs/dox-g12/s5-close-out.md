# Slice 5 · Close-out: gates, runbook, `built/`

[Index](./index.md) · Binding rules: [Tier 2 · Gates](../../built/tier-2-gates.md),
[Tier 6 · Runbooks](../../built/tier-6-runbooks.md),
[verification-and-risks.md](../../reference/verification-and-risks.md).

## Goal

Run every gate once over the finished deck, write the venue runbook, and leave `context/dox/`
describing what is built. Slices 1–4c ran only their own tests, lint and checks.

## The merge waits on four inputs

1. The talk's date and start time (Europe/Helsinki) replacing `OWNER-TO-SUPPLY` in
   `decks.ts`; `slides-check` fails until then.
2. The slide 2 agent transcript in `quotes/agent-moment.json`, captured by the owner.
3. The wall captures (`node scripts/capture-wall.ts`, run from `apps/dox`), with each `clip` set and
   `clock` checked by the owner.
4. A full zone-matrix run committed with no untagged failure and GMT at zero; any GMT failure is
   fixed first through the library pipeline, with a changeset.

The `wrong-answer` tags awaiting the upstream filing flow are listed in the PR description; each
is filed only after the owner approves its exact text, then added to `upstream-filings.json`.

## One build, announced

`packages/gmt` is unchanged unless the zone-matrix control found a bug, so no gmt rebuild is
needed for the deck. `pnpm run validate` and
any `pnpm dox:build` still build through the workspace: tell the owner before the first one,
because his `pnpm dox:dev` reads `packages/gmt/dist` and a rebuild breaks every open tool. Build
once, then run everything below against that build.

## Gates

| Gate | Tier | What it proves for the deck |
| --- | --- | --- |
| `pnpm run validate` | CI | Lint, types, tests, the CI timezone matrix untouched |
| `slides-check` (new) | pr, leg "other" | Steps, builds, deep links, stage fit at three sizes, no stage move while stepping, flight settles on its place, no frames at rest, frame budget, no-JS order, print breaks, presenter readout boxes still; the shatter's frame budget, reset on stepping back and pins lit; recorded demos labelled, both JSON panels, three deck tools registered; no talk-start placeholder; no dev secret in `dist/` or recordings |
| `a11y-axe` | pr | The three deck routes and `/compare/zone-matrix/` (it reads every built page) |
| `a11y-tab-walk` | pr | Deck controls bar, both dialogs, presenter buttons: add the deck and presenter to its page list |
| `esc-cascade` | pr | Overview and help dialogs close one per Escape, focus returns to the opener |
| `contrast-measure` | pr | Slide text over its panel at 7:1 for each slide, both colour schemes; `slides-check` steps to each slide by `#<id>` and calls the same measurement |
| `data-credits-check` | pr | The sky and capture credits on the `thanks` slide and the index |
| `head.dist.test.ts` | CI | WebMCP markers on tool pages and registry decks only |
| `hero-space` | pr | The landing hero is unchanged after the `space-sky.ts` extraction |
| `globe-smoke` | local (GPU) | WebGPU on the deck page: imagery, pins, arcs, a hop, the shatter, then canvas-2D parity |
| `scripts/deploy-smoke.mjs` | post-deploy | Rows for `/slides/`, the deck, the presenter and `/compare/zone-matrix/`: 200, the presenter carries `noindex`, the sitemap lists the others |
| `pnpm dox:docs-check` | local | Unchanged (no reference page touched) |

Then `dox-tester` verifies the whole story once, at most two builder → tester rounds. A
Firefox or WebKit finding from the weekly sweep is fixed in the product, never waived.

## Venue runbook (`built/tier-6-runbooks.md`, new section "Present a deck")

1. The day before: on the venue laptop, visit `/gmt/api/brains?key=<secret>` once (typed, never
   bookmarked or shared) so the `dox_dev` cookie exempts it from the visitor cap. Then open the
   deck and the presenter on the deployed site; the readiness check must read all "Loaded" and
   show the cookie and brain allowance. This also warms the HTTP cache.
2. Check which brain allowance resets before the talk (Workers AI at 00:00 UTC, Gemini at
   midnight Pacific), and do not rehearse the chat demos on the day beyond one test question.
3. Offline fallback: from a checkout, `pnpm dox:build` then `pnpm dox:preview`, and present from
   `http://localhost:4321/gmt/slides/give-me-temporal/`. Only the chat demos call the network
   after load, and there they play their recordings, labelled.
4. Projector: mirror off, deck window on the projector in fullscreen (F or F5), presenter on the
   laptop (T). Pair the clicker; press each of its buttons once with the help dialog open.
5. If the GPU stutters, reload with `?globe=canvas2d`; if the globe fails, the slides still read
   on the void. Reduced motion in the OS turns every flight into a cut.
6. Spare: print the deck to PDF from the article view (one slide a page) and keep it on a stick.

## `context/dox/` updates (present tense, the decision and a one-line reason, no history)

- **New `built/tier-3-slides.md`**, with a row in `built/index.md`'s map: the `/slides/` routes
  and URL scheme, the registry, the `Deck`/`Slide`/`Build`/`Notes` components and the one-source
  rule (the runtime reads the DOM), the key table and where it lives (`keys.ts`), the presenter
  sync contract, the no-JS and print forms, the panel rule, and the traps found while building
  (F5 reload, Space on a focused button, the presenter being out of the sitemap).
- **`built/tier-4-globe.md`**: `ambient: false`, `flyTo` with `hop`, `steer`, `getView`,
  `globe-theme.ts`, `space-sky.ts`; the deck page as the fourth globe host; the ice wall layer
  (Voronoi shards, pure poses, both renderers) and the clock pins.
- **`built/tier-2-webmcp.md`**: deck tools built without `definePageTool`, `offerPageTools`, the
  deck head marker.
- **`built/tier-6-chat.md`**: the deck's plain-DOM chat client, the 8 s budget and recorded
  fallbacks; **`built/tier-6-runbooks.md`**: "Present a deck", "Re-record deck answers" and
  "Re-run the zone matrix" (command, cost, tag review, filing flow).
- **`built/tier-0-1-generator.md` § Hand-written pages**: `/compare/` figures come from
  `gmt-stats.json`, `library-measurements.json` and `zone-matrix.json`; `/compare/zone-matrix/`,
  the new column, `zoneMatrixLine` on Migrate pages; the zone-matrix runner beside the
  behaviour-matrix one (outside the workspace, the same skips).
- **`built/tier-2-platform.md`**: the carousel's `steps` option.
- **`built/tier-2-gates.md`**: `slides-check` and what it reads.
- **`built/tier-0-1-site.md`**: the sitemap filter's presenter rule; the deck's share card.
- **`reference/visual-design.md`**: Motion gains the deck's hop flight, the 200 ms slide fade,
  the shatter (1400 ms) and the shards settling as clock pins, with reduced-motion forms (cuts;
  crack and fade); Performance names the deck page as a globe host.
- **`tracker.md`**: the DOX-G12 row to Done (the main session adds it as Todo before slice 1);
  DOX-G2 corrected to Done (#461). Run `pnpm deps:sync`.
- **`specs/index.md`**: drop `dox-g2` (merged) when its folder is folded.

## Definition of done

- Every gate above green on one build; `dox-tester` passes.
- The owner presents the full deck once from the venue runbook on his laptop, clicker in hand,
  with the presenter on a second screen, and once with `?globe=canvas2d`.
- `context/dox/` matches what is built. The finalizer folds this folder into `built/` and
  deletes it. No changeset unless a GMT fix from the zone-matrix control touched `packages/`.
