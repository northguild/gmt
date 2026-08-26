# Contributing

Node.js 24.x (recommended for development; see `.nvmrc`)
pnpm (recommended package manager). Use Corepack or Volta to manage pnpm locally.

This guide covers local development, quality checks, and publishing for workspace packages.

## Prerequisites

- Node.js 24.x (see `.nvmrc`)
- pnpm (use Corepack or Volta)
- npm account with publish access to the `@northguild` org (for publishing)
- [uv](https://docs.astral.sh/uv/) (only needed to run Python-backed agent skill scripts under `.agents/skills/`)

## Local Setup

```bash
# Activate Corepack and install workspace deps
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile

# Only needed for Python-backed agent skill scripts under .agents/skills/
uv sync --extra dev

# Test skills
uv run python -m pytest .agents/skills -q
```

## Quick Reference

### Workspace commands (run from repository root)

```bash
# Test, build, typecheck
pnpm -w exec nx run-many -t test
pnpm -w exec nx run-many -t build
pnpm -w exec nx run-many -t typecheck

# Code quality
pnpm run check
pnpm run lint
pnpm run format

# Nx utilities
pnpm -w exec nx graph        # Visual dependency graph
pnpm -w exec nx sync         # Sync TypeScript project references
```

### Nx commands

```bash
# Run targets for every package
pnpm run build
pnpm run test:nx
pnpm run lint:nx
pnpm run typecheck

# Full local gate before PR
pnpm run validate

# Only run on projects affected by your branch changes
pnpm run affected:build
pnpm run affected:test
pnpm run affected:lint
pnpm run affected:typecheck

# Workspace maintenance
pnpm run graph
pnpm run sync
pnpm run sync:check
pnpm run reset
```

Recommended PR flow:

```bash
pnpm run affected:lint
pnpm run affected:test
pnpm run affected:typecheck
pnpm run affected:build
```

### Run within a specific package

```bash
cd packages/gmt
pnpm run test
pnpm run build
pnpm run lint
```

## Project Structure

```
.
├── packages/
│   ├── gmt/                    # @northguild/gmt — Give Me Temporal!
│   │   ├── src/
│   │   │   ├── duration/       # ISO 8601 duration parsing and validation
│   │   │   │   ├── parse/      # parseDuration
│   │   │   │   └── validate/   # isValidDuration
│   │   │   ├── plain/          # Timezone-free operations
│   │   │   │   ├── calculate/  # addDate, diffDateTime, subtractTime, ...
│   │   │   │   ├── compare/    # isAfterDate, isBeforeDate, areDatesEqual, ...
│   │   │   │   ├── format/     # formatDate, formatTime, formatDateTime, formatRelativeDate, ...
│   │   │   │   ├── get/        # getNow, getToday, getUnixNow, ...
│   │   │   │   ├── map/        # mapDaysInMonth, mapDatesInRange, ...
│   │   │   │   ├── parse/      # parseDateUnit, parseTimeUnit, ...
│   │   │   │   └── validate/   # isValidDate, unix validators, ...
│   │   │   ├── zoned/          # IANA timezone-aware operations
│   │   │   │   ├── calculate/  # addZoned, subtractZoned
│   │   │   │   ├── compare/    # isAfterZoned, isBeforeZoned, areZonedEqual
│   │   │   │   ├── convert/    # unix/utc/timezone conversion helpers
│   │   │   │   ├── format/     # formatZonedDateTime, formatZonedRange, formatRelativeZoned
│   │   │   │   ├── get/        # getZonedNow, getZonedToday, ...
│   │   │   │   ├── map/        # mapZonedHoursInDay, mapZonedDatesInRange
│   │   │   │   ├── parse/      # parseZonedDate, parseTimeFromZoned, ...
│   │   │   │   └── validate/   # isValidZonedDateTime, isValidTimezone
│   │   │   ├── unix/           # Unix epoch utilities
│   │   │   │   ├── calculate/  # addUnix, subtractUnix, diffUnix, ...
│   │   │   │   ├── convert/    # convertUnixToPlainDate, convertUnixToZoned, ...
│   │   │   │   ├── format/     # formatUnix, formatRelativeUnix
│   │   │   │   ├── get/        # getUnixNow, getUnixYear, ...
│   │   │   │   ├── parse/      # parseDateFromUnix, parseTimeFromUnix, ...
│   │   │   │   └── validate/   # isValidUnixSeconds, isValidUnixMilliseconds
│   │   │   ├── utc/            # UTC instant utilities
│   │   │   │   ├── calculate/  # addUtc, subtractUtc, diffUtc, ...
│   │   │   │   ├── chop/       # chopUtc
│   │   │   │   ├── convert/    # convertUtcToPlainDate, convertUtcToZoned, ...
│   │   │   │   ├── format/     # formatUtc, formatRelativeUtc
│   │   │   │   ├── get/        # getUtcNow, getUtcYear, ...
│   │   │   │   ├── parse/      # parseDateFromUtc, parseTimeFromUtc, ...
│   │   │   │   └── validate/   # isValidUtc
│   │   │   ├── regex/          # Composable regex patterns for date/time strings
│   │   │   └── package.json
│   ├── gmt-biome/              # @northguild/gmt-biome — Shared Biome config
│   │   ├── biome.json          # Consumer-facing config (uses ./plugins/ paths)
│   │   └── plugins/            # Grit plugins banning Date APIs
│   └── gmt-eslint/             # @northguild/gmt-eslint — Shared ESLint flat config
│       └── eslint/
│           └── index.mjs       # Flat config banning Date APIs
├── northguild/                  # Nx workspace configuration (internal, do not publish)
├── biome.json                   # Root Biome config — references gmt-biome plugins directly
├── eslint.config.mjs            # Root ESLint config — imports gmt-eslint
├── tsconfig.base.json           # Shared TypeScript base config
└── package.json                 # Workspace root
```

## Testing

### Pre-built Mock Functions for Error Path Testing

Use the pre-built mock functions from `packages/gmt/src/test/mocks` to test error handling paths that throw.

**Available mocks**:

- `mockTemporalNowInstantThrow()` — mocks `Temporal.Now.instant()` to throw
- `mockTemporalNowPlainDateTimeISOThrow()` — mocks `Temporal.Now.plainDateTimeISO()` to throw
- `mockTemporalNowZonedDateTimeISOThrow()` — mocks `Temporal.Now.zonedDateTimeISO()` to throw
- `mockTemporalPlainDateFromThrow()` — mocks `Temporal.PlainDate.from()` to throw
- `mockTemporalPlainDateTimeFromThrow()` — mocks `Temporal.PlainDateTime.from()` to throw
- `mockTemporalPlainTimeFromThrow()` — mocks `Temporal.PlainTime.from()` to throw
- `mockTemporalZonedDateTimeFromThrow()` — mocks `Temporal.ZonedDateTime.from()` to throw
- `mockTemporalInstantFromThrow()` — mocks `Temporal.Instant.from()` to throw

**Usage**:

```ts
import { mockTemporalPlainDateFromThrow } from "@gmt/test/mocks";

it("returns empty string when Temporal.PlainDate.from throws", () => {
  mockTemporalPlainDateFromThrow();
  const result = addDays("2024-03-10", 1);
  expect(result).toBe("");
});
```

### ICU/CLDR Wording Variance Across Node Versions

`Intl` locale output can vary between Node versions and even between runners on the _same_ Node version, since CLDR data ships embedded in Node's ICU build. Two helpers in `packages/gmt/src/test/icuVariants.ts` handle the known cases — use whichever matches the failure:

**`oneOfIcu` / `expectOneOfIcu`** — for a golden verified to differ solely by CLDR wording between ICU 77 (Node 20) and ICU 78 (Node 22/24), e.g. pt-PT's day period ("da tarde" → "p.m."), Turkish/Korean long time zone names, Hebrew/Swedish relative-time phrasing:

```ts
import { expectOneOfIcu, oneOfIcu } from "../../test";

it("formats valid time for pt-PT with 12-hour day period as one of the known ICU variants", () => {
  expectOneOfIcu(
    formatZonedDateTime(value, MustTestLocales.ptPT, options),
    oneOfIcu("03/02/2024, 02:30:45 da tarde", "03/02/2024, 02:30:45 p.m."),
  );
});
```

Only add a variant independently confirmed to come from a real ICU version — this is for masking known wording revisions, not for tolerating an unexplained mismatch.

**`expectDateTimeEqual` / `expectOneOfDateTimeIcu`** — some CI runners render the 12-hour day-period marker for ko-KR/ja-JP/zh-CN/zh-TW as ASCII `"AM"`/`"PM"` instead of the native-script word (오전/오후, 午前/午後, 上午/下午), even on the same Node version that renders the native word locally — this is host/runner-dependent, not reliably reproducible locally. Use these in place of `.toBe`/`.toEqual` (or `expectOneOfIcu`) for any golden containing one of those words:

```ts
import { expectDateTimeEqual, MustTestLocales } from "../../test";

expectDateTimeEqual(formatTime(value, MustTestLocales.koKR, options), expected);
```

**Do not** fix this by normalizing day-period words inside library source (e.g. `src/internal/normalizeDateTime.ts`) — that function's output feeds real `formatDateTime`/`formatTime`/etc. return values, so canonicalizing there silently changes production output for every caller. This is a test-comparison concern only.

## Python Agent Skill Scripts

Agent skills under `.agents/skills/` may include Python scripts (in `scripts/` subdirectories) that require a shared root-level Python environment.

### Setup

```bash
# Install the shared Python environment (run once at repo root)
uv sync --extra dev
```

### Running Tests

```bash
# Run all Python skill tests (quiet mode)
uv run python -m pytest .agents/skills -q

# Run tests for a specific skill
uv run python -m pytest .agents/skills/<skill-name> -q

# Run a single test file
uv run python -m pytest .agents/skills/<skill-name>/scripts/test_<file>.py -q
```

The shared environment is defined by the root `pyproject.toml` / `uv.lock`. Each skill's scripts run against this single venv — they do not carry their own Python environment.

## Code Quality & Conventions

### JSDoc conventions

All public methods must have comprehensive JSDoc comments with `@example` tags. This ensures proper documentation generation and helps users understand usage patterns.

#### Required JSDoc structure

```ts
/**
 * Brief description of what the function does.
 *
 * - Bullet points covering behavior, validation, edge cases, etc.
 * - Each bullet on its own line.
 *
 * @param paramName Description of the parameter
 * @returns Description of return value, or "or <sentinel> on invalid input"
 *
 * @example functionName(input) // expected output
 * @example functionName(input, options) // expected output
 * @example functionName(invalidInput) // expected output (error case)
 */
export function functionName(...): ... {}
```

#### Example with permutations

```ts
/**
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The latest date string, or null on invalid input
 *
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "also invalid"]) // null
 * @example maxDate([]) // null
 */
```

#### Key rules

1. **Use `it.each` backtick syntax** in tests (see AGENTS.md for details)
2. **Show permutations**: valid inputs, invalid inputs, edge cases, empty cases
3. **Include return type in @returns**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`
4. **No Date objects**: Use Temporal or ISO strings only (enforced elsewhere)
5. **Match return sentinel**: `""` for strings, `null` for numbers, `false` for booleans

### Error handling: Always wrap Temporal methods

Any code that calls Temporal methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) **MUST be wrapped in try-catch**.

Temporal's static methods like `Temporal.PlainDate.from()` throw `RangeError` on invalid input (e.g., malformed strings, invalid calendars). These errors must be caught and converted to the appropriate sentinel value.

**Pattern for string returns**:

```ts
export const addDays = (dateStr: string, days: number): string => {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
};
```

**Pattern for number returns**:

```ts
export function getDay = (dateStr: string): number | null {
  if (!isValidDate(dateStr)) {
    return null;
  }
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.day;
  } catch {
    return null;
  }
};
```

**Key rules**:

- Wrap the **entire block** after Zod validation (if any) that uses Temporal methods
- Return `""` for string returns, `null` for number returns, `false` for boolean returns
- Never let Temporal exceptions propagate to the caller
- The catch block should have no arguments (`catch { ... }`) since we don't need the error

### Tools

| Tool                                          | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| [Biome](https://biomejs.dev/)                 | Formatting and linting (+ Grit plugins for Date ban) |
| [TypeScript](https://www.typescriptlang.org/) | Type safety                                          |
| [Vitest](https://vitest.dev/)                 | Testing                                              |
| [Nx](https://nx.dev/)                         | Task orchestration and caching                       |

All Biome rules are in [biome.json](./biome.json) (Grit plugins live in [packages/gmt-biome/plugins/](./packages/gmt-biome/plugins/)).

### Development conventions

- Use `pnpm` for package management and scripts.
- Use `pnpm -w exec <binary>` instead of `npx`.
- Avoid Bun-specific runtime APIs (e.g. `Bun.serve`, `bun:sqlite`) — prefer standard Node.js libraries.

### PR checklist

- Ensure tests pass for affected projects.
- Ensure lint/typecheck pass for affected projects.
- Keep APIs string-in/string-out and Temporal-only.
- Add or update tests for behavior changes.
- If you added, renamed, removed, or changed the options of an exported function in `packages/gmt/src/`, update the TanStack Intent agent skills in the same PR — see "Agent Skills" below.

## Publishing

Pre-alpha. Each package follows semantic versioning and is published independently to npm.

Publishing is manual only. We use [Changesets](https://github.com/changesets/changesets) to manage per-package versioning. Nothing publishes automatically — releases are triggered by maintainers.

Two supported publish paths:

- **Local publish (recommended):** run Changesets locally with your npm credentials (passkey). This gives maintainers direct control and creates git tags when publishing.
- **GitHub Actions (optional):** run the manual `Publish Package` workflow at `.github/workflows/publish.yml` via Actions → Run workflow. The workflow reads `NPM_TOKEN` from secrets and is gated by the `release` environment.

Prerequisites for Actions-based publishing (optional):

1. Create an npm access token with `Publish` permission for the `@northguild` org at https://www.npmjs.com/.
2. Add it as a repository secret named `NPM_TOKEN` (or add it to the `release` environment) in GitHub (`Settings → Secrets` / `Settings → Environments`).

Basic Changesets workflow:

- On your feature branch, run `pnpm run changeset:add` to record the change and desired bump.
- Merge the PR. If no `.changeset/*` files were merged, create changesets before versioning — Changesets only acts on files in `.changeset/`.
- On `main`, run `pnpm run changeset:version` to apply version bumps and update changelogs; commit and push those changes.
- To publish locally, run `pnpm run changeset:publish` from the repo root — this will publish packages and create package-scoped git tags.
- If you use the Actions workflow to publish, run the workflow, then run `pnpm exec changeset tag` locally and `git push --follow-tags` to synchronize tags (Actions publish does not create tags).

Notes:

- Prefer using Changesets rather than manually bumping `package.json`; manual bumps can be used but they bypass the Changesets workflow.
- Verify packages with `npm pack --dry-run` before publishing. For `@northguild/gmt`, run the dry-run after building.
- The `Publish Package` workflow will build `@northguild/gmt` automatically when publishing that package.

See [PUBLISHING.md](./PUBLISHING.md) for the full, step-by-step guide and examples.

CI strategy:

- Pull requests run `nx affected` targets (`lint`, `test`, `typecheck`, `build`) using `NX_BASE` and `NX_HEAD`.
- Pushes to `main` run full `nx run-many` across all projects.
- `defaultBase` is set to `main` in Nx config so local affected commands behave consistently.

## Agent prompt

```
You are working with the @northguild/gmt library — a Temporal-first date/time library for JavaScript. Before writing any date-related code, read the skill files in packages/gmt/skills/ and packages/gmt/skills/_artifacts/ to understand the full API surface, naming conventions, and Temporal patterns this project uses. For maintenance procedures (stale skill detection, version bumps, artifact updates), see .agents/skills/tanstack-intent/SKILL.md.
```

## Agent Skills

`packages/gmt/skills/` contains [TanStack Intent](https://github.com/tanstack/intent) skill files that teach coding agents how to use `@northguild/gmt`'s API. They are published as part of the npm package (see `files` in `packages/gmt/package.json`) and go stale silently — nothing fails CI if a skill still references a renamed or removed function, so this is a manual discipline, not an automated gate.

Two independent things can go stale, and both matter:

1. **Skill content** — a skill file's code examples, `covers:` lists, or `library_version` no longer match the actual exports in `packages/gmt/src/`. Fix this whenever you change the public API surface, using the `/tanstack-intent` skill (or `.agents/skills/tanstack-intent/SKILL.md` directly).
2. **The `@tanstack/intent` tool itself** — the `devDependency` version (declared in `package.json` and every `packages/*/package.json`) can fall behind what's published on npm, and the CLI's frontmatter contract has changed between releases (for example, the `type`/`library`/`library_version` frontmatter fields moved under a nested `metadata:` key in a later 0.x release). Check periodically, independent of any specific feature PR:

```bash
npm view @tanstack/intent version
grep '"@tanstack/intent"' package.json packages/*/package.json
```

If behind, consult current docs (via context7/`find-docs` against `/tanstack/intent`) before bumping, since the CLI's flags and frontmatter schema are not guaranteed stable across minor versions. After bumping the version string in all four `package.json` files and running `pnpm install`, run:

```bash
pnpm exec intent validate packages/gmt/skills
```

A schema-migration failure here has a one-shot fix built into the CLI:

```bash
pnpm exec intent validate packages/gmt/skills --fix
```

And to bump every skill's `library_version` to match a new package release in one pass instead of hand-editing each `SKILL.md`:

```bash
pnpm exec intent validate packages/gmt/skills --set-version <next-version>
```

Always finish with a staleness check:

```bash
pnpm exec intent stale packages/gmt/skills
```

See `.agents/skills/tanstack-intent/SKILL.md` for the full step-by-step (deciding new skill vs. extend existing, updating `_artifacts/domain_map.yaml` and `_artifacts/skill_tree.yaml`, etc.), and `context/roadmap/index.md`'s "Instructions for the agent picking up a story" for when this is required as part of a roadmap story.
