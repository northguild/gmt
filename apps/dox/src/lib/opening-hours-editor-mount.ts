/**
 * The Opening Hours Board's editor: its markup and its wiring.
 *
 * Seven weekday groups and a list of override groups, each a `windowRows` of native text boxes,
 * a zone box and a holidays box. The mount reads the fields from the DOM (`read`), writes a
 * preset into them (`write`) and marks the parts the library refused (`mark`) by toggling
 * attributes, so the caret and an IME composition in a box are never disturbed. Add and Remove
 * redraw only their own group and say where focus goes next: after a Remove, the next window's
 * "from" box, or the group's Add button when it was the last; after an Add, the new "from" box.
 *
 * Text is passed as typed: nothing here trims or repairs a time, a date or a zone.
 */
import {
  button,
  field,
  hint,
  hold,
  html,
  setHtml,
  textArea,
  textInput,
  type FoundWidget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  addWindowId,
  markRefused,
  windowIds,
  windowRows,
} from "~/widgets/families/hours/window-rows";
import styles from "~/widgets/tools/opening-hours-board.module.css";
import {
  WEEKDAYS,
  rowOfPart,
  type EditorState,
  type OverrideRow,
  type WindowText,
} from "./opening-hours-editor";
import type { ScheduleProbe } from "./schedule-probe";
import { SCHEDULE_TEXT_MAX } from "./schedule-text-max";

const TEXT_MAX_CHARS = 64;
const ZONE_REFUSED = "The zone is refused on its own";
const HOLIDAYS_SAMPLE = "Lines 99, 99, 99 are refused on their own";

export type Scope = (local: string) => string;

const pathOf = (el: Element, id: string): HTMLInputElement | null =>
  el.querySelector<HTMLInputElement>(`[id="${CSS.escape(id)}"]`);

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** One group's slot: the wrapper the mount redraws on Add and Remove. */
function windowSlot(
  gid: string,
  label: string,
  windows: readonly WindowText[],
): SafeHtml {
  return html`<div class="${styles.slot}" data-slot data-gid="${gid}" data-label="${label}" id="${gid}-slot"
    >${windowRows({ id: gid, label, windows })}</div
  >`;
}

function overrideRow(id: Scope, o: OverrideRow, i: number): SafeHtml {
  const gid = id(`ov-${i}`);
  const name = `Override ${i + 1}`;
  return html`<div class="${styles.override}" data-override="${String(i)}">
    ${field({
      id: `${gid}-date`,
      label: `${name} date`,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: o.date,
          spellcheck: false,
          autocomplete: "off",
          maxLength: TEXT_MAX_CHARS,
          describedBy,
        }),
    })}${windowSlot(gid, name, o.windows)}${button({ id: `${gid}-remove`, label: `Remove ${name.toLowerCase()}` })}
  </div>`;
}

const overridesMarkup = (
  id: Scope,
  overrides: readonly OverrideRow[],
): SafeHtml => html`${overrides.map((o, i) => overrideRow(id, o, i))}`;

/** A hint line that keeps its place: the text appearing moves nothing. */
const holdHint = (
  id: string,
  sample: string,
): { id: string; html: SafeHtml } => ({
  id,
  html: hold(hint(id, "").html, [sample]),
});

export function editorMarkup(id: Scope, state: EditorState): SafeHtml {
  return html`${field({
    id: id("zone"),
    label: "Time zone",
    hint: holdHint(id("zone-error"), ZONE_REFUSED),
    control: ({ id: cid, describedBy }) =>
      textInput({
        id: cid,
        value: state.timeZone,
        spellcheck: false,
        autocomplete: "off",
        maxLength: TEXT_MAX_CHARS,
        describedBy,
      }),
  })}<div class="${styles.days}">${WEEKDAYS.map((name, i) =>
    windowSlot(id(`day-${i}`), name, state.weekdays[i] ?? []),
  )}</div>${field({
    id: id("holidays"),
    label: "Holidays (one date per line)",
    hint: holdHint(id("holidays-error"), HOLIDAYS_SAMPLE),
    control: ({ id: cid, describedBy }) =>
      textArea({
        id: cid,
        value: state.holidays,
        rows: 3,
        maxLength: SCHEDULE_TEXT_MAX,
        describedBy,
      }),
  })}<div class="${styles.overrides}" id="${id("overrides")}">${overridesMarkup(id, state.overrides)}</div>${button(
    {
      id: id("add-override"),
      label: "Add override",
    },
  )}`;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface EditorControl {
  read(): EditorState;
  write(state: EditorState): void;
  /** Marks what the library refused; `null` clears every mark. */
  mark(probe: ScheduleProbe | null): void;
}

function readSlot(slot: HTMLElement): WindowText[] {
  const gid = slot.dataset["gid"]!;
  return [...slot.querySelectorAll("[data-window]")].map((_, i) => {
    const ids = windowIds(gid, i);
    return {
      from: pathOf(slot, ids.from)?.value ?? "",
      to: pathOf(slot, ids.to)?.value ?? "",
    };
  });
}

function drawSlot(slot: HTMLElement, windows: readonly WindowText[]): void {
  setHtml(
    slot,
    windowRows({
      id: slot.dataset["gid"]!,
      label: slot.dataset["label"]!,
      windows,
    }),
  );
}

const groupOf = (slot: HTMLElement): HTMLElement =>
  slot.firstElementChild as HTMLElement;

export function wireEditor(
  widgetEl: HTMLElement,
  el: FoundWidget["part"],
  id: Scope,
  signal: AbortSignal,
  onChange: () => void,
): EditorControl {
  const zoneEl = el<HTMLInputElement>("zone");
  const holidaysEl = el<HTMLTextAreaElement>("holidays");
  const overridesEl = el("overrides");
  const slotOf = (day: number): HTMLElement => el(`day-${day}-slot`);
  const overrideRows = (): HTMLElement[] => [
    ...overridesEl.querySelectorAll<HTMLElement>("[data-override]"),
  ];

  const read = (): EditorState => ({
    timeZone: zoneEl.value,
    weekdays: WEEKDAYS.map((_, i) => readSlot(slotOf(i))),
    holidays: holidaysEl.value,
    overrides: overrideRows().map((row, i) => ({
      date: pathOf(row, `${id(`ov-${i}`)}-date`)?.value ?? "",
      windows: readSlot(row.querySelector<HTMLElement>("[data-slot]")!),
    })),
  });

  const drawOverrides = (overrides: readonly OverrideRow[]): void =>
    setHtml(overridesEl, overridesMarkup(id, overrides));

  function write(state: EditorState): void {
    zoneEl.value = state.timeZone;
    WEEKDAYS.forEach((_, i) => drawSlot(slotOf(i), state.weekdays[i] ?? []));
    holidaysEl.value = state.holidays;
    drawOverrides(state.overrides);
  }

  function mark(probe: ScheduleProbe | null): void {
    const parts = probe?.kind === "parts-refused" ? probe.parts : [];
    const days = new Map<number, { whole: boolean; windows: number[] }>();
    const overrides = new Set<number>();
    const lines: number[] = [];
    let holidaysWhole = false;
    for (const row of parts.map(rowOfPart)) {
      if (row === null) continue;
      if (row.kind === "override") overrides.add(row.index);
      else if (row.kind === "holidays") {
        if (row.line === undefined) holidaysWhole = true;
        else lines.push(row.line + 1);
      } else {
        const day = days.get(row.day) ?? { whole: false, windows: [] };
        if (row.window === undefined) day.whole = true;
        else day.windows.push(row.window);
        days.set(row.day, day);
      }
    }
    WEEKDAYS.forEach((_, i) => {
      const d = days.get(i);
      markRefused(groupOf(slotOf(i)), d?.whole === true, d?.windows ?? []);
    });
    overrideRows().forEach((row, i) =>
      markRefused(
        groupOf(row.querySelector<HTMLElement>("[data-slot]")!),
        overrides.has(i),
      ),
    );
    const zoneBad = probe?.kind === "zone-refused";
    zoneEl.toggleAttribute("aria-invalid", zoneBad);
    if (zoneBad) zoneEl.setAttribute("aria-invalid", "true");
    el("zone-error").textContent = zoneBad ? ZONE_REFUSED : "";
    const holidaysBad = holidaysWhole || lines.length > 0;
    holidaysEl.toggleAttribute("aria-invalid", holidaysBad);
    if (holidaysBad) holidaysEl.setAttribute("aria-invalid", "true");
    el("holidays-error").textContent = holidaysWhole
      ? "The holidays are refused on their own"
      : lines.length === 0
        ? ""
        : `${lines.length === 1 ? "Line" : "Lines"} ${lines.join(", ")} ${lines.length === 1 ? "is" : "are"} refused on its own`;
  }

  widgetEl.addEventListener(
    "click",
    (e) => {
      const btn = (e.target as Element).closest("button");
      if (btn === null) return;
      const slot = btn.closest<HTMLElement>("[data-slot]");
      if (slot !== null) {
        const gid = slot.dataset["gid"]!;
        const windows = readSlot(slot);
        const adding = btn.id === addWindowId(gid);
        const at = windows.findIndex(
          (_, i) => windowIds(gid, i).remove === btn.id,
        );
        if (!adding && at === -1) return;
        if (adding) windows.push({ from: "", to: "" });
        else windows.splice(at, 1);
        drawSlot(slot, windows);
        const next = adding ? windows.length - 1 : at;
        const target =
          next < windows.length ? windowIds(gid, next).from : addWindowId(gid);
        pathOf(slot, target)?.focus();
        onChange();
        return;
      }
      if (btn.id === id("add-override")) {
        const overrides = read().overrides;
        overrides.push({ date: "", windows: [{ from: "", to: "" }] });
        drawOverrides(overrides);
        pathOf(
          overridesEl,
          `${id(`ov-${overrides.length - 1}`)}-date`,
        )?.focus();
        onChange();
        return;
      }
      const row = btn.closest<HTMLElement>("[data-override]");
      if (row !== null && btn.id.endsWith("-remove")) {
        const at = Number(row.dataset["override"]);
        const overrides = read().overrides;
        overrides.splice(at, 1);
        drawOverrides(overrides);
        const next = overrideRows()[at];
        (next === undefined
          ? el("add-override")
          : pathOf(next, `${id(`ov-${at}`)}-date`)
        )?.focus();
        onChange();
      }
    },
    { signal },
  );

  return { read, write, mark };
}
