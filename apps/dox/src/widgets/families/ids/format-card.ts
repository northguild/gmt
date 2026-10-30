/**
 * formatCard and precisionLadder: how one stored form holds an instant, and how much of the
 * instant each form kept.
 *
 * A card is a `<section>` named by its heading, with a bottom edge in its form's series
 * colour. It shows what was stored (one or two lines), what the form reads back, and, for an
 * Arrow column with a zone, the same int64 read under a zoneless schema. A refused read is
 * the bracketed NO SIGNAL pill beside the literal the converter returned (`null`, `""` or
 * `0n`), never a blank. Every changing line is a `hold` that reserves the widest thing it
 * can show, so a reading never moves the card or its neighbours.
 *
 * - `state` is `idle` (no call made), `read` or `sentinel`.
 * - An empty `stored` list and a null `readBack` leave their boxes in place, empty.
 * - A stored line wraps at any character, so a long value never makes the card scroll.
 *
 * The ladder is a named group of four rows, one for each way the instant was kept, left
 * aligned so digits a unit dropped show as a shorter row.
 */
import { html, type SafeHtml } from "../../builders/html";
import { instant } from "../../builders/instant";
import { hold } from "./hold";
import { NO_SIGNAL_PILL } from "./instant-hero";
import styles from "./format-card.module.css";

type CardSeries = 1 | 2 | 3 | 4;

export interface FormatCardOptions {
  /** The heading's id; the section is named by it. Required. */
  headingId: string;
  title: string;
  /** Which series colour the card's bottom edge takes. */
  series: CardSeries;
  /** A form's own key, for a gate or a test to name the card by. */
  card: string;
  state: "idle" | "read" | "sentinel";
  /** The stored fields, one for each line (two at most). */
  stored: readonly string[];
  /** The instant the form reads back, or null for none. */
  readBack: string | null;
  /** Arrow only: the zoneless read of the same int64. Null for a card with no such row. */
  zoneless: { caption: string; text: string | null } | null;
  /** Whether the "wall time, not an instant" chip shows. */
  chip: boolean;
  /** The literal a refused converter returned; empty when not refused. */
  literal: string;
  /** The validator call and its answer, as highlighted markup; null for none. */
  validator: SafeHtml | null;
  /** The card's words: what an idle card says, or why a read was refused. */
  message: string;
  /** The widest of each thing, to reserve its box. */
  samples: {
    stored: readonly string[];
    readBack: string;
    chip: string;
    literal: string;
    validator: string;
    messages: readonly string[];
  };
}

const line = (text: string | undefined): SafeHtml | "" =>
  text === undefined || text === ""
    ? ""
    : html`<code class="${styles.line}">${text}</code>`;

export function formatCard(o: FormatCardOptions): SafeHtml {
  const stored = (index: number): SafeHtml =>
    hold(line(o.stored[index]), o.samples.stored, { ghostClass: styles.line });
  const readBackSample = instant(o.samples.readBack);
  return html`<section class="${styles.card}" data-card="${o.card}" data-series="${String(o.series)}" data-state="${o.state}" aria-labelledby="${o.headingId}">
    <h5 class="${styles.head}" id="${o.headingId}">${o.title}</h5>
    <div class="${styles.body}">
      <div role="group" aria-label="Stored" class="${styles.group}">
        <span class="${styles.cap}" aria-hidden="true">Stored</span>${stored(0)}${stored(1)}
      </div>
      <div role="group" aria-label="Reads back" class="${styles.group}">
        <span class="${styles.cap}" aria-hidden="true">Reads back</span>${hold(
          o.readBack === null
            ? ""
            : html`<code class="${styles.line} ${styles.wrap}">${instant(o.readBack)}</code>`,
          [readBackSample],
          { ghostClass: styles.line },
        )}
      </div>
      ${
        o.zoneless === null
          ? ""
          : html`<div role="group" aria-label="${o.zoneless.caption}" class="${styles.group}" ${o.zoneless.text === null ? html`aria-hidden="true" data-off` : ""}>
              <span class="${styles.cap}" aria-hidden="true">${o.zoneless.caption}</span>${hold(
                o.zoneless.text === null
                  ? ""
                  : html`<code class="${styles.line} ${styles.wrap}">${instant(o.zoneless.text)}</code>`,
                [readBackSample],
                { ghostClass: styles.line },
              )}
            </div>`
      }
      ${hold(
        o.chip
          ? html`<span class="${styles.chip}">${o.samples.chip}</span>`
          : "",
        [o.samples.chip],
        { ghostClass: styles.chip },
      )}
      ${hold(
        o.state === "sentinel"
          ? html`<span class="${styles.signal}"><span class="${styles.pill}">${NO_SIGNAL_PILL}</span><code class="${styles.literal}">${o.literal}</code></span>`
          : "",
        [`${NO_SIGNAL_PILL} ${o.samples.literal}`],
        { ghostClass: styles.signal },
      )}
      ${hold(
        o.validator === null
          ? ""
          : html`<p class="${styles.validator}">${o.validator}</p>`,
        [o.samples.validator],
        { ghostClass: styles.validator },
      )}
      ${hold(
        o.message === ""
          ? ""
          : html`<p class="${styles.message}">${o.message}</p>`,
        o.samples.messages,
        { ghostClass: styles.message },
      )}
    </div>
  </section>`;
}

interface LadderRowView {
  label: string;
  text: string;
}

interface PrecisionLadderOptions {
  /** The group's name. Required. */
  label: string;
  rows: readonly LadderRowView[];
  /** The widest read-back, to reserve each row. */
  sample: string;
}

export function precisionLadder(o: PrecisionLadderOptions): SafeHtml {
  return html`<div class="${styles.ladder}" role="group" aria-label="${o.label}">${o.rows.map(
    (r) =>
      html`<div class="${styles.rung}" role="group" aria-label="${r.label}"><span class="${styles.rungLabel}" aria-hidden="true">${r.label}</span>${hold(
        r.text === ""
          ? ""
          : html`<code class="${styles.rungText}">${r.text}</code>`,
        [o.sample],
        { ghostClass: styles.rungText },
      )}</div>`,
  )}</div>`;
}
