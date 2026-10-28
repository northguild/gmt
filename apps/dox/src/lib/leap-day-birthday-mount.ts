/**
 * The Leap-Day Birthday widget (CORE-102), mountable on its tool page and in
 * the chat rail.
 *
 * The reader types a yearly date (a month-day, a date of birth or a date-time),
 * picks a locale and a year, by typing it or by dragging a slider. Three plates
 * read the stored `--MM-DD`, how it reads in the locale and the date it falls on
 * in that year. A table of eight consecutive years sets the library's answer
 * beside two alternatives. Everything on screen is a library call; the widget
 * computes no date (`leap-day-birthday.ts` builds the rows).
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. Dragging the slider redraws the plates and
 * the rows in place, and none of them changes size: every row and cell is laid
 * out in every state, and a slot that comes and goes is hidden, not removed.
 */
import { CONVERTER_LOCALES } from "./curated-timezones";
import { holdHtml, sizerHtml, textSizers } from "./edi-picture";
import {
  CUSTOM_PRESET_ID,
  LEAP_PRESETS,
  REASONS,
  ROW_COUNT,
  VERDICT_WORDS,
  buildModel,
  callsSizerText,
  isSeeded,
  longestMonthText,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readersYear,
  sliderRange,
  yearNumber,
  type LeapDayArgs,
  type LeapModel,
  type LeapState,
  type YearRow,
} from "./leap-day-birthday";
import { descriptionHoldHtml } from "./ledger-widgets";
import { loadMonthDayLib, type MonthDayLib } from "./month-day-lib";
import { heroLinesHtml, setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  syncRange,
} from "./widget-ui";

export type { LeapDayArgs } from "./leap-day-birthday";

/** What a cell or a plate reads when the library gave nothing. */
export const NO_SIGNAL_SHORT = "⟨ NO SIGNAL ⟩";

/** The longest English month-day, the Reads-as plate's width until a locale is read. */
const FALLBACK_READS = "September 28";

const HEADERS = [
  { text: "Year", cls: "gmt-leap-col-year" },
  { text: "gmt", cls: "gmt-leap-col-gmt" },
  { text: "Verdict", cls: "gmt-leap-col-verdict" },
  { text: "Year pasted on (naive)", cls: "gmt-leap-col-pasted" },
  { text: "1 March rule (your policy)", cls: "gmt-leap-col-policy" },
] as const;

let counter = 0;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** One plate. `sizers` are the texts its value can take, kept in a hold. */
function plateOf(
  role: string,
  caption: string,
  value: string | null,
  line: string,
  series: 1 | 2 | 3,
  sizers: readonly string[] = [],
): string {
  const text = value ?? NO_SIGNAL_SHORT;
  const live = `<span data-role="${escapeAttr(role)}-text">${escapeHtml(text)}</span>`;
  const inner =
    sizers.length === 0
      ? live
      : holdHtml(
          live,
          sizers.map((s) =>
            sizerHtml("span", "gmt-leap-plate-sizer", escapeHtml(s)),
          ),
          "gmt-ledger-hold",
        );
  return (
    `<div class="gmt-punct-hero" data-role="${escapeAttr(role)}" data-series="${series}"${value === null ? " data-signal" : ""}>` +
    `<span class="gmt-punct-hero-cap">${escapeHtml(caption)}</span>` +
    `<span class="gmt-punct-hero-value">${inner}</span>` +
    heroLinesHtml([{ text: value === null ? "" : line }]) +
    `</div>`
  );
}

function platesHtml(
  model: LeapModel,
  state: LeapState,
  readsSizers: readonly string[],
): string {
  const first = model.rows[0]!;
  const caption = first.year === null ? "In that year" : `In ${first.year}`;
  return (
    plateOf("stored", "Stored as", model.stored, "the canonical form", 1) +
    plateOf("reads", "Reads as", model.reads, state.locale, 2, readsSizers) +
    plateOf("in-year", caption, first.gmt, first.verdict, 3, [
      "+275760-09-13",
      NO_SIGNAL_SHORT,
    ])
  );
}

/** A date cell: the library's date, or NO SIGNAL (amber, bracketed). */
function dateHtml(value: string | null): string {
  return value === null
    ? `<span class="gmt-leap-date" data-signal>${escapeHtml(NO_SIGNAL_SHORT)}</span>`
    : `<span class="gmt-leap-date">${escapeHtml(value)}</span>`;
}

/** A verdict word in a hold sized by the longest word, hidden when it is blank. */
function wordHtml(word: string | null): string {
  const live = `<span class="gmt-leap-word"${word === null ? " data-off" : ""}>${escapeHtml(word ?? "")}</span>`;
  return holdHtml(
    live,
    VERDICT_WORDS.map((w) => sizerHtml("span", "gmt-leap-word", escapeHtml(w))),
    "gmt-ledger-hold",
  );
}

function rowHtml(row: YearRow): string {
  const moved = row.verdict.startsWith("moved");
  return (
    `<tr class="gmt-leap-row"${moved ? " data-moved" : ""}>` +
    `<td data-label="Year"><span class="gmt-leap-year">${row.year === null ? "-" : escapeHtml(String(row.year))}</span></td>` +
    `<td data-label="gmt">${dateHtml(row.gmt)}</td>` +
    `<td data-label="Verdict" data-verdict="${escapeAttr(row.verdict)}">${wordHtml(row.verdict)}</td>` +
    `<td data-label="Year pasted on (naive)">${dateHtml(row.pasted)}</td>` +
    `<td data-label="1 March rule (your policy)">${dateHtml(row.policy)}${wordHtml(row.policyVerdict)}</td>` +
    `</tr>`
  );
}

function tableHtml(rows: readonly YearRow[]): string {
  return (
    `<div class="gmt-leap-box"><table class="gmt-leap-table gmt-leap-table--fixed">` +
    `<thead><tr>` +
    HEADERS.map(
      (h) => `<th scope="col" class="${h.cls}">${escapeHtml(h.text)}</th>`,
    ).join("") +
    `</tr></thead><tbody data-role="rows">${rows.map(rowHtml).join("")}</tbody></table></div>`
  );
}

/** Eight rows with no result, so the table is laid out before the library loads. */
function blankRows(): YearRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({
    year: null,
    gmt: null,
    verdict: "no date" as const,
    pasted: null,
    policy: null,
    policyVerdict: null,
    calls: [],
  }));
}

function presetOptionsHtml(id: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${id === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    LEAP_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === id ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function localeOptionsHtml(locale: string): string {
  const list: readonly string[] = (
    CONVERTER_LOCALES as readonly string[]
  ).includes(locale)
    ? CONVERTER_LOCALES
    : [...CONVERTER_LOCALES, locale];
  return list
    .map(
      (l) =>
        `<option value="${escapeAttr(l)}"${l === locale ? " selected" : ""}>${escapeHtml(l)}</option>`,
    )
    .join("");
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows are drawn blank here, without
 * the library; `mount` draws every result.
 */
export function renderLeapDayBirthdayTemplate(args: LeapDayArgs = {}): string {
  const uid = `gmt-leap-day-${++counter}`;
  const state = isSeeded(args) ? readArgs(args) : presetState(LEAP_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = LEAP_PRESETS.find((p) => p.id === presetId);
  const range = sliderRange(readersYear());
  const typed = yearNumber(state.year);
  const sliderValue = Math.min(
    range.max,
    Math.max(range.min, Number.isFinite(typed) ? typed : range.min),
  );

  const blank: LeapModel = {
    stored: null,
    reads: null,
    rows: blankRows(),
    calls: [],
    reason: "input",
  };

  return (
    `<div class="gmt-leap-day gmt-widget not-content" data-uid="${uid}">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. A date with no year</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      LEAP_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-leap-value">${labelTextHtml("Birthday or yearly date")}` +
    `<input class="gmt-input gmt-mono" data-role="value" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="64" value="${escapeAttr(state.value)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Locale")}` +
    `<select class="gmt-select" data-role="locale">${localeOptionsHtml(state.locale)}</select></label>` +
    `<div class="gmt-label gmt-leap-year-field">` +
    `<label class="gmt-label-text" for="${uid}-year">Year</label>` +
    `<input class="gmt-input" id="${uid}-year" data-role="year" type="number" step="1" inputmode="numeric" value="${escapeAttr(state.year)}">` +
    `</div>` +
    `<div class="gmt-label gmt-field-wide gmt-leap-slider">` +
    `<span class="gmt-label-text">Drag the year</span>` +
    rangeFieldHtml({
      role: "year-slider",
      min: range.min,
      max: range.max,
      step: 1,
      value: sliderValue,
      valueText: String(sliderValue),
      ends: [String(range.min), String(range.max)],
      label: "Year slider",
    }) +
    `</div>` +
    `</div>` +
    `<div class="gmt-holiday-frame">` +
    `<div class="gmt-punct-heroes gmt-leap-heroes" data-role="heroes" aria-hidden="true">${platesHtml(blank, state, [FALLBACK_READS, NO_SIGNAL_SHORT])}</div>` +
    `<p class="gmt-ledger-sr" data-role="sentence" aria-live="polite"></p>` +
    `<div data-role="table">${tableHtml(blank.rows)}</div>` +
    holdHtml(
      `<p class="gmt-widget-hint gmt-leap-reason" data-role="reason"></p>`,
      textSizers(
        "p",
        "gmt-widget-hint gmt-leap-reason",
        Object.values(REASONS),
      ),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. The calls</h4>` +
    `<details class="gmt-leap-calls"><summary>Every call behind the plates and the first row</summary>` +
    // The pre sits in a hold: its hidden twin prints the widest calls
    // (`callsSizerText`), so no input wraps a line the frame has no room for.
    `<div class="gmt-ledger-hold">` +
    `<pre class="gmt-codeframe-pre"><code data-role="calls"></code></pre>` +
    `<pre class="gmt-codeframe-pre gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore><code data-role="calls-sizer">${escapeHtml(callsSizerText())}</code></pre>` +
    `</div></details>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): LeapState;
  apply(state: LeapState): void;
}

function sentenceOf(model: LeapModel, state: LeapState): string {
  if (model.stored === null) {
    return `${state.value}: no reader accepted this input.`;
  }
  const rows = model.rows
    .map((r) =>
      r.year === null || r.gmt === null
        ? `${r.year ?? "that year"}: no date`
        : `${r.year}: ${r.gmt}, ${r.verdict}`,
    )
    .join("; ");
  return `Stored as ${model.stored}, reads as ${model.reads ?? "not placed"}. ${rows}.`;
}

function setupWidget(root: HTMLElement, lib: MonthDayLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const valueEl = q<HTMLInputElement>("value")!;
  const localeEl = q<HTMLSelectElement>("locale")!;
  const yearEl = q<HTMLInputElement>("year")!;
  const sliderEl = q<HTMLInputElement>("year-slider")!;
  const presetEl = q<HTMLSelectElement>("preset")!;

  // The slider spans the reader's year plus or minus a century. The template
  // was rendered at build time, so the ends are set again from the clock here.
  const range = sliderRange(readersYear());
  sliderEl.min = String(range.min);
  sliderEl.max = String(range.max);
  const ends = sliderEl
    .closest(".gmt-range-field")
    ?.querySelectorAll<HTMLElement>(".gmt-range-ends > span");
  if (ends && ends.length === 2) {
    ends[0]!.textContent = String(range.min);
    ends[1]!.textContent = String(range.max);
  }

  let state: LeapState = presetState(LEAP_PRESETS[0]!);
  /** The locale the Reads-as plate's width was last measured for. */
  let sizedLocale = "";
  let readsSizers: string[] = [FALLBACK_READS, NO_SIGNAL_SHORT];

  /** One library call per month, on a locale change only, never during a drag. */
  function sizeReads(): void {
    if (sizedLocale === state.locale) return;
    sizedLocale = state.locale;
    const longest = longestMonthText(lib, state.locale);
    readsSizers = [longest === "" ? FALLBACK_READS : longest, NO_SIGNAL_SHORT];
  }

  function syncControls(): void {
    valueEl.value = state.value;
    yearEl.value = state.year;
    if (![...localeEl.options].some((o) => o.value === state.locale)) {
      const opt = localeEl.ownerDocument.createElement("option");
      opt.value = state.locale;
      opt.textContent = state.locale;
      localeEl.append(opt);
    }
    localeEl.value = state.locale;
  }

  function syncSlider(): void {
    const year = yearNumber(state.year);
    if (Number.isInteger(year)) {
      const clamped = Math.min(range.max, Math.max(range.min, year));
      sliderEl.value = String(clamped);
      syncRange(sliderEl, String(clamped));
    }
  }

  function syncPreset(): void {
    const id = matchPreset(state);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        LEAP_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function draw(): void {
    syncPreset();
    sizeReads();
    const model = buildModel(lib, state);

    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = platesHtml(model, state, readsSizers);

    const rows = q("rows");
    if (rows) rows.innerHTML = model.rows.map(rowHtml).join("");

    const reason = q("reason");
    if (reason) {
      reason.textContent = REASONS[model.reason];
      reason.dataset["state"] =
        model.reason === "input" ||
        model.reason === "day" ||
        model.reason === "year"
          ? "sentinel"
          : "note";
    }

    const sentence = q("sentence");
    if (sentence) sentence.textContent = sentenceOf(model, state);

    const code = q("calls");
    if (code) code.textContent = model.calls.join("\n");
  }

  function onField(e: Event): void {
    const el = e.target as HTMLElement;
    const role = el.dataset?.["role"];
    switch (role) {
      case "value":
        state.value = (el as HTMLInputElement).value;
        draw();
        break;
      case "locale":
        state.locale = (el as HTMLSelectElement).value;
        draw();
        break;
      case "year":
        state.year = (el as HTMLInputElement).value;
        syncSlider();
        draw();
        break;
      case "year-slider": {
        const slider = el as HTMLInputElement;
        state.year = slider.value;
        yearEl.value = slider.value;
        syncRange(slider, slider.value);
        draw();
        break;
      }
      case "preset": {
        if (e.type !== "change") return;
        const preset = LEAP_PRESETS.find(
          (p) => p.id === (el as HTMLSelectElement).value,
        );
        if (!preset) return;
        apply(presetState(preset));
        break;
      }
    }
  }

  root.addEventListener("input", onField);
  root.addEventListener("change", onField);

  function apply(next: LeapState): void {
    state = next;
    syncControls();
    syncSlider();
    draw();
  }

  apply(state);

  return { readState: () => state, apply };
}

export const mountLeapDayBirthday: MountFn<LeapDayArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: MonthDayLib;
  try {
    lib = await loadMonthDayLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) widget.apply(readArgs(args));

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
