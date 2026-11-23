/**
 * The Opening Hours Board widget, mountable on its tool page and in the chat rail.
 *
 * The reader edits an operating schedule in fields, picks a local week and two instants, and the
 * Board draws that week's open intervals on day columns and reads all six operating functions:
 * the bars are `operatingIntervals`, the plates are `isOpenAt`, `nextOpenAt`, `nextCloseAt`,
 * `operatingTimeBetween` and `addOperatingTime`. A refused schedule reads "Schedule refused"
 * across every plate and marks the refused rows; a closed week reads "closed", never NO SIGNAL.
 *
 * `mount` draws from real calls (`boardFacts`) and computes no value. The two handles are the
 * typed From and To boxes' drag equivalent: they write the box and the box moves them. No timer,
 * live clock; the gate chips and the axis are fitted to the track's width when a reading is
 * drawn, and again when the track's width changes (`onWidthChange`). The markup is in `opening-hours-board-template.ts`, the editor's in
 * `opening-hours-editor-mount.ts`.
 */
import { defineElements } from "~/widgets/define";
import { findWidget, html, plates, setHtml, verdict } from "~/widgets/builders";
import { dayColumns } from "~/widgets/families/ledger/day-columns";
import { axisTicks, ledgerBar } from "~/widgets/families/ledger/ledger-lane";
import type { GmtHandle } from "~/widgets/primitives/handle/handle";
import type { GmtPreset } from "~/widgets/primitives/preset/preset";
import {
  axisLabels,
  dayCells,
  formatHandleValue,
  formatLocal,
  toEpochMs,
  type LedgerCanvas,
} from "./dwell-ledger";
import { loadHoursLib, type HoursLib } from "./hours-lib";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { layoutGates, placeGate } from "./ledger-gate";
import {
  BOARD_SNAP_MINUTES,
  barsOf,
  boardFacts,
  gatePlace,
  type BoardFacts,
  type BoardState,
} from "./opening-hours-board";
import {
  BOARD_PRESETS,
  disambiguationOf,
  isSeeded,
  matchBoardPreset,
  permalinkOf,
  presetBoardState,
  readBoardArgs,
  type BoardArgs,
} from "./opening-hours-board-seed";
import {
  GATES,
  HANDLE_MAX,
  WIDGET_NAME,
  callsOf,
} from "./opening-hours-board-template";
import { verdictOf } from "./opening-hours-board-verdict";
import { boardPlates } from "./opening-hours-board-view";
import { scheduleFromEditor } from "./opening-hours-editor";
import { wireEditor, type EditorControl } from "./opening-hours-editor-mount";
import { SCHEDULE_TEXT_MAX } from "./schedule-text-max";
import { onceDestroy, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";

export type { BoardArgs } from "./opening-hours-board-seed";
export { renderOpeningHoursBoardTemplate } from "./opening-hours-board-template";

const TOO_LONG_HINT =
  "This schedule is too long to carry in a link. Copy it into the Checker.";
const UNFIT_NOTE =
  "The editor cannot hold the schedule in the link. The Checker reads any shape.";

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): BoardState;
  apply(state: BoardState): void;
  render(): void;
  syncPreset(): void;
  note(text: string): void;
  /** Stops watching the track's width. */
  dispose(): void;
}

const NO_DAYS = { toPercent: () => 0 };

function setupWidget(
  root: HTMLElement,
  lib: HoursLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const weekEl = el<HTMLInputElement>("week-of");
  const fromEl = el<HTMLInputElement>("from");
  const toEl = el<HTMLInputElement>("to");
  const durationEl = el<HTMLInputElement>("duration");
  const withinEl = el<HTMLInputElement>("within");
  const choiceEl = el<HTMLSelectElement>("disambiguation");
  const trackEl = el("lane-track");
  const [fromHandle, toHandle] = [
    ...widgetEl.querySelectorAll<GmtHandle>("gmt-handle"),
  ] as [GmtHandle, GmtHandle];

  let canvas: LedgerCanvas | null = null;
  let editor: EditorControl;

  const readState = (): BoardState => ({
    editor: editor.read(),
    weekOf: weekEl.value,
    from: fromEl.value,
    to: toEl.value,
    duration: durationEl.value,
    within: withinEl.value,
    disambiguation: disambiguationOf(choiceEl.value),
  });

  const syncPreset = (): void => {
    presetEl.value = matchBoardPreset(editor.read());
  };

  /** Places both handles on the week and says each one's time aloud. `held` is the one being dragged. */
  function drawHandles(zone: string, held: GmtHandle | null): void {
    const week = canvas;
    const pairs = [
      [fromHandle, fromEl.value],
      [toHandle, toEl.value],
    ] as const;
    if (week !== null) {
      const spanMs = Math.max(1, week.endMs - week.startMs);
      const step = ((BOARD_SNAP_MINUTES * 60000) / spanMs) * HANDLE_MAX;
      for (const [h] of pairs) {
        h.setAttribute("step", String(step));
        h.setAttribute("large-step", String(step * 4));
      }
      const at = (text: string, empty: number): number => {
        const pct = week.toPercent(toEpochMs(text));
        return Number.isNaN(pct) ? empty : pct * (HANDLE_MAX / 100);
      };
      // Widen the end first, so the start is never held back by the old end.
      if (held !== toHandle) toHandle.value = HANDLE_MAX;
      if (held !== fromHandle) fromHandle.value = at(fromEl.value, 0);
      if (held !== toHandle) toHandle.value = at(toEl.value, HANDLE_MAX);
    }
    // After the values: a handle whose value moves rewrites its own `aria-valuetext` as a number.
    for (const [h, text] of pairs) {
      const ms = week === null ? Number.NaN : toEpochMs(text);
      h.setAttribute(
        "aria-valuetext",
        Number.isNaN(ms) ? "not a time in this week" : formatLocal(ms, zone),
      );
    }
  }

  function drawLane(
    facts: BoardFacts,
    zone: string,
    held: GmtHandle | null,
  ): void {
    canvas = facts.week;
    const cells =
      canvas === null ? [] : dayCells(canvas, zone, Number.NaN, Number.NaN);
    setHtml(el("lane-cells"), dayColumns(cells, canvas ?? NO_DAYS, {}));
    el("lane-label").textContent = canvas === null ? "" : zone;
    const axis = el("axis");
    setHtml(
      axis,
      axisTicks(canvas === null ? ["", "", ""] : axisLabels(canvas, zone)),
    );
    // On a narrow track the three times would touch: drop the ones that do.
    thinTickLabels(axis, "span");
    const bars =
      canvas === null || facts.kind === "refused"
        ? []
        : barsOf(facts.intervals, zone, canvas);
    setHtml(
      el("bars"),
      html`${bars.map((b, i) =>
        ledgerBar({
          id: id(`bar-${i}`),
          from: b.from,
          to: b.to,
          label: b.label,
        }),
      )}`,
    );
    const reading = facts.kind === "accepted" ? facts.reading : null;
    const instants: Record<(typeof GATES)[number]["key"], string | null> = {
      open:
        reading?.kind === "read" && reading.nextOpen.kind === "at"
          ? reading.nextOpen.instant
          : null,
      close:
        reading?.kind === "read" && reading.nextClose.kind === "at"
          ? reading.nextClose.instant
          : null,
      due:
        reading?.kind === "read" && reading.deadline.kind === "at"
          ? reading.deadline.instant
          : null,
    };
    // Hide all first, so a gate left over from the last draw never takes a chip row.
    for (const g of GATES) el(`gate-${g.key}`).hidden = true;
    for (const g of GATES) {
      const gate = el(`gate-${g.key}`);
      const at =
        canvas === null || instants[g.key] === null
          ? null
          : gatePlace(canvas, instants[g.key]!, zone);
      if (at === null) gate.hidden = true;
      else
        placeGate(
          gate,
          el(`gate-${g.key}-chip`),
          trackEl,
          at.percent,
          `${g.label} ${at.text}`,
        );
    }
    layoutGates(trackEl);
    drawHandles(zone, held);
  }

  function drawHandoff(state: BoardState): void {
    const link = el<HTMLAnchorElement>("handoff");
    const text = JSON.stringify(scheduleFromEditor(state.editor), null, 2);
    const fits = text.length <= SCHEDULE_TEXT_MAX;
    if (fits) {
      const args =
        state.from !== "" && state.to !== ""
          ? { schedule: text, start: state.from, end: state.to }
          : { schedule: text };
      link.setAttribute("href", encodeWidgetPermalink("schedule", args));
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
    el("handoff-hint").textContent = fits ? "" : TOO_LONG_HINT;
  }

  /** Draws everything from one set of calls. `held` is the handle being dragged, left where it is. */
  function render(held: GmtHandle | null = null): void {
    const state = readState();
    const facts = boardFacts(lib, state);
    const zone = state.editor.timeZone;
    editor.mark(facts.kind === "refused" ? facts.probe : null);
    setHtml(el("verdict"), verdict(verdictOf(facts)));
    const [row1, row2] = boardPlates(facts, zone);
    setHtml(el("plates-1"), plates(row1));
    setHtml(el("plates-2"), plates(row2));
    setHtml(el("calls-slot"), callsOf(facts));
    drawLane(facts, zone, held);
    drawHandoff(state);
  }

  function apply(state: BoardState): void {
    editor.write(state.editor);
    weekEl.value = state.weekOf;
    fromEl.value = state.from;
    toEl.value = state.to;
    durationEl.value = state.duration;
    withinEl.value = state.within;
    choiceEl.value = state.disambiguation;
  }

  editor = wireEditor(widgetEl, el, id, signal, () => {
    syncPreset();
    render();
  });

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target as Element;
      if (presetEl.contains(target)) return;
      if (target === fromHandle || target === toHandle) {
        const h = target as GmtHandle;
        if (canvas === null) return;
        const ms = canvas.fromPercent(h.value / (HANDLE_MAX / 100));
        (h === fromHandle ? fromEl : toEl).value = formatHandleValue(
          ms,
          readState().editor.timeZone,
        );
        render(h);
        return;
      }
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = BOARD_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetBoardState(chosen));
      syncPreset();
      render();
    },
    { signal },
  );

  /* The chips and the axis are fitted to the track's measured width, so a width change
     (rotation, the chat rail opening) draws again. */
  const stopWidth = onWidthChange(trackEl, () => render());

  return {
    dispose: stopWidth,
    readState,
    apply,
    render: () => {
      syncPreset();
      render();
    },
    syncPreset,
    note: (text) => {
      el("note").textContent = text;
    },
  };
}

export const mountOpeningHoursBoard: MountFn<BoardArgs> = async (
  root,
  args = {},
  // ui-standards-ok: the mount signature every tool shares (root, seed args, abort signal)
  signal,
) => {
  // ui-standards-ok: the mount shape every tool shares (define, load the library, check the signal)
  defineElements();
  // `loadHoursLib` throws `WidgetLoadError`: loud, not inert; the host decides what to show.
  const lib: HoursLib = await loadHoursLib();
  if (signal.aborted) return onceDestroy(() => {});

  const widgetCtl = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    const seeded = readBoardArgs(args);
    widgetCtl.apply(seeded.state);
    widgetCtl.note(seeded.unfit ? UNFIT_NOTE : "");
  }
  widgetCtl.render();

  return onceDestroy(
    () => widgetCtl.dispose(),
    () => {
      const state = widgetCtl.readState();
      return permalinkOf(
        state,
        JSON.stringify(scheduleFromEditor(state.editor), null, 2),
      );
    },
  );
};
