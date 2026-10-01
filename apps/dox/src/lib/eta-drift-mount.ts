/**
 * The ETA Drift Chart widget (TRAN-57), mountable on its tool page and in the
 * chat rail.
 *
 * The timestamps of one event, plotted by when each was recorded: the best
 * available pick from `bestAvailable` with its class beside the naive
 * latest-recorded pick, and how far the estimate moved from `estimateDrift`
 * against a tolerance the reader drags. The printed results are always the real
 * calls'; the marks, rings and band are a picture of them.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The
 * tolerance has three ways in: the range, the typed field, and a seed.
 */
import { codeFrameHtml } from "./code-frame";
import {
  CLASS_SERIES,
  ETA_PRESETS,
  MAX_EVENTS,
  CUSTOM_PRESET_ID,
  collectDriftFacts,
  driftNullReason,
  driftReasonText,
  indexOfPick,
  initialState,
  matchPreset,
  permalinkOf,
  plotWindow,
  plotZone,
  toleranceBand,
  visibleCount,
  xTicks,
  yTicks,
  type DriftFacts,
  type DriftState,
  type EtaDriftArgs,
} from "./eta-drift";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { loadPunctualityLib } from "./punctuality-lib";
import {
  TIMESTAMP_CLASSES,
  callArgs,
  epochMs,
  formatValue,
  isoToMinutes,
  minutesToIso,
  nextInstanceId,
  heroLinesHtml,
  setPresetDescription,
  niceMinutes,
  placeLabels,
  type Rect,
  signedText,
  spokenMinutes,
  toleranceText,
  writtenLabel,
  type PunctualityLib,
  type TimestampClass,
} from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError } from "./widget-mount";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  syncRange,
  wireCopyButtons,
} from "./widget-ui";

export type { EtaDriftArgs } from "./eta-drift";

const SENTINEL = '<span class="gmt-playground-sentinel">NO SIGNAL</span>';

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    ETA_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function sliderMax(drift: { drift: string } | null): number {
  const m = drift === null ? null : isoToMinutes(drift.drift);
  return Math.max(1440, niceMinutes(1.5 * Math.abs(m ?? 0)));
}

function eventFieldsetHtml(s: DriftState, n: number, uid: number): string {
  const e = s.events[n - 1]!;
  // The word beside the code: PLN, EST, REQ and ACT mean nothing to a reader
  // who has not met them, and the chart's legend names only the classes in use.
  const chips = TIMESTAMP_CLASSES.map(({ code, label }) =>
    chipToggleHtml({
      type: "radio",
      name: `classifier-${n}-${uid}`,
      role: `classifier-${n}`,
      value: code,
      label: `${code} ${label}`,
      checked: e.classifier === code,
    }),
  ).join("");
  return (
    `<fieldset class="gmt-transport-leg" data-role="event-${n}"${n > visibleCount(s) ? " hidden" : ""}>` +
    `<legend>Event ${n}</legend>` +
    `<fieldset class="gmt-chip-group"><legend>Class</legend>${chips}</fieldset>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("At")}` +
    `<input class="gmt-input" data-role="at-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(e.at)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Recorded at")}` +
    `<input class="gmt-input" data-role="recorded-at-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(e.recordedAt)}"></label>` +
    `</div>` +
    `</fieldset>`
  );
}

/**
 * `renderEtaDriftTemplate(args = {})`: the widget's chrome, seeded so the first
 * paint shows the events and the tolerance. Seeded when `args.events`,
 * `args.classifier1` or `args.preset` is defined, else the first preset. The
 * plot, callouts and results are drawn by `mount`, because they come from the
 * real library.
 */
export function renderEtaDriftTemplate(args: EtaDriftArgs = {}): string {
  const s = initialState(args);
  const presetId = matchPreset(s);
  const preset = ETA_PRESETS.find((p) => p.id === presetId);
  const uid = nextInstanceId();
  const count = visibleCount(s);
  const tolMin = isoToMinutes(s.tolerance);
  const max = 1440;

  const countOptions = Array.from({ length: MAX_EVENTS }, (_, i) => i + 1)
    .map(
      (n) =>
        `<option value="${n}"${n === count ? " selected" : ""}>${n}</option>`,
    )
    .join("");

  return (
    `<div class="gmt-eta-drift gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The timestamps</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Events")}` +
    `<select class="gmt-select" data-role="event-count">${countOptions}</select></label>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `</div>` +
    Array.from({ length: MAX_EVENTS }, (_, i) =>
      eventFieldsetHtml(s, i + 1, uid),
    ).join("") +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Which time, and how far it moved</h4>` +
    `<p class="gmt-punct-callout" data-role="callout-best"></p>` +
    `<p class="gmt-punct-callout gmt-punct-naive" data-role="callout-naive"></p>` +
    `<div class="gmt-punct-frame">` +
    `<div class="gmt-punct-heroes" data-role="drift-heroes" aria-hidden="true"></div>` +
    `<div class="gmt-eta-plot" data-role="drift-plot" role="img" aria-labelledby="drift-summary-${uid}">` +
    `<div class="gmt-eta-yaxis" data-role="y-ticks"></div>` +
    `<div class="gmt-eta-area" data-role="plot-area"></div>` +
    `<div class="gmt-punct-ticks gmt-eta-xticks" data-role="x-ticks"></div>` +
    `</div>` +
    `<ul class="gmt-eta-legend" data-role="legend" aria-hidden="true"></ul>` +
    `<p class="gmt-punct-callout" data-role="band-label"></p>` +
    `</div>` +
    `<p class="gmt-widget-hint">Across: when each record was recorded. Up: the time it names, later at the top.</p>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Tolerance", { optional: true })}` +
    `<input class="gmt-input" data-role="tolerance" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.tolerance)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Drag the tolerance")}` +
    rangeFieldHtml({
      role: "tolerance-slider",
      chipRole: "tolerance-value",
      min: 0,
      max,
      step: 15,
      value:
        tolMin === null ? 0 : Math.min(max, Math.max(0, Math.round(tolMin))),
      valueText: tolMin === null ? "none" : toleranceText(s.tolerance),
      ends: ["0", "24 h"],
    }) +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint" id="drift-summary-${uid}" data-role="drift-summary"></p>` +
    `<table class="gmt-punct-table" data-role="event-table"></table>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What the calls return</h4>` +
    codeFrameHtml("best") +
    `<output class="gmt-widget-output" data-role="best-output">&nbsp;</output>` +
    codeFrameHtml("drift") +
    `<output class="gmt-widget-output" data-role="drift-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

const labelOf = (text: string): string => writtenLabel(text) || text;

function classWord(code: string): string {
  return TIMESTAMP_CLASSES.find((c) => c.code === code)?.label ?? code;
}

/** A class's series, or `null` for a blank or unknown class. */
const seriesOf = (code: string): number | null =>
  Object.hasOwn(CLASS_SERIES, code)
    ? CLASS_SERIES[code as TimestampClass]
    : null;

const seriesAttr = (code: string): string => {
  const n = seriesOf(code);
  return n === null ? "" : ` data-series="${n}"`;
};

/** A class code on a chip whose border is the class's series colour. */
const chip = (code: string): string =>
  `<span class="gmt-punct-chip"${seriesAttr(code)}>${escapeHtml(code || "?")}</span>`;

/** The class's shape, inline and static: the plot mark's twin for the legend,
 *  the table and the plates. Decorative; the code beside it names the class. */
function glyphHtml(code: string): string {
  if (seriesOf(code) === null) return "";
  const inner =
    code === "REQ"
      ? `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 1.2 9.4 9H.6Z"/></svg>`
      : "";
  return `<span class="gmt-eta-glyph gmt-eta-glyph--${escapeAttr(code.toLowerCase())}" aria-hidden="true">${inner}</span>`;
}

function markHtml(code: string, left: number, top: number, n: number): string {
  const cls = code.toLowerCase();
  const inner =
    code === "REQ"
      ? `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 1.2 9.4 9H.6Z" fill="currentColor"/></svg>`
      : "";
  return `<span class="gmt-eta-mark gmt-eta-mark--${escapeAttr(cls)}"${seriesAttr(code)} data-role="mark-${n}" style="left:${left}%;top:${top}%">${inner}</span>`;
}

interface Controller {
  destroy(): void;
  state(): DriftState;
}

function setupWidget(root: HTMLElement, lib: PunctualityLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset");
  const countEl = q<HTMLSelectElement>("event-count");
  const tolEl = q<HTMLInputElement>("tolerance");
  const sliderEl = q<HTMLInputElement>("tolerance-slider");
  const area = q("plot-area");
  if (!presetEl || !countEl || !tolEl || !sliderEl || !area) {
    return { destroy() {}, state: () => initialState({}) };
  }
  let destroyed = false;

  const classifierOf = (n: number): string =>
    (
      root.querySelector(
        `[data-role="classifier-${n}"]:checked`,
      ) as HTMLInputElement | null
    )?.value ?? "";

  const state = (): DriftState => ({
    eventCount: countEl.value,
    events: Array.from({ length: MAX_EVENTS }, (_, i) => ({
      classifier: classifierOf(i + 1) as never,
      at: q<HTMLInputElement>(`at-${i + 1}`)?.value ?? "",
      recordedAt: q<HTMLInputElement>(`recorded-at-${i + 1}`)?.value ?? "",
    })),
    tolerance: tolEl.value,
  });

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        ETA_PRESETS.find((p) => p.id === presetEl!.value)?.description ?? "",
      );
    }
  }

  function syncSlider(facts: DriftFacts): void {
    const max = sliderMax(facts.drift);
    const m = isoToMinutes(tolEl!.value.trim());
    sliderEl!.max = String(max);
    sliderEl!.disabled = false;
    const readable = m !== null && m >= 0;
    sliderEl!.value = String(readable ? Math.min(max, Math.round(m)) : 0);
    syncRange(sliderEl!);
    const text = tolEl!.value.trim();
    sliderEl!.setAttribute(
      "aria-valuetext",
      readable
        ? `Tolerance ${spokenMinutes(m)}, ${text}`
        : text === ""
          ? "No tolerance"
          : "Tolerance is not a duration",
    );
    const chipEl = q("tolerance-value");
    if (chipEl) {
      chipEl.textContent = readable
        ? toleranceText(text)
        : text === ""
          ? "none"
          : "?";
    }
    const ends = sliderEl!
      .closest(".gmt-range-field")
      ?.querySelectorAll<HTMLElement>(".gmt-range-ends span");
    if (ends && ends.length === 2) ends[1]!.textContent = `${max / 60} h`;
  }

  /** The segments drawn in the plot, in percent of its size. */
  let drawnLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  /** The tolerance band's two edges, as percents of the plot's height. */
  let drawnBandEdges: number[] = [];

  function placeAll(): void {
    const w = area!.clientWidth;
    const h = area!.clientHeight;
    if (w === 0 || h === 0) return;
    const labels = [...area!.querySelectorAll<HTMLElement>(".gmt-eta-label")];
    const boxes = labels.map((el) => {
      el.classList.remove("gmt-eta-label--placed");
      const ax = Number(el.dataset.x ?? 0);
      const ay = Number(el.dataset.y ?? 0);
      return {
        x: (ax / 100) * w,
        y: (ay / 100) * h,
        w: el.offsetWidth,
        h: el.offsetHeight,
      };
    });
    // The join line, the chord and the band's two edges are drawn in percent;
    // the placer works in px.
    const lines = drawnLines.map((l) => ({
      x1: (l.x1 / 100) * w,
      y1: (l.y1 / 100) * h,
      x2: (l.x2 / 100) * w,
      y2: (l.y2 / 100) * h,
    }));
    // Every mark and both rings are obstacles, at their rendered size plus 2px.
    const origin = area!.getBoundingClientRect();
    const blocked = [
      ...area!.querySelectorAll(".gmt-eta-mark, .gmt-eta-ring"),
    ].map((el): Rect => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - origin.left - 1,
        top: r.top - origin.top - 1,
        w: r.width + 2,
        h: r.height + 2,
      };
    });
    // A chip may cross the join line when nothing else fits (it is opaque), but
    // never a band edge: both edges are also thin full-width obstacles.
    for (const l of drawnBandEdges) {
      blocked.push({ left: 0, top: (l / 100) * h - 1, w, h: 2 });
    }
    // The placer is greedy, first come first placed: the biggest chip goes
    // first, so the small ones fill the gaps around it.
    const order = boxes
      .map((_, i) => i)
      .sort((a, b) => boxes[b]!.w * boxes[b]!.h - boxes[a]!.w * boxes[a]!.h);
    const placed = placeLabels(
      order.map((i) => boxes[i]!),
      w,
      h,
      { markPx: 34, lines, blocked },
    );
    order.forEach((i, k) => {
      const el = labels[i]!;
      // When nothing is clear the placer falls back to its first choice, which
      // may hang past the plot; a label always stays inside it.
      const left = Math.max(0, Math.min(placed[k]!.left, w - boxes[i]!.w));
      const top = Math.max(0, Math.min(placed[k]!.top, h - boxes[i]!.h));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.classList.add("gmt-eta-label--placed");
    });
  }

  function drawPlot(s: DriftState, facts: DriftFacts): void {
    const yEl = q("y-ticks");
    const xEl = q("x-ticks");
    const bandLabel = q("band-label");
    const legendEl = q("legend");
    const clear = (html: string) => {
      area!.innerHTML = html;
      if (yEl) yEl.innerHTML = "";
      if (xEl) xEl.innerHTML = "";
      if (bandLabel) bandLabel.textContent = "";
      if (legendEl) legendEl.innerHTML = "";
      drawnLines = [];
      drawnBandEdges = [];
    };
    if (facts.best === null) {
      clear(`<span class="gmt-eta-signal">${SENTINEL} invalid input</span>`);
      return;
    }
    const band = toleranceBand(facts.drift, s.tolerance);
    const win = plotWindow(facts.events, band);
    if (win === null) {
      clear("");
      return;
    }
    const zone = plotZone(facts.events);
    const px = (ms: number) => ((ms - win.xMin) / (win.xMax - win.xMin)) * 100;
    const py = (ms: number) =>
      100 - ((ms - win.yMin) / (win.yMax - win.yMin)) * 100;
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const points = facts.events.map((e) => {
      try {
        return {
          x: r2(px(epochMs(e.recordedAt))),
          y: r2(py(epochMs(e.at))),
          rec: epochMs(e.recordedAt),
        };
      } catch {
        return null;
      }
    });
    const bestIdx = indexOfPick(facts.events, facts.best);
    const naiveIdx = facts.naive?.index ?? null;

    // The EST marks, joined in the order they were recorded.
    const ests = points
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p !== null && facts.events[i]!.classifier === "EST")
      .sort((a, b) => a.p!.rec - b.p!.rec || a.i - b.i);
    drawnLines = [];
    for (let i = 1; i < ests.length; i++) {
      const a = ests[i - 1]!.p!;
      const b = ests[i]!.p!;
      drawnLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    if (facts.drift !== null && ests.length >= 2) {
      const a = ests[0]!.p!;
      const b = ests.at(-1)!.p!;
      drawnLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    const yt = yTicks(win, zone);
    const lines =
      yt
        .map(
          (t) =>
            `<line class="gmt-eta-grid" x1="0" x2="100" y1="${r2(py(t.ms))}" y2="${r2(py(t.ms))}" vector-effect="non-scaling-stroke"/>`,
        )
        .join("") +
      (ests.length >= 2
        ? `<polyline class="gmt-eta-line" points="${ests.map(({ p }) => `${p!.x},${p!.y}`).join(" ")}" vector-effect="non-scaling-stroke"/>`
        : "") +
      (facts.drift !== null && ests.length >= 2
        ? `<polyline class="gmt-eta-line-glow" points="${ests[0]!.p!.x},${ests[0]!.p!.y} ${ests.at(-1)!.p!.x},${ests.at(-1)!.p!.y}" vector-effect="non-scaling-stroke"/>`
        : "") +
      (facts.drift !== null && ests.length >= 2
        ? `<line class="gmt-eta-chord" x1="${ests[0]!.p!.x}" y1="${ests[0]!.p!.y}" x2="${ests.at(-1)!.p!.x}" y2="${ests.at(-1)!.p!.y}" vector-effect="non-scaling-stroke"/>`
        : "");

    drawnBandEdges = [];
    if (band) {
      // A chip never sits on the band's edge: both edges are obstacles.
      for (const ms of [band.highMs, band.lowMs]) {
        drawnLines.push({ x1: 0, y1: py(ms), x2: 100, y2: py(ms) });
        drawnBandEdges.push(py(ms));
      }
    }

    const bandHtml = band
      ? `<span class="gmt-eta-band" style="top:${r2(py(band.highMs))}%;height:${r2(py(band.lowMs) - py(band.highMs))}%"></span>`
      : "";

    let marks = "";
    let labels = "";
    facts.events.forEach((e, i) => {
      const p = points[i];
      if (!p) return;
      marks += markHtml(e.classifier, p.x, p.y, i + 1);
      const isBest = i === bestIdx;
      const isNaive = i === naiveIdx;
      if (isBest) {
        marks += `<span class="gmt-eta-ring" style="left:${p.x}%;top:${p.y}%"></span>`;
      }
      if (isNaive) {
        marks += `<span class="gmt-eta-ring gmt-eta-ring--dashed" style="left:${p.x}%;top:${p.y}%"></span>`;
      }
      const words = [isBest ? "best available" : "", isNaive ? "naive" : ""]
        .filter(Boolean)
        .join(", ");
      labels += `<span class="gmt-eta-label gmt-cutoff-chip" data-role="label-${i + 1}" data-x="${p.x}" data-y="${p.y}" style="left:${p.x}%;top:${p.y}%">${chip(e.classifier)}${words ? ` ${escapeHtml(words)}` : ""}</span>`;
    });
    if (facts.drift !== null && ests.length >= 2) {
      const a = ests[0]!.p!;
      const b = ests.at(-1)!.p!;
      const arrow =
        facts.drift.drift === "PT0S"
          ? "→"
          : facts.drift.drift.startsWith("-")
            ? "↓"
            : "↑";
      labels += `<span class="gmt-eta-label gmt-cutoff-chip" data-role="label-drift" data-x="${r2((a.x + b.x) / 2)}" data-y="${r2((a.y + b.y) / 2)}" style="left:${r2((a.x + b.x) / 2)}%;top:${r2((a.y + b.y) / 2)}%">${arrow} ${escapeHtml(signedText(facts.drift.drift))}</span>`;
    }

    area!.innerHTML = `<svg class="gmt-eta-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${lines}</svg>${bandHtml}${marks}${labels}`;
    if (yEl) {
      yEl.innerHTML = yt
        .map(
          (t) =>
            `<span class="gmt-eta-ytick" style="top:${r2(py(t.ms))}%">${escapeHtml(t.label)}</span>`,
        )
        .join("");
    }
    if (xEl) {
      xEl.innerHTML = xTicks(win, zone)
        .map(
          (t) =>
            `<span class="gmt-cutoff-axis-tick gmt-punct-tick--mid" style="left:${r2(px(t.ms))}%">${escapeHtml(t.label)}</span>`,
        )
        .join("");
      thinTickLabels(xEl);
    }
    if (bandLabel) {
      bandLabel.textContent = band
        ? `±${toleranceText(s.tolerance)} around the first estimate · exceeds the tolerance: ${String(facts.drift?.exceedsTolerance)}`
        : "";
    }
    if (legendEl) {
      const present = new Set(facts.events.map((e) => e.classifier as string));
      legendEl.innerHTML = TIMESTAMP_CLASSES.filter((c) => present.has(c.code))
        .map(
          (c) =>
            `<li data-series="${CLASS_SERIES[c.code]}">${glyphHtml(c.code)}${chip(c.code)}<span class="gmt-eta-legend-word">${escapeHtml(c.label)}</span></li>`,
        )
        .join("");
    }
    placeAll();
  }

  /** The result plates above the plot: the drift `estimateDrift` returned and
   *  the pick `bestAvailable` made, large. Every value is the library's. */
  function drawHeroes(s: DriftState, facts: DriftFacts): void {
    const heroes = q("drift-heroes");
    if (!heroes) return;
    let html = "";
    if (facts.drift !== null) {
      const tolerance = s.tolerance.trim();
      const exceeds =
        facts.drift.exceedsTolerance === null
          ? ""
          : `exceeds ±${toleranceText(tolerance)}: ${facts.drift.exceedsTolerance ? "yes" : "no"}`;
      html +=
        `<div class="gmt-punct-hero" data-role="drift-hero">` +
        `<span class="gmt-punct-hero-cap">estimate drift</span>` +
        `<span class="gmt-punct-hero-value">${escapeHtml(signedText(facts.drift.drift))}</span>` +
        heroLinesHtml([
          {
            text: `${facts.drift.drift} · over ${facts.drift.revisions} estimates`,
          },
          { text: exceeds, sep: " · " },
        ]) +
        `</div>`;
    }
    if (facts.best !== null) {
      html +=
        `<div class="gmt-punct-hero gmt-punct-hero--quiet"${seriesAttr(facts.best.classifier)} data-role="best-hero">` +
        `<span class="gmt-punct-hero-cap">${glyphHtml(facts.best.classifier)}best available</span>` +
        `<span class="gmt-punct-hero-value">${escapeHtml(`${facts.best.classifier} · ${labelOf(facts.best.at)}`)}</span></div>`;
    }
    heroes.innerHTML = html;
  }

  function render(): void {
    if (destroyed) return;
    const s = state();
    const facts = collectDriftFacts(s, lib);
    const reason = driftNullReason(s, facts, lib);
    const count = visibleCount(s);
    for (let n = 1; n <= MAX_EVENTS; n++) {
      const set = q(`event-${n}`);
      if (set) set.hidden = n > count;
    }

    // Callouts.
    const best = q("callout-best");
    const naive = q("callout-naive");
    const bestIdx = indexOfPick(facts.events, facts.best);
    const naiveIdx = facts.naive?.index ?? null;
    if (best) {
      best.innerHTML =
        facts.best === null
          ? `Best available: ${SENTINEL}`
          : bestIdx !== null && bestIdx === naiveIdx
            ? escapeHtml(
                `Best available and the latest recorded are the same event: ${facts.best.classifier}, ${labelOf(facts.best.at)} (bestAvailable)`,
              )
            : escapeHtml(
                `Best available: ${facts.best.classifier}, ${labelOf(facts.best.at)} (bestAvailable)`,
              );
    }
    if (naive) {
      const same = bestIdx !== null && bestIdx === naiveIdx;
      naive.hidden = same || facts.naive === null;
      naive.textContent =
        facts.naive === null
          ? ""
          : `Naive, latest recorded: ${facts.naive.event.classifier}, ${labelOf(facts.naive.event.at)}`;
    }

    drawPlot(s, facts);
    drawHeroes(s, facts);
    syncSlider(facts);

    // Summary and table, in the order the records were made.
    const order = facts.events
      .map((e, i) => {
        let rec = Number.POSITIVE_INFINITY;
        try {
          rec = epochMs(e.recordedAt);
        } catch {
          /* sorted last */
        }
        return { e, i, rec };
      })
      .sort((a, b) => a.rec - b.rec || a.i - b.i);
    const estOrder = order.filter(({ e }) => e.classifier === "EST");
    const notes = (i: number): string => {
      const out: string[] = [];
      if (i === bestIdx) out.push("best available");
      if (i === naiveIdx) out.push("naive pick");
      if (facts.drift !== null && estOrder.length >= 2) {
        if (estOrder[0]!.i === i) out.push("first EST");
        if (estOrder.at(-1)!.i === i) out.push("last EST");
      }
      return out.join(", ");
    };
    const summary = q("drift-summary");
    if (summary) {
      const sentences = order.map(
        ({ e }) =>
          `Recorded ${labelOf(e.recordedAt)}: ${classWord(e.classifier)} (${e.classifier || "no class"}), naming ${labelOf(e.at)}.`,
      );
      sentences.push(
        facts.drift === null
          ? "No estimate drift: NO SIGNAL."
          : `Estimate drift ${signedText(facts.drift.drift)} over ${facts.drift.revisions} estimates${facts.drift.exceedsTolerance === null ? "" : `; exceeds the tolerance: ${facts.drift.exceedsTolerance}`}.`,
      );
      summary.textContent = sentences.join(" ");
    }
    const table = q("event-table");
    if (table) {
      table.innerHTML =
        `<thead><tr><th scope="col">#</th><th scope="col">Class</th><th scope="col">At</th><th scope="col">Recorded</th><th scope="col">Note</th></tr></thead><tbody>` +
        facts.events
          .map(
            (e, i) =>
              `<tr data-role="event-row-${i + 1}"><th scope="row">${i + 1}</th><td${seriesAttr(e.classifier)}>${glyphHtml(e.classifier)}${chip(e.classifier)}</td><td>${escapeHtml(labelOf(e.at))}</td><td>${escapeHtml(labelOf(e.recordedAt))}</td><td data-role="note-${i + 1}">${escapeHtml(notes(i))}</td></tr>`,
          )
          .join("") +
        `</tbody>`;
    }

    const aside = q("reason-aside");
    if (aside) {
      if (reason) {
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(driftReasonText(reason))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // What the calls return.
    const [bestHtml, bestPlain] = callArgs([facts.events]);
    renderCallLine(q("call-best"), "bestAvailable", bestHtml, bestPlain);
    const tolerance = s.tolerance.trim();
    const [driftHtml, driftPlain] = callArgs(
      tolerance ? [facts.events, { tolerance }] : [facts.events],
    );
    renderCallLine(q("call-drift"), "estimateDrift", driftHtml, driftPlain);
    const bestOut = q("best-output");
    if (bestOut) {
      if (facts.best === null)
        renderWidgetOutput(bestOut, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(bestOut, formatValue(facts.best), "live");
    }
    const driftOut = q("drift-output");
    if (driftOut) {
      if (facts.drift === null)
        renderWidgetOutput(driftOut, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(driftOut, formatValue(facts.drift), "live");
    }
  }

  function applyPreset(): void {
    const preset = ETA_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    writeSeed(root, {
      eventCount: String(preset.events.length),
      events: Array.from({ length: MAX_EVENTS }, (_, i) => ({
        ...(preset.events[i] ?? {
          classifier: "" as never,
          at: "",
          recordedAt: "",
        }),
      })),
      tolerance: preset.tolerance,
    });
    syncPreset();
    render();
  }

  /** Showing another event copies the last visible one into a blank slot, so
   *  a new event starts as a valid timestamp the reader can then edit. */
  function fillNewEvents(previous: number): void {
    const s = state();
    const count = visibleCount(s);
    for (let n = previous + 1; n <= count; n++) {
      const e = s.events[n - 1]!;
      const blank =
        e.classifier === ("" as never) && e.at === "" && e.recordedAt === "";
      const from = s.events[n - 2];
      if (!blank || !from) continue;
      root
        .querySelectorAll<HTMLInputElement>(`[data-role="classifier-${n}"]`)
        .forEach((r) => {
          r.checked = r.value === (from.classifier || "EST");
        });
      const at = q<HTMLInputElement>(`at-${n}`);
      if (at) at.value = from.at;
      const rec = q<HTMLInputElement>(`recorded-at-${n}`);
      if (rec) rec.value = from.recordedAt;
    }
  }

  let lastCount = visibleCount(state());

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const target = e.target as HTMLElement;
    if (target === sliderEl) {
      tolEl.value = minutesToIso(Number.parseInt(sliderEl.value, 10) || 0);
      syncPreset();
      render();
      return;
    }
    const role = target.dataset?.role ?? "";
    if (role === "tolerance" || /^(at|recorded-at)-\d$/.test(role)) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const target = e.target as HTMLElement;
    const role = target.dataset?.role ?? "";
    if (target === presetEl) {
      applyPreset();
    } else if (target === countEl) {
      fillNewEvents(lastCount);
      lastCount = visibleCount(state());
      syncPreset();
      render();
    } else if (/^classifier-\d$/.test(role)) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  syncPreset();
  render();
  const refitText = (): void => {
    if (destroyed) return;
    placeAll();
    const xEl = q("x-ticks");
    if (xEl) thinTickLabels(xEl);
  };
  onWidthChange(area, refitText);
  // Text measured before the web fonts swap in is the wrong width: fit again
  // once they have loaded.
  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts.ready.then(refitText);
    document.fonts.addEventListener?.("loadingdone", refitText);
  }

  return {
    state,
    destroy() {
      destroyed = true;
    },
  };
}

/** Write the state onto the controls: the page server-renders the first preset,
 *  so a permalink or chat seed has to reach the controls here. */
function writeSeed(root: HTMLElement, s: DriftState): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const count = q<HTMLSelectElement>("event-count");
  if (count) count.value = String(visibleCount(s));
  s.events.forEach((e, i) => {
    const n = i + 1;
    root
      .querySelectorAll<HTMLInputElement>(`[data-role="classifier-${n}"]`)
      .forEach((r) => {
        r.checked = r.value === e.classifier;
      });
    const at = q<HTMLInputElement>(`at-${n}`);
    if (at) at.value = e.at;
    const rec = q<HTMLInputElement>(`recorded-at-${n}`);
    if (rec) rec.value = e.recordedAt;
  });
  const tol = q<HTMLInputElement>("tolerance");
  if (tol) tol.value = s.tolerance;
}

export const mountEtaDrift = async (
  root: HTMLElement,
  args: EtaDriftArgs,
  signal: AbortSignal,
) => {
  let lib: PunctualityLib;
  try {
    lib = await loadPunctualityLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  writeSeed(root, initialState(args));
  const controller = setupWidget(root, lib);
  const onAbort = () => controller.destroy();
  signal.addEventListener("abort", onAbort);

  return onceDestroy(
    () => {
      signal.removeEventListener("abort", onAbort);
      controller.destroy();
    },
    () => permalinkOf(controller.state()),
  );
};
