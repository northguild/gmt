/**
 * The Cron in a Zone widget (CORE-84), mountable on its tool page and in the
 * chat rail.
 *
 * The reader types a cron line and names a zone and a year. Section 2 draws the
 * night of one clock change under both `cronRuns` policies, section 3 lists the
 * next twelve runs under each, and section 4 prints every call made.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The template
 * holds every element the widget ever shows (every row, plate and tick is always
 * laid out and hidden with `data-off`), so nothing moves when a value changes;
 * `mount` only fills them from real calls. Every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
import { codeFrameHtml } from "./code-frame";
import { CURATED_TIMEZONES } from "./curated-timezones";
import { loadCronLib } from "./cron-lib";
import type { CronLib, CronLibPolicy, CronLibRun } from "./cron-lib";
import {
  CRON_MAX_TEXT,
  CRON_PRESETS,
  CUSTOM_PRESET_ID,
  CUSTOM_PRESET_LABEL,
  FIELD_LABELS,
  KIND_WORD,
  LIST_ROWS,
  NIGHT_HOURS,
  NO_RUNS_TEXT,
  NO_SIGNAL_NOTE,
  NO_SIGNAL_TEXT,
  NO_TOUCHED_TEXT,
  PARSE_PAGE,
  POLICIES,
  POLICY_LINE,
  TOUCHED_ROWS,
  WEEKDAY_NOTE,
  afterErrorText,
  cronView,
  noChangeOptionText,
  noChangeText,
  permalinkOf,
  plateText,
  presetIdOf,
  readArgs,
  resultText,
  sentenceOf,
  stateOfPreset,
  zoneErrorText,
  type CronInAZoneArgs,
  type CronState,
  type CronView,
  type ListRow,
  type Mark,
  type TouchedRow,
} from "./cron-in-a-zone";
import { callArgs, formatValue } from "./edi-widgets";
import { callSizer, holdHtml, outputSizer, sizerHtml } from "./edi-picture";
import { renderCallResults, renderCalls } from "./edi-render";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  instantPiecesHtml,
  labelTextHtml,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { CronInAZoneArgs } from "./cron-in-a-zone";

/** What a slot holds while it is laid out and hidden: the shape of a real row. */
const SAMPLE_ROW: TouchedRow = {
  local: "2024-03-31T01:30:00",
  instant: "2024-03-31T01:00:00Z",
  classification: "nonexistent",
};
const TICK_COUNT = NIGHT_HOURS + 1;
const NO_GRAMMAR_NIGHT_TEXT =
  "The line is outside the grammar, so there is nothing to draw.";

const KIND_CLASS: Record<CronLibRun["classification"], string> = {
  unique: "gmt-cutoff-chip--dim",
  nonexistent: "gmt-cutoff-dst--gap",
  ambiguous: "gmt-cutoff-dst--overlap",
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function zoneOptionsHtml(selected: string): string {
  const zones: readonly string[] = (
    CURATED_TIMEZONES as readonly string[]
  ).includes(selected)
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, selected];
  return zones
    .map(
      (z) =>
        `<option value="${escapeAttr(z)}"${z === selected ? " selected" : ""}>${escapeHtml(z)}</option>`,
    )
    .join("");
}

function presetOptionsHtml(selected: string): string {
  return (
    CRON_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === selected ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("") +
    `<option value="${CUSTOM_PRESET_ID}"${selected === CUSTOM_PRESET_ID ? " selected" : ""}>${CUSTOM_PRESET_LABEL}</option>`
  );
}

function fieldsHtml(): string {
  const rows = FIELD_LABELS.map(
    ([key, label]) =>
      `<div class="gmt-cron-field" data-row="${key}">` +
      `<dt>${escapeHtml(label)}</dt>` +
      `<dd><code class="gmt-cron-values" data-role="field-${key}">&nbsp;</code>` +
      `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-cron-star" data-role="star-${key}" data-off>star</span></dd>` +
      `</div>`,
  ).join("");
  return (
    `<div class="gmt-cron-parsed">` +
    `<dl class="gmt-cron-fields" data-role="fields" data-off>${rows}</dl>` +
    `<p class="gmt-cron-nosignal" data-role="nosignal" data-off>` +
    `<span class="gmt-cron-nosignal-pill">${NO_SIGNAL_TEXT}</span>` +
    `<span class="gmt-cron-nosignal-note">${escapeHtml(NO_SIGNAL_NOTE)} <a href="${withBase(PARSE_PAGE)}">Read the grammar</a>.</span>` +
    `</p>` +
    `</div>` +
    `<p class="gmt-widget-hint gmt-cron-weekday">${escapeHtml(WEEKDAY_NOTE)}</p>`
  );
}

function legendHtml(): string {
  const item = (kind: CronLibRun["classification"], words: string) =>
    `<li class="gmt-cron-legend-item"><span class="gmt-cron-swatch gmt-cron-mark--${kind}" aria-hidden="true"><span class="gmt-cron-stem"></span></span>${escapeHtml(words)}</li>`;
  return (
    `<ul class="gmt-cron-legend" aria-label="Legend">` +
    item("unique", "Solid line: an ordinary time") +
    item("nonexistent", "Dashed line on hatching: a skipped time") +
    item("ambiguous", "Double line: a repeated time") +
    `</ul>`
  );
}

function axisHtml(role: string, caption: string): string {
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const edge =
      i === 0
        ? " gmt-cron-tick--first"
        : i === TICK_COUNT - 1
          ? " gmt-cron-tick--last"
          : "";
    return `<span class="gmt-cutoff-axis-tick gmt-cron-tick${edge}" style="left:${(i / NIGHT_HOURS) * 100}%" data-off>00:00</span>`;
  }).join("");
  return (
    `<div class="gmt-cron-axis-row"><span class="gmt-cron-axis-cap">${escapeHtml(caption)}</span>` +
    `<div class="gmt-cron-axis" data-role="${role}">${ticks}</div></div>`
  );
}

function laneHtml(policy: CronLibPolicy): string {
  return (
    `<div class="gmt-cron-lane" data-lane="${policy}">` +
    `<div class="gmt-cron-lane-head">` +
    `<div class="gmt-cron-lane-name"><code>${policy}</code><span class="gmt-cron-lane-line">${escapeHtml(POLICY_LINE[policy])}</span></div>` +
    `<span class="gmt-cron-plate" data-role="plate-${policy}" data-off>${plateText(88)}</span>` +
    `</div>` +
    `<div class="gmt-cron-track" role="img" aria-label="${policy}" data-role="track-${policy}"><span class="gmt-cron-rule" data-role="rule-${policy}" data-off></span><div class="gmt-cron-marks" data-role="marks-${policy}"></div></div>` +
    `</div>`
  );
}

/** One table row in the shape of a real row, hidden until filled. */
function sampleRowHtml(policy: CronLibPolicy): string {
  return (
    `<tr data-off>` +
    `<td data-role="c-local">${instantPiecesHtml(SAMPLE_ROW.local)}</td>` +
    `<td data-role="c-instant">${instantPiecesHtml(SAMPLE_ROW.instant)}</td>` +
    `<td data-role="c-kind">${kindHtml(SAMPLE_ROW.classification, false, policy)}</td>` +
    `</tr>`
  );
}

/** A kind cell: the word, and the "only under" line, which a row hides unless it is one. */
function kindHtml(
  kind: CronLibRun["classification"],
  only: boolean,
  policy: CronLibPolicy,
): string {
  return (
    `<span class="gmt-cutoff-chip ${KIND_CLASS[kind]}">${KIND_WORD[kind]}</span>` +
    `<span class="gmt-cron-only"${only ? "" : " data-off"}>only under <code>${policy}</code></span>`
  );
}

function noteRowHtml(): string {
  return (
    `<tr class="gmt-cron-note-row"><td colspan="3">` +
    holdHtml(
      `<span class="gmt-cron-note" data-role="note"></span>`,
      [sizerHtml("span", "gmt-cron-note", escapeHtml(NO_TOUCHED_TEXT))],
      "gmt-ledger-hold",
    ) +
    `</td></tr>`
  );
}

function tableHtml(
  role: string,
  policy: CronLibPolicy,
  caption: string,
  rows: number,
): string {
  return (
    `<div class="gmt-cron-table-box">` +
    `<table class="gmt-cron-table" data-role="${role}">` +
    `<caption>${caption}</caption>` +
    `<thead><tr><th scope="col">Local</th><th scope="col">Instant</th><th scope="col">Kind</th></tr></thead>` +
    `<tbody>${sampleRowHtml(policy).repeat(rows)}${noteRowHtml()}</tbody>` +
    `</table></div>`
  );
}

/** The widest expression the call lines print: every value of every field. */
const WORST_FIELD = (n: number, from = 0) => ({
  values: Array.from({ length: n }, (_, i) => from + i),
  star: true,
});
const WORST_EXPRESSION = {
  minute: WORST_FIELD(60),
  hour: WORST_FIELD(24),
  dayOfMonth: WORST_FIELD(31, 1),
  month: WORST_FIELD(12, 1),
  dayOfWeek: WORST_FIELD(7, 1),
};
const WORST_ZONE = "America/Argentina/ComodRivadavia";
const WORST_RUNS = Array.from({ length: LIST_ROWS }, (_, i) => ({
  local: "2024-03-31T01:30:00",
  instant: `2024-03-31T01:${String(i).padStart(2, "0")}:00Z`,
  classification: "nonexistent" as const,
}));

function printed(fn: string, args: readonly unknown[]): string {
  return `${fn}(${callArgs(args)[1]})`;
}

const CALL_SIZER = [
  printed("isValidTimeZone", [WORST_ZONE]),
  printed("parseCronExpression", ["x".repeat(CRON_MAX_TEXT)]),
  printed("getDstTransitions", [WORST_ZONE, 2100]),
  ...[0, 1].map(() =>
    printed("cronRuns", [
      WORST_EXPRESSION,
      WORST_ZONE,
      { start: "2024-03-30T22:00:00Z", end: "2024-03-31T04:00:00Z" },
      "daemonCatchUp",
    ]),
  ),
  ...[0, 1].map(() =>
    printed("cronRuns", [
      WORST_EXPRESSION,
      WORST_ZONE,
      { after: "2024-03-30T22:00:00Z", count: LIST_ROWS },
      "daemonCatchUp",
    ]),
  ),
].join("\n");

const OUTPUT_SIZER = [
  "false",
  formatValue(WORST_EXPRESSION),
  formatValue([
    {
      instant: "2024-03-31T01:00:00Z",
      offsetBefore: "+00:00",
      offsetAfter: "+01:00",
    },
    {
      instant: "2024-10-27T01:00:00Z",
      offsetBefore: "+01:00",
      offsetAfter: "+00:00",
    },
  ]),
  ...[0, 1, 2, 3].map(() => resultText("cronRuns", WORST_RUNS, formatValue)),
].join("\n");

/** A one-line readout and the longest text it can show, in one cell. */
function heldLine(
  role: string,
  className: string,
  worst: readonly string[],
): string {
  return holdHtml(
    `<p class="${className}" data-role="${role}">&nbsp;</p>`,
    worst.map((t) => sizerHtml("p", className, escapeHtml(t))),
    "gmt-ledger-hold",
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. It holds
 * every element the widget shows; `mount` fills them from real library calls.
 */
export function renderCronInAZoneTemplate(args: CronInAZoneArgs = {}): string {
  const state = readArgs(args);
  return (
    `<div class="gmt-cron-zone gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The line
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. The line</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Cron line")}` +
    `<input class="gmt-input gmt-cron-line" data-role="line" type="text" maxlength="${CRON_MAX_TEXT}" value="${escapeAttr(state.line)}" spellcheck="false" autocomplete="off" autocapitalize="off">` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Try")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetIdOf(state))}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Time zone")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptionsHtml(state.zone)}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Year")}` +
    `<input class="gmt-input" data-role="year" type="number" inputmode="numeric" min="1900" max="2100" step="1" value="${escapeAttr(state.year)}">` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Clock change")}` +
    `<select class="gmt-select" data-role="change"><option value="${escapeAttr(state.change)}">&nbsp;</option></select>` +
    `</label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Runs after", { optional: true })}` +
    `<input class="gmt-input gmt-cron-line" data-role="after" type="text" maxlength="${CRON_MAX_TEXT}" value="${escapeAttr(state.after)}" placeholder="2024-03-31T01:00:00Z" spellcheck="false" autocomplete="off" autocapitalize="off">` +
    `</label>` +
    `</div>` +
    heldLine("problem", "gmt-widget-hint gmt-cron-problem", [
      zoneErrorText("z".repeat(CRON_MAX_TEXT)),
      afterErrorText("x".repeat(CRON_MAX_TEXT)),
    ]) +
    fieldsHtml() +
    `</div>` +
    // 2. The night of the change
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. The night of the change</h4>` +
    heldLine("nightnote", "gmt-widget-hint gmt-cron-nightnote", [
      noChangeText(2024),
      NO_GRAMMAR_NIGHT_TEXT,
    ]) +
    `<div class="gmt-cron-frame" data-role="night-frame">` +
    legendHtml() +
    `<div class="gmt-cron-plot" data-role="plot">` +
    `<div class="gmt-cron-chiprow"><span class="gmt-cutoff-chip gmt-cron-chip" data-role="chip" data-off>clock change, +00:00 → +01:00</span></div>` +
    axisHtml("axis-utc", "UTC") +
    axisHtml("axis-wall", "Wall") +
    `<div class="gmt-cron-lanes">` +
    POLICIES.map(laneHtml).join("") +
    `</div>` +
    `</div>` +
    `</div>` +
    heldLine("sentence", "gmt-cron-sentence", [sentenceOf(false, 88, 88)]) +
    `<div class="gmt-cron-pair">` +
    POLICIES.map((p) =>
      tableHtml(
        `touched-${p}`,
        p,
        `<code>${p}</code>, skipped or repeated times`,
        TOUCHED_ROWS,
      ),
    ).join("") +
    `</div>` +
    `</div>` +
    // 3. Next runs
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. Next runs</h4>` +
    heldLine("after-used", "gmt-widget-hint gmt-cron-after", [
      `Runs strictly after ${"x".repeat(CRON_MAX_TEXT)}.`,
    ]) +
    `<div class="gmt-cron-pair">` +
    POLICIES.map((p) =>
      tableHtml(
        `list-${p}`,
        p,
        `<code>${p}</code>, the next ${LIST_ROWS} runs`,
        LIST_ROWS,
      ),
    ).join("") +
    `</div>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide gmt-cron-calls">` +
    `<h4>4. The calls</h4>` +
    holdHtml(
      codeFrameHtml("cron"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="cron-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

type Q = <T extends HTMLElement>(role: string) => T | null;

const setOff = (el: Element | null, off: boolean) =>
  el?.toggleAttribute("data-off", off);

function drawProblem(q: Q, view: CronView): void {
  const el = q("problem");
  if (!el) return;
  el.textContent =
    view.zoneError ??
    view.yearError ??
    view.afterError ??
    view.changeNote ??
    " ";
}

function drawFields(q: Q, view: CronView): void {
  setOff(q("fields"), view.fields === null);
  setOff(q("nosignal"), !(view.parsed && view.expr === null));
  for (const [key] of FIELD_LABELS) {
    const row = view.fields?.find((f) => f.key === key);
    const values = q(`field-${key}`);
    if (values) values.textContent = row ? row.text : " ";
    setOff(q(`star-${key}`), !row?.star);
  }
}

function drawChange(q: Q, view: CronView, state: CronState): void {
  const select = q<HTMLSelectElement>("change");
  if (!select) return;
  select.innerHTML = "";
  const add = (value: string, label: string) => {
    const opt = select.ownerDocument.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.append(opt);
  };
  if (view.changes.length > 0) {
    for (const c of view.changes) add(c.value, c.label);
    select.disabled = false;
    select.value = String(view.ordinal);
  } else {
    add(
      "",
      view.noChangeNote !== null
        ? noChangeOptionText(state.year)
        : "Needs a valid zone and year",
    );
    select.disabled = true;
  }
}

function drawAxes(root: HTMLElement, view: CronView): void {
  const night = view.night;
  for (const [role, pick] of [
    ["axis-utc", (t: { utc: string }) => t.utc],
    ["axis-wall", (t: { wall: string }) => t.wall],
  ] as const) {
    const row = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!row) continue;
    row.querySelectorAll<HTMLElement>(".gmt-cron-tick").forEach((tick, i) => {
      const t = night?.ticks[i];
      tick.textContent = t ? pick(t as { utc: string; wall: string }) : "00:00";
      tick.toggleAttribute("data-off", !t);
    });
    thinTickLabels(row, ".gmt-cron-tick");
  }
}

function marksHtml(marks: readonly Mark[]): string {
  return marks
    .map(
      (m) =>
        `<span class="gmt-cron-mark gmt-cron-mark--${m.classification}" style="left:${m.pct}%" data-kind="${m.classification}">` +
        `<span class="gmt-cron-stem"></span>` +
        (m.count > 1 ? `<span class="gmt-cron-count">×${m.count}</span>` : "") +
        `</span>`,
    )
    .join("");
}

/** Fills a table's fixed rows; the rows past `rows.length` stay laid out and hidden. */
function fillRows(
  table: HTMLElement | null,
  rows: readonly (TouchedRow | ListRow)[],
  capacity: number,
  policy: CronLibPolicy,
): void {
  if (!table) return;
  const trs = [...table.querySelectorAll<HTMLElement>("tbody > tr")].slice(
    0,
    capacity,
  );
  trs.forEach((tr, i) => {
    const row = rows[i];
    tr.toggleAttribute("data-off", !row);
    tr.toggleAttribute("data-only", Boolean(row && "only" in row && row.only));
    const [local, instant, kind] = [...tr.children] as HTMLElement[];
    const shown = row ?? SAMPLE_ROW;
    if (local) local.innerHTML = instantPiecesHtml(shown.local);
    if (instant) instant.innerHTML = instantPiecesHtml(shown.instant);
    if (kind) {
      kind.innerHTML = kindHtml(
        shown.classification,
        Boolean(row && "only" in row && row.only),
        policy,
      );
    }
  });
}

function setNote(table: HTMLElement | null, text: string): void {
  const note = table?.querySelector<HTMLElement>('[data-role="note"]');
  if (note) note.textContent = text;
}

function drawNight(root: HTMLElement, q: Q, view: CronView): void {
  const night = view.night;
  setOff(q("chip"), !night);
  const chip = q("chip");
  if (chip && night) chip.textContent = night.chip;
  drawAxes(root, view);

  const nightNote = q("nightnote");
  if (nightNote) {
    nightNote.textContent =
      view.noChangeNote ??
      (view.expr === null && view.parsed ? NO_GRAMMAR_NIGHT_TEXT : " ");
  }

  POLICIES.forEach((policy, i) => {
    const lane = night?.lanes[i];
    const plate = q(`plate-${policy}`);
    if (plate && lane) plate.textContent = lane.plate;
    setOff(plate, !lane);
    const marks = q(`marks-${policy}`);
    if (marks) marks.innerHTML = lane ? marksHtml(lane.marks) : "";
    setOff(q(`rule-${policy}`), !night);
    const track = q(`track-${policy}`);
    if (track) {
      track.setAttribute(
        "aria-label",
        lane ? `${policy}: ${lane.plate}` : `${policy}: nothing to draw`,
      );
    }
    const table = q(`touched-${policy}`);
    fillRows(table, lane?.touched ?? [], TOUCHED_ROWS, policy);
    setNote(
      table,
      !lane
        ? ""
        : lane.more > 0
          ? `and ${lane.more} more`
          : lane.touched.length === 0
            ? NO_TOUCHED_TEXT
            : "",
    );
  });

  const sentence = q("sentence");
  if (sentence) sentence.textContent = night ? night.sentence : " ";
}

function drawLists(q: Q, view: CronView): void {
  const after = q("after-used");
  if (after) {
    after.textContent = view.afterUsed
      ? `Runs strictly after ${view.afterUsed}.`
      : " ";
  }
  POLICIES.forEach((policy, i) => {
    const rows = view.lists?.[i] ?? [];
    const table = q(`list-${policy}`);
    fillRows(table, rows, LIST_ROWS, policy);
    setNote(table, view.lists && rows.length === 0 ? NO_RUNS_TEXT : "");
  });
}

function drawCalls(q: Q, view: CronView): void {
  renderCalls(q("call-cron"), view.calls);
  const out = q("cron-output");
  if (!out) return;
  const shown = view.calls.map((c) => ({
    ...c,
    result:
      c.fn === "cronRuns" ? resultText(c.fn, c.result, formatValue) : c.result,
  }));
  renderCallResults(out, shown, view.parsed && view.expr === null, (v) =>
    typeof v === "string" ? v : formatValue(v),
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: CronLib, initial: CronState) {
  const q: Q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const line = q<HTMLInputElement>("line")!;
  const zone = q<HTMLSelectElement>("zone")!;
  const year = q<HTMLInputElement>("year")!;
  const after = q<HTMLInputElement>("after")!;
  const preset = q<HTMLSelectElement>("preset")!;
  const change = q<HTMLSelectElement>("change")!;
  let changeAsked = initial.change;

  const readState = (): CronState => ({
    line: line.value,
    zone: zone.value,
    year: year.value,
    change: changeAsked,
    after: after.value.trim(),
  });

  function apply(state: CronState): void {
    line.value = state.line;
    setControlValue(zone, state.zone);
    year.value = state.year;
    after.value = state.after;
    changeAsked = state.change;
  }

  function render(): void {
    const state = readState();
    const view = cronView(lib, state);
    preset.value = presetIdOf(state);
    drawProblem(q, view);
    drawFields(q, view);
    drawChange(q, view, state);
    drawNight(root, q, view);
    drawLists(q, view);
    drawCalls(q, view);
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"];
    if (role === "line" || role === "year" || role === "after") render();
  });
  root.addEventListener("change", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"];
    if (role === "preset") {
      const hit = CRON_PRESETS.find((p) => p.id === preset.value);
      if (!hit) return;
      apply(stateOfPreset(hit));
      render();
    } else if (role === "zone" || role === "year") {
      render();
    } else if (role === "change") {
      changeAsked = change.value;
      render();
    }
  });
  wireCopyButtons(root);

  apply(initial);
  render();

  const frame = q("night-frame");
  const stop = frame
    ? onWidthChange(frame, () => {
        for (const role of ["axis-utc", "axis-wall"]) {
          const row = q(role);
          if (row) thinTickLabels(row, ".gmt-cron-tick");
        }
      })
    : () => {};
  return { readState, stop };
}

export const mountCronInAZone: MountFn<CronInAZoneArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: CronLib;
  try {
    lib = await loadCronLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, readArgs(args));

  return onceDestroy(
    () => widget.stop(),
    () => permalinkOf(widget.readState()),
  );
};
