---
story: MAR-16
issue: 197
status: approved
dox: context/dox/specs/mar-16/index.md
---

# MAR-16 — GNSS time scales, the leap-second table and TAI: implementation spec

## Scope

Story: [`issues/MAR-16.md`](../../issues/MAR-16.md) (tracker #197). It also builds all of
[SPA-48](../../issues/SPA-48.md) (#229) and `toTAI` / `fromTAI` from
[SPA-46](../../issues/SPA-46.md) (#227). GMT supports the six RINEX 4.02 §5.2.8 satellite time
scales — GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC — as peers; no system is a default (D6).

- **`timescale/`** (Core): the closed, built-in leap-second table and its queries, and
  `toTAI` / `fromTAI`.
- **`gnss/`** (cross-industry layer, drawn on by Maritime): the six system times, the week and
  rollover functions, and the RINEX week functions.
- `plain/validate/isLeapSecond` is renamed `hasSecond60`; `isLeapSecond` moves to `timescale/` as a
  table lookup (D3).

No `space/` and no `maritime/` namespace (D13). Full header text — sources, editions and how every
expected value was verified — is in [header-scope-and-verification.md](header-scope-and-verification.md).
The authority table is §0, in [s0-s1-authority-and-signatures.md](s0-s1-authority-and-signatures.md).

## Files this story touches

Library source, under `packages/gmt/src/` (signatures §1.1–1.2, helpers §1.3, wiring §5.1):

| Area | Files |
| --- | --- |
| `timescale/` | `calculate/{taiMinusUtc,leapSecondsBetween,nextLeapSecond}.ts`, `convert/{toTAI,fromTAI}.ts`, `validate/isLeapSecond.ts`; barrels `index.ts`, `calculate/`, `convert/`, `validate/`; `README.md` |
| `gnss/` | `convert/{gnssToUtc,utcToGnss,gnssWeekToUtc,utcToGnssWeek,rinexWeekToUtc,utcToRinexWeek}.ts`; barrels `index.ts`, `convert/`; `README.md` |
| `plain/validate/` | `isLeapSecond.ts` → `hasSecond60.ts` (and its test); `index.ts` |
| rename importers | the `isLeapSecond` imports in `plain/`, `internal/`, `zoned/`, `utc/` and `regex/` listed in §5.1 item 4 |
| `types/` | `gnss.ts` (new), `index.ts` |
| `internal/` | `leapSeconds.ts`, `utcReading.ts`, `timeScaleString.ts`, `gnssTimeScales.ts`, `gnssWeek.ts`, `rinexWeek.ts` (each with a test); `index.ts` |
| root | `src/index.ts` |

Every new function file has a colocated `*.test.ts`.

Package and repo (§5.2–5.8):

- `packages/gmt/package.json` — `exports` and `typesVersions` for the six new subpaths (§5.2)
- `README.md`, `packages/gmt/README.md` (§5.3)
- `apps/dox/src/lib/gmt-modules.ts` (§5.4); `apps/dox/src/lib/chat-constants.ts` (§5.5)
- `apps/dox/src/content/docs/guides/core-date-operations/leap-seconds-and-tai.mdx` and the
  Maritime pages (§5.5, §8.4)
- `skills/gmt-integration/SKILL.md`, `skills/gmt-basics/SKILL.md`, `_artifacts/` (§5.6)
- `.changeset/gnss-time-scales-and-leap-seconds.md` (§5.7)
- `scripts/leap-seconds.mjs`, `.github/workflows/leap-seconds.yml` (§5.8)
- Context docs: issue files, tracker, overview, coding standards, review checklist (§8.1–8.3)

## Slices

Each slice holds the source text verbatim, with its original headings and numbers.

| Slice | Sections | Purpose |
| --- | --- | --- |
| [header-scope-and-verification](header-scope-and-verification.md) | header | Story scope, namespaces, sources and how expected values were verified |
| [decisions-d1-d6](decisions-d1-d6.md) | D1–D6 | Closed table, SPA-48 functions, `isLeapSecond`/`hasSecond60`, `:60` input, scale strings, `GnssSystem` and week counters |
| [decisions-d7-d13](decisions-d7-d13.md) | D7–D13 | `rolloverEra`, signature order, CGPM, GLONASS, NavIC, RINEX weeks, namespaces |
| [s0-s1-authority-and-signatures](s0-s1-authority-and-signatures.md) | §0, §1, §1.1, §1.2 | Authority table; public files, signatures and types |
| [s1-3-internal-helpers](s1-3-internal-helpers.md) | §1.3 | Internal helper modules and their contracts |
| [s2-s3-validation-and-algorithms](s2-s3-validation-and-algorithms.md) | §2, §3, §3.1–§3.10 | Validation order, sentinels and the bigint-nanosecond algorithms |
| [s4-jsdoc-types-and-timescale](s4-jsdoc-types-and-timescale.md) | §4, §4.1, §4.2 | JSDoc drafts for the types and `timescale/` |
| [s4-jsdoc-gnss](s4-jsdoc-gnss.md) | §4.3, §4.4 | JSDoc drafts for `gnss/` and `hasSecond60` |
| [s5-namespace-wiring](s5-namespace-wiring.md) | §5, §5.1–§5.10 | Barrels, package exports, READMEs, Dox modules, docs placement, skills, changeset, canary |
| [s6-edge-cases-1](s6-edge-cases-1.md) | §6, §6.1–§6.7 | Test rows: table invariants, queries, `toTAI`/`fromTAI`, scale-string grammar |
| [s6-edge-cases-2](s6-edge-cases-2.md) | §6.8 | Test rows: GNSS strings |
| [s6-edge-cases-3](s6-edge-cases-3.md) | §6.9, §6.9a | Test rows: week functions and RINEX weeks |
| [s6-edge-cases-4-and-s7](s6-edge-cases-4-and-s7.md) | §6.10–§6.12, §7 | Constants against sources, shared invalid rows, cross-cutting suites; TDD slice order |
| [s8-1-issue-files](s8-1-issue-files.md) | §8, §8.1 | Edits to the MAR-16, SPA-48, SPA-46 and CORE-1 issue files |
| [s8-2-s9-docs-and-open-questions](s8-2-s9-docs-and-open-questions.md) | §8.2–§8.4, §9, §9.1–§9.4 | Tracker and overview, standards text, docs-site pages; owner decisions and open items |

## Section map

Where each numbered section lives. Other specs cite these as "L§n".

| Section | Slice |
| --- | --- |
| D1, D2, D3, D4, D5, D6 | [decisions-d1-d6](decisions-d1-d6.md) |
| D7, D8, D9, D10, D11, D12, D13 | [decisions-d7-d13](decisions-d7-d13.md) |
| §0 Authority | [s0-s1-authority-and-signatures](s0-s1-authority-and-signatures.md) |
| §1 Files and signatures, §1.1 Public, §1.2 Public types | [s0-s1-authority-and-signatures](s0-s1-authority-and-signatures.md) |
| §1.3 Internal helpers | [s1-3-internal-helpers](s1-3-internal-helpers.md) |
| §2 Validation order and sentinels | [s2-s3-validation-and-algorithms](s2-s3-validation-and-algorithms.md) |
| §3 Algorithms, §3.1, §3.2, §3.3, §3.4, §3.5, §3.6, §3.7, §3.8, §3.9, §3.10 | [s2-s3-validation-and-algorithms](s2-s3-validation-and-algorithms.md) |
| §4 JSDoc drafts, §4.1 Types, §4.2 Timescale | [s4-jsdoc-types-and-timescale](s4-jsdoc-types-and-timescale.md) |
| §4.3 GNSS, §4.4 `hasSecond60` | [s4-jsdoc-gnss](s4-jsdoc-gnss.md) |
| §5 Namespace wiring, §5.1, §5.2, §5.3, §5.4, §5.5, §5.6, §5.7, §5.8, §5.9, §5.10 | [s5-namespace-wiring](s5-namespace-wiring.md) |
| §6 Edge-case test matrix, §6.1, §6.2, §6.3, §6.4, §6.5, §6.6, §6.7 | [s6-edge-cases-1](s6-edge-cases-1.md) |
| §6.8 GNSS strings | [s6-edge-cases-2](s6-edge-cases-2.md) |
| §6.9 Week functions, §6.9a RINEX weeks | [s6-edge-cases-3](s6-edge-cases-3.md) |
| §6.10, §6.11, §6.12 | [s6-edge-cases-4-and-s7](s6-edge-cases-4-and-s7.md) |
| §7 TDD slice order | [s6-edge-cases-4-and-s7](s6-edge-cases-4-and-s7.md) |
| §8 Doc slice, §8.1 Issue files | [s8-1-issue-files](s8-1-issue-files.md) |
| §8.2 Tracker and overview, §8.3 Standards text, §8.4 Docs site pages | [s8-2-s9-docs-and-open-questions](s8-2-s9-docs-and-open-questions.md) |
| §9 Open questions, §9.1, §9.2, §9.3, §9.4 | [s8-2-s9-docs-and-open-questions](s8-2-s9-docs-and-open-questions.md) |
