/**
 * The Crossing Clock widget (TRAN-9), mountable on its tool page and in the
 * chat rail.
 *
 * A crossing — a canal transit, a strait passage, a border queue — is logged
 * as two instants and read on the clock of the zone that administers it. The
 * real `crossingTime` gives the exact elapsed hours; the widget's one naive
 * value, `naiveWallDifference`, is the printed `HH:MM` at either end
 * subtracted with no zone and no DST, which agrees when nothing moves the
 * zone's offset between the two ends and disagrees when a DST transition
 * does.
 *
 * Built on the component kit: `renderCrossingClockTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its
 * parts by those ids and reads and writes element `value` properties. Every
 * listener is delegated on the widget with the mount's `signal`. The two faces
 * and the strip are the clock family's (`widgets/families/clock`).
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  badge,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { crossingConnector } from "~/widgets/families/clock/crossing-connector";
import {
  crossingBar,
  type CrossingBarView,
} from "~/widgets/families/clock/crossing-strip";
import {
  bindClockToggle,
  crystalClock,
  type CrystalClockHighlight,
  type CrystalClockState,
} from "~/widgets/families/clock/crystal-clock";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/crossing-clock.module.css";
import { resolveWallTime } from "./dwell-ledger";
import {
  CROSSING_PRESETS,
  CROSSING_ZONES,
  CUSTOM_PRESET_ID,
  NULL_REASON_TEXT,
  crossingCallSource,
  crossingClockFace,
  crossingStrip,
  durationMinutes,
  explainNull,
  isRepeatedReading,
  matchPreset,
  naiveText,
  naiveWallDifference,
  permalinkOf,
  readArgs,
  spokenOffset,
  type ClockFace,
  type CrossingClockArgs,
  type CrossingState,
} from "./crossing-clock";
import { enter } from "./enter";
import { loadTransportLib } from "./transport-lib";
import {
  formatCrossing,
  minutesText,
  type TransportLib,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan, isRangeError, RANGE_EDGE_TEXT } from "./widget-ui";

export type { CrossingClockArgs } from "./crossing-clock";

const NBSP = " ";
const WIDGET_NAME = "crossing-clock";

type Side = "entry" | "exit";

/** The face's grid area for each of the five rows, by side. */
const AREAS: Record<Side, readonly string[]> = {
  entry: ["eh", "ef", "et", "em", "ed"],
  exit: ["xh", "xf", "xt", "xm", "xd"],
};

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/**
 * One clock column, as five direct children of the grid. They are empty until
 * the library loads: the same "skeleton first, then filled" shape every other
 * computed value in this widget follows.
 */
function clockPanel(
  id: (local: string) => string,
  side: Side,
  heading: string,
): SafeHtml {
  const [h, f, t, m, d] = AREAS[side] as [
    string,
    string,
    string,
    string,
    string,
  ];
  return html`<p class="${styles.heading}" data-area="${h}">${heading}</p
    ><div class="${styles.face}" data-area="${f}" id="${id(`${side}-clock`)}"></div
    ><p class="${styles.time}" data-area="${t}" id="${id(`${side}-time`)}">${NBSP}</p
    ><p class="${styles.meta}" data-area="${m}" id="${id(`${side}-meta`)}">${NBSP}</p
    ><p class="${styles.date}" data-area="${d}" id="${id(`${side}-date`)}">${NBSP}</p>`;
}

/** The zones to pick from: the curated list, and a seeded zone outside it. */
function zoneChoices(selected: string): { value: string; label: string }[] {
  const list =
    selected === "" || CROSSING_ZONES.includes(selected)
      ? CROSSING_ZONES
      : [...CROSSING_ZONES, selected];
  return list.map((z) => ({ value: z, label: z }));
}

function noCall(): SafeHtml {
  return codeFrame({
    label: "Call made",
    copyLabel: "Copy call",
    copyText: "",
    gate: "codeframe",
  });
}

function callFrame(state: CrossingState): SafeHtml {
  const [argsHtml, plain] = crossingCallSource(state);
  return codeFrame({
    label: "Call made",
    copyLabel: "Copy call",
    copyText: `crossingTime(${plain})`,
    code: raw(`${codeSpan("fn", "crossingTime")}(${argsHtml})`),
    gate: "codeframe",
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The faces, the strip and the call are
 * drawn by `mount`, because they come from the real library call.
 */
export function renderCrossingClockTemplate(
  idPrefix: string,
  args: CrossingClockArgs = {},
): string {
  const id = idScope(idPrefix);
  const seeded = args.entry !== undefined;
  const state: CrossingState = seeded
    ? readArgs(args)
    : { ...CROSSING_PRESETS[0]!.state };
  const presetId = matchPreset(state);

  const box = (wide: boolean, content: SafeHtml): SafeHtml =>
    html`<div class="${styles.box}" ${wide ? html`data-wide` : ""}>${content}</div>`;

  const text = (local: string, label: string, value: string): SafeHtml =>
    box(
      true,
      field({
        id: id(local),
        label,
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    );

  const log = section(
    { id: id("log"), heading: "1. Log the crossing", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...CROSSING_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${text("entry", "Entry", state.entry)}${text("exit", "Exit", state.exit)}${box(
        false,
        field({
          id: id("target-zone"),
          label: "Read on the clock of",
          control: ({ id: cid }) =>
            select({
              id: cid,
              value: state.targetZone,
              options: zoneChoices(state.targetZone),
            }),
        }),
      )}`,
    )}`,
  );

  const read = section(
    {
      id: id("read"),
      heading: "2. Elapsed, and what the clocks say",
      level: 4,
    },
    html`<div class="${styles.clocks}">${clockPanel(id, "entry", "Entry")}${crossingConnector({ elapsedId: id("elapsed"), naiveId: id("naive"), area: "co" })}${clockPanel(id, "exit", "Exit")}</div>${grow(html`<div id="${id("strip")}">${crossingBar({ kind: "blank" })}</div>`)}${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const call = section(
    {
      id: id("call"),
      heading: "3. What crossingTime returns",
      level: 4,
    },
    html`${grow(html`<div id="${id("call-slot")}">${noCall()}</div>`)}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the call returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Crossing Clock", scope: idPrefix },
    html`${log}${read}${call}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Draws one clock panel from `face`, which `crossingClockFace` already read out of the library's own string. */
function drawPanel(
  part: <T extends HTMLElement>(local: string) => T,
  side: Side,
  heading: string,
  face: ClockFace,
  clockState: CrystalClockState,
  highlight: CrystalClockHighlight | undefined,
): void {
  const faceEl = part(`${side}-clock`);
  /* The face arrives with the site's entrance (lib/enter.ts) when it first appears, the exit
     clock a beat after the entry clock. A re-render with new values replaces the dial in place
     and does not replay it. */
  const appearing = !faceEl.hasChildNodes();
  setHtml(
    faceEl,
    crystalClock({
      id: side,
      hour: face.hour,
      minute: face.minute,
      label: `${heading} clock`,
      sublabel: `${face.timeLabel}, ${spokenOffset(face.offset)}, ${face.zoneLabel}`,
      state: clockState,
      highlight,
    }),
  );
  if (appearing) enter(faceEl, { delayMs: side === "exit" ? 80 : 0 });
  part(`${side}-time`).textContent = face.timeLabel;
  part(`${side}-meta`).textContent = `${face.offset} · ${face.zoneLabel}`;
  part(`${side}-date`).textContent = face.dateLabel;
}

function clearPanel(
  part: <T extends HTMLElement>(local: string) => T,
  side: Side,
): void {
  const faceEl = part(`${side}-clock`);
  setHtml(faceEl, html``);
  // Emptied, so the next face to appear enters again.
  faceEl.removeAttribute("data-entered");
  for (const suffix of ["time", "meta", "date"] as const) {
    part(`${side}-${suffix}`).textContent = NBSP;
  }
}

interface Controller {
  readState(): CrossingState;
  apply(state: CrossingState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: TransportLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const entryEl = part<HTMLInputElement>("entry");
  const exitEl = part<HTMLInputElement>("exit");
  const zoneEl = part<HTMLSelectElement>("target-zone");

  function readState(): CrossingState {
    return {
      entry: entryEl.value.trim(),
      exit: exitEl.value.trim(),
      targetZone: zoneEl.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function render(): void {
    const s = readState();
    const result = lib.crossingTime(s.entry, s.exit, s.targetZone);

    setHtml(part("call-slot"), callFrame(s));
    setHtml(
      part("output-slot"),
      callOutput({
        label: "What the call returned",
        state: result === null ? "sentinel" : "live",
        lines: [
          result === null
            ? { text: "", lost: true }
            : { text: formatCrossing(result), lost: false },
        ],
      }),
    );

    const elapsedEl = part("elapsed");
    const naiveEl = part("naive");

    if (result === null) {
      elapsedEl.textContent = NBSP;
      setHtml(naiveEl, html`${NBSP}`);
      setHtml(part("strip"), crossingBar({ kind: "blank" }));
      clearPanel(part, "entry");
      clearPanel(part, "exit");
      const reason = explainNull(s.entry, s.exit, s.targetZone, lib);
      setHtml(
        part("reason"),
        aside(
          { label: "Why null", tone: "caution", title: "Why null" },
          html`<p>${reason ? NULL_REASON_TEXT[reason] : "The crossing could not be read."}</p>`,
        ),
      );
      return;
    }

    setHtml(part("reason"), html``);

    const naiveMinutes = naiveWallDifference(result);
    const elapsedMinutes = durationMinutes(result.duration);
    const disagrees = Math.round(naiveMinutes - elapsedMinutes) !== 0;
    elapsedEl.textContent = `${result.duration} elapsed — ${minutesText(elapsedMinutes)}`;
    setHtml(
      naiveEl,
      html`Naive: ${naiveText(elapsedMinutes, naiveMinutes)}${disagrees ? html` ${badge({ text: "disagrees", tone: "danger" })}` : ""}`,
    );

    const entryFace = crossingClockFace(result.enter);
    const exitFace = crossingClockFace(result.exit);
    const repeated = isRepeatedReading(entryFace, exitFace);

    /* A crossing at the very edge of the supported range has zoned strings that cannot be
       placed on a bar: say so, and keep the clocks. */
    let strip: ReturnType<typeof crossingStrip> | null = null;
    try {
      strip = crossingStrip(result, s.targetZone);
    } catch (error) {
      if (!isRangeError(error)) throw error;
    }
    // Both clocks read the same targetZone, so a change found anywhere in the crossing shows on
    // both. Only the first change draws (a highlight is one hour, not a list).
    const firstChange = strip?.changes[0];
    const highlight: CrystalClockHighlight | undefined = firstChange
      ? {
          fromHour: firstChange.fromHour,
          fromMinute: firstChange.fromMinute,
          toHour: firstChange.toHour,
          toMinute: firstChange.toMinute,
          kind: firstChange.kind === "skip" ? "skipped" : "repeated",
        }
      : undefined;

    const faceState: CrystalClockState = repeated ? "repeated" : "normal";
    drawPanel(part, "entry", "Entry", entryFace, faceState, highlight);
    drawPanel(part, "exit", "Exit", exitFace, faceState, highlight);

    const view: CrossingBarView =
      strip === null
        ? { kind: "edge", text: RANGE_EDGE_TEXT }
        : { kind: "drawn", strip };
    setHtml(part("strip"), crossingBar(view));
  }

  function apply(state: CrossingState): void {
    entryEl.value = state.entry;
    exitEl.value = state.exit;
    zoneEl.value = state.targetZone;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === entryEl || e.target === exitEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        const chosen = CROSSING_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(chosen.state);
        syncPreset();
        render();
        return;
      }
      if (e.target === zoneEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  bindClockToggle(widgetEl, signal);
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

/** A zone the picker does not list is added, so a seeded zone is kept. */
function ensureZone(zoneEl: HTMLSelectElement, zone: string): void {
  if (zone === "") return;
  const known = Array.from(zoneEl.options).some((o) => o.value === zone);
  if (!known) zoneEl.add(new Option(zone, zone));
}

export const mountCrossingClock: MountFn<CrossingClockArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TransportLib;
  try {
    lib = await loadTransportLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const { part } = findWidget(root, WIDGET_NAME);
  if (args.entry !== undefined) {
    const s = readArgs(args);
    const zone = s.targetZone.trim();
    ensureZone(part<HTMLSelectElement>("target-zone"), zone);
    part<HTMLInputElement>("entry").value =
      zone === "" ? s.entry : resolveWallTime(s.entry, zone);
    part<HTMLInputElement>("exit").value =
      zone === "" ? s.exit : resolveWallTime(s.exit, zone);
    part<HTMLSelectElement>("target-zone").value = zone;
  }
  const controller = setupWidget(root, lib, signal);

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
