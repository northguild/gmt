---
story: DOX-G9
issue: 522
status: draft
dox: none
---

# DOX-G9 · Pulse: what GMT keeps checking

One docs page, `/pulse/`, titled `Pulse`: every scheduled check, what it
watches, when it runs, its recent runs, and the condition (never a date) that retires it. A page,
not a tool: no `CHAT_STARTERS` pill. Run history is read at build only.

**Wait first.** Other agents are changing `scripts/upstream.mjs`, `scripts/lib/upstream-trackers.mjs`,
`apps/dox/src/data/upstream-filings.*` (the `tracker` discriminant) and `cldr-sweep-weekly.yml`.
Never edit the upstream files; read filings only through `filingKey`, `filingRef`, `filingGroup`
and `UpstreamFilingRefs.astro`. Edit workflow headers only after those agents finish.
`temporal-compat.json` must be current (`pnpm compat:snapshot`, CORE-112) before checking.

## Data flow — one hand-written source, everything else derived

1. **`scripts/lib/pulse.mjs`** (Node built-ins only, no side effect on import) exports
   `PULSE_CHECKS`: `{ id, area, source, job?, step?, watches, finds, life, story }`.
   - `area`: `temporal` | `clocks` | `site`; `source`: a workflow path, or an unscheduled canary's
     test file; `watches` and `finds` (what a finding does): plain words, the only prose here.
   - `life`: `{ kind: "permanent", why }` | `{ kind: "workarounds", groups: "all" | string[] }` |
     `{ kind: "condition", until, waitsOn?: filingKey[] }`. Group ids must exist in `WORKAROUNDS`.
2. **`apps/dox/scripts/build-pulse.mjs`** (in `generate`, after `upstream.mjs refresh`) reads each
   workflow with `yaml` `parseDocument` and writes gitignored `src/generated/pulse.json`: the
   workflow `name:`, every `schedule[].cron`, job names, the list joined in. It fails the build on
   drift (the check below) and imports no gmt.
3. **Run history**, same script, at build only, best effort, mirroring the upstream refresh
   ([built.md, Tiers 0–1](../../built.md#tiers-01--site-generator-ai-surface-brand-guides), the
   `/upstream/` entries): one `gh api` call per scheduled workflow,
   `actions/workflows/<file>/runs?event=schedule&per_page=12`, 10 s budget, 6 h TTL, to gitignored
   `src/generated/pulse-runs.live.json` with `runsRead` (UTC). No token, an error or a 404 (not on
   `main` yet) leaves runs `null`. The browser never calls GitHub; the list comes from the repo.
4. **`apps/dox/src/data/pulse.ts`** loads both files and joins: workaround state and `trigger` per
   group from `temporal-compat.json` (`toCompatGroup`, `stateLine`); filings per group by
   `gmtGuard`; `waitsOn` by `filingKey`; the swap check also takes every open
   `fullcalendar/temporal-polyfill` filing. Counts come from these joins, never typed.
5. **Time is gmt's.** At build, components import `parseCronExpression`, `cronRuns` and formatting
   from the `@northguild/gmt` root (dev-alias trap, `upstream-summary.ts`); the window ends at
   `runsRead`, not the clock. In the browser, `src/lib/pulse-mount.ts` dynamic-imports `utc/get`,
   `recurrence/parse`, `recurrence/calculate` and `utc/format` after first paint, with a `deps.now`
   seam (`sunshine-protection-act-mount.ts`). No `Date`, `performance` or `Intl` anywhere.

**Drift check** (`pnpm pulse:check` = `build-pulse.mjs --check`, added to CI Story consistency
beside `upstream.mjs check`): every workflow with `on.schedule` has a list entry and the reverse;
each `job` exists; every `scripts/canary/*.mjs` and `*-canary.test.ts` is named by an entry; every
`WORKAROUNDS` group is claimed by a `workarounds` life; each source file carries
`# Pulse check: <id>` (`// Pulse check:` in a test) and no other retirement prose; the canary
overview table equals what `pnpm pulse:sync` writes between `<!-- pulse:start -->` markers.

## Cadence and runs — the rules the view applies (`src/lib/pulse-view.ts`)

- `cadenceText(cron)` accepts a fixed minute and hour with day-of-week `*` or one weekday, and
  throws on anything else: "Every Monday at 06:17 UTC", "Every day at 06:00 UTC". The weekday word
  comes from formatting the next `cronRuns` instant with gmt, locale `en`. The page says once, not
  per card, "GitHub may start a scheduled run hours late".
- `beats(cron, runs, runsRead)`: the last 8 expected times from `cronRuns(..., "UTC", ...,
  "crontabMatch")`; a run belongs to the expected time it starts after and before the next one.
  Results are words with a pattern: **Passed** (solid), **Failed** (hatched with a cross), **Did
  not finish** (cancelled, timed out: outline), **No run** (dotted gap). Never green or red.
- `runs: null`, or `runsRead` more than 8 days before the mount's now: the strip shows the amber
  NO SIGNAL state and "Run history not read in this build" or "Run history is N days old".
- The mount fills only reserved slots: "Next run in 2 days" and "read 3 hours ago"
  (`formatRelativeUtc`). It recomputes on `visibilitychange` to visible; no timer, no polling.

## Page and components

`apps/dox/src/content/docs/pulse.mdx`. Sidebar: `START_HERE` in `src/lib/section-order.ts`,
straight after `upstream` (which follows `why-gmt`) ([built.md](../../built.md#rules-that-bind-every-change), sidebar rule);
update any test that pins the Start here list.

- `components/pulse/Pulse.astro`: intro, summary, three area sections, "How a check retires".
- `PulseSummary.astro`: checks running, on a schedule, workarounds still needed, filings open.
- `PulseCard.astro`: one per workflow or unscheduled source; a workflow's checks are rows inside,
  because GitHub reports results per run, not per job (the four `temporal-oracle` checks share one
  strip). `PulseBeats.astro`: the strip, kit `timeline` lane with `mark`s. `PulseLife.astro`:
  Watching → Fixed upstream → Retired, kit `badge` per step, current step marked by word and fill.
- Kit pieces only: `plates`, `badge`, `timeline`, `disclosure`/`wireDisclosure` (the per-group
  list, closed by default), `table`, `sr-only`, `idScope`, plus `UpstreamFilingRefs.astro`. A
  missing piece is a kit addition with its APG pattern, never card markup.
- Text twin: `renderPulse` in `mdx-jsx.ts` via `replaceElements`: cadence, checks, retirement and
  last results as words; no "next run", no dot.

```text
Pulse
GMT is a living, breathing project, and its code is never finished. Every week these checks run
against the JavaScript engines, the polyfill, the world's clocks and this site. They spot a clock
rule that changes, an engine defect that is new, and the day a fix ships upstream, so its
workaround can go.
┌10 checks────┐┌6 on a schedule┐┌27 of 31 workarounds┐┌9 filings open┐
Run history read 14 November 2026, 06:02 UTC · read 3 hours ago
## Watching Temporal       [temporal-oracle card] [cldr-sweep-weekly card]
## Watching the world's clocks   [leap-seconds] [us-clock-watch] [runtime time zone data]
## Watching this site        [dox-gates-weekly] [deploy-dox: filing states]
## How a check retires       Watching ──▶ Fixed upstream ──▶ Retired
```

```text
╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲
 Temporal oracle                          temporal-oracle.yml
 Every Monday at 06:17 UTC        ◉ Next run [in 2 days    ]
 ■ ■ ▨ ■ ■ ┈ ■ ■   Last 8 · latest Passed, 9 November
 ──────────────────────────────────────────────────────────
 Workaround check (Node)    ● Watching ─ ○ Fixed upstream ─ ○ Retired
   Retires with its workarounds: 27 still needed, 2 removable, 2 guards  ▸ 31 workarounds
 Polyfill swap              Waiting on temporal-polyfill #127 #128 #131 #132
 All runs on GitHub ↗
╲━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╱  bottom accent
```

Card: full bevelled border (`corner-shape: bevel`), opaque plate, bottom accent border, never a
left-only edge. Light: ink beats on the light plate, spring only on the next-run value and its dot.
Dark: same tokens redefined; patterns in `currentColor`. Amber only for NO SIGNAL. "Next run" and
"read … ago" have reserved widths, tabular figures, `white-space: nowrap`. **Motion: one slow pulse
dot (◉) per card** beside, never on, the next-run value: shown once the mount computes the next
run, opacity and `transform` only in a fixed box, static under reduced motion. Nothing else moves.

## Files

Create: `scripts/lib/pulse.mjs`; `apps/dox/scripts/build-pulse.mjs` (+ `.test.ts`, fixture
workflows, an injected fetch); `apps/dox/src/data/pulse.ts`; `src/lib/pulse-view.ts` (+ test);
`src/lib/pulse-mount.ts` (+ test); the five components above; `pulse.mdx`.
Modify: `apps/dox/package.json` (`generate`); root `package.json` (`pulse:check`, `pulse:sync`);
`.github/workflows/ci.yml` (Story consistency step); each scheduled workflow header and
`runtime-tz-canary.test.ts` (`# Pulse check:` line, retirement prose moved to the list, day words
removed); `context/canary/overview.md` (generated table; its header rule points to the list);
`context/dox/reference/visual-design.md` (Motion list: "The Pulse next-run dot", one per card,
static under reduced motion); `section-order.ts`; `mdx-jsx.ts`; links from `upstream.mdx` (Why
this polyfill, Native engines), `native-engines.mdx` (Where the results are), `bundle-size.mdx`
(the "polyfill stays" sentence, which keeps its #316 citation).

## Definition of done

- `pnpm pulse:check` passes; deleting a list entry, a `# Pulse check:` line or a workaround claim
  each fails it (tested on fixtures). Tests never touch the network or the clock: fetch and `now`
  are injected; each mount test aborts its signal in `afterEach`, and a test proves the
  `visibilitychange` listener is gone after abort.
- `pulse-view` tests: `cadenceText` for the six live crons, a throw on `*/5 * * * *`; `beats` with
  a missing week, a 13:00 start for a 06:17 cron, `runs: null`, a 9-day-old read.
- Bounding boxes of every card, the summary readouts and the next-run slot are equal before and
  after the mount fills them and across a full dot cycle, at 360 px and 1280 px.
- With motion allowed, each card has exactly one running animation, on the dot; under reduced
  motion `getAnimations()` is empty. Both themes pass the contrast gate; every disclosure and link
  works by keyboard with a visible focus ring; no text under 12 px; axe and `frame-check` pass;
  the `.md` twin has no leftover JSX; with no `pulse-runs.live.json` every strip says NO SIGNAL.
- Close-out: `built.md` gains a present-tense `/pulse/` entry beside `/upstream/`; DOX-G9 set Done
  at close, then `pnpm deps:sync`; `pnpm run validate` green. One Dox build, last; never build
  `packages/gmt`. No changeset unless a `packages/` file changes. Do not stage, commit or push.
