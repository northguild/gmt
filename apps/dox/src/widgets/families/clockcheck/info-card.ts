/**
 * The two info cards of a checker's third row: "Test your own servers" (`serversCard`) and
 * "Upgrade to at least" (`minimumsCard`). Both are a full cyan border, the bevel and a faint cyan
 * wash with the info icon beside the text; never a left-edge accent. The Markdown twin of the
 * minimums card is `minimumsMarkdown` in `data/clock-change-minimums.ts`.
 */
import type { MinimumsText } from "~/data/clock-change-minimums";
import { SERVERS_TITLE } from "~/lib/clock-change-common";
import { codeFrame } from "../../builders/code-frame";
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./info-card.module.css";

const infoIcon = (): SafeHtml =>
  html`<svg
    class="${styles.icon}"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="12"
      cy="12"
      r="9.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    />
    <path
      d="M12 11v5.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
  </svg>`;

interface ServersCardOptions {
  idPrefix: string;
  /** The Node command, from `nodeProbeCommand`. */
  command: string;
  /** What the command prints on a runtime with the new data: `[city, offset]` per row. */
  expected: readonly (readonly [string, string])[];
  /** Defaults to "Test your own servers". */
  title?: string;
  /** The one plain line under the title. */
  line: string;
}

/** The command, a keyboard copy button and the expected output. */
export function serversCard(o: ServersCardOptions): SafeHtml {
  const titleId = `${o.idPrefix}-servers-title`;
  const expected = o.expected.map(
    ([city, offset], i) =>
      html`${i > 0 ? html` &middot; ` : ""}<code>${city}</code> ${offset}`,
  );
  return html`<section
    class="${styles.card}"
    ${gateAttr("servers")}
    aria-labelledby="${titleId}"
  >
    ${infoIcon()}
    <div class="${styles.body}">
      <h4 class="${styles.title}" id="${titleId}">${o.title ?? SERVERS_TITLE}</h4>
      <p>${o.line}</p>
      ${codeFrame({
        label: "Node command",
        copyText: o.command,
        copyLabel: "Copy the command",
        code: html`${o.command}`,
      })}
      <p class="${styles.expected}">Expected: ${expected}</p>
    </div>
  </section>`;
}

/** The runtimes' minimum releases: one row to a line, each with its sources. */
export function minimumsCard(idPrefix: string, text: MinimumsText): SafeHtml {
  const titleId = `${idPrefix}-minimums-title`;
  const rows = text.rows.map((row) => {
    const sources = row.sources.map(
      (s, i) =>
        html`${i > 0 ? ", " : ""}<a href="${s.href}" rel="noopener noreferrer"
          >${s.label}</a
        >`,
    );
    return html`<li>
      <strong>${row.name}</strong>
      ${row.parts.map((p) =>
        typeof p === "string" ? p : html`<code>${p.code}</code>`,
      )}
      ${
        sources.length > 0
          ? html`<span class="${styles.source}">Source: ${sources}</span>`
          : null
      }
    </li>`;
  });
  return html`<section
    class="${styles.card}"
    ${gateAttr("minimums")}
    aria-labelledby="${titleId}"
  >
    ${infoIcon()}
    <div class="${styles.body}">
      <h4 class="${styles.title}" id="${titleId}">${text.heading}</h4>
      <p>${text.intro}</p>
      <ul class="${styles.list}">
        ${rows}
      </ul>
      <p>${text.footer}</p>
      <p class="${styles.note}">${text.note}</p>
    </div>
  </section>`;
}
