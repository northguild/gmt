/**
 * The Stored Time Audit widget (CORE-83), mountable on its tool page and in the
 * chat rail.
 *
 * The reader pastes stored RFC 9557 strings, one per line. Each line shows the
 * kind `classifyStoredZoned` finds under this browser's rules and every reading
 * it allows. The selected line is drawn on two lanes: the zone's own clock
 * (a skipped or repeated hour, or the offsets in question) and the exact
 * timeline in UTC (the clock change and each reading).
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The
 * template is chrome only; the rows, the lanes and the printed calls are drawn
 * by `mount` from real calls in the reader's browser, so the build host's tz
 * data never reaches a result. Every listener is delegated on the root, so the
 * host dropping the subtree is a complete teardown apart from the width
 * observer and a pending frame.
 */
import { Temporal } from "@js-temporal/polyfill";
import { codeFrameHtml } from "./code-frame";
import { renderCallResults, renderCalls } from "./edi-render";
import {
  asideSizer,
  callSizer,
  holdHtml,
  outputSizer,
  textSizers,
} from "./edi-picture";
import { NO_RESULT_TITLE, type EdiCall } from "./edi-widgets";
import { formatMinuteOfDay } from "./dst-inspector";
import {
  AUDIT_LINKS,
  AUDIT_MAX_CHARS,
  AUDIT_MAX_LINES,
  AUDIT_PRESETS,
  CUSTOM_PRESET_ID,
  HOST_NOTE_TEXT,
  KIND_LABEL_WIDEST,
  NOT_STORED_TEXT,
  NO_BAND_TEXT,
  VALID_REASON_TEXT,
  bandChipText,
  dayTicks,
  defaultLine,
  dstLink,
  figureLabel,
  isSeeded,
  kindLabel,
  laneMarks,
  lineSentence,
  matchPreset,
  parseAuditLines,
  permalinkOf,
  presetState,
  readArgs,
  readAuditLines,
  readingsOf,
  stripFor,
  transitionDate,
  type AuditLine,
  type AuditState,
  type LaneMark,
  type ParsedLines,
  type Strip,
  type StoredTimeAuditArgs,
} from "./stored-time-audit";
import { onWidthChange } from "./label-fit";
import { descriptionHoldHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { loadStoredTimeLib, type StoredTimeLib } from "./stored-time-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  toolLinksHtml,
  wireCopyButtons,
} from "./widget-ui";

export type { StoredTimeAuditArgs } from "./stored-time-audit";

/** The sentinel a line that is not a stored time shows in the Kind cell. */
export const LINE_NO_SIGNAL = "⟨ NO SIGNAL ⟩";

const BLANK_LINES_TEXT = "Paste a stored time above: one line each.";
const BLANK_REASON_TEXT = "Give a stored time to see the rules behind it.";
const NO_TRANSITION_TEXT = (years: readonly number[]) =>
  `No clock change in ${[...years].reverse().join(" or ")} under this browser's rules.`;

/** Rows of the exact lane: one for the clock change, three for the readings. */
const MARK_TIERS = 3;

/** The longest call and result the printed region holds. */
const CALL_SIZER =
  'classifyStoredZoned("2016-12-01T09:00:00+02:00[America/Argentina/ComodRivadavia]")\n' +
  'getDstTransitions("America/Argentina/ComodRivadavia", 2016)\n' +
  'getDstTransitions("America/Argentina/ComodRivadavia", 2015)';

const OUTPUT_SIZER =
  '{"kind":"offsetMismatch","storedOffset":"+02:00","zoneOffset":"+03:00","atStoredOffset":"2016-12-01T07:00:00Z","atZoneOffset":"2016-12-01T06:00:00Z"}\n' +
  '[{"instant":"2016-03-27T01:00:00Z","offsetBefore":"+02:00","offsetAfter":"+03:00"}]\n' +
  '[{"instant":"2015-03-27T01:00:00Z","offsetBefore":"+02:00","offsetAfter":"+03:00"}]';

/** The words under a lane that has nothing to draw, each of which the slot may show. */
const REASON_TEXTS = [
  VALID_REASON_TEXT,
  NO_BAND_TEXT,
  BLANK_REASON_TEXT,
  NO_TRANSITION_TEXT([2019, 2018]),
];

let groupCounter = 0;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    AUDIT_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

const LEGEND = [
  { id: "gap", text: "skipped hour" },
  { id: "overlap", text: "repeated hour" },
  { id: "gate", text: "clock change" },
  { id: "mark", text: "a reading" },
  { id: "break", text: "time not drawn" },
] as const;

function legendHtml(): string {
  return (
    `<ul class="gmt-stored-legend" data-role="legend" aria-label="Legend">` +
    LEGEND.map(
      (l) =>
        `<li class="gmt-cutoff-chip" data-legend="${l.id}"><i class="gmt-stored-swatch" data-swatch="${l.id}" aria-hidden="true"></i>${escapeHtml(l.text)}</li>`,
    ).join("") +
    `</ul>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows, the lanes and the calls are
 * drawn by `mount`, because they come from real library calls.
 */
export function renderStoredTimeAuditTemplate(
  args: StoredTimeAuditArgs = {},
): string {
  const state: AuditState = isSeeded(args)
    ? readArgs(args)
    : presetState(AUDIT_PRESETS[0]!);
  const presetId = matchPreset(state.values);
  const preset = AUDIT_PRESETS.find((p) => p.id === presetId);
  const kindWidth = KIND_LABEL_WIDEST.length;

  return (
    `<div class="gmt-stored-time-audit gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. Paste stored times
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Paste stored times</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      AUDIT_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Stored strings")}` +
    `<textarea class="gmt-input gmt-stored-values" data-role="values" rows="6" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(state.values)}</textarea></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">One stored time per line, at most ${AUDIT_MAX_LINES} lines of ${AUDIT_MAX_CHARS} characters: a date and time, a UTC offset and a bracketed zone, such as <code>2016-12-01T09:00:00+02:00[Europe/Istanbul]</code>.</p>` +
    `<p class="gmt-widget-hint" data-role="host-note">${escapeHtml(HOST_NOTE_TEXT).replace("process.versions.tz", "<code>process.versions.tz</code>")}</p>` +
    `</div>` +
    // 2. What each line still says
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What each line still says</h4>` +
    `<div class="gmt-stored-table-box">` +
    `<table class="gmt-stored-table" data-role="table">` +
    `<thead><tr>` +
    `<th scope="col" class="gmt-stored-col-line">Line</th>` +
    `<th scope="col" class="gmt-stored-col-stored">Stored</th>` +
    `<th scope="col" class="gmt-stored-col-kind" style="--kind-ch:${kindWidth}">Kind</th>` +
    `<th scope="col" class="gmt-stored-col-readings">Readings</th>` +
    `</tr></thead>` +
    `<tbody data-role="rows"></tbody>` +
    `</table>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="truncated" data-grow="slot"></p>` +
    `</div>` +
    // 3. The rules behind the selected line
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The rules behind the selected line</h4>` +
    `<div class="gmt-stored-time-frame" data-role="frame">` +
    `<div class="gmt-stored-figure" data-role="figure" role="img" aria-label="">` +
    `<div class="gmt-stored-lane">` +
    `<span class="gmt-stored-lane-name">On the zone's clock</span>` +
    `<div class="gmt-stored-track gmt-stored-track--clock" data-role="lane-clock"></div>` +
    `</div>` +
    `<div class="gmt-stored-lane">` +
    `<span class="gmt-stored-lane-name">On the exact timeline, in UTC</span>` +
    `<div class="gmt-stored-track gmt-stored-track--exact" data-role="lane-exact"></div>` +
    `</div>` +
    `</div>` +
    legendHtml() +
    `</div>` +
    holdHtml(
      `<div data-role="reason" data-grow="slot"></div>`,
      [
        asideSizer(NO_RESULT_TITLE, [NOT_STORED_TEXT]),
        ...textSizers("p", "gmt-widget-hint", REASON_TEXTS),
      ],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      codeFrameHtml("audit"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="audit-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(AUDIT_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Section 2: the rows
// ---------------------------------------------------------------------------

/** The stored string, breaking only at the `T`, before the offset and before the `[`. */
function storedHtml(value: string): string {
  return escapeHtml(value)
    .replace("T", "T<wbr>")
    .replace(/(?<=\d)(?=[+-]\d{2}:\d{2})/, "<wbr>")
    .replace("[", "<wbr>[");
}

/**
 * A reading value, breaking only directly after the `T` that precedes a digit and
 * directly before the `.` of a fraction. Each stretch between those points is its own
 * nowrap `.gmt-stored-seg`, with a `<wbr>` between: Chromium also breaks after a hyphen,
 * and `word-break: keep-all` does not stop that, so a hyphen inside a segment has to sit
 * where nothing can break. Escape first, then wrap; no character is added to the text.
 */
function readingHtml(value: string): string {
  const cuts: number[] = [];
  const t = /T(?=\d)/.exec(value);
  if (t) cuts.push(t.index + 1);
  const dot = /(?<=\d)(?=\.\d)/.exec(value);
  if (dot) cuts.push(dot.index);
  cuts.sort((a, b) => a - b);
  const segs: string[] = [];
  let from = 0;
  for (const at of [...cuts, value.length]) {
    if (at > from) segs.push(value.slice(from, at));
    from = at;
  }
  return segs
    .map((seg) => `<span class="gmt-stored-seg">${escapeHtml(seg)}</span>`)
    .join("<wbr>");
}

function tokenHtml(name: string, value: string): string {
  return (
    `<span class="gmt-stored-token"><span class="gmt-stored-token-name">${escapeHtml(name)}</span> ` +
    `<span class="gmt-stored-token-value">${readingHtml(value)}</span></span>`
  );
}

function readingsHtml(line: AuditLine): string {
  const r = line.result;
  if (r === null) {
    return `<p class="gmt-stored-sentence">${escapeHtml(NOT_STORED_TEXT)}</p>`;
  }
  const items = readingsOf(r);
  let tokens: string;
  if (r.kind === "offsetMismatch") {
    tokens =
      `<span class="gmt-stored-token gmt-stored-token--pair">` +
      `<span class="gmt-stored-token-name">storedOffset</span> <span class="gmt-stored-token-value">${readingHtml(r.storedOffset)}</span>` +
      ` → ` +
      `<span class="gmt-stored-token-name">zoneOffset</span> <span class="gmt-stored-token-value">${readingHtml(r.zoneOffset)}</span>` +
      `</span>` +
      items
        .filter((i) => i.name.startsWith("at"))
        .map((i) => tokenHtml(i.name, i.value))
        .join("");
  } else {
    tokens = items.map((i) => tokenHtml(i.name, i.value)).join("");
  }
  return (
    `<div class="gmt-stored-tokens">${tokens}</div>` +
    `<p class="gmt-stored-sentence">${escapeHtml(lineSentence(line))}</p>`
  );
}

function rowHtml(
  line: AuditLine,
  n: number,
  selected: boolean,
  group: string,
): string {
  const kind =
    line.result === null
      ? `<span class="gmt-stored-nosignal">${LINE_NO_SIGNAL}</span>`
      : `<span class="gmt-stored-badge" data-kind="${line.result.kind}">${escapeHtml(kindLabel(line.result.kind))}</span>`;
  return (
    `<tr class="gmt-stored-row" data-line="${n}"${selected ? " data-selected" : ""}>` +
    `<td data-label="Line">${chipToggleHtml({ type: "radio", role: "line", value: String(n), label: String(n), ariaLabel: `Draw line ${n}`, checked: selected, name: group })}</td>` +
    `<td data-label="Stored"><code class="gmt-stored-value">${storedHtml(line.value)}</code></td>` +
    `<td data-label="Kind">${kind}</td>` +
    `<td data-label="Readings">${readingsHtml(line)}</td>` +
    `</tr>`
  );
}

function truncatedText(parsed: ParsedLines): string {
  if (!parsed.truncated) return "";
  const parts: string[] = [];
  if (parsed.droppedLines > 0) {
    parts.push(
      `${parsed.droppedLines} more ${parsed.droppedLines === 1 ? "line" : "lines"} not read, after the first ${AUDIT_MAX_LINES}`,
    );
  }
  if (parsed.cutLines) {
    parts.push(`lines cut to ${AUDIT_MAX_CHARS} characters`);
  }
  return `Read ${parsed.lines.length} ${parsed.lines.length === 1 ? "line" : "lines"}: ${parts.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Section 3: the lanes
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function anchorOf(x: number): "start" | "mid" | "end" {
  return x < 22 ? "start" : x > 78 ? "end" : "mid";
}

function tickLabel(minute: number): string {
  return minute >= 1440 ? "24:00" : formatMinuteOfDay(minute);
}

function dayLaneHtml(
  strip: Extract<Strip, { kind: "day" }>,
  trackPx: number,
): string {
  const w = strip.window;
  const left = (w.zoneStartMinutes / 1440) * 100;
  const width = ((w.zoneEndMinutes - w.zoneStartMinutes) / 1440) * 100;
  const kind = strip.gap ? "gap" : "overlap";
  const pinX = (strip.pinMinute / 1440) * 100;
  const chipX = left + width / 2;
  const ticks = dayTicks(w, trackPx > 0 ? trackPx : 600);
  return (
    `<div class="gmt-stored-chiprow">` +
    `<span class="gmt-cutoff-chip gmt-stored-chip" data-kind="${kind}" data-anchor="${anchorOf(chipX)}" style="--x:${pct(chipX)}">${escapeHtml(bandChipText(strip))}</span>` +
    `</div>` +
    `<div class="gmt-stored-daytrack">` +
    `<span class="gmt-stored-band" data-kind="${kind}" style="--x:${pct(left)};--w:${pct(width)}"></span>` +
    ticks
      .map(
        (m) =>
          `<span class="gmt-stored-tick" style="--x:${pct((m / 1440) * 100)}"></span>`,
      )
      .join("") +
    `<span class="gmt-stored-pin" style="--x:${pct(pinX)}"></span>` +
    `</div>` +
    `<div class="gmt-stored-tickrow" aria-hidden="true">` +
    ticks
      .map((m) => {
        const x = (m / 1440) * 100;
        return `<span class="gmt-stored-ticklabel" data-anchor="${anchorOf(x) === "mid" ? "mid" : anchorOf(x)}" style="--x:${pct(x)}">${tickLabel(m)}</span>`;
      })
      .join("") +
    `</div>` +
    `<div class="gmt-stored-pinrow">` +
    `<span class="gmt-cutoff-chip gmt-stored-chip" data-kind="pin" data-anchor="${anchorOf(pinX)}" style="--x:${pct(pinX)}">stored ${tickLabel(strip.pinMinute)}</span>` +
    `</div>`
  );
}

function sinceLaneHtml(
  strip: Extract<Strip, { kind: "since" }>,
  line: AuditLine,
): string {
  const r = line.result!;
  const stored = r.kind === "offsetMismatch" ? r.storedOffset : "";
  const zoneText =
    strip.transition === null
      ? `Zone offset: ${r.kind === "offsetMismatch" ? r.zoneOffset : ""}`
      : `Zone offset since ${transitionDate(strip.transition, strip.zone)}: ${strip.transition.offsetAfter}`;
  return (
    `<div class="gmt-stored-plates">` +
    `<span class="gmt-cutoff-chip gmt-stored-plate" data-series="1">${escapeHtml(zoneText)}</span>` +
    `<span class="gmt-cutoff-chip gmt-stored-plate" data-series="2">${escapeHtml(`Stored offset: ${stored}`)}</span>` +
    `</div>`
  );
}

/** A reading's chip text: its names, and the time it falls at. */
function markText(m: LaneMark, withDate: boolean): string {
  const time = withDate
    ? `${m.instant.slice(5, 10)} ${m.instant.slice(11, 16)}Z`
    : `${m.instant.slice(11, 16)}Z`;
  return `${m.names.join(" = ")} ${time}`;
}

interface Placed {
  gateX: number | null;
  marks: { mark: LaneMark; x: number }[];
}

/** Places the readings and the clock change on the exact lane, as percentages. */
function placeExact(strip: Strip, marks: LaneMark[]): Placed {
  if (strip.kind === "day") {
    const gateMs = Temporal.Instant.from(
      strip.transition.instant,
    ).epochMilliseconds;
    const all = [...marks.map((m) => m.ms), gateMs];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.14, 15 * 60_000);
    const lo = min - pad;
    const span = max + pad - lo;
    const x = (ms: number) => ((ms - lo) / span) * 100;
    return {
      gateX: x(gateMs),
      marks: marks.map((mark) => ({ mark, x: x(mark.ms) })),
    };
  }
  // A since strip: the clock change on the left, a break, then the readings.
  const lo = Math.min(...marks.map((m) => m.ms));
  const hi = Math.max(...marks.map((m) => m.ms));
  const from = strip.kind === "since" && strip.transition !== null ? 36 : 12;
  const to = 90;
  return {
    gateX: strip.kind === "since" && strip.transition !== null ? 8 : null,
    marks: marks.map((mark) => ({
      mark,
      x:
        hi === lo
          ? (from + to) / 2
          : from + ((mark.ms - lo) / (hi - lo)) * (to - from),
    })),
  };
}

function exactLaneHtml(
  strip: Extract<Strip, { kind: "day" | "since" }>,
  marks: LaneMark[],
): string {
  const { gateX, marks: placed } = placeExact(strip, marks);
  const gateKind =
    strip.kind === "day" ? (strip.gap ? "gap" : "overlap") : "since";
  const withDate = strip.kind === "since";
  let html = `<span class="gmt-stored-baseline"></span>`;
  if (strip.kind === "since" && gateX !== null) {
    html += `<span class="gmt-stored-break" style="--x:18;--w:14"></span>`;
  }
  if (gateX !== null) {
    html += `<span class="gmt-stored-gate" data-kind="${gateKind}" style="--x:${pct(gateX)};--tier:0"></span>`;
    const t = strip.transition!;
    const label =
      strip.kind === "since"
        ? `${t.offsetBefore} → ${t.offsetAfter} ${t.instant.slice(0, 10)}`
        : `${t.offsetBefore} → ${t.offsetAfter} ${t.instant.slice(11, 16)}Z`;
    html += `<span class="gmt-cutoff-chip gmt-stored-chip" data-kind="${gateKind === "since" ? "gate" : gateKind}" data-anchor="${anchorOf(gateX)}" style="--x:${pct(gateX)};--tier:0">${escapeHtml(label)}</span>`;
  }
  placed.slice(0, MARK_TIERS).forEach(({ mark, x }, i) => {
    html +=
      `<span class="gmt-stored-markline" data-series="${(i % 3) + 1}" style="--x:${pct(x)};--tier:${i + 1}"></span>` +
      `<span class="gmt-cutoff-chip gmt-stored-chip" data-kind="mark" data-series="${(i % 3) + 1}" data-anchor="${anchorOf(x)}" style="--x:${pct(x)};--tier:${i + 1}" title="${escapeAttr(mark.instant)}">${escapeHtml(markText(mark, withDate))}</span>`;
  });
  return html;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): AuditState;
  apply(state: AuditState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

const formatResult = (value: unknown): string =>
  value === null || value === undefined ? "null" : JSON.stringify(value);

function setupWidget(root: HTMLElement, lib: StoredTimeLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const valuesEl = q<HTMLTextAreaElement>("values")!;
  const group = `gmt-stored-line-${++groupCounter}`;

  let selected: number | null = null;
  let lines: AuditLine[] = [];
  let pending = 0;

  const readState = (): AuditState => ({
    values: valuesEl.value,
    line: selected,
  });

  function syncPreset(): void {
    const id = matchPreset(valuesEl.value);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        AUDIT_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function drawTable(parsed: ParsedLines): void {
    const rows = q("rows");
    if (rows) {
      rows.innerHTML =
        lines.length === 0
          ? `<tr class="gmt-stored-empty"><td colspan="4">${BLANK_LINES_TEXT}</td></tr>`
          : lines
              .map((l, i) => rowHtml(l, i + 1, selected === i + 1, group))
              .join("");
    }
    const hint = q("truncated");
    if (hint) setPresetDescription(hint, truncatedText(parsed));
  }

  /** What the last lanes were drawn for, so a change of width can draw them again. */
  let last: { line: AuditLine; strip: Strip } | null = null;

  function drawLanes(line: AuditLine | null, strip: Strip | null): void {
    const clock = q("lane-clock");
    const exact = q("lane-exact");
    if (!clock || !exact) return;
    last = line && strip ? { line, strip } : null;
    const legend = new Set<string>();
    if (!line || !strip || strip.kind === "none" || line.result === null) {
      clock.innerHTML = "";
      exact.innerHTML = `<span class="gmt-stored-baseline"></span>`;
    } else {
      const marks = laneMarks(line.result);
      if (strip.kind === "day") {
        clock.innerHTML = dayLaneHtml(strip, clock.clientWidth);
        legend.add(strip.gap ? "gap" : "overlap");
        legend.add("gate");
      } else {
        clock.innerHTML = sinceLaneHtml(strip, line);
        if (strip.transition !== null) {
          legend.add("gate");
          legend.add("break");
        }
      }
      exact.innerHTML = exactLaneHtml(strip, marks);
      if (marks.length > 0) legend.add("mark");
    }
    for (const li of root.querySelectorAll<HTMLElement>("[data-legend]")) {
      li.toggleAttribute("data-off", !legend.has(li.dataset["legend"]!));
    }
    q("figure")?.setAttribute(
      "aria-label",
      line && strip ? figureLabel(line, strip) : BLANK_REASON_TEXT,
    );
  }

  function drawReason(line: AuditLine | null, strip: Strip | null): void {
    const slot = q("reason");
    if (!slot) return;
    if (line === null || strip === null) {
      slot.innerHTML = `<p class="gmt-widget-hint">${escapeHtml(BLANK_REASON_TEXT)}</p>`;
    } else if (line.result === null) {
      renderAside(
        slot,
        "caution",
        NO_RESULT_TITLE,
        `<p>${escapeHtml(NOT_STORED_TEXT)}</p>`,
      );
    } else if (strip.kind === "none") {
      slot.innerHTML = `<p class="gmt-widget-hint">${escapeHtml(strip.reason)}</p>`;
    } else if (strip.kind === "since" && strip.transition === null) {
      slot.innerHTML = `<p class="gmt-widget-hint">${escapeHtml(NO_TRANSITION_TEXT(strip.years))}</p>`;
    } else {
      slot.innerHTML = "";
    }
  }

  function drawCalls(line: AuditLine | null, strip: Strip | null): void {
    const out = q("audit-output");
    if (!out) return;
    if (line === null || strip === null) {
      renderCalls(q("call-audit"), []);
      renderWidgetOutput(out, "Not read: there is no line.", "empty");
      return;
    }
    const calls: EdiCall[] = [
      { fn: "classifyStoredZoned", args: [line.value], result: line.result },
      ...strip.calls,
    ];
    renderCalls(q("call-audit"), calls);
    renderCallResults(out, calls, line.result === null, formatResult);
  }

  function drawLink(line: AuditLine | null): void {
    const link = q("link-dst");
    const info = line ? dstLink(line) : null;
    setToolLink(link, info ? info.href : null);
    if (link) {
      link.textContent = info ? info.text : AUDIT_LINKS[0].text;
    }
  }

  function render(): void {
    const parsed = parseAuditLines(valuesEl.value);
    lines = readAuditLines(parsed.lines, lib);
    if (selected === null || selected < 1 || selected > lines.length) {
      selected = lines.length > 0 ? defaultLine(lines) : null;
    }
    drawTable(parsed);
    drawSection3();
  }

  function drawSection3(): void {
    const line = selected === null ? null : (lines[selected - 1] ?? null);
    const strip = line === null ? null : stripFor(line, lib);
    drawLanes(line, strip);
    drawReason(line, strip);
    drawCalls(line, strip);
    drawLink(line);
  }

  function apply(state: AuditState): void {
    setControlValue(valuesEl, state.values);
    selected = state.line;
  }

  function applyPreset(): void {
    const preset = AUDIT_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  }

  const frame: (cb: () => void) => number =
    typeof requestAnimationFrame === "function"
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number;
  const unframe: (id: number) => void =
    typeof cancelAnimationFrame === "function"
      ? (id) => cancelAnimationFrame(id)
      : (id) => clearTimeout(id);

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role !== "values") return;
    // Debounced one frame: a paste of twelve lines reads once.
    if (pending) unframe(pending);
    pending = frame(() => {
      pending = 0;
      // New text is a new list: the old line number names nothing in it, so
      // render picks the first line that is not valid.
      selected = null;
      syncPreset();
      render();
    });
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const role = target.dataset?.["role"] ?? "";
    if (role === "preset") applyPreset();
    else if (role === "line") {
      selected = Number(target.value);
      for (const tr of root.querySelectorAll<HTMLElement>("[data-line]")) {
        tr.toggleAttribute(
          "data-selected",
          tr.dataset["line"] === target.value,
        );
      }
      drawSection3();
    }
  });

  wireCopyButtons(root);

  // A new width can change how many ticks the day lane has room for.
  const clockEl = q<HTMLElement>("lane-clock");
  const disposeWidth = clockEl
    ? onWidthChange(clockEl, () => {
        if (last) drawLanes(last.line, last.strip);
      })
    : () => {};

  // The template seeds a preset; opening on it selects the preset's line.
  const initial = AUDIT_PRESETS.find(
    (p) => p.id === matchPreset(valuesEl.value),
  );
  selected = initial ? initial.selected : null;
  syncPreset();
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      if (pending) unframe(pending);
      pending = 0;
      disposeWidth();
    },
  };
}

export const mountStoredTimeAudit: MountFn<StoredTimeAuditArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: StoredTimeLib;
  try {
    lib = await loadStoredTimeLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
