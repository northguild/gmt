/**
 * The Cut-off Stack widget (TRAN-10), mountable on its tool page and in the
 * chat rail.
 *
 * A sailing's whole stack of cut-offs, computed by `cutoffSchedule` against
 * one departure, earliest first, with closed days shaded and each rolled
 * cut-off drawn where it landed and where `cutoffAt` with no calendar would
 * have put it.
 *
 * Follows the Free Time Ledger's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  CUSTOM_PRESET_ID,
  MAX_CUTOFFS,
  STACK_PRESETS,
  axisDatesOf,
  collectStackFacts,
  entriesOf,
  matchPreset,
  optionsOf,
  permalinkOf,
  presetState,
  readArgs,
  stackNullReason,
  stackNullText,
  type CutoffFields,
  type CutoffStackArgs,
  type StackFacts,
  type StackRow,
  type StackState,
} from "./cutoff-stack";
import {
  ROLL_OPTIONS,
  WEEKDAYS,
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  callSource,
  dayTickLabel,
  durationText,
  epochMs,
  formatStack,
  localLabel,
  localParts,
} from "./cutoff-widgets";
import { codeFrameHtml } from "./code-frame";
import { loadCutoffLib } from "./cutoff-lib";
import { onWidthChange, pickLabelLeft, placeLabel } from "./label-fit";
import type { CutoffLib } from "./cutoff-widgets";
import { transportIcon } from "./transport-icons";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
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

export type { CutoffStackArgs } from "./cutoff-stack";

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    STACK_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function cutoffFieldset(n: number, c: CutoffFields): string {
  return (
    `<fieldset class="gmt-transport-leg gmt-cutoff-fieldset" data-role="cutoff-${n}">` +
    `<legend>Cut-off ${n}</legend>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Name")}` +
    `<input class="gmt-input" data-role="name-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(c.name)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Offset")}` +
    `<input class="gmt-input" data-role="offset-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(c.offset)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("At local time", { optional: true })}` +
    `<input class="gmt-input" data-role="at-local-time-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(c.atLocalTime)}"></label>` +
    `</div>` +
    `</fieldset>`
  );
}

function closedDaysFieldset(state: StackState): string {
  const weekdayBoxes = WEEKDAYS.map((w) =>
    chipToggleHtml({
      type: "checkbox",
      role: `weekday-${w.value}`,
      value: String(w.value),
      label: w.label,
      checked: state.weekend.includes(w.value),
    }),
  ).join("");
  const rollOptions =
    `<option value=""${state.roll === "" ? " selected" : ""}>(not given)</option>` +
    ROLL_OPTIONS.map(
      (r) =>
        `<option value="${escapeAttr(r)}"${r === state.roll ? " selected" : ""}>${escapeHtml(r)}</option>`,
    ).join("");
  return (
    `<fieldset class="gmt-transport-leg gmt-cutoff-calendar" data-role="closed-days">` +
    `<legend>Closed days</legend>` +
    chipToggleHtml({
      type: "checkbox",
      role: "calendar",
      value: "calendar",
      label: "Use a business calendar",
      checked: state.calendar,
      switch: true,
    }) +
    `<fieldset class="gmt-chip-group"><legend>Weekend</legend>${weekdayBoxes}</fieldset>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Holidays")}` +
    `<input class="gmt-input" data-role="holidays" type="text" spellcheck="false" autocomplete="off" placeholder="2024-05-09, 2024-12-25" value="${escapeAttr(state.holidays)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Roll a closed-day cut-off")}` +
    `<select class="gmt-select" data-role="roll">${rollOptions}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">ISO dates, separated by commas</p>` +
    `<p class="gmt-widget-hint">There is no default: a calendar without a roll, or a roll without a calendar, returns [].</p>` +
    `</fieldset>`
  );
}

/** `renderCutoffStackTemplate(args = {})` (seeded when `args.anchor` or
 *  `args.cutoffs` or `args.name1` is defined, else the first preset). */
export function renderCutoffStackTemplate(args: CutoffStackArgs = {}): string {
  const flat = args as unknown as Record<string, unknown>;
  const seeded =
    args.anchor !== undefined ||
    args.cutoffs !== undefined ||
    flat.name1 !== undefined;
  const state: StackState = seeded
    ? readArgs(args)
    : presetState(STACK_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = STACK_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-cutoff-stack gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The sailing and its cut-offs</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Departs")}` +
    `<input class="gmt-input" data-role="anchor" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.anchor)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Terminal clock")}` +
    `<select class="gmt-select" data-role="time-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `</div>` +
    [1, 2, 3, 4].map((n) => cutoffFieldset(n, state.cutoffs[n - 1]!)).join("") +
    closedDaysFieldset(state) +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. When each cut-off closes</h4>` +
    `<div class="gmt-cutoff-stack-timeline" data-role="stack-timeline" role="img" aria-labelledby="stack-summary" tabindex="-1"></div>` +
    `<p class="gmt-widget-hint" id="stack-summary" data-role="stack-summary"></p>` +
    `<table class="gmt-cutoff-stack-table" data-role="stack-table" role="table">` +
    `<thead role="rowgroup"><tr role="row"><th role="columnheader">Cut-off</th><th role="columnheader">Rule</th><th role="columnheader">Closes</th><th role="columnheader">Before departure</th><th role="columnheader">Moved</th></tr></thead>` +
    `<tbody data-role="stack-table-body" role="rowgroup"></tbody>` +
    `</table>` +
    `<div class="gmt-transport-reason" data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>cutoffSchedule</code> returns</h4>` +
    codeFrameHtml("stack") +
    `<output class="gmt-widget-output" data-role="stack-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function ruleText(row: StackRow): string {
  return row.atLocalTime ? `${row.offset} at ${row.atLocalTime}` : row.offset;
}

function movedText(row: StackRow): string {
  if (row.unrolled === undefined) return "—";
  return row.moved ? `from ${localLabel(row.unrolled)}` : "no";
}

function beforeDepartureText(row: StackRow): string {
  const words = durationText(row.beforeDeparture);
  return row.afterDeparture
    ? `${words} after the departure: cutoffAt does not check order`
    : `${words} before departure`;
}

interface DayBound {
  date: string;
  startMs: number;
  endMs: number;
}

/**
 * Each axis date's real local-day bounds, from the polyfill's own
 * `startOfDay()` chained day by day — the same boundary `dwellTime`'s own
 * grid uses, so a 23- or 25-hour DST day is one column at its real width,
 * never a day arithmetic of this widget's own. `[]` when `dates` is empty or
 * the zone does not resolve.
 */
function dayBoundsFor(dates: readonly string[], zone: string): DayBound[] {
  if (dates.length === 0) return [];
  try {
    let day = Temporal.PlainDate.from(dates[0]!)
      .toZonedDateTime({ timeZone: zone, plainTime: "12:00" })
      .startOfDay();
    const out: DayBound[] = [];
    for (const date of dates) {
      const next = day.add({ days: 1 }).startOfDay();
      out.push({
        date,
        startMs: day.epochMilliseconds,
        endMs: next.epochMilliseconds,
      });
      day = next;
    }
    return out;
  } catch {
    return [];
  }
}

/** A column narrower than this shows no date label; its `title` still names
 *  it. Mirrors the Free Time Ledger's own narrow-cell threshold. */
const MIN_LABEL_PERCENT = 9;

function renderTimeline(
  el: HTMLElement,
  facts: StackFacts,
  timeZone: string,
): void {
  const dates = axisDatesOf(
    facts.rows.map((r) => ({ at: r.at, unrolled: r.unrolled })),
    facts.departure,
  );
  const bounds = dayBoundsFor(dates, timeZone);
  if (bounds.length === 0) {
    el.innerHTML = "";
    return;
  }
  const axisStartMs = bounds[0]!.startMs;
  const axisEndMs = bounds[bounds.length - 1]!.endMs;
  const span = Math.max(1, axisEndMs - axisStartMs);
  const pct = (ms: number) => ((ms - axisStartMs) / span) * 100;

  const departureMs = facts.departure ? epochMs(facts.departure) : null;
  const departurePct = departureMs !== null ? pct(departureMs) : null;

  let anyClosedLabel = false;
  const columns = bounds
    .map((b) => {
      const closed = facts.closedDays[b.date] ?? false;
      const widthPct = ((b.endMs - b.startMs) / span) * 100;
      const dateLabel = dayTickLabel(
        Temporal.Instant.fromEpochMilliseconds(b.startMs).toZonedDateTimeISO(
          timeZone,
        ),
      );
      const showLabel = widthPct >= MIN_LABEL_PERCENT;
      if (closed && showLabel) anyClosedLabel = true;
      return (
        `<div class="gmt-cutoff-stack-day${closed ? " gmt-cutoff-stack-day--closed gmt-cutoff-closed" : ""}" ` +
        `style="left:${pct(b.startMs)}%;width:${widthPct}%" title="${escapeAttr(dateLabel)}${closed ? " (closed)" : ""}">` +
        (showLabel
          ? `<span class="gmt-cutoff-stack-day-label">${escapeHtml(dateLabel)}</span>`
          : "") +
        (closed && showLabel
          ? `<span class="gmt-cutoff-chip gmt-cutoff-stack-day-closed">closed</span>`
          : "") +
        `</div>`
      );
    })
    .join("");

  // The one departure gate, drawn once in the days layer, and its chip.
  const gate =
    departurePct === null
      ? ""
      : `<span class="gmt-cutoff-gate" style="left:${departurePct}%"></span>` +
        `<span class="gmt-cutoff-chip gmt-cutoff-stack-gate-chip" style="left:${departurePct}%">` +
        transportIcon("ship", { className: "gmt-cutoff-icon", size: 14 }) +
        `<span>departs ${escapeHtml(localParts(facts.departure).time)}</span></span>`;

  const lanes = facts.rows
    .map((row) => {
      const atMs = epochMs(row.at);
      const atPct = pct(atMs);
      const solid = `<span class="gmt-cutoff-mark gmt-cutoff-stack-marker gmt-cutoff-stack-marker--solid" style="left:${atPct}%" title="${escapeAttr(localLabel(row.at))}"></span>`;
      let hollow = "";
      let arc = "";
      if (row.moved && row.unrolled !== undefined) {
        const unrolledPct = pct(epochMs(row.unrolled));
        hollow = `<span class="gmt-cutoff-mark gmt-cutoff-mark--hollow gmt-cutoff-stack-marker gmt-cutoff-stack-marker--hollow" style="left:${unrolledPct}%" title="${escapeAttr(`moved from ${localLabel(row.unrolled)}`)}"></span>`;
        const delta = Math.abs(unrolledPct - atPct);
        // Skip the arc when the two markers all but coincide.
        if (delta > 1.5) {
          // The path runs from the hollow marker to the solid one, so the
          // dashes flow that way.
          const d =
            unrolledPct <= atPct
              ? "M 0 50 Q 50 -30 100 50"
              : "M 100 50 Q 50 -30 0 50";
          arc =
            `<svg class="gmt-cutoff-stack-arc" aria-hidden="true" focusable="false" ` +
            `viewBox="0 0 100 100" preserveAspectRatio="none" ` +
            `style="left:${Math.min(unrolledPct, atPct)}%;width:${delta}%">` +
            `<path d="${d}"></path></svg>`;
        }
      }
      return (
        `<div class="gmt-cutoff-stack-lane" data-series="${row.series}">` +
        `<span class="gmt-cutoff-stack-lane-label"><span class="gmt-cutoff-series-swatch" aria-hidden="true"></span><span>${escapeHtml(row.name)}</span></span>` +
        `<div class="gmt-cutoff-stack-lane-track">` +
        arc +
        hollow +
        solid +
        `<span class="gmt-cutoff-chip gmt-cutoff-stack-lane-time" data-x="${atPct}" style="left:calc(${atPct}% - 7px)">${escapeHtml(localLabel(row.at))}${row.moved ? " · moved" : ""}</span>` +
        `</div>` +
        `</div>`
      );
    })
    .join("");

  const departureLine = facts.departure
    ? `<div class="gmt-cutoff-stack-departure-line">Departs ${escapeHtml(localLabel(facts.departure))} (${escapeHtml(timeZone)})</div>`
    : "";

  el.innerHTML =
    `<div class="gmt-cutoff-stack-plot${anyClosedLabel ? " gmt-cutoff-stack-plot--closed" : ""}">` +
    `<div class="gmt-cutoff-stack-days">${columns}${gate}</div>` +
    `<div class="gmt-cutoff-stack-lanes">${lanes}</div>` +
    `</div>` +
    departureLine;
  fitStackTimeline(el);
}

/** Drop day labels their column cannot hold, and flip a lane's time chip to
 *  the other side of its marker when it would run past the track or cross the
 *  departure gate. Measured, so it re-runs when the width changes. */
function fitStackTimeline(el: HTMLElement): void {
  for (const day of el.querySelectorAll<HTMLElement>(".gmt-cutoff-stack-day")) {
    day.classList.remove("gmt-cutoff-stack-day--narrow");
    const label = day.querySelector<HTMLElement>(".gmt-cutoff-stack-day-label");
    const closed = day.querySelector<HTMLElement>(
      ".gmt-cutoff-stack-day-closed",
    );
    if (closed) closed.hidden = false;
    if (!label || day.clientWidth === 0) continue;
    if (label.scrollWidth > label.clientWidth + 0.5) {
      day.classList.add("gmt-cutoff-stack-day--narrow");
    } else if (closed && closed.offsetWidth + 6 > day.clientWidth) {
      closed.hidden = true;
    }
  }
  const days = el.querySelector<HTMLElement>(".gmt-cutoff-stack-days");
  const gate = days?.querySelector<HTMLElement>(".gmt-cutoff-gate") ?? null;
  const trackPx = days?.clientWidth ?? 0;
  const gatePx =
    gate && trackPx > 0 ? (parseFloat(gate.style.left) / 100) * trackPx : NaN;
  const gateChip = days?.querySelector<HTMLElement>(
    ".gmt-cutoff-stack-gate-chip",
  );
  if (gateChip && trackPx > 0 && !Number.isNaN(gatePx)) {
    gateChip.classList.remove("gmt-cutoff-stack-gate-chip--end");
    const side = placeLabel({
      atPx: gatePx,
      labelPx: gateChip.getBoundingClientRect().width,
      trackPx,
      offsetPx: 10,
    });
    gateChip.classList.toggle(
      "gmt-cutoff-stack-gate-chip--end",
      side === "end",
    );
  }
  for (const track of el.querySelectorAll<HTMLElement>(
    ".gmt-cutoff-stack-lane-track",
  )) {
    const time = track.querySelector<HTMLElement>(
      ".gmt-cutoff-stack-lane-time",
    );
    if (!time || track.clientWidth === 0) continue;
    const w = track.clientWidth;
    const at = (parseFloat(time.dataset.x ?? "0") / 100) * w;
    const labelPx = time.getBoundingClientRect().width;
    // Hanging from just left of the marker; else just right of it; else
    // tucked against the departure gate's left side.
    const left = pickLabelLeft(
      [
        at - 7,
        at + 7 - labelPx,
        ...(Number.isNaN(gatePx) ? [] : [gatePx - 8 - labelPx]),
      ],
      labelPx,
      w,
      Number.isNaN(gatePx) ? [] : [gatePx],
    );
    time.style.left = `${left}px`;
  }
}

function summaryText(facts: StackFacts): string {
  if (facts.rows.length === 0) return "";
  return facts.rows
    .map((row) => {
      const moved =
        row.unrolled === undefined
          ? ""
          : row.moved
            ? `, moved from ${localLabel(row.unrolled)}`
            : ", not moved";
      const before = beforeDepartureText(row);
      return `${row.name} closes ${localLabel(row.at)}, ${before}${moved}.`;
    })
    .join(" ");
}

function renderTable(el: HTMLElement, facts: StackFacts): void {
  // `data-label` feeds the stacked narrow layout's `::before` labels; neither it
  // nor the generated text changes a cell's `textContent`.
  el.innerHTML = facts.rows
    .map(
      (row) =>
        `<tr role="row">` +
        `<td role="cell"><span class="gmt-cutoff-series-swatch" data-series="${row.series}" aria-hidden="true"></span>${escapeHtml(row.name)}</td>` +
        `<td role="cell" data-label="Rule">${escapeHtml(ruleText(row))}</td>` +
        `<td role="cell" data-label="Closes">${escapeHtml(localLabel(row.at))}<br><span class="gmt-widget-hint">${escapeHtml(row.at)}</span></td>` +
        `<td role="cell" data-label="Before departure">${escapeHtml(beforeDepartureText(row))}<br><span class="gmt-widget-hint">${escapeHtml(row.beforeDeparture)}</span></td>` +
        `<td role="cell" data-label="Moved">${escapeHtml(movedText(row))}</td>` +
        `</tr>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: CutoffLib): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const anchorEl = q<HTMLInputElement>("anchor");
  const timeZoneEl = q<HTMLSelectElement>("time-zone");
  const calendarEl = q<HTMLInputElement>("calendar");
  const holidaysEl = q<HTMLInputElement>("holidays");
  const rollEl = q<HTMLSelectElement>("roll");
  if (
    !presetEl ||
    !anchorEl ||
    !timeZoneEl ||
    !calendarEl ||
    !holidaysEl ||
    !rollEl
  ) {
    return;
  }

  function state(): StackState {
    const cutoffs = [1, 2, 3, 4].map((n) => ({
      name: q<HTMLInputElement>(`name-${n}`)?.value.trim() ?? "",
      offset: q<HTMLInputElement>(`offset-${n}`)?.value.trim() ?? "",
      atLocalTime:
        q<HTMLInputElement>(`at-local-time-${n}`)?.value.trim() ?? "",
    })) as [CutoffFields, CutoffFields, CutoffFields, CutoffFields];
    const weekend = WEEKDAYS.filter(
      (w) => q<HTMLInputElement>(`weekday-${w.value}`)?.checked,
    ).map((w) => w.value);
    return {
      anchor: anchorEl!.value.trim(),
      timeZone: timeZoneEl!.value.trim(),
      cutoffCount: String(MAX_CUTOFFS),
      cutoffs,
      calendar: calendarEl!.checked,
      weekend,
      holidays: holidaysEl!.value.trim(),
      roll: rollEl!.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        STACK_PRESETS.find((p) => p.id === presetEl!.value)?.description ?? "";
    }
  }

  function render(): void {
    const s = state();
    const entries = entriesOf(s);
    const options = optionsOf(s);
    const facts = collectStackFacts(s, lib);

    const [callHtml, callPlain] = callSource("cutoffSchedule", [
      s.anchor.trim(),
      entries,
      options,
    ]);
    renderCallLine(q("call-stack"), "cutoffSchedule", callHtml, callPlain);

    const out = q("stack-output");
    if (out) {
      if (entries.length === 0) {
        renderWidgetOutput(out, formatStack([]), "empty");
      } else if (facts.result.length === 0) {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else {
        renderWidgetOutput(out, formatStack(facts.result), "live");
      }
    }

    const timeline = q<HTMLElement>("stack-timeline");
    if (timeline) renderTimeline(timeline, facts, s.timeZone.trim());
    const summary = q("stack-summary");
    if (summary) summary.textContent = summaryText(facts);
    const table = q<HTMLElement>("stack-table-body");
    if (table) renderTable(table, facts);

    const aside = q("reason-aside");
    if (aside) {
      if (entries.length === 0) {
        renderAside(aside, "note", "Note", `<p>An empty list returns [].</p>`);
      } else if (facts.result.length === 0) {
        const reason = stackNullReason(s, facts, lib);
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(reason ? stackNullText(reason) : "The stack could not be computed.")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = STACK_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    const s = presetState(preset);
    anchorEl!.value = s.anchor;
    timeZoneEl!.value = s.timeZone;
    for (let i = 0; i < MAX_CUTOFFS; i++) {
      const c = s.cutoffs[i]!;
      const n = i + 1;
      const nameEl = q<HTMLInputElement>(`name-${n}`);
      const offsetEl = q<HTMLInputElement>(`offset-${n}`);
      const atLocalTimeEl = q<HTMLInputElement>(`at-local-time-${n}`);
      if (nameEl) nameEl.value = c.name;
      if (offsetEl) offsetEl.value = c.offset;
      if (atLocalTimeEl) atLocalTimeEl.value = c.atLocalTime;
    }
    calendarEl!.checked = s.calendar;
    for (const w of WEEKDAYS) {
      const el = q<HTMLInputElement>(`weekday-${w.value}`);
      if (el) el.checked = s.weekend.includes(w.value);
    }
    holidaysEl!.value = s.holidays;
    rollEl!.value = s.roll;
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) return;
    syncPreset();
    render();
  });
  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  render();
  const timelineEl = q<HTMLElement>("stack-timeline");
  if (timelineEl) onWidthChange(timelineEl, () => fitStackTimeline(timelineEl));
}

function applyArgs(root: HTMLElement, args: CutoffStackArgs): void {
  const flat = args as unknown as Record<string, unknown>;
  if (
    args.anchor === undefined &&
    args.cutoffs === undefined &&
    flat.name1 === undefined
  ) {
    return;
  }
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("anchor", s.anchor);
  set("time-zone", s.timeZone);
  for (let i = 0; i < MAX_CUTOFFS; i++) {
    const c = s.cutoffs[i]!;
    const n = i + 1;
    set(`name-${n}`, c.name);
    set(`offset-${n}`, c.offset);
    set(`at-local-time-${n}`, c.atLocalTime);
  }
  const calendarEl = q<HTMLInputElement>("calendar");
  if (calendarEl) calendarEl.checked = s.calendar;
  for (const w of WEEKDAYS) {
    const el = q<HTMLInputElement>(`weekday-${w.value}`);
    if (el) el.checked = s.weekend.includes(w.value);
  }
  set("holidays", s.holidays);
  set("roll", s.roll);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        STACK_PRESETS.find((p) => p.id === presetEl.value)?.description ?? "";
    }
  }
}

export const mountCutoffStack: MountFn<CutoffStackArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  setupWidget(root, lib);

  return onceDestroy(
    () => {},
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const anchorEl = q<HTMLInputElement>("anchor");
      if (!anchorEl) return null;
      const cutoffs = [1, 2, 3, 4].map((n) => ({
        name: q<HTMLInputElement>(`name-${n}`)?.value ?? "",
        offset: q<HTMLInputElement>(`offset-${n}`)?.value ?? "",
        atLocalTime: q<HTMLInputElement>(`at-local-time-${n}`)?.value ?? "",
      })) as [CutoffFields, CutoffFields, CutoffFields, CutoffFields];
      const weekend = WEEKDAYS.filter(
        (w) => q<HTMLInputElement>(`weekday-${w.value}`)?.checked,
      ).map((w) => w.value);
      const state: StackState = {
        anchor: anchorEl.value,
        timeZone: q<HTMLSelectElement>("time-zone")?.value ?? "",
        cutoffCount: String(MAX_CUTOFFS),
        cutoffs,
        calendar: q<HTMLInputElement>("calendar")?.checked ?? false,
        weekend,
        holidays: q<HTMLInputElement>("holidays")?.value ?? "",
        roll: q<HTMLSelectElement>("roll")?.value ?? "",
      };
      return permalinkOf(state);
    },
  );
};
