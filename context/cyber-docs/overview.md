# EPIC: Dox: AI powered docs chat

## 1. Executive Summary & Architecture

This Epic details the implementation of a futuristic, cyber-themed documentation hub and real-time temporal telemetry system for the `burglekitt/gmt` monorepo.

The site features:

1. **Cyber-HUD Documentation (`/gmt/`):** Astro Starlight site styled as a sci-fi command console with live reactive Octane.js (`.tsrx`) code widgets.
2. **Interactive 3D Earth Telemetry (`/gmt/earth`):** Full-screen Three.js wireframe globe with raycasted city pins displaying real-time local clock data, GMT offsets, and timezone names fed by `packages/gmt`.
3. **AI Doc Agent Terminal (`/gmt/chat`):** Ambient 3D globe background with SSE streaming answers from Google Gemini (proxied via Cloudflare Worker) restricted strictly to repo documentation and JSDoc context. Includes browser Web Audio Text-to-Speech (TTS) and live frequency wave visualizer.

[ burglekitt/gmt Monorepo (pnpm) ]
┌─────────────────────────────────────────────────────────────────────────┐
│ packages/gmt (Core Temporal Lib) ──────┐ JSDoc AST & READMEs │
│ packages/\* (Linters & Configs) │ │
│ ▼ │
│ apps/docs (Astro + Starlight + Octane.js + Three.js) │
│ ├── src/content/docs/ (.mdx) ──────────► Ingestion Script │
│ ├── src/components/globe/ (Shared 3D Globe) │
│ ├── src/pages/earth.astro (Interactive Timezone Telemetry) │
│ ├── src/pages/chat.astro (3D AI Terminal + TTS) │
│ └── src/components/ (.tsrx) │
└─────────────────────────────────────────┬───────────────────────────────┘
│
Deploy: gh-pages (/gmt/) │ Fetch /gmt/docs-knowledge.json
▼
[ Client Browser ]
│
│ POST /api/chat (SSE Stream)
▼
[ Cloudflare Worker ]
(Gemini 2.5 Flash Proxy)

---

## 2. Tech Stack & Key Parameters

- **Monorepo Tool:** `pnpm` workspaces (`pnpm-workspace.yaml`).
- **Docs Framework:** Astro + Starlight with `@octanejs/vite-plugin` (`.tsrx` component syntax).
- **3D Graphics:** Three.js / React Three Fiber (`@react-three/fiber`, `@react-three/drei`).
- **Base Route:** `/gmt/` (Hosted at `https://burglekitt.github.io/gmt/`).
- **Knowledge Ingestion:** Recursive parsing of `/README.md`, `/packages/*/README.md`, `apps/docs/src/content/docs/**/*.mdx`, plus JSDoc comment extraction from `packages/gmt/src/**/*.ts`.
- **Backend Proxy:** Cloudflare Workers (`workers/chat-proxy`) for zero-cost Gemini 2.5 Flash API proxying.

---

## 3. Work Breakdown Structure (Tasks & Action Items)

### Phase 1: Monorepo Integration & Base Setup

**Goal:** Initialize `@gmt/docs` package in the `pnpm` workspace.

- [ ] **Task 1.1: Register Package in `pnpm` Workspace**
  - Create directory `apps/docs`.
  - Verify `pnpm-workspace.yaml` includes `'apps/*'` and `'packages/*'`.
  - Create `apps/docs/package.json` (`@gmt/docs`).
  - Add root `package.json` scripts:

    ```json
    "docs:dev": "pnpm --filter @gmt/docs dev",
    "docs:build": "pnpm --filter @gmt/docs build"
    ```

- [ ] **Task 1.2: Initialize Astro + Starlight**
  - Install dependencies in `apps/docs`: `astro`, `@astrojs/starlight`, `@astrojs/tailwind`, `tailwindcss`.
  - Configure `apps/docs/astro.config.mjs` with `site: 'https://burglekitt.github.io'` and `base: '/gmt'`.
  - Configure Starlight sidebar sections: _Overview_, _API Reference_, _Interactive Earth (`/earth`)_, and _AI Terminal (`/chat`)_.

---

### Phase 2: Cyber/HUD Design System

**Goal:** Transform standard Starlight docs into a glowing, temporal HUD terminal.

- [ ] **Task 2.1: Custom Cyber Theme (`cyber-theme.css`)**
  - Create `apps/docs/src/styles/cyber-theme.css`.
  - Override Starlight CSS variables with dark slate/black base (`#030712`), neon cyan (`#00f3ff`), and purple (`#a855f7`) accents.
  - Add SVG vector scanline pattern and monospace typography (_JetBrains Mono_ or _Fira Code_).
- [ ] **Task 2.2: Glassmorphism & HUD Styling**
  - Add utility styles for `backdrop-blur-md bg-black/70 border border-cyan-500/20`.
  - Add HUD metadata tags to headers (`[SYS.DOCS // GMT.ENGINE]`).

---

### Phase 3: Shared 3D Globe Engine (`CyberGlobe.tsx`)

**Goal:** Build a modular Three.js / React Three Fiber wireframe sphere component used in both ambient and interactive modes.

- [ ] **Task 3.1: Core Globe Geometry & Meridian Rings**
  - Install `three`, `@react-three/fiber`, `@react-three/drei` in `apps/docs`.
  - Create `apps/docs/src/components/globe/CyberGlobe.tsx`.
  - Render a wireframe sphere with glowing latitude/longitude meridian rings and an atmospheric halo.
- [ ] **Task 3.2: Coordinate Projection Utility**
  - Create `src/utils/geoTo3d.ts` converting GPS latitude/longitude to 3D Cartesian vectors (`x, y, z`) on the sphere.
- [ ] **Task 3.3: Interactive Pin Layer & Raycasting**
  - Add clickable/hoverable marker pins for key timezone cities (Helsinki, London, New York, Tokyo, Sydney, San Francisco).
  - Implement hover tooltips and selection handlers via Three.js raycasting.

---

### Phase 4: Interactive `/earth` Route

**Goal:** Build a dedicated full-screen 3D telemetry console displaying real-time timezone data using `packages/gmt`.

- [ ] **Task 4.1: Build `/earth` Page Container (`src/pages/earth.astro`)**
  - Create full-bleed layout mounting `<CyberGlobe interactive={true} />`.
- [ ] **Task 4.2: Real-time Telemetry HUD Card (`TimezoneTelemetryCard.tsrx`)**
  - Create `apps/docs/src/components/earth/TimezoneTelemetryCard.tsrx` using Octane.js.
  - Compute and display 24-hour local time, GMT offset (e.g., `UTC+3`), date, and location name for the selected globe pin in real time.

---

### Phase 5: Octane.js (`.tsrx`) Integration & Doc Islands

**Goal:** Enable `.tsrx` template syntax (`@if`, `@for`) for reactive documentation widgets.

- [ ] **Task 5.1: Configure `@octanejs/vite-plugin`**
  - Install `@octanejs/vite-plugin` and `octane` in `apps/docs`.
  - Add `octane()` plugin to `astro.config.mjs` under `vite.plugins`.
  - Configure `tsconfig.json` for `.tsrx` syntax recognition.
- [ ] **Task 5.2: Live Interactive Code Islands**
  - Create `apps/docs/src/components/InteractiveMatrix.tsrx`.
  - Embed directly into Starlight `.mdx` pages with `<InteractiveMatrix client:load/>`.

---

### Phase 6: Pre-build Knowledge Ingestion Script

**Goal:** Recursively extract README files and TypeScript JSDoc metadata across the monorepo into a single JSON knowledge bundle.

- [ ] **Task 6.1: Develop `build-knowledge-bundle.js`**
  - Create `apps/docs/scripts/build-knowledge-bundle.js`.
  - Scan `/README.md`, `/packages/*/README.md`, and `apps/docs/src/content/docs/**/*.mdx`.
  - Parse `.ts` files in `packages/gmt/src/` to extract exported function signatures and JSDoc comment blocks (`@param`, `@returns`).
  - Output clean structured JSON to `apps/docs/public/docs-knowledge.json`.
- [ ] **Task 6.2: Hook into Build Step**
  - Update `apps/docs/package.json`:

    ```json
    "build": "node scripts/build-knowledge-bundle.js && astro build"
    ```

---

### Phase 7: Cloudflare Worker Proxy & Sci-Fi `/chat` Route

**Goal:** Stream Gemini API responses through a serverless Cloudflare Worker proxy and render the full-screen AI chat route with TTS.

- [ ] **Task 7.1: Cloudflare Worker Proxy (`workers/chat-proxy`)**
  - Create `workers/chat-proxy` with `wrangler.toml`.
  - Enable CORS allowing requests from `https://burglekitt.github.io`.
  - Stream Google Gemini 2.5 Flash responses using a strict system prompt restricting output strictly to the injected `docContext`.
  - Store key securely via `wrangler secret put GEMINI_API_KEY`.
- [ ] **Task 7.2: Assemble `/chat` Route (`src/pages/chat.astro`)**
  - Mount `<CyberGlobe interactive={false} />` as a fixed low-opacity background.
  - Implement streaming message terminal UI rendered using TSRX `@for` blocks.
- [ ] **Task 7.3: Web Speech API & Frequency Wave Visualizer**
  - Integrate native `window.speechSynthesis` audio output.
  - Render active 2D Canvas frequency bars (`AudioWaveform.tsrx`) synced with speech state.

---

### Phase 8: Global `Cmd+K` Drawer & CI/CD Pipeline

**Goal:** Add instant AI access on all pages and automate deployments to GitHub Pages and Cloudflare Workers.

- [ ] **Task 8.1: Global Terminal Drawer (`AiDrawer.tsrx`)**
  - Implement drawer component triggered by global `Cmd+K` / `Ctrl+K` hotkeys or navigation button.
- [ ] **Task 8.2: GitHub Actions Deployment (`.github/workflows/deploy-docs.yml`)**
  - Trigger workflow on push to `main`.
  - Install dependencies (`pnpm install --frozen-lockfile`).
  - Build core library (`pnpm --filter @gmt/gmt build`) before building docs (`pnpm --filter @gmt/docs build`).
  - Deploy `apps/docs/dist` output to `gh-pages` branch using `actions/deploy-pages`.
  - Deploy Cloudflare Worker using `cloudflare/wrangler-action`.
