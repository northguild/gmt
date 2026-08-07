# Contributing

Node.js 24.x (recommended for development; see `.nvmrc`)
pnpm (recommended package manager). Use Corepack or Volta to manage pnpm locally.

This guide covers local development, quality checks, and publishing for workspace packages.

Local setup (recommended):

```bash
# Activate Corepack and install workspace deps
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
```

Common workspace commands (run from repository root):

```bash
# Run targets across the workspace
pnpm -w exec nx run-many -t build
pnpm -w exec nx run-many -t test
pnpm -w exec nx run-many -t lint
pnpm -w exec nx run-many -t typecheck

# Affected projects only
pnpm -w exec nx affected -t build
pnpm -w exec nx affected -t test
pnpm -w exec nx affected -t lint
pnpm -w exec nx affected -t typecheck
```

Nx-focused workflow examples:

```bash
# Visual dependency graph
pnpm -w exec nx graph

# Sync TypeScript project references
pnpm -w exec nx sync
pnpm -w exec nx sync:check
```

Run commands inside a specific package directory:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Package-level development

Example for the `gmt` package:

```bash
cd packages/gmt
pnpm run build
pnpm run test
pnpm run lint
```

## Publishing

Publishing is managed with Changesets and is triggered manually — nothing publishes automatically.

**See [PUBLISHING.md](./PUBLISHING.md) for the full step-by-step guide** including one-time npm org setup, how to record changesets, how to cut a release, and how git tags work in this monorepo.

For copyable commands and a quick reference, see [PUBLISHING.md](./PUBLISHING.md).

## Development conventions

- Use `pnpm` for package management and scripts.
- Use `pnpm -w exec <binary>` instead of `npx`.
- Avoid Bun-specific runtime APIs (e.g. `Bun.serve`, `bun:sqlite`) — prefer standard Node.js libraries.

## PR checklist

- Ensure tests pass for affected projects.
- Ensure lint/typecheck pass for affected projects.
- Keep APIs string-in/string-out and Temporal-only.
- Add or update tests for behavior changes.
- If you added, renamed, removed, or changed the options of an exported function in `packages/gmt/src/`, update the TanStack Intent agent skills in the same PR — see "Keeping agent skills current" below.

## Keeping agent skills current (TanStack Intent)

`packages/gmt/skills/` contains [TanStack Intent](https://github.com/tanstack/intent) skill files that teach coding agents how to use `@burglekitt/gmt`'s API. They are published as part of the npm package (see `files` in `packages/gmt/package.json`) and go stale silently — nothing fails CI if a skill still references a renamed or removed function, so this is a manual discipline, not an automated gate.

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

See `.agents/skills/tanstack-intent/SKILL.md` for the full step-by-step (deciding new skill vs. extend existing, updating `_artifacts/domain_map.yaml` and `_artifacts/skill_tree.yaml`, etc.), and `context/roadmap.md`'s "Instructions for the agent picking up a story" for when this is required as part of a roadmap story.

## Testing: Pre-built Mock Functions for Error Path Testing

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

## Testing: ICU/CLDR Wording Variance Across Node Versions

`Intl` locale output can vary between Node versions and even between runners on the *same* Node version, since CLDR data ships embedded in Node's ICU build. Two helpers in `packages/gmt/src/test/icuVariants.ts` handle the known cases — use whichever matches the failure:

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

expectDateTimeEqual(
  formatTime(value, MustTestLocales.koKR, options),
  expected,
);
```

**Do not** fix this by normalizing day-period words inside library source (e.g. `src/internal/normalizeDateTime.ts`) — that function's output feeds real `formatDateTime`/`formatTime`/etc. return values, so canonicalizing there silently changes production output for every caller. This is a test-comparison concern only.

## JSDoc conventions

All public methods must have comprehensive JSDoc comments with `@example` tags. This ensures proper documentation generation and helps users understand usage patterns.

### Required JSDoc structure

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

### Example with permutations

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

### Key rules

1. **Use `it.each` backtick syntax** in tests (see AGENTS.md for details)
2. **Show permutations**: valid inputs, invalid inputs, edge cases, empty cases
3. **Include return type in @returns**: `or "" on invalid input`, `or null on invalid input`, `or false on invalid input`
4. **No Date objects**: Use Temporal or ISO strings only (enforced elsewhere)
5. **Match return sentinel**: `""` for strings, `null` for numbers, `false` for booleans

## Error handling: Always wrap Temporal methods

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

