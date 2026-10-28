# S3 — `/dox` shows the site header

Spec: [index.md](index.md) (D10–D12). Needs S2. Read
[design-system.md § `/dox` and the header](../../../dox/reference/design-system.md) and
[built.md § Tier 6, Shape](../../../dox/built.md) (search "One surface: `/dox`") first.

The site header is Astro with no JavaScript, so showing it on `/dox` puts no React on any other
page. Only the hidden-header override goes; every other `data-dox-shell` rule stays.

## 1. `apps/dox/src/pages/dox.astro`

- Delete the `html[data-dox-shell] .header { display: none; }` rule and its "Defect #1" comment.
- Keep the `#_top` rule, the no-scroll rules and the `.main-frame` rule. The hive shell is
  fixed (§2), so the frame's padding does not place it. Rewrite the `.main-frame` comment to
  say it removes the sidebar and title padding meant for a prose page. It does not reclaim
  header space any more.
- Rewrite item 1 of the top comment: the route keeps the site header (the same one as every
  page, WCAG 2.2 SC 3.2.3) and hides only the page `<h1>`. The chat fills the viewport below the
  header. Rewrite the closing paragraph: the chrome that is removed is the `<h1>` and the prose
  frame.

## 2. `apps/dox/src/styles/gmt-hive.css`

- `.gmt-hive-shell`: replace `inset: 0` with `inset: var(--sl-nav-height) 0 0 0`. Add one line
  to the comment above it: the shell starts below Starlight's fixed header, whose height
  `--sl-nav-height` already changes at the desktop breakpoint, so the two never overlap.
  Do not add a `z-index`; the boxes do not overlap.
- `.gmt-hive-strip`: `justify-content: space-between` becomes `flex-end`. The strip now holds
  only `.gmt-hive-strip-end`.
- Delete `.gmt-hive-back` and its `:hover` / `:focus-visible` rules.
- Check `gmt-a11y.css` and `gmt-light.css` for `.gmt-hive-back`. Delete any rule that names it.
  Leave nothing that styles a class no markup uses.

## 3. `apps/dox/src/components/ask/DoxPage.tsx`

- `<header className="gmt-hive-strip">` … `</header>` becomes `<div className="gmt-hive-strip">`
  … `</div>`. A second `<header>` at this level would be a second banner landmark.
- Delete the `<a className="gmt-hive-back" …>← @northguild/gmt</a>` element.
- Delete `import { withBase } from "~/lib/site";` if nothing else in the file uses it (today
  only the back link does). `pnpm --filter @gmt/dox lint` must not report an unused import.
- Update any comment in the file that says the strip holds the way back.

## 4. `apps/dox/src/components/Header.astro`

The Dox button now appears on the page it links to. In the frontmatter:

```ts
const onDox = stripBase(Astro.url.pathname).replace(/\/$/, "") === "/dox";
```

On the `ButtonLink` to `withBase("/dox/")`, pass `aria-current={onDox ? "page" : undefined}`.
`ButtonLink` already forwards `aria-*` attributes. Import `stripBase` from `~/lib/site`.

Give the current state a visible sign that does not rest on colour alone (WCAG 2.2 SC 1.4.1).
In `gmt-primitives.css`, beside the other `.gmt-ask-dox-link` rules, add
`.gmt-ask-dox-link[aria-current="page"]` with a 2px **bottom** border in `--gmt-cyan-ink`.
No left border and no glow (the house rule). The button's box must not change size when the
border appears: reserve it as a transparent 2px bottom border on the base rule.

## Close-out (part of this slice)

Present tense, the decision and a one-line reason, no history:

- `context/dox/built.md`, Tier 6 Shape: "One surface: `/dox` … chrome-free" becomes "One
  surface: `/dox` … under the site header, with no page title". It is reached from the header's
  "Chat with Dox" button, which carries `aria-current="page"` there.
- `context/dox/built.md`: add the NorthGuild mark to the section that lists the header, or to
  Tier 0 chrome if the header is described there. Say it links to `LANDING_URL`, and that the
  dist guard allows exactly that URL in an `<a href>`.
- `context/dox/reference/design-system.md` § `/dox` and the header: `data-dox-shell` hides only
  the `<h1>`, and the hive shell starts at `--sl-nav-height`. Add a bullet for the mark link (S2):
  a plain `<a>`, same tab, sr-only name, fills in `gmt-primitives.css`.
  § The composer control bar: "The `/dox` strip holds wayfinding, the header clock and the
  Live/Local badge" becomes "The `/dox` strip holds the header clock and the Live/Local badge;
  the site header gives the way back."
- `context/dox/reference/visual-design.md` § Colour: one bullet for the mark. The field and
  glyphs are fixed, and the body follows the theme. The `--gmt-logo-*` tokens hold every value,
  with ≥ 3:1 against every header surface (SC 1.4.11).
- `context/dox/ui-audit.md` line "`dox.astro`'s `data-dox-shell` overrides": keep the line. The
  overrides that remain are still correct.
- No tracker row and no changeset (index.md § Scope).

## Definition of done (dox-tester runs these literally)

Use the S2 build (one `pnpm --filter @gmt/dox build`; never build `packages/gmt`). Serve
`apps/dox/dist` the way the gates do. Run each check in **dark** and **light**, at **1440×900**
and **390×844**, unless it says otherwise.

1. **One header.** On `/gmt/dox/`, `.header` has a computed `display` other than `none`. It holds
   the same items as on `/gmt/install/`: compare the ordered list of
   `a, button` accessible names inside `.header` on both pages. They match, apart from
   `aria-current` on the Dox button.
2. **One banner.** On `/gmt/dox/`, Playwright's accessibility snapshot has exactly one `banner`
   landmark. `.gmt-hive-strip` is a `DIV`.
3. **No overlap.** On `/gmt/dox/`, `.gmt-hive-shell`'s `getBoundingClientRect().top` equals
   `.header`'s `bottom`, within 1px. The shell's bottom equals `innerHeight`. Repeat at
   **390×600**, the small phone height, where the empty layout is tightest.
4. **The composer fits.** At each size, with the conversation empty: the composer's textarea and
   its Send button are wholly inside the viewport. On phone, the empty-state crystal, its status
   line and the examples sheet handle are each wholly inside the viewport, and none of them is
   newly cut off compared with the `main` build at the same size. Then send one message with the
   chat stubbed as `rail-keyboard.test.tsx` does, or against a local Worker. The transcript
   scrolls inside `.gmt-hive-shell`, and `document.scrollingElement.scrollTop` stays `0`.
5. **The strip.** `.gmt-hive-strip` holds no link. Its clock and its badge (when an environment
   is set) sit at the inline end, and nothing in it is clipped:
   `scrollWidth <= clientWidth`.
6. **Current page.** On `/gmt/dox/`, `a.gmt-ask-dox-link` has `aria-current="page"` (at 1440;
   below the md breakpoint, Starlight hides the right group). On `/gmt/install/` it has none. On
   `/gmt/dox/` its computed `border-bottom-color` differs from `/gmt/install/`, and its
   bounding box is the same size on both pages.
7. **Keyboard.** On `/gmt/dox/`, from a fresh load, Tab order is: the NorthGuild mark link, the
   site title, search, then (at 1440) the Dox button, social links and theme select, then the
   chat controls. Every stop shows a visible focus ring. With a rail widget open, the walk still
   reaches the composer. Then run
   `pnpm --filter dox gates --no-build --only a11y-tab-walk,a11y-axe,a11y-media,contrast-measure`.
   It passes with no new finding.
8. **No React elsewhere.** `/gmt/install/` and one reference function page request no chunk that
   `/gmt/dox/` requests for React (compare the network logs for `react` in `.js` URLs). This is
   the same as before the change.
9. **Visual.** Run `pnpm --filter dox gates --no-build --only visual-diff,html-diff`. `/dox`
   changes, because it gains the header, and the S2 header change shows on every page. Judge
   `/dox` by eye in all four captures, empty and with one exchange. Re-baseline, and say so in
   the report. Never raise `MAX_DIFF_PIXEL_RATIO`.
10. `pnpm --filter @gmt/dox test`, `check` and `lint` pass, and the `rail-keyboard` test passes
    unchanged. Then `pnpm run validate` passes. Nothing staged and no commit.
