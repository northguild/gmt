/**
 * The presenter view as markup: pure, with no DOM. `pages/slides/<slug>/presenter.astro` renders
 * it on the server and the tests render it into jsdom. `lib/slides/presenter.ts` wires it.
 *
 * - `presenterShell`: the current slide's frame, what Next shows, the notes, the four readouts
 *   (Elapsed, Pace, Local time, Demo), the buttons and the readiness list.
 * - `readinessList`: the readiness rows, one list item each; the result is words, never colour
 *   alone (`Loaded`, `Failed: ...`).
 *
 * Every readout is the kit's `readout` with its widest forms as `samples`, so the bar keeps its
 * size while the clock runs and the pace changes side.
 */
import { button, buttonRow } from "./button";
import { html, type SafeHtml } from "./html";
import { readout } from "../primitives/readout/readout";
import styles from "./presenter.module.css";

/** The widest form of each readout, so its box is that wide from the start. */
export const PRESENTER_SAMPLES = {
  elapsed: ["59:59"],
  pace: ["+59:59 ahead", "−59:59 behind", "On pace", "Not started"],
  time: ["23:59"],
  demo: ["Recorded", "Waiting", "No demo"],
} as const;

/**
 * The signal-lost text of a clock readout, as wide as its widest sample: the default sentinel is
 * twice that, and a readout reserves the width of the longest text it may show, so four of them
 * would not share a line on a laptop.
 */
const PRESENTER_SENTINEL = "⟨ NO SIGNAL ⟩";

/** What a readout shows before the first tick. */
export const PRESENTER_INITIAL = {
  elapsed: "00:00",
  pace: "Not started",
  time: "00:00",
  demo: "No demo",
} as const;

function cell(
  key: keyof typeof PRESENTER_SAMPLES,
  label: string,
  tone?: string,
): SafeHtml {
  return html`<div class="${styles.cell}" data-pv-cell="${key}" ${tone ? html`data-tone="${tone}"` : ""}>
    <span class="${styles.cellLabel}" aria-hidden="true">${label}</span>
    ${readout({
      label,
      value: PRESENTER_INITIAL[key],
      samples: PRESENTER_SAMPLES[key],
      sentinel: PRESENTER_SENTINEL,
    })}
  </div>`;
}

export function presenterShell(): SafeHtml {
  return html`<div class="${styles.root} gmt-theme-dark" data-presenter>
    <section class="gmt-deck-panel ${styles.panel} ${styles.current}" aria-labelledby="pv-current-title">
      <h2 id="pv-current-title" class="${styles.heading}">Current slide</h2>
      <div class="${styles.stageBox}"><div class="${styles.frame} ${styles.currentFrame}" data-pv-stage></div></div>
      <p class="${styles.position}" data-pv-position></p>
      <div class="${styles.nav}">
        ${buttonRow(html`${button({ id: "pv-prev", label: "Previous" })}${button({ id: "pv-next", label: "Next" })}${button({ id: "pv-blank", label: "Blank" })}`)}
      </div>
    </section>
    <section class="gmt-deck-panel ${styles.panel} ${styles.upNext}" aria-labelledby="pv-next-title">
      <h2 id="pv-next-title" class="${styles.heading}">Next slide</h2>
      <p class="${styles.nextLabel}" data-pv-next-label></p>
      <div class="${styles.frame}" data-pv-next></div>
    </section>
    <section class="gmt-deck-panel ${styles.panel} ${styles.notes}" aria-labelledby="pv-notes-title">
      <h2 id="pv-notes-title" class="${styles.heading}">Speaker notes</h2>
      <div class="${styles.notesBody}" data-pv-notes role="group" aria-label="Speaker notes text" tabindex="0"></div>
    </section>
    <section class="gmt-deck-panel ${styles.panel} ${styles.bar}" aria-labelledby="pv-clock-title">
      <h2 id="pv-clock-title" class="${styles.heading}">Clock</h2>
      <div class="${styles.readouts}">
        ${cell("elapsed", "Elapsed")}${cell("pace", "Pace", "spring")}${cell("time", "Local time")}${cell("demo", "Demo")}
      </div>
      <p class="${styles.plan}" data-pv-plan></p>
      <div class="${styles.nav}">
        ${buttonRow(html`${button({ id: "pv-start", label: "Start" })}${button({ id: "pv-reset", label: "Reset" })}${button({ id: "pv-overview", label: "Overview" })}${button({ id: "pv-help", label: "Keys" })}`)}
      </div>
      <p class="${styles.status}" data-pv-status role="status" aria-live="polite" aria-label="Status" tabindex="0"></p>
    </section>
    <section class="gmt-deck-panel ${styles.panel} ${styles.check}" aria-labelledby="pv-check-title">
      <h2 id="pv-check-title" class="${styles.heading}">Ready to present?</h2>
      <ul class="${styles.rows}" data-pv-readiness aria-labelledby="pv-check-title" tabindex="0"></ul>
      <div class="${styles.nav}">${button({ id: "pv-check", label: "Check again" })}</div>
    </section>
  </div>`;
}

export interface ReadinessItem {
  id: string;
  label: string;
  status: "ok" | "failed";
  text: string;
}

/** The readiness rows: a label and the result in words. The status word leads the text. */
export function readinessList(rows: readonly ReadinessItem[]): SafeHtml {
  return html`${rows.map(
    (r) =>
      html`<li class="${styles.row}" data-status="${r.status}"><span class="${styles.rowLabel}">${r.label}</span><span class="${styles.rowText}">${r.text}</span></li>`,
  )}`;
}

/** A row that has not answered yet. */
export function readinessPending(labels: readonly string[]): SafeHtml {
  return html`${labels.map(
    (label) =>
      html`<li class="${styles.row}" data-status="pending"><span class="${styles.rowLabel}">${label}</span><span class="${styles.rowText}">Checking</span></li>`,
  )}`;
}
