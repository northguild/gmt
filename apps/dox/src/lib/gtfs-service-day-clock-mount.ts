/**
 * The GTFS Service Day Clock widget (RAI-100), mountable on its tool page and in the chat rail.
 *
 * The reader types a service date, a stop time and the agency's zone. Two cards show the
 * instant GTFS means (`gtfsToInstant`: noon of the service day minus 12 hours, plus the time as
 * elapsed seconds) and the instant a midnight anchor gives (`resolveLocal` of local midnight,
 * plus the same seconds). A verdict names the gap between them. A day rail draws both anchors,
 * both answers and the clock change on one scale, and the calls the tool made are printed under
 * it.
 *
 * Built on the component kit: `renderGtfsServiceDayClockTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids.
 * Every listener is delegated on the widget with the mount's `signal`; no timer runs. The
 * widget holds no GTFS rule: every value comes from the library (`gtfs-service-day-clock.ts`).
 *
 * `""` / `null` from the library renders as NO SIGNAL (amber). An empty box makes no call and
 * reads "nothing typed", never amber. Every value sits in a `hold` with the widest values the
 * presets give, so typing never moves a card.
 */
import { defineElements } from "~/widgets/define";
import {
  axis,
  codeFrame,
  field,
  findWidget,
  hold,
  html,
  idScope,
  lane,
  mark,
  section,
  setHtml,
  textInput,
  tick,
  toolLinks,
  verdict,
  widget,
  zonedValue,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { SIGNAL_TEXT } from "~/widgets/families/holiday/signal-plates";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/gtfs-service-day-clock.module.css";
import {
  BLANK_RESULT,
  CAPTIONS,
  CUSTOM_PRESET_ID,
  DATE_MAX_CHARS,
  GHOST_LOCAL,
  GHOST_UTC,
  GTFS_CARD_TITLE,
  MIDNIGHT_CARD_TITLE,
  MIDNIGHT_NOTES,
  midnightNoteOf,
  NOTHING_TO_DRAW,
  NOTHING_TYPED,
  NOT_DRAWN,
  PRESETS,
  REASONS,
  TIME_MAX_CHARS,
  VERDICT_SAMPLES,
  ZONE_MAX_CHARS,
  callsSizerText,
  computeClock,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  verdictOf,
  type ClockResult,
  type GtfsServiceDayClockArgs,
  type LaneId,
  type Rail,
  type ReasonKey,
  type ServiceDayState,
} from "./gtfs-service-day-clock";
import { loadServiceDayLib, type ServiceDayLib } from "./rail-lib";
import { encodeWidgetPermalink } from "./widget-permalink";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { GtfsServiceDayClockArgs } from "./gtfs-service-day-clock";

const WIDGET_NAME = "gtfs-service-day-clock";

const LANE_LABELS: Record<LaneId, string> = {
  gtfs: "GTFS",
  midnight: "Midnight",
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

type PlateState = "live" | "note" | "signal";

/** One value of a card: a caption and the value, held to the widest the presets give. */
function plate(
  caption: string,
  text: string,
  state: PlateState,
  ghosts: readonly string[],
): SafeHtml {
  const live =
    state === "live"
      ? zonedValue(text)
      : html`<span class="${styles.word}">${text}</span>`;
  return html`<div class="${styles.plate}" data-state="${state}"
    ><dt class="${styles.caption}">${caption}</dt
    ><dd class="${styles.value}"
      >${hold(
        live,
        [...ghosts.map((g) => zonedValue(g)), SIGNAL_TEXT, NOTHING_TYPED],
        { ghostClass: styles.ghost },
      )}</dd
    ></div
  >`;
}

function plateOf(
  caption: string,
  value: string,
  blank: boolean,
  ghosts: readonly string[],
): SafeHtml {
  if (blank) return plate(caption, NOTHING_TYPED, "note", ghosts);
  if (value === "") return plate(caption, SIGNAL_TEXT, "signal", ghosts);
  return plate(caption, value, "live", ghosts);
}

const REASON_TEXTS = Object.values(REASONS);
const MIDNIGHT_TEXTS = Object.values(MIDNIGHT_NOTES);

const reasonState = (key: ReasonKey): HeldState =>
  key === "ok" ? "ok" : key === "empty" ? "note" : "sentinel";

function cardOf(
  id: string,
  title: string,
  plates: SafeHtml,
  note: SafeHtml,
): SafeHtml {
  return html`<div class="${styles.card}" role="group" aria-labelledby="${id}"
    ><h4 class="${styles.cardTitle}" id="${id}">${title}</h4
    ><dl class="${styles.plates}">${plates}</dl
    >${note}</div
  >`;
}

function cardsOf(id: (local: string) => string, r: ClockResult): SafeHtml {
  const blank = r.kind === "empty";
  const sideOf = (
    side: ClockResult["gtfs"],
    ghosts: { local: readonly string[]; utc: readonly string[] },
  ) =>
    html`${plateOf(CAPTIONS.anchor, side.anchor.local, blank, ghosts.local)}${plateOf(
      CAPTIONS.answerUtc,
      side.answer.utc,
      blank,
      ghosts.utc,
    )}${plateOf(CAPTIONS.answerLocal, side.answer.local, blank, ghosts.local)}`;
  const ghosts = { local: GHOST_LOCAL, utc: GHOST_UTC };

  const midKey = midnightNoteOf(r);
  const midNote = MIDNIGHT_NOTES[midKey];
  return html`<div class="${styles.cards}">${cardOf(
    id("gtfs-title"),
    GTFS_CARD_TITLE,
    sideOf(r.gtfs, ghosts),
    heldText({
      label: "Reason for the GTFS instant",
      text: REASONS[r.reason],
      state: reasonState(r.reason),
      sizers: REASON_TEXTS,
      gate: "hold",
    }),
  )}${cardOf(
    id("midnight-title"),
    MIDNIGHT_CARD_TITLE,
    sideOf(r.midnight, ghosts),
    heldText({
      label: "About the midnight anchor",
      text: midNote,
      state: midKey === "none" ? "sentinel" : "note",
      sizers: MIDNIGHT_TEXTS,
      gate: "hold",
    }),
  )}</div>`;
}

const verdictHtml = (v: NonNullable<ReturnType<typeof verdictOf>>) =>
  verdict({ tone: v.tone, title: v.title, detail: v.detail });

function verdictSlot(gap: number | null): SafeHtml {
  const v = verdictOf(gap);
  return hold(
    v === null ? html`` : verdictHtml(v),
    VERDICT_SAMPLES.map((s) => verdictHtml({ tone: "bad", ...s })),
  );
}

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------

function laneOf(which: LaneId, rail: Rail | null): SafeHtml {
  const marks = (rail?.marks ?? []).filter((m) => m.lane === which);
  const spans = (rail?.spans ?? []).filter((s) => s.lane === which);
  const series = { anchor: 1, answer: 2, noon: 3, change: 4 } as const;
  return lane(
    { label: LANE_LABELS[which] },
    html`${spans.map((s) =>
      mark({
        label: s.label,
        at: s.at,
        span: s.span,
        series: 3,
        pattern: s.kind === "anchor-gap" ? "dotted" : "hatch",
      }),
    )}${marks.map((m) =>
      mark({ label: m.label, at: m.at, series: series[m.kind] }),
    )}${
      which === "gtfs"
        ? (rail?.changes ?? []).map((c) => tick({ at: c.at, label: c.label }))
        : ""
    }`,
  );
}

function railOf(rail: Rail | null): SafeHtml {
  return html`${laneOf("gtfs", rail)}${laneOf("midnight", rail)}${axis(
    html`${(rail?.ticks ?? []).map((t) => tick({ at: t.at, label: t.label }))}`,
  )}`;
}

const NO_CHANGE = "No clock change in this window.";
const changeText = (rail: Rail | null): string =>
  rail === null
    ? ""
    : rail.changes.length === 0
      ? NO_CHANGE
      : `Clock change: ${rail.changes.map((c) => c.label).join("; ")}.`;

function railNoteOf(r: ClockResult): SafeHtml {
  const text =
    r.railNote === "notDrawn"
      ? NOT_DRAWN
      : r.railNote === "nothing"
        ? NOTHING_TO_DRAW
        : changeText(r.rail);
  return heldText({
    label: "About the rail",
    text,
    state: r.railNote === "notDrawn" ? "sentinel" : "note",
    sizers: [
      NOT_DRAWN,
      NOTHING_TO_DRAW,
      NO_CHANGE,
      "Clock change: +01:00 → +02:00; +02:00 → +01:00.",
    ],
    gate: "hold",
  });
}

// ---------------------------------------------------------------------------
// Calls and links
// ---------------------------------------------------------------------------

const SIZER_TEXT = callsSizerText();
const SIZER_LINES = SIZER_TEXT.split("\n").length;
const SIZER_WIDEST = SIZER_TEXT.split("\n").reduce(
  (a, b) => (b.length > a.length ? b : a),
  "",
);

function callsOf(text: string): SafeHtml {
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy the calls",
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    minLines: SIZER_LINES,
    sizer: SIZER_WIDEST,
  });
}

function linksOf(state: ServiceDayState, r: ClockResult): SafeHtml {
  return toolLinks({
    label: "Open this result in another tool",
    links: [
      {
        text: "Read this stop time in the GTFS Time Reader",
        href:
          state.time === ""
            ? undefined
            : encodeWidgetPermalink("gtfstime", { value: state.time }),
      },
      {
        text: "See this zone's clock changes in the DST Inspector",
        href:
          r.year !== null && r.hasChange
            ? encodeWidgetPermalink("dst", { zone: state.zone, year: r.year })
            : undefined,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const presetOptions = () => [
  { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
  ...PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The cards, the rail and the calls are drawn blank here, without the
 * library; `mount` draws every result.
 */
export function renderGtfsServiceDayClockTemplate(
  idPrefix: string,
  args: GtfsServiceDayClockArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: ServiceDayState = isSeeded(args)
    ? readArgs(args)
    : presetState();

  const input = (
    local: string,
    label: string,
    value: string,
    maxLength: number,
  ) =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          inputMode: "text",
          autocomplete: "off",
          spellcheck: false,
          maxLength,
          describedBy,
        }),
    });

  const inputs = section(
    {
      id: id("inputs"),
      heading: "A service day, as the feed holds it",
      level: 3,
    },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: presetOptions(),
    })}</div>${input("date", "Service date (calendar.txt)", state.date, DATE_MAX_CHARS)}${input(
      "time",
      "Stop time (stop_times.txt)",
      state.time,
      TIME_MAX_CHARS,
    )}${input(
      "zone",
      "Zone (agency.txt, agency_timezone)",
      state.zone,
      ZONE_MAX_CHARS,
    )}</div>`,
  );

  const result = section(
    { id: id("result"), heading: "Two anchors, one day", level: 3 },
    html`<div id="${id("cards")}">${cardsOf(id, BLANK_RESULT)}</div
      ><div id="${id("verdict")}">${verdictSlot(null)}</div>`,
  );

  const railSection = section(
    { id: id("rail-section"), heading: "The day, hour by hour", level: 3 },
    html`<div class="${styles.rail}" id="${id("rail")}" data-gate="drawn">${railOf(null)}</div
      ><div id="${id("rail-note")}">${railNoteOf(BLANK_RESULT)}</div>`,
  );

  const calls = section(
    { id: id("calls-section"), heading: "The calls", level: 3 },
    html`${grow(html`<div class="${styles.slot}" id="${id("calls")}">${callsOf("")}</div>`)}<div id="${id("links")}">${linksOf(state, BLANK_RESULT)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "GTFS Service Day Clock", scope: idPrefix },
    html`${inputs}${result}${railSection}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ServiceDayState;
  apply(state: ServiceDayState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: ServiceDayLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const id = idScope(widgetEl.dataset.scope ?? "");
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const dateEl = el<HTMLInputElement>("date");
  const timeEl = el<HTMLInputElement>("time");
  const zoneEl = el<HTMLInputElement>("zone");

  const readState = (): ServiceDayState => ({
    date: dateEl.value,
    time: timeEl.value,
    zone: zoneEl.value,
  });

  function syncPresets(): void {
    presetEl.value = matchPreset(readState());
  }

  function render(): void {
    const state = readState();
    const r = computeClock(lib, state);
    setHtml(el("cards"), cardsOf(id, r));
    setHtml(el("verdict"), verdictSlot(r.gap));
    setHtml(el("rail"), railOf(r.rail));
    setHtml(el("rail-note"), railNoteOf(r));
    setHtml(el("calls"), callsOf(r.calls.join("\n")));
    setHtml(el("links"), linksOf(state, r));
  }

  function apply(state: ServiceDayState): void {
    dateEl.value = state.date;
    timeEl.value = state.time;
    zoneEl.value = state.zone;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== dateEl && e.target !== timeEl && e.target !== zoneEl) {
        return;
      }
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = PRESETS.find((p) => p.id === presetEl.value);
      // "Your values" keeps what is typed.
      if (!chosen) return;
      apply(chosen);
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountGtfsServiceDayClock: MountFn<
  GtfsServiceDayClockArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: ServiceDayLib;
  try {
    lib = await loadServiceDayLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPresets();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
