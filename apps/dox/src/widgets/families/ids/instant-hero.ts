/**
 * instantHero: the plate that names what a reading decoded to.
 *
 * A `<figure>` named by its caption, over one `<output>` that holds the instant (broken at
 * the kit's `instant` points), the NO SIGNAL pill or nothing. A reading that is not an
 * instant (the empty box, a word) keeps the plate's box: every part is a `hold` that
 * reserves the widest thing it can show, so a result never moves the page.
 *
 * - `lost` is the library's sentinel for invalid input, in amber and in words.
 * - an empty `value` with `lost` false is a legitimate empty reading, and the reason says so.
 * - `chip` (a UUID version) and `call` (a validator call) are optional slots; each reserves
 *   its size whether or not it shows.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { instant } from "../../builders/instant";
import { hold } from "./hold";
import styles from "./instant-hero.module.css";

export const NO_SIGNAL_PILL = "⟨ NO SIGNAL ⟩";

export interface ChipSlot {
  /** The chip's words; empty for none. */
  text: string;
  /** The widest chip, to reserve its box. */
  sample: string;
}

export interface CallSlot {
  /** The call and what it returned, as highlighted markup; null for none. */
  line: SafeHtml | null;
  /** The longest line it can show, as plain text. */
  sample: string;
}

export interface InstantHeroOptions {
  gate?: string;
  caption: string;
  /** Every caption the plate can show; the widest sets the caption's width. */
  captions: readonly string[];
  /** The value's accessible name. Required. */
  label: string;
  /** A state word the page can style and a test can read. */
  state: string;
  value: string;
  /** The widest value, to reserve its box. */
  sample: string;
  lost: boolean;
  /** The series bar along the bottom edge. */
  bar: boolean;
  chip: ChipSlot | null;
  call: CallSlot | null;
  reason: string;
  /** Every reason the plate can show. */
  reasons: readonly string[];
}

export function instantHero(o: InstantHeroOptions): SafeHtml {
  const value = o.lost
    ? html`<span class="${styles.pill}">${NO_SIGNAL_PILL}</span>`
    : o.value === ""
      ? ""
      : instant(o.value);
  return html`<figure class="${styles.root}" ${gateAttr(o.gate)} aria-label="${o.caption}" data-state="${o.state}" data-bar="${String(o.bar)}">
    <figcaption class="${styles.caption}">${hold(o.caption, o.captions, { ghostClass: styles.caption })}</figcaption>
    ${hold(
      html`<output class="${styles.value}" aria-label="${o.label}" aria-live="off">${value}</output>`,
      [instant(o.sample)],
      { ghostClass: styles.value },
    )}
    ${
      o.chip === null
        ? ""
        : hold(
            o.chip.text === ""
              ? ""
              : html`<span class="${styles.chip}">${o.chip.text}</span>`,
            [o.chip.sample],
            { ghostClass: styles.chip },
          )
    }
    ${
      o.call === null
        ? ""
        : hold(
            o.call.line === null
              ? ""
              : html`<p class="${styles.call}">${o.call.line}</p>`,
            [o.call.sample],
            { ghostClass: styles.call },
          )
    }
    ${hold(
      o.reason === "" ? "" : html`<p class="${styles.reason}">${o.reason}</p>`,
      o.reasons,
      { ghostClass: styles.reason },
    )}
  </figure>`;
}
