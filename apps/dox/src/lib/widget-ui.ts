/**
 * Shared client-side render helpers for the teaching widgets (DST Inspector,
 * Interval Visualizer). Pairs with the chrome in styles/gmt-widget.css and
 * the markup in components/CodeFrame.astro.
 *
 * These run in the browser so they must have zero Node/TS-only dependencies.
 */

// ---------------------------------------------------------------------------
// Syntax-highlighted call lines
// ---------------------------------------------------------------------------

/** Escape text for safe use inside innerHTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Wrap text in a syntax-token span. Colors are sampled from this site's own
 * Shiki output (see gmt-widget.css) so a dynamically-built call line matches
 * every static ```ts fence on the page exactly.
 */
export function codeSpan(cls: "fn" | "str" | "num", text: string): string {
  return `<span class="gmt-code-${cls}">${escapeHtml(text)}</span>`;
}

/**
 * Render a syntax-highlighted call line into a <code> element (emitted by
 * CodeFrame.astro) and stash the plain-text version on the enclosing
 * codeframe's copy button, so wireCopyButtons() has something to copy.
 */
export function renderCallLine(
  codeEl: HTMLElement | null,
  fnName: string,
  argsHtml: string,
  argsPlain: string,
): void {
  if (!codeEl) return;
  codeEl.innerHTML = `${codeSpan("fn", fnName)}(${argsHtml})`;

  const frame = codeEl.closest(".gmt-codeframe");
  const copyBtn = frame?.querySelector(
    '[data-role^="copy-"]',
  ) as HTMLButtonElement | null;
  if (copyBtn) copyBtn.dataset.copyText = `${fnName}(${argsPlain})`;
}

// ---------------------------------------------------------------------------
// Copy buttons
// ---------------------------------------------------------------------------

const COPY_ICON =
  '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
const CHECK_ICON = '<polyline points="20 6 9 17 4 12"></polyline>';

/**
 * Wire every `[data-role^="copy-"]` button inside container: on click, copies
 * the plain text stashed by renderCallLine() to the clipboard and swaps the
 * icon to a checkmark for 1.5s. Call once per widget instance at setup —
 * CodeFrame.astro's buttons are static, only their dataset changes per render.
 */
export function wireCopyButtons(container: HTMLElement): void {
  container.querySelectorAll('[data-role^="copy-"]').forEach((btn) => {
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    btn.addEventListener("click", async () => {
      const button = btn as HTMLButtonElement;
      const text = button.dataset.copyText;
      if (!text || !navigator.clipboard) return;

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard API unavailable or permission denied — nothing to fall back to.
        return;
      }

      clearTimeout(resetTimer);
      const icon = button.querySelector('[data-role="copy-icon"]');
      if (icon) icon.innerHTML = CHECK_ICON;
      button.classList.add("gmt-codeframe-copy--copied");
      const original = button.title;
      button.title = "Copied!";
      resetTimer = setTimeout(() => {
        if (icon) icon.innerHTML = COPY_ICON;
        button.classList.remove("gmt-codeframe-copy--copied");
        button.title = original;
      }, 1500);
    });
  });
}

// ---------------------------------------------------------------------------
// Result output — live / sentinel / legitimately-empty
// ---------------------------------------------------------------------------

export type WidgetOutputState = "live" | "sentinel" | "empty";

/**
 * Render a widget's result output in one of three states. The distinction
 * between "sentinel" and "empty" is load-bearing (context/dox/overview.md
 * §3): a function returning [] because two intervals genuinely don't overlap
 * is a correct answer, not invalid input, and must never look like signal-lost.
 */
export function renderWidgetOutput(
  outputEl: HTMLElement,
  text: string,
  state: WidgetOutputState,
): void {
  outputEl.classList.remove(
    "gmt-playground-live",
    "gmt-playground-sentinel",
    "gmt-widget-output--empty",
  );
  if (state === "live") {
    outputEl.classList.add("gmt-playground-live");
  } else if (state === "sentinel") {
    outputEl.classList.add("gmt-playground-sentinel");
  } else {
    outputEl.classList.add("gmt-widget-output--empty");
  }
  outputEl.textContent = text;
}

// ---------------------------------------------------------------------------
// Starlight-matching asides
// ---------------------------------------------------------------------------

// Starlight's actual aside icon paths (@astrojs/starlight/components-internals/Icons),
// so a widget's dynamic asides render identically to a real :::note/:::caution.
const ICON_INFO =
  '<path d="M12 11a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1Zm.38-3.92a1 1 0 0 0-.76 0 1 1 0 0 0-.33.21 1.15 1.15 0 0 0-.21.33 1 1 0 0 0 .21 1.09c.097.088.209.16.33.21A1 1 0 0 0 13 8a1.05 1.05 0 0 0-.29-.71 1 1 0 0 0-.33-.21ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16.001A8 8 0 0 1 12 20Z"/>';
const ICON_WARNING =
  '<path d="M12 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10.67 1.47-8.05-14a3 3 0 0 0-5.24 0l-8 14A3 3 0 0 0 3.94 22h16.12a3 3 0 0 0 2.61-4.53Zm-1.73 2a1 1 0 0 1-.88.51H3.94a1 1 0 0 1-.88-.51 1 1 0 0 1 0-1l8-14a1 1 0 0 1 1.78 0l8.05 14a1 1 0 0 1 .05 1.02v-.02ZM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1Z"/>';

export type AsideType = "note" | "caution";

/** Render a real Starlight aside (styled globally by gmt-glass.css / gmt-theme.css). */
export function renderAside(
  el: HTMLElement,
  type: AsideType,
  title: string,
  contentHtml: string,
): void {
  const icon = type === "caution" ? ICON_WARNING : ICON_INFO;
  el.innerHTML = `<aside aria-label="${title}" class="starlight-aside starlight-aside--${type}">
    <p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon">${icon}</svg>${title}</p>
    <div class="starlight-aside__content">${contentHtml}</div>
  </aside>`;
}
