/**
 * The Departure Board widget (TRAN-57), mountable on its tool page and in the
 * chat rail.
 *
 * A timetable on a time rail with the arrival as a draggable marker and the
 * minimum connection as a hatched bar: the departure `nextDeparture` says the
 * arrival can make, beside the naive pick with no connection time. The printed
 * results are always the real calls'; the rail is a picture of them.
 *
 * `""` means two things. A correct empty answer (no departure qualifies) is
 * drawn as empty with a note; an invalid input is drawn as NO SIGNAL with its
 * reason. `departureNullReason` decides which, by probing the library.
 *
 * The arrival handle has three ways in: pointer drag, keyboard (Arrow,
 * Shift+Arrow, PageUp, PageDown, Home, End) and the typed arrival field. The
 * rail never rescales while the handle is dragged or a key is held; it refits
 * on `pointerup`, on a typed value's `change`, on a preset and on a seed.
 */
import { codeFrameHtml } from "./code-frame";
import {
  DEPARTURE_PRESETS,
  CUSTOM_PRESET_ID,
  MAX_DEPARTURES,
  collectDepartureFacts,
  departureNullReason,
  departureReasonText,
  handoffArgs,
  initialState,
  isEmptyReason,
  matchPreset,
  optionsOf,
  permalinkOf,
  railDepartures,
  railTickStep,
  railWindow,
  thresholdOf,
  timetableOf,
  visibleCount,
  type DepartureBoardArgs,
  type DepartureFacts,
  type DepartureState,
  type RailWindow,
} from "./departure-board";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { loadPunctualityLib } from "./punctuality-lib";
import {
  TRANSPORT_ZONES,
  callArgs,
  epochMs,
  minuteTicks,
  nextInstanceId,
  placeLabels,
  type Rect,
  toleranceText,
  writeLike,
  writtenLabel,
  writtenTime,
  zoneOf,
  zoneOptionsHtml,
  type PunctualityLib,
} from "./punctuality-widgets";
import { encodeWidgetPermalink } from "./widget-permalink";
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

export type { DepartureBoardArgs } from "./departure-board";

const MINUTE_MS = 60_000;

/** Where each kind of rail label is centred, as a percent of the rail's height:
 *  the window ends above the line, the departures and the connection below. */
const ROW_TOP = 12;
const ROW_MADE = 76;
const ROW_CONN = 91;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    DEPARTURE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * `renderDepartureBoardTemplate(args = {})`: the widget's chrome, seeded so the
 * first paint shows the arrival and the timetable. Seeded when `args.departures`,
 * `args.headway`, `args.form` or `args.preset` is defined, else the first
 * preset. The rail and the results are drawn by `mount`, because they come from
 * the real library.
 */
export function renderDepartureBoardTemplate(
  args: DepartureBoardArgs = {},
): string {
  const s = initialState(args);
  const presetId = matchPreset(s);
  const preset = DEPARTURE_PRESETS.find((p) => p.id === presetId);
  const uid = nextInstanceId();
  const count = visibleCount(s);

  const radio = (value: "list" | "headway", label: string) =>
    chipToggleHtml({
      type: "radio",
      name: `form-${uid}`,
      role: "form",
      value,
      label,
      checked: s.form === value,
    });
  const countOptions = Array.from({ length: MAX_DEPARTURES }, (_, i) => i + 1)
    .map(
      (n) =>
        `<option value="${n}"${n === count ? " selected" : ""}>${n}</option>`,
    )
    .join("");
  const slots = Array.from({ length: MAX_DEPARTURES }, (_, i) => {
    const n = i + 1;
    return (
      `<label class="gmt-label" data-role="departure-field-${n}"${n > count ? " hidden" : ""}>${labelTextHtml(`Departure ${n}`)}` +
      `<input class="gmt-input" data-role="departure-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.departures[i] ?? "")}"></label>`
    );
  }).join("");

  return (
    `<div class="gmt-departure-board gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The arrival and the timetable</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `</div>` +
    `<fieldset class="gmt-chip-group"><legend>Timetable</legend>` +
    radio("list", "A list of departures") +
    radio("headway", "Every N minutes") +
    `</fieldset>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Arrival")}` +
    `<input class="gmt-input" data-role="after" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.after)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Minimum connection", { optional: true })}` +
    `<input class="gmt-input" data-role="minimum-connection" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.minimumConnection)}"></label>` +
    `</div>` +
    `<div class="gmt-field-grid" data-role="list-fields"${s.form === "list" ? "" : " hidden"}>` +
    `<label class="gmt-label">${labelTextHtml("Departures")}` +
    `<select class="gmt-select" data-role="departure-count">${countOptions}</select></label>` +
    slots +
    `</div>` +
    `<div class="gmt-field-grid" data-role="headway-fields"${s.form === "headway" ? "" : " hidden"}>` +
    `<label class="gmt-label">${labelTextHtml("Every")}` +
    `<input class="gmt-input" data-role="headway" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.headway)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("From")}` +
    `<input class="gmt-input" data-role="from" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.from)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("To, excluded")}` +
    `<input class="gmt-input" data-role="to" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.to)}"></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">Every time needs its offset: 2024-06-15T10:05:00+03:00, or a zoned string written with its offset.</p>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. The departure you can make</h4>` +
    `<p class="gmt-transport-verdict" data-role="verdict" aria-live="polite"></p>` +
    `<p class="gmt-punct-naive" data-role="naive-line"></p>` +
    `<div class="gmt-punct-frame">` +
    `<div class="gmt-dep-stage" data-role="rail-stage">` +
    `<div class="gmt-dep-rail" data-role="departure-rail" role="img" aria-labelledby="rail-summary-${uid}"></div>` +
    `<div class="gmt-handle" data-role="handle-after" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="Arrival"></div>` +
    `</div>` +
    `<div class="gmt-punct-ticks gmt-dep-ticks" data-role="rail-ticks" aria-hidden="true"></div>` +
    `</div>` +
    `<p class="gmt-widget-hint" id="rail-summary-${uid}" data-role="rail-summary"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>nextDeparture</code> returns</h4>` +
    codeFrameHtml("made") +
    `<output class="gmt-widget-output" data-role="made-output">&nbsp;</output>` +
    codeFrameHtml("naive") +
    `<output class="gmt-widget-output" data-role="naive-output">&nbsp;</output>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>4. Send it on</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Onward leg duration")}` +
    `<input class="gmt-input" data-role="onward-duration" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.onwardDuration)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Destination clock")}` +
    `<select class="gmt-select" data-role="onward-zone">${zoneOptionsHtml(TRANSPORT_ZONES, s.onwardZone, "(not given)")}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Mode", { optional: true })}` +
    `<input class="gmt-input" data-role="onward-mode" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(s.onwardMode)}"></label>` +
    `</div>` +
    `<div class="gmt-widget-controls"><a class="gmt-button gmt-button--pad" data-role="handoff" aria-disabled="true">Send to Delivery Scheduler</a></div>` +
    `<p class="gmt-widget-hint" data-role="handoff-hint"></p>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Write the state onto the controls. The page server-renders the first
 *  preset, so a permalink or chat seed has to reach the controls here. */
function writeSeed(root: HTMLElement, s: DepartureState): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement>(role);
    if (el) el.value = value;
  };
  set("after", s.after);
  set("minimum-connection", s.minimumConnection);
  set("headway", s.headway);
  set("from", s.from);
  set("to", s.to);
  set("onward-duration", s.onwardDuration);
  set("onward-mode", s.onwardMode);
  const count = q<HTMLSelectElement>("departure-count");
  if (count) count.value = String(visibleCount(s));
  s.departures.forEach((d, i) => set(`departure-${i + 1}`, d));
  root.querySelectorAll<HTMLInputElement>('[data-role="form"]').forEach((r) => {
    r.checked = r.value === s.form;
  });
  const zone = q<HTMLSelectElement>("onward-zone");
  if (zone) {
    if (
      s.onwardZone !== "" &&
      ![...zone.options].some((o) => o.value === s.onwardZone)
    ) {
      const opt = document.createElement("option");
      opt.value = s.onwardZone;
      opt.textContent = s.onwardZone;
      zone.appendChild(opt);
    }
    zone.value = s.onwardZone;
  }
}

interface Controller {
  release(): void;
  destroy(): void;
  state(): DepartureState;
}

function setupWidget(root: HTMLElement, lib: PunctualityLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset");
  const afterEl = q<HTMLInputElement>("after");
  const stage = q<HTMLElement>("rail-stage");
  const handle = q<HTMLElement>("handle-after");
  const rail = q<HTMLElement>("departure-rail");
  if (!presetEl || !afterEl || !stage || !handle || !rail) {
    return { release() {}, destroy() {}, state: () => initialState({}) };
  }
  let win: RailWindow | null = null;
  let destroyed = false;

  const val = (role: string) =>
    q<HTMLInputElement | HTMLSelectElement>(role)?.value ?? "";

  const state = (): DepartureState => ({
    form:
      (
        root.querySelector(
          '[data-role="form"]:checked',
        ) as HTMLInputElement | null
      )?.value === "headway"
        ? "headway"
        : "list",
    after: afterEl.value,
    minimumConnection: val("minimum-connection"),
    departureCount: val("departure-count"),
    departures: Array.from({ length: MAX_DEPARTURES }, (_, i) =>
      val(`departure-${i + 1}`),
    ),
    headway: val("headway"),
    from: val("from"),
    to: val("to"),
    onwardDuration: val("onward-duration"),
    onwardZone: val("onward-zone"),
    onwardMode: val("onward-mode"),
  });

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        DEPARTURE_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function placeAll(): void {
    const w = rail!.clientWidth;
    const h = rail!.clientHeight;
    if (w === 0 || h === 0) return;
    const labels = [...rail!.querySelectorAll<HTMLElement>(".gmt-dep-label")];
    const boxes = labels.map((el) => {
      el.classList.remove("gmt-dep-label--placed");
      return {
        x: (Number(el.dataset.x ?? 0) / 100) * w,
        y: (Number(el.dataset.y ?? 0) / 100) * h,
        w: el.offsetWidth,
        h: el.offsetHeight,
      };
    });
    // Nothing but a label may sit on the rule, the connection bar, a tick, a
    // bracket, the naive outline or the handle's 44px hit square.
    const origin = rail!.getBoundingClientRect();
    const rectOf = (el: Element, minSize = 0): Rect => {
      const r = el.getBoundingClientRect();
      const cx = r.left - origin.left + r.width / 2;
      const cy = r.top - origin.top + r.height / 2;
      const rw = Math.max(r.width, minSize);
      const rh = Math.max(r.height, minSize);
      return { left: cx - rw / 2, top: cy - rh / 2, w: rw, h: rh };
    };
    const blocked: Rect[] = [
      ...rail!.querySelectorAll(
        ".gmt-dep-line, .gmt-dep-conn, .gmt-dep-run, .gmt-dep-tick, .gmt-dep-naive, .gmt-dep-bracket",
      ),
    ].map((el) => rectOf(el, 3));
    if (!handle!.hidden) blocked.push(rectOf(handle!, 44));
    placeLabels(boxes, w, h, { markPx: 0, blocked }).forEach((p, i) => {
      const el = labels[i]!;
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
      el.classList.add("gmt-dep-label--placed");
    });
  }

  function drawRail(s: DepartureState, facts: DepartureFacts): void {
    const ticksEl = q("rail-ticks");
    const after = s.after.trim();
    let afterMs: number;
    try {
      afterMs = epochMs(after);
    } catch {
      rail!.innerHTML = "";
      if (ticksEl) ticksEl.innerHTML = "";
      handle!.hidden = true;
      return;
    }
    if (win === null) win = railWindow(s);
    if (win === null) return;
    const span = win.endMs - win.startMs;
    const pct = (ms: number) =>
      Math.min(100, Math.max(0, ((ms - win!.startMs) / span) * 100));
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const zone = zoneOf(after) || "UTC";

    const thresholdText = thresholdOf(after, s.minimumConnection);
    let thresholdMs: number | null = null;
    try {
      thresholdMs = thresholdText === "" ? null : epochMs(thresholdText);
    } catch {
      thresholdMs = null;
    }
    const { ticks, dense } = railDepartures(s, win);

    let html = `<span class="gmt-dep-line"></span>`;
    const labels: { role: string; ms: number; y: number; text: string }[] = [];

    if (thresholdMs !== null && thresholdMs > afterMs) {
      html += `<span class="gmt-dep-conn gmt-punct-hatch" style="left:${r2(pct(afterMs))}%;width:${r2(pct(thresholdMs) - pct(afterMs))}%"></span>`;
      labels.push({
        role: "conn",
        ms: afterMs,
        y: ROW_CONN,
        text: `${toleranceText(s.minimumConnection)} to connect`,
      });
    }
    if (dense) {
      const row = timetableOf(s) as {
        headway: string;
        from: string;
        to: string;
      };
      let a = win.startMs;
      let b = win.endMs;
      try {
        a = Math.max(a, epochMs(row.from));
        b = Math.min(b, epochMs(row.to));
      } catch {
        /* the whole window */
      }
      html += `<span class="gmt-dep-run gmt-punct-hatch" style="left:${r2(pct(a))}%;width:${r2(pct(b) - pct(a))}%"></span>`;
      labels.push({
        role: "run",
        ms: (a + b) / 2,
        y: ROW_TOP,
        text: `every ${toleranceText(row.headway)}`,
      });
    } else {
      for (const ms of ticks) {
        html += `<span class="gmt-dep-tick" style="left:${r2(pct(ms))}%"></span>`;
      }
    }
    if (s.form === "headway") {
      try {
        const from = epochMs(s.from.trim());
        const to = epochMs(s.to.trim());
        if (from >= win.startMs && from <= win.endMs) {
          html += `<span class="gmt-dep-bracket gmt-dep-bracket--from" style="left:${r2(pct(from))}%"></span>`;
          labels.push({ role: "from", ms: from, y: ROW_TOP, text: "from" });
        }
        if (to >= win.startMs && to <= win.endMs) {
          html += `<span class="gmt-dep-bracket gmt-dep-bracket--to" style="left:${r2(pct(to))}%"></span>`;
          labels.push({ role: "to", ms: to, y: ROW_TOP, text: "to, excluded" });
        }
      } catch {
        /* no brackets */
      }
    }
    const instantOf = (text: string): number | null => {
      try {
        return text === "" ? null : epochMs(text);
      } catch {
        return null;
      }
    };
    const madeMs = instantOf(facts.made);
    const naiveMs = instantOf(facts.naive);
    if (naiveMs !== null) {
      html += `<span class="gmt-dep-naive" data-role="rail-naive" style="left:${r2(pct(naiveMs))}%"></span>`;
    }
    if (madeMs !== null) {
      html += `<span class="gmt-dep-tick gmt-dep-tick--made" data-role="rail-made" style="left:${r2(pct(madeMs))}%"></span>`;
    }
    if (madeMs !== null && naiveMs !== null && madeMs === naiveMs) {
      labels.push({
        role: "made",
        ms: madeMs,
        y: ROW_MADE,
        text: `made: ${writtenTime(facts.made)}, naive`,
      });
    } else {
      if (madeMs !== null) {
        labels.push({
          role: "made",
          ms: madeMs,
          y: ROW_MADE,
          text: `made: ${writtenTime(facts.made)}`,
        });
      }
      if (naiveMs !== null) {
        labels.push({ role: "naive", ms: naiveMs, y: ROW_MADE, text: "naive" });
      }
    }
    for (const l of labels) {
      const y = l.y;
      html += `<span class="gmt-dep-label" data-role="rail-label-${l.role}" data-x="${r2(pct(l.ms))}" data-y="${y}" style="left:${r2(pct(l.ms))}%;top:${y}%">${escapeHtml(l.text)}</span>`;
    }
    rail!.innerHTML = html;

    if (ticksEl) {
      const step = railTickStep(span);
      ticksEl.innerHTML = minuteTicks(win.startMs, win.endMs, zone, step)
        .map(
          (t) =>
            `<span class="gmt-cutoff-axis-tick gmt-punct-tick--mid" style="left:${r2(pct(t.ms))}%">${escapeHtml(t.label)}</span>`,
        )
        .join("");
      thinTickLabels(ticksEl);
    }

    // The handle.
    handle!.hidden = false;
    handle!.style.left = `${r2(pct(afterMs))}%`;
    handle!.setAttribute("aria-valuemin", "0");
    handle!.setAttribute("aria-valuemax", String(Math.round(span / MINUTE_MS)));
    handle!.setAttribute(
      "aria-valuenow",
      String(
        Math.round(
          (Math.min(win.endMs, Math.max(win.startMs, afterMs)) - win.startMs) /
            MINUTE_MS,
        ),
      ),
    );
    handle!.setAttribute(
      "aria-valuetext",
      `Arrival ${writtenLabel(after) || after}`,
    );
    placeAll();
  }

  function render(): void {
    if (destroyed) return;
    const s = state();
    for (let n = 1; n <= MAX_DEPARTURES; n++) {
      const f = q(`departure-field-${n}`);
      if (f) f.hidden = n > visibleCount(s);
    }
    const listFields = q("list-fields");
    if (listFields) listFields.hidden = s.form !== "list";
    const headwayFields = q("headway-fields");
    if (headwayFields) headwayFields.hidden = s.form !== "headway";

    const facts = collectDepartureFacts(s, lib);
    const reason = departureNullReason(s, facts, lib);
    const empty = isEmptyReason(reason);
    const invalid = reason !== null && !empty;
    // The naive call has no connection time, so a bad connection does not void it.
    const naiveReason = departureNullReason(
      { ...s, minimumConnection: "" },
      { made: facts.naive, naive: facts.naive },
      lib,
    );
    const naiveInvalid = naiveReason !== null && !isEmptyReason(naiveReason);

    // Verdict and naive line.
    const verdict = q("verdict");
    if (verdict) {
      verdict.textContent =
        facts.made !== ""
          ? `You make the ${writtenTime(facts.made)}.`
          : empty
            ? "No departure you can make."
            : "";
    }
    const naiveLine = q("naive-line");
    if (naiveLine) {
      let line = "";
      if (!invalid && !naiveInvalid) {
        if (facts.made === facts.naive) {
          line =
            facts.made !== ""
              ? "The connection time changes nothing here."
              : "";
        } else {
          line =
            facts.naive !== ""
              ? `Naive, with no connection time: the ${writtenTime(facts.naive)}.`
              : "Naive, with no connection time: no departure.";
        }
      }
      naiveLine.hidden = line === "";
      naiveLine.textContent = line;
    }

    drawRail(s, facts);

    const summary = q("rail-summary");
    if (summary) {
      const threshold = thresholdOf(s.after.trim(), s.minimumConnection);
      summary.textContent = [
        s.after.trim() === ""
          ? "No arrival."
          : `Arrival ${writtenLabel(s.after.trim()) || s.after.trim()}.`,
        threshold === ""
          ? ""
          : `A departure must be at or after ${writtenLabel(threshold)}.`,
        facts.made !== ""
          ? `Made: ${writtenLabel(facts.made)}.`
          : invalid
            ? "No signal."
            : "No departure you can make.",
        facts.naive !== "" && facts.naive !== facts.made
          ? `Naive, no connection time: ${writtenLabel(facts.naive)}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    const aside = q("reason-aside");
    if (aside) {
      if (reason === null) aside.innerHTML = "";
      else {
        renderAside(
          aside,
          empty ? "note" : "caution",
          empty ? "Why empty" : "Why NO SIGNAL",
          `<p>${escapeHtml(departureReasonText(reason))}</p>`,
        );
      }
    }

    // What nextDeparture returns.
    const timetable = timetableOf(s);
    const options = optionsOf(s);
    const [madeHtml, madePlain] = callArgs(
      options
        ? [s.after.trim(), timetable, options]
        : [s.after.trim(), timetable],
    );
    renderCallLine(q("call-made"), "nextDeparture", madeHtml, madePlain);
    const [naiveHtml, naivePlain] = callArgs([s.after.trim(), timetable]);
    renderCallLine(q("call-naive"), "nextDeparture", naiveHtml, naivePlain);
    const show = (out: HTMLElement | null, value: string, bad: boolean) => {
      if (!out) return;
      if (value !== "") renderWidgetOutput(out, JSON.stringify(value), "live");
      else if (bad) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, '""', "empty");
    };
    show(q("made-output"), facts.made, invalid);
    show(q("naive-output"), facts.naive, naiveInvalid);

    // Send it on.
    const link = q<HTMLAnchorElement>("handoff");
    const hint = q("handoff-hint");
    const args = handoffArgs(s, facts.made);
    if (link) {
      if (args) {
        link.setAttribute("href", encodeWidgetPermalink("delivery", args));
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (hint) {
      hint.textContent = args
        ? ""
        : facts.made === ""
          ? "No departure to send."
          : "Give the onward leg's duration and destination clock.";
    }
  }

  function refit(): void {
    win = railWindow(state());
    render();
  }

  function applyPreset(): void {
    const preset = DEPARTURE_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    // `readArgs` is the one place a preset becomes a state.
    const next = initialState({ preset: preset.id });
    writeSeed(root, next);
    syncPreset();
    refit();
  }

  // ---- The handle ----

  function setAfter(ms: number): void {
    if (win === null) return;
    const snapped =
      Math.round(Math.min(win.endMs, Math.max(win.startMs, ms)) / MINUTE_MS) *
      MINUTE_MS;
    const text = writeLike(afterEl!.value.trim(), snapped);
    if (text === "") return;
    afterEl!.value = text;
    syncPreset();
    render();
  }

  let dragging = false;
  let captured: { el: HTMLElement; id: number } | null = null;

  root.addEventListener("pointerdown", (e) => {
    if (destroyed) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-role="handle-after"]',
    );
    if (!target) return;
    dragging = true;
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
    if (destroyed || !dragging || win === null) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = ((e as PointerEvent).clientX - rect.left) / rect.width;
    setAfter(win.startMs + fraction * (win.endMs - win.startMs));
  });

  const stopDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    captured = null;
    refit();
  };
  root.addEventListener("pointerup", stopDrag);
  root.addEventListener("pointercancel", stopDrag);

  root.addEventListener("keydown", (e) => {
    if (destroyed || win === null) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-role="handle-after"]',
    );
    if (!target) return;
    const ev = e as KeyboardEvent;
    let now: number;
    try {
      now = epochMs(afterEl.value.trim());
    } catch {
      return;
    }
    let next: number | null = null;
    switch (ev.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = now + MINUTE_MS * (ev.shiftKey ? 10 : 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = now - MINUTE_MS * (ev.shiftKey ? 10 : 1);
        break;
      case "PageUp":
        next = now + MINUTE_MS * 10;
        break;
      case "PageDown":
        next = now - MINUTE_MS * 10;
        break;
      case "Home":
        next = win.startMs;
        break;
      case "End":
        next = win.endMs;
        break;
    }
    if (next === null) return;
    ev.preventDefault();
    setAfter(next);
  });

  // ---- Typed fields, the form chips and the preset ----

  const TEXT_ROLES = new Set([
    "after",
    "minimum-connection",
    "headway",
    "from",
    "to",
    "onward-duration",
    "onward-mode",
  ]);
  const isTyped = (role: string) =>
    TEXT_ROLES.has(role) || /^departure-\d$/.test(role);

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.role ?? "";
    if (isTyped(role)) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.role ?? "";
    if (role === "preset") applyPreset();
    else if (isTyped(role) || role === "form" || role === "departure-count") {
      syncPreset();
      refit();
    } else if (role === "onward-zone") {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  syncPreset();
  refit();
  onWidthChange(rail, () => {
    if (destroyed) return;
    placeAll();
    const ticks = q("rail-ticks");
    if (ticks) thinTickLabels(ticks);
  });

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

export const mountDepartureBoard = async (
  root: HTMLElement,
  args: DepartureBoardArgs,
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
