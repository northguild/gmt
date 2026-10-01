/**
 * The Punctuality Board widget (TRAN-57), mountable on its tool page and in the
 * chat rail.
 *
 * Arrivals on one axis against a tolerance the reader drags: each deviation in
 * exact time, early, on time or late with both edges outside, and the on-time
 * rate. The printed results are always the real `scheduleDeviation`,
 * `classifyPunctuality` and `punctualityRate` calls'; the bars and the band are
 * a picture of them. The tool's one naive value is the wall-clock reading.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`: the markup
 * is a pure string so the page can server-render it and the rail can
 * string-mount it. The rows are not editable: they come from a preset, the chat
 * or a permalink, and the tolerance is the manipulation.
 *
 * Each handle has three ways in: pointer drag, keyboard (Arrow, Shift+Arrow,
 * PageUp, PageDown, Home, End) and the typed field it writes. The axis never
 * rescales while a handle is dragged or a key is held; it refits on
 * `pointerup`, on a typed value's `change`, on a preset and on a seed.
 */
import { codeFrameHtml } from "./code-frame";
import {
  PUNCTUALITY_PRESETS,
  axisMinutes,
  barLayout,
  boardNullReason,
  boardReasonText,
  collectBoardFacts,
  CUSTOM_PRESET_ID,
  initialState,
  matchPreset,
  permalinkOf,
  rowLabel,
  rowTimeText,
  toleranceA,
  toleranceB,
  type BoardFacts,
  type BoardState,
  type PunctualityBoardArgs,
} from "./punctuality-board";
import { loadPunctualityLib } from "./punctuality-lib";
import {
  PUNCTUALITY_LABELS,
  callArgs,
  formatValue,
  isoToMinutes,
  minutesToIso,
  nextInstanceId,
  heroLinesHtml,
  setPresetDescription,
  signedText,
  spokenMinutes,
  stepMinutesFor,
  toleranceText,
  type Punctuality,
  type PunctualityLib,
} from "./punctuality-widgets";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { onceDestroy, WidgetLoadError } from "./widget-mount";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { PunctualityBoardArgs } from "./punctuality-board";

const SENTINEL = '<span class="gmt-playground-sentinel">NO SIGNAL</span>';

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    PUNCTUALITY_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function handleHtml(role: string, label: string, hidden: boolean): string {
  return `<div class="gmt-handle" data-role="${role}" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="${label}"${hidden ? " hidden" : ""}></div>`;
}

/**
 * `renderPunctualityBoardTemplate(args = {})`: the widget's chrome, seeded so
 * the first paint shows the tolerance. Seeded when `args.pairs`,
 * `args.planned1` or `args.preset` is defined, else the first preset. The
 * rows, bars and results are drawn by `mount`, because they come from the real
 * library.
 */
export function renderPunctualityBoardTemplate(
  args: PunctualityBoardArgs = {},
): string {
  const state = initialState(args);
  const presetId = matchPreset(state);
  const preset = PUNCTUALITY_PRESETS.find((p) => p.id === presetId);
  const id = nextInstanceId();

  return (
    `<div class="gmt-punctuality-board gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The arrivals and the tolerance</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `</div>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Late tolerance")}` +
    `<input class="gmt-input" data-role="late" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.late)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Early tolerance", { optional: true })}` +
    `<input class="gmt-input" data-role="early" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.early)}"${state.earlyOn ? "" : " disabled"}></label>` +
    `<label class="gmt-label">${labelTextHtml("Second late tolerance", { optional: true })}` +
    `<input class="gmt-input" data-role="compare-late" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.compareLate)}"${state.compareOn ? "" : " disabled"}></label>` +
    `<p class="gmt-widget-hint">ISO 8601 durations of exact time: PT15M, PT1H30M, P1D. A day is 24 hours.</p>` +
    `</div>` +
    `<fieldset class="gmt-chip-group"><legend>Compare</legend>` +
    chipToggleHtml({
      type: "checkbox",
      role: "early-on",
      value: "early",
      label: "Early tolerance",
      checked: state.earlyOn,
      switch: true,
    }) +
    chipToggleHtml({
      type: "checkbox",
      role: "compare-on",
      value: "compare",
      label: "A second late tolerance",
      checked: state.compareOn,
      switch: true,
    }) +
    `</fieldset>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Late, early or on time</h4>` +
    `<div class="gmt-punct-rate" data-role="rate" aria-live="polite"></div>` +
    `<div class="gmt-punct-frame">` +
    `<div class="gmt-punct-heroes" data-role="rate-heroes" aria-hidden="true"></div>` +
    `<div class="gmt-punct-grid" data-role="board" role="group" aria-label="Arrivals against the tolerance" aria-describedby="punct-summary-${id}">` +
    `<div class="gmt-punct-track-row">` +
    `<span class="gmt-punct-track-label" aria-hidden="true">Tolerance</span>` +
    `<div class="gmt-punct-track" data-role="tolerance-track">` +
    `<div class="gmt-punct-lane" data-role="lane-a" data-series="1">` +
    `<span class="gmt-punct-band" data-role="band-a" aria-hidden="true"><span class="gmt-punct-band-text gmt-cutoff-chip" data-role="band-a-text"></span></span>` +
    handleHtml("handle-early", "Early tolerance", !state.earlyOn) +
    handleHtml("handle-late", "Late tolerance", false) +
    `</div>` +
    `<div class="gmt-punct-lane" data-role="lane-b" data-series="3"${state.compareOn ? "" : " hidden"}>` +
    `<span class="gmt-punct-band gmt-punct-band--second" data-role="band-b" aria-hidden="true"><span class="gmt-punct-band-text gmt-cutoff-chip" data-role="band-b-text"></span></span>` +
    handleHtml("handle-compare", "Second late tolerance", false) +
    `</div>` +
    `</div>` +
    `</div>` +
    `<ol class="gmt-punct-rows" data-role="rows" role="list"></ol>` +
    `<div class="gmt-punct-axis-row"><div class="gmt-punct-ticks" data-role="axis-ticks" aria-hidden="true"></div></div>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-widget-hint" id="punct-summary-${id}" data-role="board-summary"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What the calls return</h4>` +
    codeFrameHtml("rate-a") +
    `<output class="gmt-widget-output" data-role="rate-output-a">&nbsp;</output>` +
    `<div class="gmt-punct-second" data-role="rate-b-block"${state.compareOn ? "" : " hidden"}>` +
    codeFrameHtml("rate-b") +
    `<output class="gmt-widget-output" data-role="rate-output-b">&nbsp;</output>` +
    `</div>` +
    `<table class="gmt-punct-table" data-role="calls-table"></table>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function wordOf(c: Punctuality | null): string {
  return c === null ? "" : PUNCTUALITY_LABELS[c];
}

function tagOf(c: Punctuality | null): string {
  const word = escapeHtml(wordOf(c));
  return c === "late" || c === "early"
    ? `<span class="gmt-punct-tag">${word}</span>`
    : word;
}

/** `"4 of 6 on time, late tolerance 15 min (PT15M)"`. */
function rateLine(
  rate: { onTime: number; total: number } | null,
  late: string,
  early: string | null,
): string {
  const tolerance =
    `late tolerance ${toleranceText(late)} (${late})` +
    (early === null
      ? ""
      : `, early tolerance ${toleranceText(early)} (${early})`);
  return rate === null
    ? `${SENTINEL} no rate, ${escapeHtml(tolerance)}`
    : `${rate.onTime} of ${rate.total} on time, ${escapeHtml(tolerance)}`;
}

function cell(value: string | null): string {
  return value === null || value === ""
    ? SENTINEL
    : escapeHtml(JSON.stringify(value));
}

interface Controller {
  release(): void;
  destroy(): void;
  state(): BoardState;
}

function setupWidget(
  root: HTMLElement,
  lib: PunctualityLib,
  start: BoardState,
): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const lateEl = q<HTMLInputElement>("late");
  const earlyEl = q<HTMLInputElement>("early");
  const compareEl = q<HTMLInputElement>("compare-late");
  const earlyOnEl = q<HTMLInputElement>("early-on");
  const compareOnEl = q<HTMLInputElement>("compare-on");
  const trackEl = q<HTMLElement>("tolerance-track");
  if (
    !presetEl ||
    !lateEl ||
    !earlyEl ||
    !compareEl ||
    !earlyOnEl ||
    !compareOnEl ||
    !trackEl
  ) {
    return { release() {}, destroy() {}, state: () => start };
  }

  let rows = start.rows;
  let rowsPreset = start.preset;
  let half = 30; // R: the axis runs from -R to +R minutes.
  let drawnTicksFor = -1;
  let destroyed = false;

  const state = (): BoardState => ({
    preset: rowsPreset,
    rows,
    late: lateEl.value,
    earlyOn: earlyOnEl.checked,
    early: earlyEl.value,
    compareOn: compareOnEl.checked,
    compareLate: compareEl.value,
  });

  /** Minutes along the axis (-R..+R) as a percent of the track. */
  const pct = (minutes: number): number =>
    Math.min(100, Math.max(0, ((minutes + half) / (2 * half)) * 100));

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        PUNCTUALITY_PRESETS.find((p) => p.id === presetEl!.value)
          ?.description ?? "",
      );
    }
  }

  /** A tolerance in minutes for the band and the bars, or `null` when the
   *  field does not read as an exact, non-negative length. */
  const lengthOf = (text: string): number | null => {
    const m = isoToMinutes(text);
    return m === null || m < 0 ? null : m;
  };

  function drawHandle(
    role: string,
    label: string,
    text: string,
    range: [number, number],
    signed: 1 | -1,
  ): void {
    const el = q(role);
    if (!el) return;
    const m = lengthOf(text);
    el.setAttribute("aria-valuemin", String(range[0]));
    el.setAttribute("aria-valuemax", String(range[1]));
    if (m === null) return;
    const value = Math.min(range[1], Math.max(range[0], signed * m));
    el.style.left = `${pct(value)}%`;
    el.setAttribute("aria-valuenow", String(Math.round(value)));
    el.setAttribute(
      "aria-valuetext",
      `${label} ${spokenMinutes(m)}, ${text.trim()}`,
    );
  }

  function drawTicks(): void {
    const row = q("axis-ticks");
    if (!row || drawnTicksFor === half) {
      if (row) thinTickLabels(row);
      return;
    }
    drawnTicksFor = half;
    const label = (m: number) =>
      m === 0
        ? "on the plan"
        : signedText(m < 0 ? `-${minutesToIso(-m)}` : minutesToIso(m));
    const marks = [-half, 0, half];
    row.innerHTML = marks
      .map((m, i) => {
        const place =
          i === 0 ? "start" : i === marks.length - 1 ? "end" : "mid";
        return `<span class="gmt-cutoff-axis-tick gmt-punct-tick--${place}" style="left:${pct(m)}%">${escapeHtml(label(m))}</span>`;
      })
      .join("");
    thinTickLabels(row);
  }

  function rowHtml(
    s: BoardState,
    facts: BoardFacts,
    i: number,
    lateMin: number | null,
    earlyMin: number | null,
  ): string {
    const r = s.rows[i]!;
    const f = facts.rows[i]!;
    const n = i + 1;
    const label = rowLabel(r.planned, r.actual);
    let bar = "";
    let delta: string;
    let words: string;
    if (f.deviation === "") {
      delta = SENTINEL;
      words = "";
    } else {
      const dev = isoToMinutes(f.deviation) ?? 0;
      const layout = barLayout(dev, lateMin, earlyMin, f.classA);
      const span = (a: number, b: number) =>
        `left:${pct(Math.min(a, b))}%;width:${Math.abs(pct(b) - pct(a))}%`;
      const inside =
        layout.inside ?? (layout.outside === null ? { from: 0, to: 0 } : null);
      // A negative deviation flips the gradient; the segment whose far end is
      // the deviation carries the cap (the outside one when there is one).
      const neg = dev < 0 ? " gmt-punct-bar--neg" : "";
      const endIn = layout.outside === null ? " gmt-punct-bar--end" : "";
      bar =
        (inside
          ? `<span class="gmt-punct-bar-in${neg}${endIn}" style="${span(inside.from, inside.to)}"></span>`
          : "") +
        (layout.outside
          ? `<span class="gmt-punct-bar-out gmt-punct-hatch${neg} gmt-punct-bar--end" style="${span(layout.outside.from, layout.outside.to)}"></span>`
          : "");
      delta = escapeHtml(signedText(f.deviation));
      words =
        f.classA === null
          ? SENTINEL
          : s.compareOn
            ? `${tagOf(f.classA)}<span class="gmt-punct-sep"> · </span><span class="gmt-punct-row-b">${escapeHtml(f.classB === null ? "no signal" : `${wordOf(f.classB)} under ${toleranceText(s.compareLate)}`)}</span>`
            : tagOf(f.classA);
    }
    const naive = facts.showNaive
      ? `<span class="gmt-punct-naive" data-role="row-naive-${n}">` +
        (f.naiveDeviation === ""
          ? `<span class="gmt-punct-naive-line">wall clock: NO SIGNAL</span><span class="gmt-punct-sep"> </span><span class="gmt-punct-naive-line">(naive)</span>`
          : `<span class="gmt-punct-naive-line">wall clock: ${escapeHtml(signedText(f.naiveDeviation))}</span><span class="gmt-punct-sep">, </span><span class="gmt-punct-naive-line">${escapeHtml(wordOf(f.naiveClass) || "no signal")} (naive)</span>`) +
        `</span>`
      : "";
    return (
      `<li class="gmt-punct-row" data-role="row-${n}">` +
      `<span class="gmt-punct-row-label" data-role="row-label-${n}">${escapeHtml(label)}</span>` +
      `<span class="gmt-punct-bar-cell" aria-hidden="true">${bar}</span>` +
      `<span class="gmt-punct-row-text"><span data-role="row-delta-${n}">${delta}</span> <span data-role="row-class-${n}">${words}</span>${naive}</span>` +
      `</li>`
    );
  }

  function summaryText(s: BoardState, facts: BoardFacts): string {
    return s.rows
      .map((r, i) => {
        const f = facts.rows[i]!;
        const head = `Arrival ${i + 1}, due ${rowTimeText(r.planned)}, came at ${rowTimeText(r.actual)}`;
        if (f.deviation === "") return `${head}: NO SIGNAL.`;
        const second = s.compareOn
          ? ` Under ${toleranceText(s.compareLate)}: ${f.classB === null ? "NO SIGNAL" : wordOf(f.classB)}.`
          : "";
        return `${head}: ${signedText(f.deviation)}, ${f.classA === null ? "NO SIGNAL" : wordOf(f.classA)}.${second}`;
      })
      .join(" ");
  }

  /** Show a band's words only when they fit clear of a handle: centred
   *  between the two handles, or after the open left edge and clear of the late
   *  handle. The rows already carry the words, so hiding them loses nothing. */
  function fitBandText(bandRole = "band-a", textRole = "band-a-text"): void {
    const band = q(bandRole);
    const label = q(textRole);
    if (!band || !label) return;
    label.hidden = false;
    const width = band.clientWidth;
    if (width === 0) return; // No layout (hidden, or jsdom): keep the words.
    const clear = 7 + 8; // half a handle, plus room to breathe
    const need =
      label.scrollWidth +
      (band.classList.contains("gmt-punct-band--open") ? clear + 4 : 2 * clear);
    label.hidden = width < need;
  }

  function fitBands(): void {
    fitBandText("band-a", "band-a-text");
    fitBandText("band-b", "band-b-text");
  }

  function render(): void {
    if (destroyed) return;
    const s = state();
    const facts = collectBoardFacts(s, lib);
    const reason = boardNullReason(s, facts, lib);
    const a = toleranceA(s);
    const b = toleranceB(s);

    // Controls that depend on the switches.
    earlyEl!.disabled = !s.earlyOn;
    compareEl!.disabled = !s.compareOn;
    const handleEarly = q("handle-early");
    if (handleEarly) handleEarly.hidden = !s.earlyOn;
    const laneB = q("lane-b");
    if (laneB) laneB.hidden = !s.compareOn;
    const blockB = q("rate-b-block");
    if (blockB) blockB.hidden = !s.compareOn;

    const lateMin = lengthOf(s.late);
    const earlyMin = s.earlyOn ? lengthOf(s.early) : null;
    const compareMin = s.compareOn ? lengthOf(s.compareLate) : null;

    // The rate header.
    const rateEl = q("rate");
    if (rateEl) {
      const earlyText =
        s.earlyOn && s.early.trim() !== "" ? s.early.trim() : null;
      let html = `<p class="gmt-transport-verdict" data-role="rate-a">${rateLine(facts.rateA, s.late.trim(), earlyText)}</p>`;
      if (s.compareOn) {
        html += `<p class="gmt-transport-verdict" data-role="rate-b">${rateLine(facts.rateB, s.compareLate.trim(), earlyText)}</p>`;
      }
      if (facts.showNaive) {
        html += `<p class="gmt-punct-naive" data-role="rate-naive">Read off the wall clocks (naive): ${
          facts.naiveRate === null
            ? SENTINEL
            : `${facts.naiveRate.onTime} of ${facts.naiveRate.total} on time`
        }</p>`;
      }
      rateEl.innerHTML = html;
    }

    // The result plates above the board: the library's own rates, large.
    const heroesEl = q("rate-heroes");
    if (heroesEl) {
      const earlyText =
        s.earlyOn && s.early.trim() !== ""
          ? `early ${toleranceText(s.early.trim())}`
          : "";
      const plate = (
        role: string,
        series: number,
        rate: { onTime: number; total: number },
        lines: readonly { text: string; sep?: string }[],
      ) =>
        `<div class="gmt-punct-hero" data-series="${series}" data-role="${role}">` +
        `<span class="gmt-punct-hero-cap">on time</span>` +
        `<span class="gmt-punct-hero-value">${rate.onTime} of ${rate.total}</span>` +
        heroLinesHtml(lines) +
        `</div>`;
      heroesEl.innerHTML =
        (facts.rateA === null
          ? ""
          : plate("rate-hero-a", 1, facts.rateA, [
              { text: `late tolerance ${toleranceText(s.late.trim())}` },
              { text: earlyText, sep: ", " },
            ])) +
        (s.compareOn && facts.rateB !== null
          ? plate("rate-hero-b", 3, facts.rateB, [
              { text: "second late tolerance" },
              { text: toleranceText(s.compareLate.trim()), sep: " " },
              { text: earlyText, sep: ", " },
            ])
          : "");
    }

    // The tolerance track: band A, band B and the handles.
    const bandA = q("band-a");
    const bandAText = q("band-a-text");
    if (bandA) {
      if (lateMin === null) {
        bandA.hidden = true;
      } else {
        bandA.hidden = false;
        const left = earlyMin === null ? 0 : pct(-earlyMin);
        bandA.style.left = `${left}%`;
        bandA.style.width = `${Math.max(0, pct(lateMin) - left)}%`;
        bandA.classList.toggle("gmt-punct-band--open", !s.earlyOn);
      }
    }
    if (bandAText) {
      bandAText.textContent = s.earlyOn ? "on time" : "← early is on time";
    }
    const bandB = q("band-b");
    const bandBText = q("band-b-text");
    if (bandB) {
      if (compareMin === null) {
        bandB.hidden = true;
      } else {
        bandB.hidden = false;
        const left = earlyMin === null ? 0 : pct(-earlyMin);
        bandB.style.left = `${left}%`;
        bandB.style.width = `${Math.max(0, pct(compareMin) - left)}%`;
        bandB.classList.toggle("gmt-punct-band--open", !s.earlyOn);
      }
    }
    if (bandBText) {
      bandBText.textContent = `${toleranceText(s.compareLate.trim())} late`;
    }

    // The band runs down every row: its edges, in percent, on the board.
    const board = q("board");
    if (board) {
      const edgeL = earlyMin === null ? 0 : pct(-earlyMin);
      board.classList.toggle("gmt-punct-grid--noband", lateMin === null);
      board.classList.toggle("gmt-punct-grid--open", !s.earlyOn);
      board.classList.toggle(
        "gmt-punct-grid--compare",
        s.compareOn && compareMin !== null,
      );
      board.style.setProperty("--band-l", `${edgeL}%`);
      board.style.setProperty(
        "--band-r",
        `${lateMin === null ? 0 : pct(lateMin)}%`,
      );
      if (compareMin === null) board.style.removeProperty("--band-b");
      else board.style.setProperty("--band-b", `${pct(compareMin)}%`);
    }
    drawHandle("handle-late", "Late tolerance", s.late, [0, half], 1);
    drawHandle("handle-early", "Early tolerance", s.early, [-half, 0], -1);
    drawHandle(
      "handle-compare",
      "Second late tolerance",
      s.compareLate,
      [0, half],
      1,
    );

    // Rows.
    const list = q("rows");
    if (list) {
      list.innerHTML = s.rows
        .map((_, i) => rowHtml(s, facts, i, lateMin, earlyMin))
        .join("");
    }
    drawTicks();
    fitBands();

    const summary = q("board-summary");
    if (summary) summary.textContent = summaryText(s, facts);

    const aside = q("reason-aside");
    if (aside) {
      if (reason) {
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(boardReasonText(reason))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // What the calls return.
    const pairs = s.rows.map((r) => ({
      planned: r.planned.trim(),
      actual: r.actual.trim(),
    }));
    const [htmlA, plainA] = callArgs([pairs, a]);
    renderCallLine(q("call-rate-a"), "punctualityRate", htmlA, plainA);
    const outA = q("rate-output-a");
    if (outA) {
      if (facts.rateA === null)
        renderWidgetOutput(outA, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(outA, formatValue(facts.rateA), "live");
    }
    if (s.compareOn) {
      const [htmlB, plainB] = callArgs([pairs, b]);
      renderCallLine(q("call-rate-b"), "punctualityRate", htmlB, plainB);
      const outB = q("rate-output-b");
      if (outB) {
        if (facts.rateB === null) {
          renderWidgetOutput(outB, "NO SIGNAL", "sentinel");
        } else renderWidgetOutput(outB, formatValue(facts.rateB), "live");
      }
    }

    const table = q("calls-table");
    if (table) {
      const head =
        `<thead><tr><th scope="col">Arrival</th><th scope="col"><code>scheduleDeviation</code></th>` +
        (s.compareOn
          ? `<th scope="col"><code>classifyPunctuality</code>, late ${escapeHtml(toleranceText(s.late))}</th><th scope="col"><code>classifyPunctuality</code>, late ${escapeHtml(toleranceText(s.compareLate))}</th>`
          : `<th scope="col"><code>classifyPunctuality</code></th>`) +
        `</tr></thead>`;
      const body = s.rows
        .map((r, i) => {
          const f = facts.rows[i]!;
          return (
            `<tr data-role="call-row-${i + 1}"><th scope="row">${escapeHtml(rowLabel(r.planned, r.actual))}</th>` +
            `<td>${cell(f.deviation)}</td><td>${cell(f.classA)}</td>` +
            (s.compareOn ? `<td>${cell(f.classB)}</td>` : "") +
            `</tr>`
          );
        })
        .join("");
      table.innerHTML = `${head}<tbody>${body}</tbody>`;
    }
  }

  function refit(): void {
    const s = state();
    half = axisMinutes(s, collectBoardFacts(s, lib));
    drawnTicksFor = -1;
    render();
  }

  function applyPreset(): void {
    const preset = PUNCTUALITY_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    const next = state();
    next.preset = preset.id;
    rows = preset.rows.map((r) => ({ ...r }));
    rowsPreset = preset.id;
    lateEl!.value = preset.late;
    earlyOnEl!.checked = preset.early !== undefined;
    earlyEl!.value = preset.early ?? next.early;
    compareOnEl!.checked = preset.compareLate !== undefined;
    compareEl!.value = preset.compareLate ?? next.compareLate;
    syncPreset();
    refit();
  }

  // ---- The three handles: one table drives drag and keyboard ----

  interface HandleSpec {
    input: HTMLInputElement;
    /** +1 when the field is the handle's value, -1 when it is its negation. */
    sign: 1 | -1;
    min: () => number;
    max: () => number;
  }
  const specs: Record<string, HandleSpec> = {
    "handle-late": {
      input: lateEl,
      sign: 1,
      min: () => 0,
      max: () => half,
    },
    "handle-early": {
      input: earlyEl,
      sign: -1,
      min: () => -half,
      max: () => 0,
    },
    "handle-compare": {
      input: compareEl,
      sign: 1,
      min: () => 0,
      max: () => half,
    },
  };

  function setHandle(role: string, value: number): void {
    const spec = specs[role];
    if (!spec) return;
    const clamped = Math.min(spec.max(), Math.max(spec.min(), value));
    spec.input.value = minutesToIso(Math.abs(Math.round(clamped)));
    syncPreset();
    render();
  }

  let dragging: string | null = null;
  let captured: { el: HTMLElement; id: number } | null = null;

  root.addEventListener("pointerdown", (e) => {
    if (destroyed) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      ".gmt-handle[data-role]",
    );
    if (!target || !specs[target.dataset.role ?? ""]) return;
    dragging = target.dataset.role ?? null;
    const id = (e as PointerEvent).pointerId;
    try {
      target.setPointerCapture(id);
      captured = { el: target, id };
    } catch {
      captured = null;
    }
    e.preventDefault();
  });

  root.addEventListener("pointermove", (e) => {
    if (destroyed || !dragging) return;
    const rect = trackEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = ((e as PointerEvent).clientX - rect.left) / rect.width;
    const step = stepMinutesFor(half);
    const minutes = -half + fraction * 2 * half;
    setHandle(dragging, Math.round(minutes / step) * step);
  });

  const stopDrag = (): void => {
    if (!dragging) return;
    dragging = null;
    captured = null;
    refit();
  };
  root.addEventListener("pointerup", stopDrag);
  root.addEventListener("pointercancel", stopDrag);

  root.addEventListener("keydown", (e) => {
    if (destroyed) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      ".gmt-handle[data-role]",
    );
    const role = target?.dataset.role ?? "";
    const spec = specs[role];
    if (!spec) return;
    const ev = e as KeyboardEvent;
    const step = stepMinutesFor(half);
    const readNow = isoToMinutes(spec.input.value.trim());
    const now = (readNow === null ? 0 : Math.abs(readNow)) * spec.sign;
    let next: number | null = null;
    switch (ev.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = now + step * (ev.shiftKey ? 10 : 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = now - step * (ev.shiftKey ? 10 : 1);
        break;
      case "PageUp":
        next = now + step * 10;
        break;
      case "PageDown":
        next = now - step * 10;
        break;
      case "Home":
        next = spec.min();
        break;
      case "End":
        next = spec.max();
        break;
    }
    if (next === null) return;
    ev.preventDefault();
    setHandle(role, next);
  });

  // ---- Typed fields, switches and the preset ----

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const target = e.target as HTMLElement;
    if (target === lateEl || target === earlyEl || target === compareEl) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
    } else if (
      target === lateEl ||
      target === earlyEl ||
      target === compareEl
    ) {
      refit();
    } else if (target === earlyOnEl || target === compareOnEl) {
      syncPreset();
      refit();
    }
  });

  wireCopyButtons(root);
  syncPreset();
  refit();

  const board = q("board");
  const refitText = (): void => {
    if (destroyed) return;
    const row = q("axis-ticks");
    if (row) thinTickLabels(row);
    fitBands();
  };
  if (board) onWidthChange(board, refitText);
  // Text measured before the web fonts swap in is the wrong width: fit again
  // once they have loaded.
  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts.ready.then(refitText);
    document.fonts.addEventListener?.("loadingdone", refitText);
  }

  return {
    state,
    release() {
      if (!captured) return;
      try {
        captured.el.releasePointerCapture(captured.id);
      } catch {
        /* Already released. */
      }
      captured = null;
    },
    destroy() {
      destroyed = true;
    },
  };
}

/** Write the state onto the controls. The page server-renders the first
 *  preset, so a permalink or chat seed has to reach the controls here. */
function writeControls(root: HTMLElement, s: BoardState): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement>(role);
    if (el) el.value = value;
  };
  set("late", s.late);
  set("early", s.early);
  set("compare-late", s.compareLate);
  const early = q<HTMLInputElement>("early-on");
  if (early) early.checked = s.earlyOn;
  const compare = q<HTMLInputElement>("compare-on");
  if (compare) compare.checked = s.compareOn;
}

export const mountPunctualityBoard = async (
  root: HTMLElement,
  args: PunctualityBoardArgs,
  signal: AbortSignal,
) => {
  let lib: PunctualityLib;
  try {
    lib = await loadPunctualityLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const start = initialState(args);
  writeControls(root, start);
  const controller = setupWidget(root, lib, start);
  const onAbort = () => {
    controller.release();
    controller.destroy();
  };
  signal.addEventListener("abort", onAbort);

  return onceDestroy(
    () => {
      signal.removeEventListener("abort", onAbort);
      controller.release();
      controller.destroy();
    },
    () => permalinkOf(controller.state()),
  );
};
