# Slice 7 — the test kit and the test-file lint

Widget tests find elements by role, label and text, drive them with `userEvent`, and assert
with jest-dom, as Testing Library intends
([guiding principles](https://testing-library.com/docs/guiding-principles)). This slice adds
the kit and the lint that keeps tests on it. It migrates no test; slices 8c–10g migrate each
widget's test with its widget, and slice 11 ends the override list.

## Current state (verified)

- `apps/dox/vitest.config.ts`: `environment: "node"`, `globals: true`, no `setupFiles`.
  80 files opt into jsdom with `@vitest-environment jsdom`.
- `src/test/jsdom-shims.ts` says its shims are never global setup files, because about 480
  tests run in node. The setup file below must not import a DOM library in node.
- Installed: `@testing-library/dom` ^10.4.1, `@testing-library/react` 16.3.3,
  `@testing-library/user-event` 14.6.7, `axe-core` 4.13.0 (through `@axe-core/playwright`),
  jsdom ^30. Not installed: `@testing-library/jest-dom`.
- In test files: `dispatchEvent` 225 times, `fireEvent` 17, `data-role` in 56 files.
  `gnss-week-decoder-mount.test.tsx` (1003 lines) asserts a 40-item `REQUIRED_ROLES` list.
- `apps/dox/oxlint.config.mts`: `jsPlugins: ["@northguild/gmt-oxlint"]`, no `plugins` key.
  `pnpm lint` is `oxlint`.
- Probe: `eslint-plugin-testing-library` 7.16.2 (`dist/index.mjs`) and
  `eslint-plugin-jest-dom` 5.10.1 load as oxlint 1.78 `jsPlugins` and report on Dox tests
  (30 findings on two files). No ESLint install is needed.

## Files

**Add dependencies** to `apps/dox/package.json` `devDependencies`, exact versions:

| Package | Version | Why |
|---|---|---|
| `@testing-library/jest-dom` | `7.0.1` | matchers; peer `@testing-library/dom` >=10 <11 |
| `axe-core` | `4.13.0` | direct dependency, already in the lockfile |
| `eslint-plugin-testing-library` | `7.16.2` | oxlint JS plugin |
| `eslint-plugin-jest-dom` | `5.10.1` | oxlint JS plugin |

Run `pnpm install` from the repo root, then check that `pnpm-lock.yaml` changes only for these.

**Create `src/test/setup-dom.ts`** and list it in `vitest.config.ts` `test.setupFiles`.

- When `typeof document === "undefined"`, it does nothing.
- Otherwise it runs `await import("@testing-library/jest-dom/vitest")` and registers
  `afterEach(cleanup)` from `@testing-library/dom`'s React-free path.
- Update the `jsdom-shims.ts` header: shims stay opt-in, and `setup-dom.ts` is the one global
  setup file, which is a no-op in node.
- Add `"@testing-library/jest-dom"` to `compilerOptions.types` in `apps/dox/tsconfig.json`.

**Create `src/test/render-widget.ts`.** These exports are the only DOM helpers a widget test
may use:

- `renderWidget(entryOrMount, { args?, permalink? })`. It builds the root the way
  `MountedWidget.tsx` does (`renderTemplate(idPrefix, args)` into a connected element, then
  `mount(root, args, signal)`). It returns `{ user, destroy, permalink() }`, where `user` comes
  from `userEvent.setup()`.
- `destroy()` aborts the signal and asserts that the widget left no listener running (the
  existing abort tests in `widget-mount.test.ts` show how).
- `setRange(slider, value)`. This is the one sanctioned direct input event. jsdom cannot drag a
  native range input, so it sets `value` and fires `input` then `change`. It accepts an
  element that `getByRole("slider")` returned, and rejects any other element.
- `expectNoAxeViolations(container)` runs `axe-core` with `color-contrast` and `target-size`
  turned off. jsdom has no layout, so the Chromium `a11y-axe` and `contrast-measure` gates own
  those two rules. Fail with the rule id, the node's role and name, and the help text.
- `flushWidget()` awaits the widget's loader and pending microtasks. It replaces the polling
  loops (`MountedWidget.test.tsx`, slice 10g).

`<gmt-handle>` tests use the keyboard (`user.keyboard("{ArrowRight}")`), so the kit has no
geometry stub. The pointer maths is a pure function that runs in node (slice 8a). Pointer
drags run in Chromium through the `readout-still` gate.

**Create `src/test/render-widget.test.ts`.** Prove each helper on a small fixture widget:
- `setRange` throws on a non-slider;
- the axe helper fails on a button with no name;
- `destroy` catches a leaked listener.

**Create `apps/dox/lint/dox-test-rules.mjs`.** This is a local oxlint JS plugin, `.mjs`
because a `.ts` plugin needs Node 22.18 and Dox's engines allow 22.16. It has these rules:

| Rule | Reports |
|---|---|
| `dox-test/no-dispatch-event` | `dispatchEvent`, `fireEvent`, `new Event(`, `new KeyboardEvent(` |
| `dox-test/no-class-query` | `classList`, `className`, `querySelector*` and `closest` with a `.` or `[data-` selector |
| `dox-test/no-data-role` | any string or template literal that contains `data-role` or `data-testid` |
| `dox-test/no-house-class` | any string literal that contains `gmt-` followed by a letter |

`render-widget.ts` is the one file that may break these rules. Exempt it with an `overrides`
entry, not with disable comments.

**Edit `apps/dox/oxlint.config.mts`.** Add an `overrides` entry for `src/**/*.test.{ts,tsx}`:

- `jsPlugins`: the two community plugins and the local one.
- Rules: `testing-library/prefer-screen-queries`, `no-node-access`, `no-container`,
  `prefer-user-event`, `await-async-events`, `await-async-queries`, `prefer-find-by`,
  `no-unnecessary-act`, `no-wait-for-side-effects`, `prefer-presence-queries`,
  `prefer-query-by-disappearance`, every `jest-dom/*` rule, and the four `dox-test/*` rules.
  All are `"error"`.

**Legacy list.** Every test file that still breaks a rule today goes in one explicit
`overrides` entry, `files: [...]`, with the rules off. List each file by path, with no globs.
The list may only shrink: each later slice deletes its files from it, and slice 11 deletes the
entry. Add a unit test in `lint/dox-test-rules.test.ts` that fails if the list contains a
glob.

## Traps

- `@testing-library/react` re-exports `cleanup`, and RTL registers `afterEach(cleanup)` on its
  own when `globals` is true. Do not register it twice for React tests. Read RTL 16's
  auto-cleanup behaviour with ctx7 before you write `setup-dom.ts`.
- `jest-dom/vitest` extends `expect` once per worker. Do not import it in a test file as well.
- A matcher that needs layout (`toBeVisible` with a CSS-hidden ancestor) is unreliable in jsdom.
  CSS Modules return a proxy under Vitest's default `css` option and apply no styles.
- The community plugins report only on code they trace to Testing Library. The local rules cover
  raw `root.querySelector`. Both are needed.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass.
2. `pnpm lint` fails on a scratch test file (create it, run the lint, delete it) that uses each
   banned form once. Paste the four `dox-test/*` errors.
3. The legacy list names every failing test file by path, with no globs, and the guard test
   passes.
4. The node-environment test count is unchanged (`vitest run --reporter=json` totals before
   and after).
5. Run `node scripts/verdict.mjs validate` from the repo root. If it lists a `packages/gmt`
   build, stop and ask the owner.
