## 5. Namespace wiring, file by file

Following `precision/` (a Core namespace) and `calendar/` (the namespace barrel re-exports the
polyfill first). `timescale/` is a Core namespace; `gnss/` is a cross-industry layer, the GNSS
industry, which Maritime draws on (D13).

### 5.1 Library source

1. `timescale/calculate/index.ts`: `leapSecondsBetween`, `nextLeapSecond`, `taiMinusUtc`.
   `timescale/convert/index.ts`: `fromTAI`, `toTAI`. `timescale/validate/index.ts`: `isLeapSecond`.
2. `timescale/index.ts`: polyfill re-export first (with `calendar/index.ts`'s comment), then
   `./calculate`, `./convert`, `./validate`.
3. `gnss/convert/index.ts`: the six `gnss` functions of §1.1, alphabetical. `gnss/index.ts`:
   polyfill, then `./convert`.
4. `plain/validate/index.ts`: `./isLeapSecond` → `./hasSecond60`. Update the imports in
   `isValidTime.ts`, `isValidIsoDateLike.ts`, `isValidDate.ts`, `isValidDateTime.ts`,
   `internal/calendarZonedString.ts` (code and JSDoc line 34), `zoned/validate/isValidZonedRange.ts`,
   `zoned/validate/isValidZonedDateTime.ts`, `zoned/parse/parseDateTimeFromZoned.ts`,
   `utc/validate/isValidUtc.ts`, and the JSDoc "Used by `isLeapSecond`" in `regex/leap-second.ts`.
5. `types/index.ts`: `./gnss`.
6. `internal/index.ts`: the helpers of §1.3.
7. `src/index.ts`: `export * from "./gnss";` after `./duty`; `export * from "./timescale";` after
   `./span` (alphabetical).

No `space/` and no `maritime/` directory is created (D13).

### 5.2 `packages/gmt/package.json`

`exports`, explicit entries in alphabetical position, no wildcards:

```json
"./gnss": { "types": "./dist/gnss/index.d.ts", "default": "./dist/gnss/index.js" },
"./gnss/convert": { "types": "./dist/gnss/convert/index.d.ts", "default": "./dist/gnss/convert/index.js" },
"./timescale": { "types": "./dist/timescale/index.d.ts", "default": "./dist/timescale/index.js" },
"./timescale/calculate": { "types": "./dist/timescale/calculate/index.d.ts", "default": "./dist/timescale/calculate/index.js" },
"./timescale/convert": { "types": "./dist/timescale/convert/index.d.ts", "default": "./dist/timescale/convert/index.js" },
"./timescale/validate": { "types": "./dist/timescale/validate/index.d.ts", "default": "./dist/timescale/validate/index.js" },
```

`typesVersions["*"]`: the matching six keys, each `["./dist/<path>/index.d.ts"]`.

### 5.3 READMEs

- `src/gnss/README.md`, `src/timescale/README.md`: one-line stubs (`# GNSS API`, `# Timescale API`
  plus the reference link), as `precision/README.md`.
- `README.md` and `packages/gmt/README.md` (identical): `[gnss]` and `[timescale]` in the list of
  namespaces — **not** on the "By industry:" line (`stats.mjs check` enforces both); then
  `pnpm stats:sync`. The `/update-readme` skill owns the rest.

### 5.4 `apps/dox/src/lib/gmt-modules.ts`

```ts
// --- timescale ---
"timescale/calculate": () => import("@northguild/gmt/timescale/calculate"),
"timescale/convert": () => import("@northguild/gmt/timescale/convert"),
"timescale/validate": () => import("@northguild/gmt/timescale/validate"),

// --- gnss ---
"gnss/convert": () => import("@northguild/gmt/gnss/convert"),
```

### 5.5 Docs-site placement: building blocks, and a Maritime industry layer

`timescale` and `gnss` are building blocks, so their reference pages sit among the general
namespaces. The **Maritime** industry layer carries the guide, the scenarios and the decoder tool,
showing how ships use GNSS time on the international footing: the six systems as IMO-recognised
WWRNS components, each by its own instrument and with its own recognition scope (D6), shipborne
receivers to the IEC 61108 part for each system that has one, and their output carried as
IEC 61162-1:2024 sentences.

**Why the tooling must change.** Today an industry layer is a namespace:

- `scripts/stats.mjs` `industryLayers()` takes the prefix of each
  `guides/industries/<prefix>-….mdx` file and throws "an industry guide is named for its namespace,
  and \`maritime\` exports no function" when no such namespace exports a function;
- `apps/dox/src/lib/industry-tags.ts` builds its tag ids from `gmtStats.industries` (that list);
- `industry-overview.ts`, the API Reference's "By industry" sidebar group and the README's "By
  industry:" line all key on the same ids, and the overview page is the namespace's
  `/reference/<namespace>/` index.

So a Maritime layer cannot exist without a `maritime/` namespace, and the owner has ruled out an
empty one. **Owner decision: industry layers are separated from namespaces.** Each industry is declared in
`industry-tags.ts` with the namespaces it draws on (`maritime: { namespaces: ["gnss", "timescale"] }`)
and has its own overview page. **dox-architect owns this tooling change** (`stats.mjs`,
`industry-tags.ts`, `industry-overview.ts`, the "By industry" sidebar and the README's industry line)
and the decoder tool; see the dox-architect spec. This spec supplies only the content:

- the Maritime guide, scenarios and mistakes page (§8.4) belong to the Maritime layer;
- `apps/dox/src/lib/chat-constants.ts` gains the decoder tool's `EXAMPLE_AREAS` entry and
  `CHAT_STARTERS` pill with the tool (§5.10).

The timescale guide is a Core guide either way:
`apps/dox/src/content/docs/guides/core-date-operations/leap-seconds-and-tai.mdx`, beside
`nanosecond-precision.mdx`, tagged `industries: [core]`.

### 5.6 TanStack Intent skills (`/tanstack-intent`)

- `skills/gmt-integration/SKILL.md`: a section on `timescale` (TAI, leap seconds, the closed
  built-in table) and `gnss` (system times, named week counters, `"rolling"`, RINEX weeks);
  `sources:` gains the guides and barrels.
- `skills/gmt-basics/SKILL.md` line 150: "`isLeapSecond` tells you one is there" → "`hasSecond60`
  tells you one is there; `isLeapSecond` (from `timescale`) tells you it was a real leap second."
- `_artifacts/domain_map.yaml` `covers:` and `_artifacts/skill_tree.yaml`: the new names.

### 5.7 Changeset

`.changeset/gnss-time-scales-and-leap-seconds.md`, `"@northguild/gmt": minor`, written with
`/changelog` and `/plain-english`. It names both namespaces and has a **Breaking changes** section:

| Before | After |
| --- | --- |
| `isLeapSecond(value)` from `@northguild/gmt/plain`: true for any seconds field of 60 | `hasSecond60(value)` from `@northguild/gmt/plain` |
| — | `isLeapSecond(value)` from `@northguild/gmt/timescale`: true only for the 27 inserted leap seconds; `isLeapSecond("2024-06-15T12:34:60Z")` is now `false` |

### 5.8 Leap-second canary

- `scripts/leap-seconds.mjs check`: fetch `Leap_Second.dat`, parse its rows, and compare them with
  `LEAP_SECOND_STEPS` (re-parsed from the source literal). Exit 1 with the IERS header line when any
  row differs or a row is added.
- `.github/workflows/leap-seconds.yml`: weekly `schedule` and `workflow_dispatch`, running only that
  script. **Not** in `pnpm run validate`: no network there.
- Its job until 20 May 2027 is to catch a Bulletin C 73 announcing an insertion the closed-table
  reading did not expect (TF.460-6 still allows a March month end). A new row is a data edit plus a
  `patch` changeset; the invariant tests (§6.1) check the edit.
- After that date it catches any other change IERS makes to the file's rows. It is retired, script
  and workflow together, once IERS publishes its file format for continuous UTC (owner decision,
  §9.1). The workflow's header comment says so.

### 5.9 Example checkers and the playground

No change. Every `@example` calls only root exports with literal arguments, so
`scripts/api-surface.mjs`, `test/noThrow.ts` and the Dox playground need nothing new.

### 5.10 Dox decoder tool and industry tooling — see the dox-architect spec

In scope for MAR-16 (owner decision): a GNSS week and era decoder, with its `CHAT_STARTERS` pill,
`EXAMPLE_AREAS` entry and chat-widget registration. **Designed by dox-architect**, not here. This
spec's only constraints:

- it calls the public functions of §1.1 through `GMT_MODULES["gnss/convert"]` (and
  `"timescale/…"` if it shows TAI);
- it offers the RINEX week alongside the broadcast counters, so the D12 trap is visible;
- every preset shows the functions' real output, asserted in its mount test;
- its page belongs to the Maritime industry layer (§5.5, owner decision).

---
