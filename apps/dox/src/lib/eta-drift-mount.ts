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
 * Built on the component kit: `renderEtaDriftTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids and
 * reads and writes element `value` properties. The tolerance has three ways in: the
 * `<gmt-range>`, the typed field, and a seed. A visually hidden status line reads the
 * answer once a change settles.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  gateAttr,
  hint,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { hold } from "~/widgets/families/edi/edi-hold";
import { callOutput } from "~/widgets/families/gnss/call-output";
import {
  punctHero,
  punctHeroStrip,
} from "~/widgets/families/punctuality/punct-hero";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/eta-drift.module.css";
import {
  CLASS_SERIES,
  ETA_PRESETS,
  MAX_EVENTS,
  CUSTOM_PRESET_ID,
  collectDriftFacts,
  driftNullReason,
  driftReasonText,
  isEmptyDriftReason,
  indexOfPick,
  initialState,
  matchPreset,
  permalinkOf,
  plotWindow,
  plotZone,
  presetState,
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
  SETTLE_MS,
  TIMESTAMP_CLASSES,
  callArgs,
  epochMs,
  formatValue,
  isoToMinutes,
  minutesToIso,
  niceMinutes,
  placeLabels,
  signedText,
  spokenMinutes,
  toleranceText,
  writtenLabel,
  type PunctualityLib,
  type Rect,
  type TimestampClass,
} from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { EtaDriftArgs } from "./eta-drift";

const WIDGET_NAME = "eta-drift";

/** The widest readings the plates show, so they keep their width while the slider drags. */
const HERO_SAMPLES = ["+23 h 59 min"];

/** The lines under the drift plate at their widest: `widest` is the longest tolerance the
 *  control can show (`widestTolerance`), and "yes" is longer than "no". */
const heroLineSamples = (widest: string): readonly (readonly string[])[] => [
  ["PT23H59M · over 6 estimates"],
  [`exceeds ±${widest}: yes`],
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const seriesOf = (code: string): 1 | 2 | 3 | 4 | null =>
  Object.hasOwn(CLASS_SERIES, code)
    ? CLASS_SERIES[code as TimestampClass]
    : null;

const seriesAttr = (code: string): SafeHtml => {
  const n = seriesOf(code);
  return n === null ? html`` : html`data-series="${n}"`;
};

/** A class code on a chip whose border is the class's series colour. */
const codeChip = (code: string): SafeHtml =>
  html`<span class="${styles.code}" ${seriesAttr(code)}>${code || "?"}</span>`;

/** The class's shape, inline and static: the plot mark's twin for the legend, the table.
 *  Decorative; the code beside it names the class. */
function glyph(code: string): SafeHtml {
  if (seriesOf(code) === null) return html``;
  return html`<span class="${styles.glyph}" data-shape="${code}" ${seriesAttr(code)} aria-hidden="true">${
    code === "REQ"
      ? raw(
          `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 1.2 9.4 9H.6Z"/></svg>`,
        )
      : ""
  }</span>`;
}

function markOf(code: string, left: number, top: number): SafeHtml {
  return html`<span class="${styles.mark}" data-shape="${code}" data-block="true" ${seriesAttr(code)} style="left: ${left}%; top: ${top}%">${
    code === "REQ"
      ? raw(
          `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 1.2 9.4 9H.6Z"/></svg>`,
        )
      : ""
  }</span>`;
}

const labelOf = (text: string): string => writtenLabel(text) || text;

function classWord(code: string): string {
  return TIMESTAMP_CLASSES.find((c) => c.code === code)?.label ?? code;
}

export function sliderMax(drift: { drift: string } | null): number {
  const m = drift === null ? null : isoToMinutes(drift.drift);
  return Math.max(1440, niceMinutes(1.5 * Math.abs(m ?? 0)));
}

/**
 * The tolerance, as the band label and the exceeds line write it, that takes the most room: the
 * longer of what the handle can reach (the slider's maximum, which grows with the drift) and
 * what is typed, since a typed tolerance has no cap and a drag replaces it. Digits are
 * tabular, so the widest reach is its whole hours with 59 minutes, the most digits and both
 * units that any length up to the maximum writes.
 */
export function widestTolerance(
  sliderMaxMinutes: number,
  typed: string,
): string {
  const reach = toleranceText(
    minutesToIso(Math.floor(sliderMaxMinutes / 60) * 60 + 59),
  );
  // Typed text that is not a duration shows no label, so it holds no room.
  const minutes = isoToMinutes(typed.trim());
  if (minutes === null || minutes < 0) return reach;
  const written = toleranceText(typed);
  return written.length > reach.length ? written : reach;
}

/** The band label for a tolerance text: `exceeds the tolerance: false` is the longest answer
 *  ("true" and "null" are shorter). */
export const bandLabelFor = (tolerance: string, exceeds: string): string =>
  `±${tolerance} around the first estimate · exceeds the tolerance: ${exceeds}`;

/** The band label's reserved room: the label at the widest tolerance the control can show. */
export const widestBandLabel = (
  sliderMaxMinutes: number,
  typed: string,
): string => bandLabelFor(widestTolerance(sliderMaxMinutes, typed), "false");

/** What the slider reads aloud and in its chip, from the typed tolerance. */
function toleranceReading(text: string): string {
  const t = text.trim();
  const m = isoToMinutes(t);
  const readable = m !== null && m >= 0;
  return readable
    ? `Tolerance ${spokenMinutes(m)}, ${t}`
    : t === ""
      ? "No tolerance"
      : "Tolerance is not a duration";
}

/**
 * `renderEtaDriftTemplate(idPrefix, args = {})`: the widget's chrome, seeded so the first
 * paint shows the events and the tolerance. Seeded when `args.events`, `args.classifier1`
 * or `args.preset` is defined, else the first preset. The plot, callouts and results are
 * drawn by `mount`, because they come from the real library.
 */
export function renderEtaDriftTemplate(
  idPrefix: string,
  args: EtaDriftArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const s = initialState(args);
  const presetId = matchPreset(s);
  const count = visibleCount(s);
  const tolMin = isoToMinutes(s.tolerance);
  const max = 1440;

  const textField = (local: string, label: string, value: string): SafeHtml =>
    html`<div class="${styles.box}">${field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          ...(describedBy === undefined ? {} : { describedBy }),
        }),
    })}</div>`;

  const eventSet = (n: number): SafeHtml => {
    const e = s.events[n - 1]!;
    return html`<fieldset class="${styles.event}" id="${id(`event-${n}`)}" ${n > count ? html`hidden` : ""}>
      <legend class="${styles.eventLegend}">Event ${n}</legend>
      ${chips({
        legend: "Class",
        kind: "radio",
        name: id(`classifier-${n}`),
        items: TIMESTAMP_CLASSES.map(({ code, label }) => ({
          value: code,
          label: `${code} ${label}`,
          checked: e.classifier === code,
        })),
      })}${fieldGrid(
        html`${textField(`at-${n}`, "At", e.at)}${textField(`recorded-at-${n}`, "Recorded at", e.recordedAt)}`,
      )}</fieldset>`;
  };

  const pick = section(
    { id: id("pick"), heading: "1. The timestamps", level: 4 },
    html`<div class="${styles.controls}">${fieldGrid(
      html`${preset({
        id: id("preset"),
        label: "Preset",
        value: presetId,
        options: [
          { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
          ...ETA_PRESETS.map((p) => ({
            value: p.id,
            label: p.label,
            description: p.description,
          })),
        ],
      })}<div class="${styles.box}">${field({
        id: id("event-count"),
        label: "Events",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: String(count),
            options: Array.from({ length: MAX_EVENTS }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            })),
          }),
      })}</div>`,
    )}${grow(
      html`<div class="${styles.controls}">${Array.from(
        { length: MAX_EVENTS },
        (_, i) => eventSet(i + 1),
      )}</div>`,
    )}</div>`,
  );

  const summary = hint(id("summary"), "");
  const read = section(
    {
      id: id("read"),
      heading: "2. Which time, and how far it moved",
      level: 4,
    },
    html`${grow(html`<p class="${styles.callout}" id="${id("callout-best")}"></p>`)}
      ${grow(html`<p class="${styles.callout} ${styles.naive}" id="${id("callout-naive")}" hidden></p>`)}
      <div role="status" aria-live="polite" aria-label="ETA status" id="${id("live")}">${srOnly("")}</div>
      ${grow(
        html`<div class="${styles.frame}" data-gate="frame">
        ${grow(html`<div class="${styles.heroes}" id="${id("heroes")}"></div>`)}
        <div class="${styles.plot}" id="${id("plot")}" role="img" aria-labelledby="${id("summary")}" ${gateAttr("drawn")}>
          <div class="${styles.yaxis}" id="${id("y-ticks")}"></div>
          <div class="${styles.area}" id="${id("area")}"></div>
          <div class="${styles.xticks}" id="${id("x-ticks")}"></div>
        </div>
        <ul class="${styles.legend}" id="${id("legend")}" aria-hidden="true"></ul>
        <div class="${styles.callout}">${hold({
          id: id("band-label"),
          role: "note",
          label: "Tolerance band",
          content: html``,
          ghosts: [
            html`<span id="${id("band-ghost")}">${widestBandLabel(sliderMax(null), s.tolerance)}</span>`,
          ],
        })}</div>
      </div>`,
      )}
      ${hint(id("axes"), "Across: when each record was recorded. Up: the time it names, later at the top.").html}
      ${fieldGrid(
        html`${textField("tolerance", "Tolerance (optional)", s.tolerance)}<div class="${styles.box}">${range(
          {
            id: id("slider"),
            label: "Drag the tolerance",
            min: 0,
            max,
            step: 15,
            value:
              tolMin === null
                ? 0
                : Math.min(max, Math.max(0, Math.round(tolMin))),
            valueText: toleranceReading(s.tolerance),
            ends: ["0", "24 h"],
          },
        )}</div>`,
      )}
      ${grow(summary.html)}
      ${grow(html`<div id="${id("table-slot")}">${eventsTable([])}</div>`)}
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What the calls return", level: 4 },
    html`${grow(
      html`<div id="${id("best-slot")}">${codeFrame({
        label: "The bestAvailable call",
        copyLabel: "Copy bestAvailable call",
        copyText: "",
      })}</div>`,
    )}${grow(
      html`<div id="${id("best-output-slot")}">${callOutput({
        label: "What bestAvailable returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(
      html`<div id="${id("drift-slot")}">${codeFrame({
        label: "The estimateDrift call",
        copyLabel: "Copy estimateDrift call",
        copyText: "",
      })}</div>`,
    )}${grow(
      html`<div id="${id("drift-output-slot")}">${callOutput({
        label: "What estimateDrift returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "ETA Drift Chart", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

interface EventRow {
  n: number;
  class: SafeHtml;
  at: string;
  recorded: string;
  note: string;
}

function eventsTable(rows: readonly EventRow[]): SafeHtml {
  return table({
    caption: "Events in the order recorded",
    columns: [
      { key: "n", header: "#", align: "start", numeric: true },
      { key: "class", header: "Class", align: "start", numeric: false },
      { key: "at", header: "At", align: "start", numeric: false },
      { key: "recorded", header: "Recorded", align: "start", numeric: false },
      { key: "note", header: "Note", align: "start", numeric: false },
    ],
    rowHeader: "n",
    rows,
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  destroy(): void;
  state(): DriftState;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

function setupWidget(
  root: HTMLElement,
  lib: PunctualityLib,
  start: DriftState,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const rangeEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const countEl = el<HTMLSelectElement>("event-count");
  const tolEl = el<HTMLInputElement>("tolerance");
  const area = el("area");
  const atEls = Array.from({ length: MAX_EVENTS }, (_, i) =>
    el<HTMLInputElement>(`at-${i + 1}`),
  );
  const recEls = Array.from({ length: MAX_EVENTS }, (_, i) =>
    el<HTMLInputElement>(`recorded-at-${i + 1}`),
  );
  const classEls = Array.from({ length: MAX_EVENTS }, (_, i) =>
    el(`event-${i + 1}`).querySelector<GmtChips>("gmt-chips")!,
  );
  let destroyed = false;

  const classifierOf = (n: number): string => {
    const v = classEls[n - 1]!.value;
    return Array.isArray(v) ? (v[0] ?? "") : v;
  };

  const state = (): DriftState => ({
    eventCount: countEl.value,
    events: Array.from({ length: MAX_EVENTS }, (_, i) => ({
      classifier: classifierOf(i + 1) as never,
      at: atEls[i]!.value,
      recordedAt: recEls[i]!.value,
    })),
    tolerance: tolEl.value,
  });

  /** Write the state onto the controls: a permalink or chat seed reaches them here. */
  function writeSeed(s: DriftState): void {
    countEl.value = String(visibleCount(s));
    s.events.forEach((e, i) => {
      classEls[i]!.value = e.classifier;
      atEls[i]!.value = e.at;
      recEls[i]!.value = e.recordedAt;
    });
    tolEl.value = s.tolerance;
  }

  // The answer is read out once, when the change that made it has settled.
  let liveText = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelAnnounce = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const announce = (): void => {
    cancelAnnounce();
    timer = setTimeout(() => {
      timer = undefined;
      if (!destroyed) setHtml(el("live"), srOnly(liveText));
    }, SETTLE_MS);
  };

  function syncPreset(): void {
    presetEl.value = matchPreset(state());
  }

  rangeEl.formatValue = () => toleranceReading(tolEl.value);

  function syncSlider(facts: DriftFacts): void {
    const max = sliderMax(facts.drift);
    const m = isoToMinutes(tolEl.value.trim());
    const readable = m !== null && m >= 0;
    rangeEl.max = max;
    rangeEl.ends = ["0", `${max / 60} h`];
    rangeEl.value = readable ? Math.min(max, Math.round(m)) : 0;
  }

  /** The segments drawn in the plot, in percent of its size. */
  let drawnLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  /** The tolerance band's two edges, as percents of the plot's height. */
  let drawnBandEdges: number[] = [];

  function placeAll(): void {
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (w === 0 || h === 0) return;
    const labels = [...area.querySelectorAll<HTMLElement>("[data-label]")];
    const boxes = labels.map((label) => {
      delete label.dataset["placed"];
      const ax = Number(label.dataset["x"] ?? 0);
      const ay = Number(label.dataset["y"] ?? 0);
      return {
        x: (ax / 100) * w,
        y: (ay / 100) * h,
        w: label.offsetWidth,
        h: label.offsetHeight,
      };
    });
    // The join line, the chord and the band's two edges are drawn in percent; the placer
    // works in px.
    const lines = drawnLines.map((l) => ({
      x1: (l.x1 / 100) * w,
      y1: (l.y1 / 100) * h,
      x2: (l.x2 / 100) * w,
      y2: (l.y2 / 100) * h,
    }));
    // Every mark and both rings are obstacles, at their rendered size plus 2px.
    const origin = area.getBoundingClientRect();
    const blocked = [...area.querySelectorAll("[data-block]")].map(
      (node): Rect => {
        const r = node.getBoundingClientRect();
        return {
          left: r.left - origin.left - 1,
          top: r.top - origin.top - 1,
          w: r.width + 2,
          h: r.height + 2,
        };
      },
    );
    // A chip may cross the join line when nothing else fits (it is opaque), but never a
    // band edge: both edges are also thin full-width obstacles.
    for (const l of drawnBandEdges) {
      blocked.push({ left: 0, top: (l / 100) * h - 1, w, h: 2 });
    }
    // The placer is greedy, first come first placed: the biggest chip goes first, so the
    // small ones fill the gaps around it.
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
      const label = labels[i]!;
      // When nothing is clear the placer falls back to its first choice, which may hang
      // past the plot; a label always stays inside it.
      const left = Math.max(0, Math.min(placed[k]!.left, w - boxes[i]!.w));
      const top = Math.max(0, Math.min(placed[k]!.top, h - boxes[i]!.h));
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
      label.dataset["placed"] = "true";
    });
  }

  function drawPlot(s: DriftState, facts: DriftFacts): void {
    const clear = (inner: SafeHtml): void => {
      setHtml(area, inner);
      setHtml(el("y-ticks"), html``);
      setHtml(el("x-ticks"), html``);
      el("band-label").textContent = "";
      setHtml(el("legend"), html``);
      drawnLines = [];
      drawnBandEdges = [];
    };
    if (facts.best === null) {
      clear(
        html`<span class="${styles.signal}"><span class="${styles.lost}">NO SIGNAL</span> invalid input</span>`,
      );
      return;
    }
    const band = toleranceBand(facts.drift, s.tolerance);
    const win = plotWindow(facts.events, band);
    if (win === null) {
      clear(html``);
      return;
    }
    const zone = plotZone(facts.events);
    const px = (ms: number) => ((ms - win.xMin) / (win.xMax - win.xMin)) * 100;
    const py = (ms: number) =>
      100 - ((ms - win.yMin) / (win.yMax - win.yMin)) * 100;

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
    const drifted = facts.drift !== null && ests.length >= 2;
    if (drifted) {
      const a = ests[0]!.p!;
      const b = ests.at(-1)!.p!;
      drawnLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    const yt = yTicks(win, zone);
    const first = ests[0]?.p;
    const last = ests.at(-1)?.p;
    const svg = html`<svg class="${styles.lines}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${yt.map(
      (t) =>
        html`<line class="${styles.grid}" x1="0" x2="100" y1="${r2(py(t.ms))}" y2="${r2(py(t.ms))}" vector-effect="non-scaling-stroke"/>`,
    )}${
      ests.length >= 2
        ? html`<polyline class="${styles.join}" points="${ests.map(({ p }) => `${p!.x},${p!.y}`).join(" ")}" vector-effect="non-scaling-stroke"/>`
        : ""
    }${
      drifted && first && last
        ? html`<polyline class="${styles.glow}" points="${first.x},${first.y} ${last.x},${last.y}" vector-effect="non-scaling-stroke"/><line class="${styles.chord}" x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}" vector-effect="non-scaling-stroke"/>`
        : ""
    }</svg>`;

    drawnBandEdges = [];
    if (band) {
      // A chip never sits on the band's edge: both edges are obstacles.
      for (const ms of [band.highMs, band.lowMs]) {
        drawnLines.push({ x1: 0, y1: py(ms), x2: 100, y2: py(ms) });
        drawnBandEdges.push(py(ms));
      }
    }
    const bandEl = band
      ? html`<span class="${styles.band}" style="top: ${r2(py(band.highMs))}%; height: ${r2(py(band.lowMs) - py(band.highMs))}%"></span>`
      : html``;

    const marks: SafeHtml[] = [];
    const labels: SafeHtml[] = [];
    facts.events.forEach((e, i) => {
      const p = points[i];
      if (!p) return;
      marks.push(markOf(e.classifier, p.x, p.y));
      const isBest = i === bestIdx;
      const isNaive = i === naiveIdx;
      if (isBest) {
        marks.push(
          html`<span class="${styles.ring}" data-block="true" style="left: ${p.x}%; top: ${p.y}%"></span>`,
        );
      }
      if (isNaive) {
        marks.push(
          html`<span class="${styles.ring}" data-pick="naive" data-block="true" style="left: ${p.x}%; top: ${p.y}%"></span>`,
        );
      }
      const words = [isBest ? "best available" : "", isNaive ? "naive" : ""]
        .filter(Boolean)
        .join(", ");
      labels.push(
        html`<span class="${styles.label}" data-label="true" data-x="${p.x}" data-y="${p.y}" style="left: ${p.x}%; top: ${p.y}%">${codeChip(e.classifier)}${words ? html` ${words}` : ""}</span>`,
      );
    });
    if (facts.drift !== null && drifted && first && last) {
      const arrow =
        facts.drift.drift === "PT0S"
          ? "→"
          : facts.drift.drift.startsWith("-")
            ? "↓"
            : "↑";
      const mx = r2((first.x + last.x) / 2);
      const my = r2((first.y + last.y) / 2);
      labels.push(
        html`<span class="${styles.label}" data-label="true" data-x="${mx}" data-y="${my}" style="left: ${mx}%; top: ${my}%">${arrow} ${signedText(facts.drift.drift)}</span>`,
      );
    }

    setHtml(area, html`${svg}${bandEl}${marks}${labels}`);
    setHtml(
      el("y-ticks"),
      html`${yt.map(
        (t) =>
          html`<span class="${styles.ytick}" style="top: ${r2(py(t.ms))}%">${t.label}</span>`,
      )}`,
    );
    setHtml(
      el("x-ticks"),
      html`${xTicks(win, zone).map(
        (t) =>
          html`<span class="${styles.xtick}" data-tick="true" style="left: ${r2(px(t.ms))}%">${t.label}</span>`,
      )}`,
    );
    thinTickLabels(el("x-ticks"), "[data-tick]");
    el("band-label").textContent = band
      ? bandLabelFor(
          toleranceText(s.tolerance),
          String(facts.drift?.exceedsTolerance),
        )
      : "";
    // The slider reaches further as the drift grows, so the room is set again here.
    el("band-ghost").textContent = widestBandLabel(
      sliderMax(facts.drift),
      s.tolerance,
    );
    const present = new Set(facts.events.map((e) => e.classifier as string));
    setHtml(
      el("legend"),
      html`${TIMESTAMP_CLASSES.filter((c) => present.has(c.code)).map(
        (c) =>
          html`<li class="${styles.legendItem}" ${seriesAttr(c.code)}>${glyph(c.code)}${codeChip(c.code)}<span>${c.label}</span></li>`,
      )}`,
    );
    placeAll();
  }

  /** The result plates above the plot: the drift `estimateDrift` returned and the pick
   *  `bestAvailable` made, large. Every value is the library's. */
  function drawHeroes(s: DriftState, facts: DriftFacts): void {
    const plates: SafeHtml[] = [];
    if (facts.drift !== null) {
      const tolerance = s.tolerance.trim();
      const exceeds =
        facts.drift.exceedsTolerance === null
          ? ""
          : `exceeds ±${toleranceText(tolerance)}: ${facts.drift.exceedsTolerance ? "yes" : "no"}`;
      plates.push(
        punctHero({
          caption: "estimate drift",
          value: signedText(facts.drift.drift),
          samples: HERO_SAMPLES,
          lines: [
            `${facts.drift.drift} · over ${facts.drift.revisions} estimates`,
            exceeds,
          ],
          lineSamples: heroLineSamples(
            widestTolerance(sliderMax(facts.drift), tolerance),
          ),
          series: 1,
          gate: "hero",
        }),
      );
    }
    if (facts.best !== null) {
      const n = seriesOf(facts.best.classifier);
      plates.push(
        punctHero({
          caption: "best available",
          value: `${facts.best.classifier} · ${labelOf(facts.best.at)}`,
          quiet: true,
          ...(n === null ? {} : { series: n }),
          gate: "hero",
        }),
      );
    }
    setHtml(
      el("heroes"),
      plates.length === 0 ? html`` : punctHeroStrip(html`${plates}`),
    );
  }

  function render(): void {
    if (destroyed) return;
    const s = state();
    const facts = collectDriftFacts(s, lib);
    const reason = driftNullReason(s, facts, lib);
    // Fewer than two estimates is a correct empty answer, not invalid input.
    const empty = isEmptyDriftReason(reason);
    const count = visibleCount(s);
    for (let n = 1; n <= MAX_EVENTS; n++) el(`event-${n}`).hidden = n > count;

    // Callouts.
    const bestIdx = indexOfPick(facts.events, facts.best);
    const naiveIdx = facts.naive?.index ?? null;
    const same = bestIdx !== null && bestIdx === naiveIdx;
    const bestText =
      facts.best === null
        ? ""
        : same
          ? `Best available and the latest recorded are the same event: ${facts.best.classifier}, ${labelOf(facts.best.at)} (bestAvailable)`
          : `Best available: ${facts.best.classifier}, ${labelOf(facts.best.at)} (bestAvailable)`;
    setHtml(
      el("callout-best"),
      facts.best === null
        ? html`Best available: <span class="${styles.lost}">NO SIGNAL</span>`
        : html`${bestText}`,
    );
    const naive = el("callout-naive");
    naive.hidden = same || facts.naive === null;
    naive.textContent =
      facts.naive === null
        ? ""
        : `Naive, latest recorded: ${facts.naive.event.classifier}, ${labelOf(facts.naive.event.at)}`;

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
    const sentences = order.map(
      ({ e }) =>
        `Recorded ${labelOf(e.recordedAt)}: ${classWord(e.classifier)} (${e.classifier || "no class"}), naming ${labelOf(e.at)}.`,
    );
    const driftSentence =
      facts.drift === null
        ? empty
          ? "No estimate drift to measure yet: fewer than two estimates."
          : "No estimate drift: NO SIGNAL."
        : `Estimate drift ${signedText(facts.drift.drift)} over ${facts.drift.revisions} estimates${facts.drift.exceedsTolerance === null ? "" : `; exceeds the tolerance: ${facts.drift.exceedsTolerance}`}.`;
    sentences.push(driftSentence);
    el("summary").textContent = sentences.join(" ");
    liveText = [bestText || "Best available: NO SIGNAL.", driftSentence].join(
      ". ",
    );

    setHtml(
      el("table-slot"),
      eventsTable(
        facts.events.map((e, i) => ({
          n: i + 1,
          class: html`${glyph(e.classifier)}${codeChip(e.classifier)}`,
          at: labelOf(e.at),
          recorded: labelOf(e.recordedAt),
          note: notes(i),
        })),
      ),
    );

    setHtml(
      el("reason"),
      reason
        ? aside(
            {
              label: empty ? "Nothing to measure yet" : "Why NO SIGNAL",
              tone: empty ? "note" : "caution",
              title: empty ? "Nothing to measure yet" : "Why NO SIGNAL",
            },
            html`<p>${driftReasonText(reason)}</p>`,
          )
        : html``,
    );

    // What the calls return.
    const frame = (
      label: string,
      copyLabel: string,
      fn: string,
      callList: readonly unknown[],
    ): SafeHtml => {
      const [argsHtml, plain] = callArgs(callList);
      return codeFrame({
        label,
        copyLabel,
        copyText: `${fn}(${plain})`,
        code: raw(`${codeSpan("fn", fn)}(${argsHtml})`),
      });
    };
    const tolerance = s.tolerance.trim();
    setHtml(
      el("best-slot"),
      frame(
        "The bestAvailable call",
        "Copy bestAvailable call",
        "bestAvailable",
        [facts.events],
      ),
    );
    setHtml(
      el("drift-slot"),
      frame(
        "The estimateDrift call",
        "Copy estimateDrift call",
        "estimateDrift",
        tolerance ? [facts.events, { tolerance }] : [facts.events],
      ),
    );
    setHtml(
      el("best-output-slot"),
      facts.best === null
        ? callOutput({
            label: "What bestAvailable returned",
            state: "sentinel",
            lines: [{ text: "NO SIGNAL", lost: true }],
          })
        : callOutput({
            label: "What bestAvailable returned",
            state: "live",
            lines: [{ text: formatValue(facts.best), lost: false }],
          }),
    );
    setHtml(
      el("drift-output-slot"),
      facts.drift !== null
        ? callOutput({
            label: "What estimateDrift returned",
            state: "live",
            lines: [{ text: formatValue(facts.drift), lost: false }],
          })
        : empty
          ? callOutput({
              label: "What estimateDrift returned",
              state: "empty",
              lines: [{ text: "null", lost: false }],
            })
          : callOutput({
              label: "What estimateDrift returned",
              state: "sentinel",
              lines: [{ text: "NO SIGNAL", lost: true }],
            }),
    );
  }

  /** How many events were visible before the Events select last changed. */
  let lastCount = visibleCount(start);

  function applyPreset(): void {
    const chosen = ETA_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    writeSeed(presetState(chosen));
    // The preset sets the visible count: the next change of the Events select copies from
    // the events that were showing now, not before the preset.
    lastCount = visibleCount(state());
    syncPreset();
    render();
  }

  /** Showing another event copies the last visible one into a blank slot, so a new event
   *  starts as a valid timestamp the reader can then edit. */
  function fillNewEvents(previous: number): void {
    const s = state();
    const count = visibleCount(s);
    for (let n = previous + 1; n <= count; n++) {
      const e = s.events[n - 1]!;
      const blank =
        e.classifier === ("" as never) && e.at === "" && e.recordedAt === "";
      const from = s.events[n - 2];
      if (!blank || !from) continue;
      classEls[n - 1]!.value = from.classifier || "EST";
      atEls[n - 1]!.value = from.at;
      recEls[n - 1]!.value = from.recordedAt;
    }
  }

  const typed: readonly EventTarget[] = [tolEl, ...atEls, ...recEls];

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      if (e.target === rangeEl) {
        tolEl.value = minutesToIso(Math.round(rangeEl.value));
        syncPreset();
        render();
        announce();
        return;
      }
      if (e.target !== null && typed.includes(e.target)) {
        syncPreset();
        render();
        announce();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed) return;
      const target = e.target;
      if (target === presetEl) {
        applyPreset();
        announce();
      } else if (target === countEl) {
        fillNewEvents(lastCount);
        lastCount = visibleCount(state());
        syncPreset();
        render();
        announce();
      } else if (
        target !== null &&
        (classEls as readonly EventTarget[]).includes(target)
      ) {
        syncPreset();
        render();
        announce();
      }
    },
    { signal },
  );

  writeSeed(start);
  lastCount = visibleCount(state());
  syncPreset();
  render();
  liveText = "";

  const refitText = (): void => {
    if (destroyed) return;
    placeAll();
    thinTickLabels(el("x-ticks"), "[data-tick]");
  };
  const stopWidthWatch = onWidthChange(area, refitText);
  // Text measured before the web fonts swap in is the wrong width: fit again once they
  // have loaded.
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (fonts) {
    void fonts.ready.then(refitText);
    fonts.addEventListener?.("loadingdone", refitText, { signal });
  }
  const stop = (): void => {
    destroyed = true;
    stopWidthWatch();
    cancelAnnounce();
  };
  signal.addEventListener("abort", stop);

  return {
    state,
    destroy() {
      signal.removeEventListener("abort", stop);
      stop();
    },
  };
}

export const mountEtaDrift: MountFn<EtaDriftArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: PunctualityLib;
  try {
    lib = await loadPunctualityLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, initialState(args), signal);
  return onceDestroy(
    () => controller.destroy(),
    () => permalinkOf(controller.state()),
  );
};
