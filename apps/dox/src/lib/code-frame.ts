/**
 * The code-frame chrome, as a string — a syntax-highlighted, copiable line
 * showing the live call a widget is making.
 *
 * ## Why this is a function and `CodeFrame.astro` is a wrapper round it
 *
 * `DOX-C3b` mounts the Tier 2 widgets into the chat rail, which means their
 * markup has to come from a `renderTemplate()` string that both the `.astro`
 * page and the rail can use. A template string cannot instantiate an Astro
 * component, and `CodeFrame.astro` appears inside three of those templates.
 *
 * So the component is turned inside out: the HTML is the primitive, and the
 * `.astro` file becomes a thin `<Fragment set:html>` over it. Every existing
 * `<CodeFrame id="…" />` call site is unchanged.
 *
 * That also collapses a real duplication rather than merely relocating one.
 * `widget-ui.ts` held the same copy/check SVG path data as a pair of string
 * constants, because `wireCopyButtons` swaps between them at runtime — the
 * icon existed twice, in two files, in two forms. Now there is one copy, here,
 * and `widget-ui.ts` imports it.
 *
 * ## The one whitespace rule that actually matters
 *
 * `<pre>` and `<code>` are adjacent with **no whitespace between them**.
 * Everywhere else in this string, stray whitespace is a diff; here it is a
 * visible leading newline inside the rendered code block.
 */

/** Clipboard icon paths — the inside of the `<svg>`, so both states share one
 *  wrapper. Imported by `widget-ui.ts`, which swaps to `CHECK_ICON` on copy. */
export const COPY_ICON =
  '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';

export const CHECK_ICON = '<polyline points="20 6 9 17 4 12"></polyline>';

/**
 * @param id Suffix for the `<code>` (`call-${id}`) and copy button
 *   (`copy-${id}`) data-roles, so a widget with several frames can address
 *   each one.
 */
export function codeFrameHtml(id: string): string {
  return (
    `<div class="gmt-codeframe">` +
    `<button class="gmt-icon-button gmt-codeframe-copy" type="button" title="Copy to clipboard" data-role="copy-${id}">` +
    `<svg data-role="copy-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    COPY_ICON +
    `</svg>` +
    `</button>` +
    // No whitespace between <pre> and <code>. See the note above.
    `<pre class="gmt-codeframe-pre"><code data-role="call-${id}"></code></pre>` +
    `</div>`
  );
}
