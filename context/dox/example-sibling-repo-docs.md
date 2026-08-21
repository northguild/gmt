# Example Docs Site and AI functionality: Docs Site + AI Chat — Architecture Blueprint

**WARNING** This is an example of a docs site and ai chat from a sibling repo in our organization. It is far from perfect (no textarea, multiline chat, no copiable blocks). This is only an example to consider how something may be built. DO NOT BUILD THIS PRODUCT - it doesn't adhere to our design or functional needs. It is ONLY an example.

A generalized write-up of how the **Worktree CLI** docs site and its AI chat assistant are
built, adapted as a starting structure for a **monorepo** (`gmt` + `gmt-biome`, `gmt-eslint`,
`gmt-oxlint`) with a single docs site covering all packages.

---

## 1. Stack at a glance

| Layer           | Choice                                                                                                          | Why                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Docs framework  | **Nextra 4** (`nextra`, `nextra-theme-docs`) on **Next.js 16 App Router**                                       | MDX pages are just `page.mdx` files in the app router; sidebar/nav driven by `_meta.ts` files |
| Rendering       | `output: "export"` (fully static)                                                                               | Deploys to GitHub Pages, zero server cost                                                     |
| Search          | **Pagefind** (postbuild static index)                                                                           | Static-site full-text search, no service                                                      |
| Styling         | Tailwind v4 + `tailwind-merge`                                                                                  | —                                                                                             |
| Chat UI         | React 19 + `@base-ui/react` (Drawer/Menu) + `@tanstack/react-query` + `@tanstack/react-form` + `react-markdown` | Streaming state via react-query mutation; markdown rendering with a hardened link renderer    |
| AI backend      | **Cloudflare Worker** proxying **Google Gemini** SSE                                                            | Keeps the API key out of the static bundle; zero npm deps, ~30 KB bundle                      |
| AI context      | **Baked in at build time** — MDX + `SKILL.md` compiled into one `SYSTEM_PROMPT` string                          | No vector DB, no runtime fetching, no infra                                                   |
| Skill authoring | `@tanstack/intent` (`SKILL.md` per package)                                                                     | Machine-maintained product vocabulary the AI reads before the docs                            |
| CI/CD           | GitHub Actions → GitHub Pages (docs) + `wrangler deploy` (worker)                                               | Two independent, path-filtered workflows                                                      |

The single most important idea: **the AI has no retrieval layer.** The entire documentation set is
compiled into a system prompt at build time and shipped inside the worker bundle. That is what makes
it cheap, deterministic, and debuggable — and it's the part that needs the most thought in a monorepo,
because you now have 4× the content (see §5).

---

## 2. Proposed monorepo layout

```
gmt/
├─ packages/
│  ├─ gmt/                       # main library
│  │  ├─ package.json
│  │  └─ skills/core/SKILL.md    # AI skill guide (TanStack Intent-managed)
│  ├─ gmt-biome/
│  │  └─ skills/core/SKILL.md
│  ├─ gmt-eslint/
│  │  └─ skills/core/SKILL.md
│  └─ gmt-oxlint/
│     └─ skills/core/SKILL.md
│
├─ apps/docs/                    # the one docs site
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ layout.tsx           # Nextra Layout + <Chat /> mounted globally
│  │  │  ├─ page.tsx             # landing page
│  │  │  ├─ _meta.ts             # top-level nav
│  │  │  └─ docs/
│  │  │     ├─ _meta.ts
│  │  │     ├─ page.mdx                    # docs home
│  │  │     ├─ gmt/{...}/page.mdx          # main library
│  │  │     ├─ biome/{...}/page.mdx        # gmt-biome
│  │  │     ├─ eslint/{...}/page.mdx       # gmt-eslint
│  │  │     └─ oxlint/{...}/page.mdx       # gmt-oxlint
│  │  ├─ chat/                   # entire chat feature (see §7)
│  │  ├─ components/             # Navbar, Footer, TerminalBlock, …
│  │  ├─ lib/site-meta.ts        # GENERATED from package.json files
│  │  └─ utils/
│  ├─ worker/                    # Cloudflare Worker (see §6)
│  │  ├─ worker.ts
│  │  ├─ build-context.mjs       # THE context compiler
│  │  ├─ docs-context.ts         # GENERATED — do not edit
│  │  ├─ docs-context.stub.ts    # empty stub so tests run without a build
│  │  ├─ worker.test.ts
│  │  ├─ wrangler.toml
│  │  ├─ tsup.config.ts
│  │  └─ setup-dev-vars.mjs
│  ├─ next.config.mjs
│  └─ package.json
│
├─ scripts/
│  ├─ sync-docs-version.mjs      # package.json → site-meta.ts
│  └─ sync-intent-version.mjs    # package.json → SKILL.md frontmatter
├─ pnpm-workspace.yaml
└─ .github/workflows/{docs-deploy.yml,worker-deploy.yml,ci.yml}
```

Package manager is **pnpm workspaces**; every docs command is run from the repo root via
`pnpm --filter docs run <script>`, with root-level aliases (`pnpm docs:dev`, `pnpm docs:build`).

---

## 3. Docs site mechanics

### Next.js config (static export + GitHub Pages)

```js
// apps/docs/next.config.mjs
import nextra from "nextra";
const withNextra = nextra({});
const isProduction = process.env.NODE_ENV === "production";

export default withNextra({
  output: "export",
  basePath: isProduction ? "/gmt" : "", // GH Pages project path
  env: {
    // Public worker URL, baked into the client bundle at build time
    GEMINI_WORKER_URL: process.env.GEMINI_WORKER_URL ?? "",
  },
  images: { unoptimized: true },
  turbopack: {
    resolveAlias: { "next-mdx-import-source-file": "./mdx-components.tsx" },
    root: workspaceRoot, // important in a monorepo — point at the repo root
  },
});
```

### Navigation

Sidebar/nav is declared with `_meta.ts` files colocated with the MDX. In a monorepo this is where
the per-package split becomes visible:

```ts
// src/app/docs/_meta.ts
const meta: MetaRecord = {
  "getting-started": "Getting Started",
  gmt: { title: "gmt" },
  biome: { title: "gmt-biome" },
  eslint: { title: "gmt-eslint" },
  oxlint: { title: "gmt-oxlint" },
  faq: "FAQ",
  changelog: "Changelog",
};
export default meta;
```

### Generated site metadata

`src/lib/site-meta.ts` is **generated** by `scripts/sync-docs-version.mjs` from the root
`package.json` (version, description, repo URL, contributors → maintainers list). The docs
site never hardcodes a version number.

**Monorepo change:** generate a _map_ of versions instead of one:

```ts
// Generated file. Do not edit directly.
export const versions = {
  gmt: "1.4.0",
  "gmt-biome": "1.0.3",
  "gmt-eslint": "0.9.1",
  "gmt-oxlint": "0.4.2",
} as const;
```

The script walks `packages/*/package.json` and writes the map, then runs the formatter on the output.
It runs in `predev` and `prebuild`, so the docs can never ship a stale version badge.

### Search

Pagefind indexes the built static output as a postbuild step:

```json
"postbuild": "pagefind --site .next/server/app --output-path out/_pagefind"
```

Search (keyword) and chat (semantic/explanatory) are complementary — keep both.

---

## 4. AI chat — architecture

```
Browser (static GitHub Pages bundle)
  │  POST { model, messages[], scope? }
  ▼
Cloudflare Worker            docs/worker/
  │  • holds GEMINI_API_KEY as an encrypted CF secret
  │  • validates input, enforces CORS, rate-limits per IP
  │  • prepends SYSTEM_PROMPT (baked in at build time)
  ▼
Google Gemini API   :streamGenerateContent?alt=sse
  │  SSE stream
  ▼
Worker pipes the SSE body straight back (no buffering)
  │
  ▼
src/chat/*  — React renders the streamed markdown
```

Two invariants worth preserving:

1. **The static bundle never sees the API key.** The only public value baked into the client is
   `GEMINI_WORKER_URL` — a plain URL, stored as a GitHub _variable_, not a secret.
2. **The worker never fetches content at runtime.** All docs context is inside the bundle, so a
   chat request is exactly one upstream call.

---

## 5. The context pipeline — the heart of it

`worker/build-context.mjs` is a plain Node script (no deps) that runs **before** every worker bundle
and every docs build. It:

1. Recursively finds every `*.mdx` under `src/app/docs/`.
2. Strips MDX noise: `import`/`export` lines, JSX elements, `{expressions}`, collapses blank lines.
3. Concatenates the plain text with a `### Docs: <path>` label per file.
4. Derives the **valid route list** from the same filesystem scan
   (`src/app/docs/commands/branch/page.mdx` → `/docs/commands/branch`).
5. Reads each `SKILL.md`.
6. Assembles the system prompt and writes two generated files:
   - `worker/docs-context.ts` → `export const SYSTEM_PROMPT = "…"` (JSON-stringified)
   - `src/chat/docs-routes.generated.ts` → `export const VALID_DOC_ROUTES: ReadonlySet<string>`

That second output is what lets the **client** reject hallucinated links (§7.4). Same source of
truth, two consumers.

### System prompt order (single-package original)

```
1. Persona & scope     — answer only from the docs + skill guide; say so when out of scope
2. Linking rules       — explicit allowlist of routes; never invent routes, never link
                         to GitHub anchors or SKILL.md headings
3. Skill Guide         — skills/core/SKILL.md
4. Documentation       — every MDX page, labelled with its file path
```

### Monorepo adaptation — scoping

One package produced a ~29 KB prompt. Four packages will land somewhere around 80–150 KB, which
Gemini can hold fine but which you pay for on **every** request. Three options, in order of
recommendation:

**A. Scoped context bundles (recommended).** Build one context per scope plus a shared core:

```js
const SCOPES = {
  gmt: {
    docsDir: "src/app/docs/gmt",
    skill: "packages/gmt/skills/core/SKILL.md",
  },
  biome: {
    docsDir: "src/app/docs/biome",
    skill: "packages/gmt-biome/skills/core/SKILL.md",
  },
  eslint: {
    docsDir: "src/app/docs/eslint",
    skill: "packages/gmt-eslint/skills/core/SKILL.md",
  },
  oxlint: {
    docsDir: "src/app/docs/oxlint",
    skill: "packages/gmt-oxlint/skills/core/SKILL.md",
  },
};
// plus SHARED: src/app/docs/*.mdx (getting-started, faq, changelog) — always included
```

Emit `export const SYSTEM_PROMPTS: Record<Scope, string>` and `export const ALL_SCOPES_PROMPT`.
The client sends `scope` in the request body; the worker validates it against a known set (same
pattern as the existing model allowlist) and picks the prompt. Derive the default scope from the
page the user is on (`/docs/eslint/...` → `eslint`) and expose a scope selector in the drawer next
to the model selector, with an "All packages" option that uses the full prompt.

This keeps the common case (a user reading the eslint docs asking an eslint question) cheap and
focused, while cross-package questions ("what's the difference between gmt-biome and gmt-oxlint?")
still work via "All packages".

**B. One monolithic prompt.** Simplest — literally the current script with more directories in the
scan. Do this first if you want to ship fast; the scoping in (A) is a drop-in upgrade later because
the generated-file boundary doesn't change.

**C. Real retrieval (embeddings + Vectorize/KV).** Only worth it past ~500 KB of docs. It adds a
build step, an index to keep in sync, and a second network hop per request. Not needed at this size.

### Route allowlist in a monorepo

The derivation stays identical — the routes just carry the package segment
(`/docs/eslint/rules/no-floating-promises`). Keep the per-scope route lists separate in the generated
file so the linking-rules section of a scoped prompt lists only that scope's routes plus shared pages.
A model that can only see 20 valid routes hallucinates far less than one shown 120.

### Regenerating

```bash
pnpm --filter docs run worker:build-context
```

Run after: adding/removing a docs page, editing MDX you want the AI to know, or updating any
`SKILL.md`. It is wired into `prebuild` and `worker:build`, so CI never forgets.

### SKILL.md per package (TanStack Intent)

Each package ships a `skills/core/SKILL.md` — frontmatter (`name`, `description`, `library`,
`library_version`, `sources[]`) plus a structured body covering setup, core patterns, and canonical
terminology. It is included **before** the MDX so the model learns vocabulary before reading
reference material. It is machine-managed — don't hand-edit:

```bash
npx @tanstack/intent@latest stale      # does the skill reference outdated sources?
npx @tanstack/intent@latest scaffold   # AI-guided authoring/update
npx @tanstack/intent@latest validate   # format + packaging rules; run before release
```

In a monorepo, run these per package (`--cwd packages/gmt-eslint` or from the package dir), and add a
root script that fans out across all four. `scripts/sync-intent-version.mjs` keeps each SKILL.md's
`library_version` in step with its `package.json`.

---

## 6. The Cloudflare Worker

Single default-export `fetch` handler, **zero npm dependencies**, bundled by tsup to ESM (~30 KB).

### Request pipeline

```
OPTIONS            → 204 + CORS headers
method !== POST    → 405
rate limit check   → 429 + Retry-After
missing API key    → 500
bad JSON           → 400
messages not array → 400
> 50 messages      → 400
bad role/shape     → 400   (roles restricted to user|assistant)
content > 20k ch   → 400
model not allowed  → 400   (allowlist shared with the client)
→ POST Gemini :streamGenerateContent?alt=sse
   upstream !ok    → mapped, human-readable error JSON (429 daily vs per-minute distinguished)
   ok              → new Response(upstream.body, { "Content-Type": "text/event-stream", … })
```

### Notable details worth copying

- **Model allowlist is imported from the client constants file** (`src/chat/constants.ts`), so UI and
  worker can never drift. Do the same for the scope list.
- **Message-history shape conversion** happens in the worker (`assistant` → Gemini's `model` role),
  so the client speaks one generic format. If you may swap providers later, this is your seam.
- **CORS allowlist** is explicit: production origin + `http://localhost:3000`; anything else gets the
  production origin echoed back, so browsers block it. `Vary: Origin` is set.
- **App-level rate limiting**: in-memory `Map<clientIp, {count, resetAtMs}>`, default 30 req / 60 s,
  tunable through non-secret `[vars]` in `wrangler.toml`. Client id is `CF-Connecting-IP` →
  first `X-Forwarded-For` → `"unknown"`. The map is swept for expired entries at a 10k-key cap, and
  rejects rather than growing unbounded past it.
  _Caveat to know going in:_ this is **per isolate**, not global — it blunts casual abuse, not a
  determined attacker. Upgrade paths are Cloudflare WAF/Rate Limiting rules, Turnstile, or a Durable
  Object if you need real global counters.
- **Errors are user-facing strings**, not raw upstream payloads — e.g. daily-quota 429s tell the user
  to switch model or come back tomorrow.

### Config

```toml
# worker/wrangler.toml
name = "gmt-gemini-proxy"
main = "dist/worker.js"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[dev]
port = 8787          # pinned so the Next.js dev server always finds it

[vars]
WORKER_RATE_LIMIT_MAX = "30"
WORKER_RATE_LIMIT_WINDOW_SECONDS = "60"
# Secrets go in via: wrangler secret put GEMINI_API_KEY
```

### The stub trick

`worker.test.ts` imports the worker, which imports `./docs-context.js` — a **generated** file that
may not exist on a clean checkout. `docs-context.stub.ts` exports an empty `SYSTEM_PROMPT` and is
aliased in the vitest config, so tests run with no build step and CI stays fast.

---

## 7. The chat client (`src/chat/`)

```
chat/
├─ components/
│  ├─ Chat.tsx              # QueryClientProvider + ChatProvider + ChatDrawer
│  ├─ ChatContext.tsx       # drawer state, model selection, chat state
│  ├─ ChatDrawer.tsx        # Base UI Drawer, header, model select, clear menu
│  ├─ ChatTrigger.tsx       # floating action button
│  ├─ ChatPanel.tsx         # Messages + ChatForm
│  ├─ ChatForm.tsx          # TanStack Form
│  ├─ ChatInput.tsx / ChatSubmitButton.tsx / ChatModelSelect.tsx
│  ├─ Messages.tsx / UserMessage.tsx / AssistantMessage.tsx / MessageMeta.tsx
│  ├─ MarkdownContent.tsx   # hardened markdown + link resolution
│  └─ LoadingDots.tsx / Portal.tsx
├─ form/                    # FormContext / FieldContext / FormField
├─ hooks/
│  ├─ useStreamChat.ts      # the streaming engine
│  ├─ useMessageHistory.ts  # persisted message list + mutators
│  ├─ useLocalStorage.ts    # useSyncExternalStore-based, SSR-safe
│  ├─ useBottomScroll.ts / useEnterAnimation.ts / useGlobalKeyDown.ts
├─ constants.ts             # ALLOWED_MODELS (shared with the worker), FREE_MODELS, DEFAULT_MODEL
├─ types.ts                 # ChatMessage
└─ docs-routes.generated.ts # GENERATED route allowlist
```

`<Chat />` is mounted once in `app/layout.tsx`, outside the Nextra `<Layout>`, so it's available on
every page.

### 7.1 Streaming (`useStreamChat`)

A `useMutation` wrapping `fetch` + a manual `ReadableStream` reader:

- **Two timeouts**: a 120 s overall request timeout, and a 30 s _idle_ timeout that resets on every
  chunk (detects stalled streams without killing long answers). The idle race clears its handle in a
  `finally`, so no dangling timers.
- **AbortController** per request; a new send aborts the previous one.
- **Optimistic append**: the user message and an empty assistant placeholder are added before the
  network call, so the loading state is instant.
- **Clean history**: the snapshot sent upstream filters out error/warning messages and empty or
  still-streaming assistant messages — the UI can be forgiving without corrupting model context.
- **Errors are classified**: `isError` (hard failure) vs `isWarning` (recoverable — rate limit,
  validation, cancellation), rendered differently and excluded from history.
- SSE parsing lives in a pure, unit-tested function (`utils/parseGeminiSseLine.ts`) that returns a
  discriminated union: `{type: "text"|"error"|"done"|"skip"}`. Keeping it side-effect-free is what
  makes the streaming logic testable at all — **do this from day one.**

### 7.2 Persistence

`useLocalStorage` is built on `useSyncExternalStore`, is SSR-safe, caches the parsed snapshot by raw
string (otherwise `JSON.parse` returns a new reference each call → infinite render loop), and
manually dispatches a `StorageEvent` on write so same-tab subscribers update (the native event only
fires in _other_ tabs).

History is keyed **per model**: `docs_chat_history_${model}`. Switching models switches
conversations rather than clearing them; a split "Clear" button offers _Clear chat_ vs _Clear all
chats_. In a monorepo, key by scope too: `docs_chat_history_${scope}_${model}`.

On load, messages left with `streaming: true` from a closed tab are sanitized.

### 7.3 UX details

- Floating chat bubble bottom-right; `Ctrl/Cmd+K` toggles the drawer.
- Base UI `Drawer` with a two-phase mount for the slide-in animation.
- A `dev` badge appears in the drawer header when `GEMINI_WORKER_URL` points at localhost — cheap,
  and it stops "why is the AI stale?" confusion.
- Model selector lists free-tier models with human labels ("Gemini 2.5 Flash Lite (fastest)").

### 7.4 Link hardening — the part most people skip

`MarkdownContent.tsx` runs **every** href the model emits through `resolveHref()`:

| Link the model produced                            | Outcome                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Relative path in `VALID_DOC_ROUTES`                | Rendered as a Next `<Link>`                                          |
| Full production URL (`https://…github.io/gmt/...`) | Origin stripped → re-checked as a relative path                      |
| GitHub repo anchor (`github.com/org/repo#…`)       | Rendered as **plain text** — no link                                 |
| Relative path not in the route list                | Rendered as **plain text** — no link                                 |
| Other external URL                                 | Only if origin is allowlisted and protocol ∈ `{https, http, mailto}` |

Anything unparseable, or using `javascript:` / `data:`, is dropped. There is also a
`DOCS_ROUTE_MAP` that auto-links **bold** phrases matching known page titles ("**getting started**" →
`/docs/getting-started`) — a nice touch that makes answers feel native. In a monorepo, generate that
map per scope from page frontmatter/titles rather than hand-maintaining it.

The net effect: **a hallucinated link degrades to plain text instead of a 404.**

---

## 8. Environment variables & secrets

| Name                    | Where it lives                                    | Secret?              | Purpose                                               |
| ----------------------- | ------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `GEMINI_API_KEY`        | Cloudflare secret store (`wrangler secret put`)   | **Yes**              | Injected by the worker runtime per request            |
| `GEMINI_API_KEY`        | `apps/docs/.env.local` → `worker/.dev.vars`       | **Yes** (gitignored) | Local `wrangler dev` only                             |
| `GEMINI_WORKER_URL`     | GitHub Actions **variable**, `.env.local` locally | No                   | Which worker the site talks to; baked into the bundle |
| `CLOUDFLARE_API_TOKEN`  | GitHub Actions **secret**                         | **Yes**              | `wrangler deploy` in CI                               |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions **secret**                         | **Yes**              | `wrangler deploy` in CI                               |

`setup-dev-vars.mjs` reads `GEMINI_API_KEY` out of `.env.local` and writes `worker/.dev.vars` so
`wrangler dev` picks it up — one less manual step, and both files are gitignored with committed
`.example` counterparts.

`GEMINI_WORKER_URL` is the single switch between local and deployed worker:

| Value                                         | Set by                            | Effect                                |
| --------------------------------------------- | --------------------------------- | ------------------------------------- |
| `http://localhost:8787`                       | `dev:local` scripts               | Next.js → local wrangler              |
| `https://gmt-gemini-proxy.<acct>.workers.dev` | GH Actions variable at build time | Production bundle → live worker       |
| unset                                         | —                                 | Falls back to `http://localhost:8787` |

---

## 9. Scripts reference

Root aliases:

```json
{
  "docs:dev": "pnpm docs:sync-version && pnpm --filter docs run dev",
  "docs:dev-local": "pnpm docs:sync-version && pnpm --filter docs run dev:local:watch",
  "docs:build": "pnpm docs:sync-version && pnpm --filter docs build",
  "docs:test": "pnpm --filter docs test",
  "docs:sync-version": "node ./scripts/sync-docs-version.mjs && biome format ./apps/docs/src/lib/site-meta.ts --write"
}
```

Docs package:

| Script                  | What it does                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| `dev`                   | Next.js dev only (chat points at whatever `GEMINI_WORKER_URL` says)           |
| `dev:local`             | Build worker once → run worker + Next.js concurrently (`concurrently -k`)     |
| `dev:local:watch`       | Same, plus `tsup --watch` on the worker — use when editing worker code        |
| `worker:build-context`  | Scan MDX + SKILL.md → generate `docs-context.ts` + `docs-routes.generated.ts` |
| `worker:build`          | `worker:build-context` → `tsup worker.ts`                                     |
| `worker:dev`            | `wrangler dev worker/dist/worker.js --local` on :8787                         |
| `worker:test`           | vitest on `worker.test.ts`                                                    |
| `worker:setup-secret`   | `wrangler secret put GEMINI_API_KEY` (one-time / on rotation)                 |
| `worker:setup-dev-vars` | `.env.local` → `worker/.dev.vars`                                             |
| `worker:deploy`         | test → build → `wrangler deploy`                                              |
| `prebuild`              | sync versions + `worker:build-context`                                        |
| `build` / `postbuild`   | `next build` / `pagefind` index                                               |

**Build-order rule:** context generation must precede _both_ the worker bundle and the Next.js build,
because the Next.js build consumes `docs-routes.generated.ts`. Wiring it into `prebuild` and
`worker:build` means it's impossible to skip.

---

## 10. CI/CD

Two path-filtered workflows on push to `main`:

**`docs-deploy.yml`** — triggers on `docs/**` (in a monorepo: `apps/docs/**`, plus
`packages/*/skills/**` and the docs-relevant package.json files, since those feed the AI context).
Runs `pnpm docs:test` → `pnpm docs:build` with `GEMINI_WORKER_URL: ${{ vars.GEMINI_WORKER_URL }}` →
`upload-pages-artifact` (`apps/docs/out`) → `deploy-pages`. Uses `concurrency: { group: pages }`.

**`worker-deploy.yml`** — triggers on `apps/docs/worker/**`. Runs worker tests → `worker:build` →
`wrangler deploy` with the two Cloudflare secrets.

> **Monorepo gotcha:** the worker's prompt embeds docs content, so a _docs-only_ change should also
> redeploy the worker or the chat answers go stale. Either add the MDX/SKILL paths to the worker
> workflow's trigger, or merge the two into one workflow with two jobs. This is the single most
> important CI change versus the original setup.

---

## 11. Testing

- **Worker** (`worker.test.ts`, ~24 cases): method guards, every validation branch, happy-path SSE
  proxying with header assertions, model forwarding, upstream 429/503 error mapping, CORS reflection
  and fallback, and rate limiting (including per-IP independence). `fetch` is stubbed; the stub
  context file keeps it build-free.
- **Pure utils**: `parseGeminiSseLine.test.ts` covers text/error/done/skip and malformed payloads.
- **Components**: React Testing Library + jsdom for Navbar/Footer/etc.

Rate-limit tests need control over time — keep the clock behind a helper (`getUnixNow()`) so it can
be faked.

---

## 12. Adaptation checklist for `gmt`

1. Scaffold `apps/docs` with Nextra 4 + `output: "export"`, `basePath: "/gmt"`.
2. Lay out `src/app/docs/{gmt,biome,eslint,oxlint}` with `_meta.ts` per level.
3. Port `src/chat/` wholesale — it's provider-shaped only at `parseGeminiSseLine` and the worker's
   role mapping.
4. Port `worker/`; rename to `gmt-gemini-proxy`, update `CORS_ORIGINS`.
5. Rewrite `build-context.mjs` for multi-package scanning. **Decide scoping now** (§5): start with
   option B if you want it shipping this week, design the generated file as
   `Record<Scope, string>` from the start so option A is a swap, not a rewrite.
6. Add `scope` to the request body, the worker allowlist, the localStorage key, and (optionally) a
   drawer selector defaulting to the current route's package.
7. Author one `SKILL.md` per package via `@tanstack/intent scaffold`; add root fan-out scripts for
   `stale` / `validate`.
8. Generalize `sync-docs-version.mjs` to emit a version map across `packages/*`.
9. Set up: CF worker + `GEMINI_API_KEY` secret, GH `GEMINI_WORKER_URL` variable, GH Cloudflare
   secrets, GH Pages source = Actions.
10. Wire both workflows, with the docs↔worker trigger overlap from §10.

### Decisions worth making deliberately

| Decision                    | Notes                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scoped vs monolithic prompt | Four packages is the threshold where scoping starts paying off; see §5                                                                           |
| Provider                    | Gemini free tier is why this exists at zero cost. The worker is ~40 lines of provider-specific code — swappable                                  |
| Scope selector UX           | Auto-detect from route (least friction) vs explicit selector (clearer) — do both: auto-detect as the default value of a visible selector         |
| Linter rule docs            | If rule pages are generated from the linter configs, generate the MDX _before_ `build-context` runs so the AI sees the same pages the site ships |
| Cross-package questions     | Only work with "All packages" scope — make that option discoverable, or fall back to the full prompt when the scoped answer says "out of scope"  |

---

## 13. Lessons that transfer

- **Generate, don't maintain.** Route allowlists, version metadata, and the system prompt are all
  derived from the filesystem. Nothing about the AI's knowledge is hand-curated, so it can't drift.
- **One source of truth, two consumers.** The MDX scan feeds both the prompt (server) and the link
  validator (client). That symmetry is what makes hallucinated links impossible to render.
- **Validate at the edge, not in the browser.** Model allowlist, message count/length, roles, CORS,
  and rate limits all live in the worker — the client is untrusted.
- **Keep parsing pure.** The SSE parser has no React and no side effects, so streaming is testable.
- **Distinguish errors from warnings.** Rate limits and cancellations shouldn't look like crashes,
  and shouldn't poison the conversation history sent upstream.
- **Make the dev/prod boundary visible.** One env var switches worker targets, and the UI badges it.
