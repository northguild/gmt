### F1 — Scenario corpus (the teaching layer)

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
F1 Author real-world scenario docs and fold into the knowledge corpus
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group F, item F1.
Depends on B1 (the corpus this extends) and B2 (the Worker that will need re-deploying
with the enlarged corpus).

## Gap
B1 gives Dox accuracy (signatures, examples) but not judgment — knowing *when* a user
needs `Pacific/Chatham` handling isn't in a function signature. This is the "real-world
scenarios" half of the original ask, and per the design discussion, it's roughly 80%
generated (B1) / 20% hand-authored (this story) — the 20% is what users actually
remember.

## Scope
Author ~12–15 markdown docs in `apps/dox/content/scenarios/`, seeded from the 17
existing `packages/gmt/skills/*/SKILL.md` guides (their `sources:` frontmatter maps
directly to relevant functions). Suggested set, per
`context/dox/overview.md` §5 Chunk 14:

- Booking a meeting across a DST boundary.
- Storing timestamps vs. displaying them (the perennial UTC-storage mistake).
- Why `Pacific/Chatham` (+12:45) breaks naive offset-arithmetic assumptions.
- Epoch seconds vs. milliseconds confusion.
- Recurring events across a zone's DST policy change.
- (Expand this list — 12–15 total, drawing on the 17 skills guides and any gaps found
  in `context/roadmap/` discussions of real user confusion.)

Each scenario doc states: the trap, the naive/wrong approach, and the correct `gmt`
answer with the specific functions involved. Fold these into the B1 knowledge bundle at
higher retrieval priority than raw signatures, so the model reaches for a scenario
before a bare function reference when the question is "how do I..." rather than "what
does X do."

## Before starting
Read all 17 `packages/gmt/skills/*/SKILL.md` files before drafting — several already
contain "Common Mistakes" sections written for exactly this purpose (e.g. the
`zoned-date-ops` skill's disambiguation/offset gotchas, `durations`' `relativeTo`
requirement gaps). Reuse that content rather than re-deriving it. Also read
`docs/dst-disambiguation.md` for the DST scenario specifically — it's the most detailed
existing writeup of a real gotcha in the codebase.

## Definition of done
- 12–15 scenario docs exist, each following the trap/wrong-approach/correct-answer
  shape.
- Asking Dox "how do I schedule a meeting across DST" produces an answer that teaches
  the pitfall and cites the relevant functions, rather than dumping a bare signature.
- B2's Worker is re-deployed with the enlarged corpus and re-verified against the
  request-size constraint noted in B2's issue.
```

---

### F2 — Deploy

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
F2 GitHub Actions deploy: apps/dox to Pages, worker via wrangler-action
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group F, item F2.
Depends on every prior story — this is the final integration/launch step.

## Gap
No deployment pipeline exists. `.github/workflows/` currently has only `ci.yml` and
`publish.yml` — nothing deploys anything to Pages or Cloudflare.

## Scope
- GitHub Actions workflow: build `@burglekitt/gmt` → build the B1 knowledge bundle →
  build `apps/dox` → deploy to GitHub Pages.
- Separate `wrangler-action` step deploying the B2 Worker.
- Confirm the deployed Worker's CORS allowlist matches the actual deployed Pages origin
  (not left as a placeholder).

## Before starting
Read the existing `.github/workflows/ci.yml` for this repo's conventions (Nx
affected-based commands, Node matrix) and match its style rather than introducing an
unrelated pattern. Confirm whether GitHub Pages is already enabled for this repo or
needs to be turned on in repo settings — that's a one-time manual step outside the
workflow file itself.

## Definition of done
- Push to the deploy trigger produces a live site that successfully streams grounded
  answers from the deployed Worker.
- CORS holds — requests from unexpected origins are rejected.
- Grep the deployed built assets to confirm the Gemini key is absent (this should
  already be guaranteed by B2, but re-verify against the actual production build, not
  just the dev build).
- `pnpm nx run-many -t lint test typecheck build` still passes for the whole monorepo,
  confirming `apps/dox` didn't regress `packages/gmt` or the linting packages.
```
