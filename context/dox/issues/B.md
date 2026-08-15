### B1 — Knowledge extraction

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
B1 Extract JSDoc, READMEs, and skills into dox-knowledge.json
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group B, item B1.
Depends on A1 (workspace exists). Independent of A2/A3 — this is a build script, not UI,
and can proceed in parallel with them if useful.

## Gap
Dox has no corpus yet. The model must be grounded strictly in `@burglekitt/gmt`'s actual
documented surface — 349 functions across `plain`/`zoned`/`unix`/`utc`/`duration` plus 16
`regex` consts, per `context/dox/overview.md` §1.

## Scope
- `apps/dox/scripts/build-knowledge.ts` walks `packages/gmt/src/**/*.ts` using the
  TypeScript compiler API — **not regex** — emitting per function: namespace, category,
  name, signature, description, `@param`/`@returns`, and every `@example` as
  `{ call, result }`. The codebase's layout (one exported function per file, sibling
  `*.test.ts`, barrel `index.ts` per category) makes this mechanical; see
  `context/jsdoc-standards.md` for the exact JSDoc shape being parsed.
- Also ingest: the six namespace READMEs (`packages/gmt/src/{plain,zoned,unix,utc,
  duration,regex}/README.md`), the root `packages/gmt/README.md`,
  `docs/dst-disambiguation.md`, and the 17 `packages/gmt/skills/*/SKILL.md` guides —
  their `sources:` frontmatter gives a symbol→file map for free.
- Emit `apps/dox/dox-knowledge.json` (or equivalent build output location).
- Add a Vitest test asserting the corpus's function/example counts, so a future
  `@burglekitt/gmt` change that isn't re-extracted fails CI rather than silently going
  stale.

## Before starting
Re-verify the 349-function / ~999-`@example` counts are still current
(`context/dox/overview.md` §1 cites them as of when it was written) — the gmt
package continues to grow per its own roadmap (`context/roadmap/`), so these numbers
will have moved. Read `context/jsdoc-standards.md` for the exact `@example` format
(`fn(args) // result`) the parser needs to handle.

## Definition of done
- `dox-knowledge.json` contains every currently-exported function with its examples.
- Spot-check at least one function (e.g. `formatDate`) against its actual source file to
  confirm the extraction is byte-accurate, not approximate.
- The corpus-count Vitest test is in place and passing.
- `pnpm lint` / `pnpm typecheck` pass on the new script.
```

---

### B2 — Worker proxy

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
B2 Cloudflare Worker proxy for Gemini with grounded systemInstruction
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group B, item B2.
Depends on B1 (the corpus this injects).

## Gap
A Gemini API key cannot live in a client-side SPA bundle — it is trivially extractable.
A server-side hop is required. See `context/dox/overview.md` §2's "Decisions
taken" table for why Cloudflare Workers specifically (free tier, 100k req/day).

## Scope
- `workers/dox-proxy` with `wrangler.toml`.
- Key stored via `wrangler secret put GEMINI_API_KEY` — never in source, never in the
  client bundle.
- CORS locked to the deployed origin plus localhost for development.
- Stream Gemini responses as unbuffered SSE straight through to the client.
- `systemInstruction` carries: the B1 corpus, GMT's core rules (ISO strings in/out,
  never `Date`, sentinel returns `""`/`null`/`false`/`[]`, invalid input never throws —
  see `context/coding-standards.md`), and an explicit instruction to refuse questions
  outside the corpus. **There is no `systemKnowledge` Gemini setting** — this
  prompt-and-context approach is the actual mechanism; see overview.md §1.
- Enable Gemini context caching so the large corpus isn't re-billed/re-sent per request.

## Before starting
Confirm current Gemini API request-size limits against the actual serialized size of
`dox-knowledge.json` from B1. If the corpus is too large for a single request even with
caching, the fallback (per overview.md §7 Risks) is namespace-scoped slices selected by
a cheap first-pass classification — not a vector database. Decide this before writing
the refusal-instruction logic, since it affects what "the corpus" means at request time.

## Definition of done
- `curl -N` against the deployed Worker streams tokens.
- An off-topic question (nothing to do with `@burglekitt/gmt`) is refused, not
  improvised — this is the single most important behavioral test for the whole epic.
- Grepping the built client bundle confirms the API key never appears there.
- CORS rejects requests from origins other than the deployed site and localhost.
```
