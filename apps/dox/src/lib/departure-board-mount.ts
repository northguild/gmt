/**
 * The Departure Board widget (TRAN-57), mountable on its tool page and in the
 * chat rail.
 *
 * A timetable on a time rail with the arrival as a draggable marker and the minimum
 * connection as a hatched bar: the departure `nextDeparture` says the arrival can make,
 * beside the naive pick with no connection time. The printed results are always the real
 * calls'; the rail is a picture of them.
 *
 * `""` means two things. A correct empty answer (no departure qualifies) is drawn as empty
 * with a note; an invalid input is drawn as NO SIGNAL with its reason. `departureNullReason`
 * decides which, by probing the library.
 *
 * Built on the component kit: `renderDepartureBoardTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids and
 * reads and writes element `value` properties.
 *
 * The arrival has three ways in: pointer drag and keyboard on its `<gmt-handle>`, and the
 * typed arrival field the handle writes. The rail never rescales while the handle is
 * dragged; it refits when the handle's value commits (`change`), on a typed value's
 * `change`, on a preset and on a seed. The verdict is not a live region; a visually hidden
 * status line reads it once a change settles.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import {
  setSelectValue,
  zoneChoices,
} from "~/widgets/families/cutoff/zone-choices";
import {
  departureRail,
  departureStage,
  departureTicks,
  type RailLabel,
  type RailMarks,
} from "~/widgets/families/punctuality/departure-rail";
import {
  punctHero,
  punctHeroStrip,
} from "~/widgets/families/punctuality/punct-hero";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import {
  handle,
  handleTrack,
  type GmtHandle,
} from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/departure-board.module.css";
import {
  CUSTOM_PRESET_ID,
  DEPARTURE_PRESETS,
  MAX_DEPARTURES,
  collectDepartureFacts,
  departureIconMode,
  departureNullReason,
  departureReasonText,
  departureWait,
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
  SETTLE_MS,
  callArgs,
  epochMs,
  minuteTicks,
  placeLabels,
  toleranceText,
  writeLike,
  writtenLabel,
  writtenTime,
  zoneOf,
  type PunctualityLib,
  type Rect,
} from "./punctuality-widgets";
import { transportIcon } from "./transport-icons";
import { encodeWidgetPermalink } from "./widget-permalink";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan, setToolLink } from "./widget-ui";

export type { DepartureBoardArgs } from "./departure-board";

const WIDGET_NAME = "departure-board";
const MINUTE_MS = 60_000;

/** Where each kind of rail label is centred, as a percent of the rail's height:
 *  the window ends above the line, the departures and the connection below. */
const ROW_TOP = 11;
const ROW_MADE = 80;
const ROW_CONN = 92;

/** The widest readings the plate shows, so it keeps its width while the handle drags. */
const HERO_SAMPLES = ["00:00", "none"];
const HERO_LINE_SAMPLES: readonly (readonly string[])[] = [
  ["wait 23 h 59 min after arrival", "no departure left"],
  ["PT23H59M"],
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/**
 * `renderDepartureBoardTemplate(idPrefix, args = {})`: the widget's chrome, seeded so the
 * first paint shows the arrival and the timetable. The rail and the results are drawn by
 * `mount`, because they come from the real library.
 */
export function renderDepartureBoardTemplate(
  idPrefix: string,
  args: DepartureBoardArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const s = initialState(args);
  const presetId = matchPreset(s);
  const count = visibleCount(s);
  const textField = (
    local: string,
    label: string,
    value: string,
    hintOf?: ReturnType<typeof hint>,
    hidden = false,
  ) =>
    html`<div class="${styles.box}" id="${id(`${local}-box`)}" ${hidden ? html`hidden` : ""}>${field(
      {
        id: id(local),
        label,
        ...(hintOf === undefined ? {} : { hint: hintOf }),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value,
            autocomplete: "off",
            spellcheck: false,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      },
    )}</div>`;

  const listFields = html`<div class="${styles.fields}" id="${id("list-fields")}" ${s.form === "list" ? "" : html`hidden`}>${fieldGrid(
    html`<div class="${styles.box}">${field({
      id: id("departure-count"),
      label: "Departures",
      control: ({ id: cid }) =>
        select({
          id: cid,
          value: String(count),
          options: Array.from({ length: MAX_DEPARTURES }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          })),
        }),
    })}</div>${Array.from({ length: MAX_DEPARTURES }, (_, i) =>
      textField(
        `departure-${i + 1}`,
        `Departure ${i + 1}`,
        s.departures[i] ?? "",
        undefined,
        i + 1 > count,
      ),
    )}`,
  )}</div>`;
  const headwayFields = html`<div class="${styles.fields}" id="${id("headway-fields")}" ${s.form === "headway" ? "" : html`hidden`}>${fieldGrid(
    html`${textField("headway", "Every", s.headway)}${textField("from", "From", s.from)}${textField("to", "To, excluded", s.to)}`,
  )}</div>`;

  const offsetHint = hint(
    id("offset-hint"),
    "Every time needs its offset: 2024-06-15T10:05:00+03:00, or a zoned string written with its offset.",
  );
  const pick = section(
    { id: id("pick"), heading: "1. The arrival and the timetable", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...DEPARTURE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${chips({
      legend: "Timetable",
      kind: "radio",
      name: id("form"),
      items: [
        {
          value: "list",
          label: "A list of departures",
          checked: s.form === "list",
        },
        {
          value: "headway",
          label: "Every N minutes",
          checked: s.form === "headway",
        },
      ],
    })}${fieldGrid(
      html`${textField("after", "Arrival", s.after, offsetHint)}${textField("minimum-connection", "Minimum connection", s.minimumConnection)}`,
    )}${grow(html`<div>${listFields}${headwayFields}</div>`)}</div>`,
  );

  const summary = hint(id("summary"), "");
  const stage = departureStage({
    railId: id("rail"),
    ticksId: id("ticks"),
    summaryId: id("summary"),
    handleBoxId: id("handle-box"),
    gate: "drawn track",
    handle: handleTrack(
      handle({
        id: id("handle-after"),
        label: "Arrival",
        min: 0,
        max: 1,
        step: 1,
        largeStep: 10,
        value: 0,
        valueText: "Arrival",
      }),
    ),
  });
  const read = section(
    { id: id("read"), heading: "2. The departure you can make", level: 4 },
    html`${grow(html`<p class="${styles.verdict}" id="${id("verdict")}" hidden></p>`)}
      <div role="status" aria-live="polite" aria-label="Departure status" id="${id("live")}">${srOnly("")}</div>
      ${grow(html`<p class="${styles.naive}" id="${id("naive-line")}" hidden></p>`)}
      ${grow(
        html`<div class="${styles.frame}" data-gate="frame">
        ${grow(html`<div class="${styles.heroes}" id="${id("heroes")}"></div>`)}${stage}
      </div>`,
      )}
      ${grow(summary.html)}
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What nextDeparture returns", level: 4 },
    html`${grow(
      html`<div id="${id("made-slot")}">${codeFrame({
        label: "The call made",
        copyLabel: "Copy call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("made-output-slot")}">${callOutput({
        label: "What nextDeparture returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(
      html`<div id="${id("naive-slot")}">${codeFrame({
        label: "The naive call, with no connection time",
        copyLabel: "Copy naive call",
        copyText: "",
      })}</div>`,
    )}${grow(
      html`<div id="${id("naive-output-slot")}">${callOutput({
        label: "What the naive call returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  const send = section(
    { id: id("send"), heading: "4. Send it on", level: 4 },
    html`<div class="${styles.controls}">${fieldGrid(
      html`${textField("onward-duration", "Onward leg duration", s.onwardDuration)}<div class="${styles.box}">${field(
        {
          id: id("onward-zone"),
          label: "Destination clock",
          control: ({ id: cid }) =>
            select({
              id: cid,
              value: s.onwardZone,
              options: [
                { value: "", label: "(not given)" },
                ...zoneChoices(s.onwardZone),
              ],
            }),
        },
      )}</div>${textField("onward-mode", "Mode", s.onwardMode)}`,
    )}<div id="${id("handoff")}">${toolLinks({
      label: "Send this departure on",
      links: [{ text: "Send to Delivery Scheduler" }],
    })}</div>${hint(id("handoff-hint"), "").html}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Departure Board", scope: idPrefix },
    html`${pick}${read}${calls}${send}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  destroy(): void;
  state(): DepartureState;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
const r2 = (n: number): number => Math.round(n * 100) / 100;

const instantOf = (text: string): number | null => {
  if (text === "") return null;
  try {
    return epochMs(text);
  } catch {
    return null;
  }
};

function setupWidget(
  root: HTMLElement,
  lib: PunctualityLib,
  start: DepartureState,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const formEl = widgetEl.querySelector<GmtChips>("gmt-chips")!;
  const afterEl = el<HTMLInputElement>("after");
  const connEl = el<HTMLInputElement>("minimum-connection");
  const countEl = el<HTMLSelectElement>("departure-count");
  const departureEls = Array.from({ length: MAX_DEPARTURES }, (_, i) =>
    el<HTMLInputElement>(`departure-${i + 1}`),
  );
  const headwayEl = el<HTMLInputElement>("headway");
  const fromEl = el<HTMLInputElement>("from");
  const toEl = el<HTMLInputElement>("to");
  const durationEl = el<HTMLInputElement>("onward-duration");
  const zoneEl = el<HTMLSelectElement>("onward-zone");
  const modeEl = el<HTMLInputElement>("onward-mode");
  const handleEl = el<GmtHandle>("handle-after");
  const handleBox = el("handle-box");
  const rail = el("rail");
  const ticksEl = el("ticks");

  /** Write the state onto the controls: a permalink or chat seed reaches them here. */
  function writeSeed(s: DepartureState): void {
    afterEl.value = s.after;
    connEl.value = s.minimumConnection;
    headwayEl.value = s.headway;
    fromEl.value = s.from;
    toEl.value = s.to;
    durationEl.value = s.onwardDuration;
    modeEl.value = s.onwardMode;
    countEl.value = String(visibleCount(s));
    s.departures.forEach((d, i) => {
      departureEls[i]!.value = d;
    });
    formEl.value = s.form;
    setSelectValue(zoneEl, s.onwardZone);
  }

  let win: RailWindow | null = null;
  let destroyed = false;

  const formOf = (): "list" | "headway" => {
    const v = formEl.value;
    return (Array.isArray(v) ? v[0] : v) === "headway" ? "headway" : "list";
  };

  const state = (): DepartureState => ({
    form: formOf(),
    after: afterEl.value,
    minimumConnection: connEl.value,
    departureCount: countEl.value,
    departures: departureEls.map((d) => d.value),
    headway: headwayEl.value,
    from: fromEl.value,
    to: toEl.value,
    onwardDuration: durationEl.value,
    onwardZone: zoneEl.value,
    onwardMode: modeEl.value,
  });

  // The verdict is read out once, when the change that made it has settled.
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

  const syncPreset = (): void => {
    presetEl.value = matchPreset(state());
  };

  /** Put each label on a spot clear of every mark, the window's edges and the handle. */
  function placeAll(): void {
    const w = rail.clientWidth;
    const h = rail.clientHeight;
    if (w === 0 || h === 0) return;
    const labels = [...rail.querySelectorAll<HTMLElement>("[data-label]")];
    const boxes = labels.map((label) => {
      delete label.dataset["placed"];
      return {
        x: (Number(label.dataset["x"] ?? 0) / 100) * w,
        y: (Number(label.dataset["y"] ?? 0) / 100) * h,
        w: label.offsetWidth,
        h: label.offsetHeight,
      };
    });
    const origin = rail.getBoundingClientRect();
    const rectOf = (node: Element, minSize = 0): Rect => {
      const r = node.getBoundingClientRect();
      const cx = r.left - origin.left + r.width / 2;
      const cy = r.top - origin.top + r.height / 2;
      const rw = Math.max(r.width, minSize);
      const rh = Math.max(r.height, minSize);
      return { left: cx - rw / 2, top: cy - rh / 2, w: rw, h: rh };
    };
    const blocked: Rect[] = [...rail.querySelectorAll("[data-block]")].map(
      (m) => rectOf(m, 3),
    );
    // The service window is lit glass a chip may sit on, but never across its top or
    // bottom edge.
    for (const win of rail.querySelectorAll("[data-window]")) {
      const r = win.getBoundingClientRect();
      const left = r.left - origin.left;
      const top = r.top - origin.top;
      blocked.push(
        { left, top: top - 1, w: r.width, h: 3 },
        { left, top: top + r.height - 2, w: r.width, h: 3 },
      );
    }
    if (!handleBox.hidden) blocked.push(rectOf(handleEl, 44));
    placeLabels(boxes, w, h, { markPx: 0, blocked }).forEach((p, i) => {
      const label = labels[i]!;
      // When nothing is clear the placer falls back to its first choice, which may hang
      // past the rail; a label always stays inside it.
      label.style.left = `${Math.max(0, Math.min(p.left, w - boxes[i]!.w))}px`;
      label.style.top = `${Math.max(0, Math.min(p.top, h - boxes[i]!.h))}px`;
      label.dataset["placed"] = "true";
    });
  }

  function drawRail(s: DepartureState, facts: DepartureFacts): void {
    const after = s.after.trim();
    let afterMs: number;
    try {
      afterMs = epochMs(after);
    } catch {
      setHtml(rail, html``);
      setHtml(ticksEl, html``);
      handleBox.hidden = true;
      return;
    }
    if (win === null) win = railWindow(s);
    if (win === null) return;
    const span = win.endMs - win.startMs;
    const pct = (ms: number): number =>
      clamp(((ms - win!.startMs) / span) * 100, 0, 100);
    const zone = zoneOf(after) || "UTC";

    const thresholdText = thresholdOf(after, s.minimumConnection);
    const thresholdMs = instantOf(thresholdText);
    const { ticks, dense } = railDepartures(s, win);
    const labels: RailLabel[] = [];
    const at = (ms: number, y: number, text: string, dim = false): void => {
      labels.push({ text, x: pct(ms), y, ...(dim ? { dim } : {}) });
    };
    let conn: RailMarks["conn"];
    let run: RailMarks["run"];
    let windowSpan: RailMarks["window"];
    let beyond: RailMarks["beyond"];
    let from: number | undefined;
    let to: number | undefined;

    if (thresholdMs !== null && thresholdMs > afterMs) {
      conn = { left: pct(afterMs), width: pct(thresholdMs) - pct(afterMs) };
      at(afterMs, ROW_CONN, `${toleranceText(s.minimumConnection)} to connect`);
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
      run = { left: pct(a), width: pct(b) - pct(a) };
      at((a + b) / 2, ROW_TOP, `every ${toleranceText(row.headway)}`);
    }
    if (s.form === "headway") {
      try {
        const f = epochMs(s.from.trim());
        const t = epochMs(s.to.trim());
        if (t > f) {
          const a = Math.max(f, win.startMs);
          const b = Math.min(t, win.endMs);
          if (b > a) windowSpan = { left: pct(a), width: pct(b) - pct(a) };
        }
        if (t >= win.startMs && t < win.endMs) {
          beyond = { left: pct(t), width: 100 - pct(t) };
        }
        if (f >= win.startMs && f <= win.endMs) {
          from = pct(f);
          at(f, ROW_TOP, "from");
        }
        if (t >= win.startMs && t <= win.endMs) {
          to = pct(t);
          at(t, ROW_TOP, "to, excluded");
        }
      } catch {
        /* no brackets */
      }
    }
    const madeMs = instantOf(facts.made);
    const naiveMs = instantOf(facts.naive);
    if (madeMs !== null && naiveMs !== null && madeMs === naiveMs) {
      at(madeMs, ROW_MADE, `made: ${writtenTime(facts.made)}, naive`);
    } else {
      if (madeMs !== null)
        at(madeMs, ROW_MADE, `made: ${writtenTime(facts.made)}`);
      if (naiveMs !== null) at(naiveMs, ROW_MADE, "naive", true);
    }
    const marks: RailMarks = {
      ticks: dense ? [] : ticks.map(pct),
      labels,
      ...(conn === undefined ? {} : { conn }),
      ...(run === undefined ? {} : { run }),
      ...(windowSpan === undefined ? {} : { window: windowSpan }),
      ...(beyond === undefined ? {} : { beyond }),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(naiveMs === null ? {} : { naive: pct(naiveMs) }),
      ...(madeMs === null ? {} : { made: pct(madeMs) }),
    };
    setHtml(rail, departureRail(marks));
    setHtml(
      ticksEl,
      departureTicks(
        minuteTicks(win.startMs, win.endMs, zone, railTickStep(span)).map(
          (t) => ({
            at: r2(pct(t.ms)),
            label: t.label,
          }),
        ),
      ),
    );
    thinTickLabels(ticksEl, "[data-tick]");

    // The handle: its range is the rail, in whole minutes.
    handleBox.hidden = false;
    const max = Math.round(span / MINUTE_MS);
    const current = Math.round(
      (clamp(afterMs, win.startMs, win.endMs) - win.startMs) / MINUTE_MS,
    );
    const startMs = win.startMs;
    handleEl.setAttribute("min", "0");
    handleEl.setAttribute("max", String(max));
    handleEl.setAttribute("step", "1");
    handleEl.setAttribute("large-step", "10");
    handleEl.formatValue = (n) => {
      const m = Math.round(n);
      const written =
        m === current
          ? writtenLabel(after) || after
          : writtenLabel(
              writeLike(afterEl.value.trim(), startMs + m * MINUTE_MS),
            );
      return `Arrival ${written}`;
    };
    handleEl.value = current;
    placeAll();
  }

  /** The departure made, large, on a plate. Every value is the library's: the wait is
   *  `scheduleDeviation` from the arrival to the departure. On a correct empty answer it
   *  reads "none"; on invalid input it is hidden and the outputs carry NO SIGNAL. */
  function drawHero(
    s: DepartureState,
    facts: DepartureFacts,
    wait: string,
    showHero: boolean,
  ): void {
    if (!showHero) {
      setHtml(el("heroes"), html``);
      return;
    }
    if (facts.made === "") {
      setHtml(
        el("heroes"),
        punctHeroStrip(
          punctHero({
            caption: "departure made",
            value: "none",
            reserveIcon: true,
            samples: HERO_SAMPLES,
            lines: ["no departure left", ""],
            lineSamples: HERO_LINE_SAMPLES,
            series: 1,
            gate: "hero",
          }),
        ),
      );
      return;
    }
    const mode = departureIconMode(s.onwardMode);
    setHtml(
      el("heroes"),
      punctHeroStrip(
        punctHero({
          caption: "departure made",
          value: writtenTime(facts.made),
          ...(mode === null
            ? {}
            : { icon: raw(transportIcon(mode, { size: 24 })) }),
          reserveIcon: true,
          samples: HERO_SAMPLES,
          lines:
            wait === ""
              ? ["", ""]
              : [`wait ${toleranceText(wait)} after arrival`, wait],
          lineSamples: HERO_LINE_SAMPLES,
          series: 1,
          gate: "hero",
        }),
      ),
    );
  }

  function render(): void {
    if (destroyed) return;
    const s = state();
    s.departures.forEach((_, i) => {
      el(`departure-${i + 1}-box`).hidden = i + 1 > visibleCount(s);
    });
    el("list-fields").hidden = s.form !== "list";
    el("headway-fields").hidden = s.form !== "headway";

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

    const verdictText =
      facts.made !== ""
        ? `You make the ${writtenTime(facts.made)}.`
        : empty
          ? "No departure you can make."
          : "";
    const verdict = el("verdict");
    verdict.textContent = verdictText;
    verdict.hidden = verdictText === "";
    liveText = verdictText;

    let line = "";
    if (!invalid && !naiveInvalid) {
      if (facts.made === facts.naive) {
        line =
          facts.made !== "" ? "The connection time changes nothing here." : "";
      } else {
        line =
          facts.naive !== ""
            ? `Naive, with no connection time: the ${writtenTime(facts.naive)}.`
            : "Naive, with no connection time: no departure.";
      }
    }
    const naiveLine = el("naive-line");
    naiveLine.textContent = line;
    naiveLine.hidden = line === "";

    const wait =
      facts.made === "" ? "" : departureWait(s.after, facts.made, lib);
    drawRail(s, facts);
    drawHero(s, facts, wait, !invalid && (facts.made !== "" || empty));

    const threshold = thresholdOf(s.after.trim(), s.minimumConnection);
    el("summary").textContent = [
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
      wait === "" ? "" : `Wait: ${toleranceText(wait)} after arrival.`,
      facts.naive !== "" && facts.naive !== facts.made
        ? `Naive, no connection time: ${writtenLabel(facts.naive)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    setHtml(
      el("reason"),
      reason === null
        ? html``
        : aside(
            {
              label: empty ? "Why empty" : "Why NO SIGNAL",
              tone: empty ? "note" : "caution",
              title: empty ? "Why empty" : "Why NO SIGNAL",
            },
            html`<p>${departureReasonText(reason)}</p>`,
          ),
    );

    // What nextDeparture returns.
    const timetable = timetableOf(s);
    const options = optionsOf(s);
    const frame = (
      label: string,
      copyLabel: string,
      callList: readonly unknown[],
      gate?: string,
    ): SafeHtml => {
      const [argsHtml, plain] = callArgs(callList);
      return codeFrame({
        label,
        copyLabel,
        copyText: `nextDeparture(${plain})`,
        code: raw(`${codeSpan("fn", "nextDeparture")}(${argsHtml})`),
        ...(gate === undefined ? {} : { gate }),
      });
    };
    setHtml(
      el("made-slot"),
      frame(
        "The call made",
        "Copy call",
        options
          ? [s.after.trim(), timetable, options]
          : [s.after.trim(), timetable],
        "codeframe",
      ),
    );
    setHtml(
      el("naive-slot"),
      frame("The naive call, with no connection time", "Copy naive call", [
        s.after.trim(),
        timetable,
      ]),
    );
    const out = (label: string, value: string, bad: boolean): SafeHtml =>
      value !== ""
        ? callOutput({
            label,
            state: "live",
            lines: [{ text: JSON.stringify(value), lost: false }],
          })
        : bad
          ? callOutput({
              label,
              state: "sentinel",
              lines: [{ text: "NO SIGNAL", lost: true }],
            })
          : callOutput({
              label,
              state: "empty",
              lines: [{ text: '""', lost: false }],
            });
    setHtml(
      el("made-output-slot"),
      out("What nextDeparture returned", facts.made, invalid),
    );
    setHtml(
      el("naive-output-slot"),
      out("What the naive call returned", facts.naive, naiveInvalid),
    );

    // Send it on.
    const args = handoffArgs(s, facts.made);
    setToolLink(
      el("handoff").querySelector("a"),
      args === null ? null : encodeWidgetPermalink("delivery", args),
    );
    el("handoff-hint").textContent = args
      ? ""
      : facts.made === ""
        ? "No departure to send."
        : "Give the onward leg's duration and destination clock.";
  }

  function refit(): void {
    win = railWindow(state());
    render();
  }

  function applyPreset(): void {
    const chosen = DEPARTURE_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    // `readArgs` is the one place a preset becomes a state.
    writeSeed(initialState({ preset: chosen.id }));
    syncPreset();
    refit();
  }

  /** The handle moved the arrival: snap to a whole minute and write it in the field's own
   *  notation (a bracketed zone, an offset or Z). */
  function setAfter(ms: number): void {
    if (win === null) return;
    const snapped =
      Math.round(clamp(ms, win.startMs, win.endMs) / MINUTE_MS) * MINUTE_MS;
    const text = writeLike(afterEl.value.trim(), snapped);
    if (text === "") return;
    afterEl.value = text;
    syncPreset();
    render();
    announce();
  }

  const typed: readonly EventTarget[] = [
    afterEl,
    connEl,
    headwayEl,
    fromEl,
    toEl,
    durationEl,
    modeEl,
    ...departureEls,
  ];

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      if (e.target === handleEl) {
        if (win !== null) setAfter(win.startMs + handleEl.value * MINUTE_MS);
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
      } else if (target === handleEl) {
        refit();
        announce();
      } else if (
        target === formEl ||
        target === countEl ||
        (target !== null && typed.includes(target))
      ) {
        syncPreset();
        refit();
        announce();
      } else if (target === zoneEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  writeSeed(start);
  syncPreset();
  refit();

  const refitText = (): void => {
    if (destroyed) return;
    placeAll();
    thinTickLabels(ticksEl, "[data-tick]");
  };
  const stopWidthWatch = onWidthChange(rail, refitText);
  // Text measured before the web fonts swap in is the wrong width: fit again once they load.
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

export const mountDepartureBoard: MountFn<DepartureBoardArgs> = async (
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
