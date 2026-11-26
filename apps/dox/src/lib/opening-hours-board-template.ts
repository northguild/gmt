/**
 * The Opening Hours Board's template: its chrome, built from the kit and the ledger family.
 *
 * Seeded with the args so the first paint shows them; the verdict, plates, lane and calls are
 * written by the mount from real library calls. The same markup server-renders on the tool page
 * and mounts in the chat rail.
 */
import {
  codeFrame,
  dateInput,
  field,
  fieldGrid,
  hint,
  hold,
  html,
  idScope,
  plates,
  section,
  select,
  textInput,
  verdict,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callLines } from "~/widgets/families/gnss/call-lines";
import { handoffRow } from "~/widgets/families/ledger/handoff-link";
import {
  ledgerAxis,
  ledgerFrame,
  ledgerGate,
  ledgerHandles,
  ledgerLane,
  ledgerLegend,
} from "~/widgets/families/ledger/ledger-lane";
import { grow } from "~/widgets/primitives/grow/grow";
import { handle } from "~/widgets/primitives/handle/handle";
import { preset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/opening-hours-board.module.css";
import type { BoardFacts, BoardState } from "./opening-hours-board";
import {
  BOARD_PRESETS,
  CUSTOM_PRESET_ID,
  isSeeded,
  matchBoardPreset,
  presetBoardState,
  readBoardArgs,
  type BoardArgs,
} from "./opening-hours-board-seed";
import { VERDICTS } from "./opening-hours-board-verdict";
import { boardPlates } from "./opening-hours-board-view";
import { editorMarkup } from "./opening-hours-editor-mount";

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

export const WIDGET_NAME = "opening-hours-board";
const INSTANT_MAX_CHARS = 64;
/** The handle's scale: hundredths of a percent of the week. */
export const HANDLE_MAX = 10000;
const PAGE_STEP_UNITS = 12;
/** The most calls a reading makes, and the widest line one prints, so the frame never resizes. */
const CALL_LINES = 11;
const CALL_SAMPLE = "x".repeat(240);

export const GATES = [
  { key: "open", label: "next open" },
  { key: "close", label: "next close" },
  { key: "due", label: "due" },
] as const;

const DISAMBIGUATIONS = [
  { value: "", label: "Library default" },
  { value: "compatible", label: "compatible" },
  { value: "earlier", label: "earlier" },
  { value: "later", label: "later" },
  { value: "reject", label: "reject" },
] as const;

function handles(): SafeHtml {
  const one = (label: string, pair: "start" | "end", value: number) =>
    handle({
      label,
      min: 0,
      max: HANDLE_MAX,
      step: 1,
      largeStep: PAGE_STEP_UNITS,
      value,
      valueText: "not drawn yet",
      pair,
    });
  return html`${one("From", "start", 0)}${one("To", "end", HANDLE_MAX)}`;
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function instantField(
  id: (l: string) => string,
  local: string,
  label: string,
  value: string,
): SafeHtml {
  return field({
    id: id(local),
    label,
    control: ({ id: cid, describedBy }) =>
      textInput({
        id: cid,
        value,
        maxLength: INSTANT_MAX_CHARS,
        spellcheck: false,
        autocomplete: "off",
        describedBy,
      }),
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The verdict, plates, lane and calls are drawn by `mount` from real calls.
 */
export function renderOpeningHoursBoardTemplate(
  idPrefix: string,
  args: BoardArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: BoardState = isSeeded(args)
    ? readBoardArgs(args).state
    : presetBoardState(BOARD_PRESETS[0]!);
  const [row1, row2] = boardPlates(null, "");

  const schedule = section(
    { id: id("schedule-section"), heading: "1. The schedule", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchBoardPreset(state.editor),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your schedule", description: "" },
        ...BOARD_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${editorMarkup(id, state.editor)}`,
  );

  const questions = section(
    { id: id("questions"), heading: "2. The week and the questions", level: 4 },
    fieldGrid(
      html`${field({
        id: id("week-of"),
        label: "Week of",
        control: ({ id: cid, describedBy }) =>
          dateInput({ id: cid, value: state.weekOf, describedBy }),
      })}${instantField(id, "from", "From (instant)", state.from)}${instantField(
        id,
        "to",
        "To (instant)",
        state.to,
      )}${instantField(
        id,
        "duration",
        "Open time to add (optional)",
        state.duration,
      )}${instantField(id, "within", "Within (optional)", state.within)}${field(
        {
          id: id("disambiguation"),
          label: "Repeated or skipped local time",
          control: ({ id: cid, describedBy }) =>
            select({
              id: cid,
              options: DISAMBIGUATIONS,
              value: state.disambiguation,
              describedBy,
            }),
        },
      )}`,
    ),
  );

  const answer = section(
    {
      id: id("answer"),
      heading: "3. The week and what the library says",
      level: 4,
    },
    html`${hold(
      html`<div id="${id("verdict")}" role="status" aria-label="Verdict"></div>`,
      Object.values(VERDICTS).map((v) => verdict(v)),
    )}${handoffRow({
      id: id("handoff"),
      label: "Check this schedule in the Operating Schedule Checker",
    })}${ledgerFrame(
      html`${ledgerLane(
        {
          id: id("lane"),
          label: "",
          daysLabel: "Local days of the week",
          gateRow: true,
        },
        html`<div class="${styles.bars}" id="${id("bars")}"></div>${GATES.map(
          (g) => ledgerGate({ id: id(`gate-${g.key}`), label: g.label }),
        )}${ledgerHandles(handles())}`,
      )}${ledgerAxis(id("axis"), ["", "", ""])}${ledgerLegend([
        { text: "open", swatch: "lit" },
        { text: "closed", swatch: "closed" },
      ])}`,
      { gate: "frame" },
    )}<div id="${id("plates-1")}">${plates(row1)}</div><div id="${id("plates-2")}">${plates(row2)}</div>${grow(
      hint(id("note"), "").html,
    )}`,
  );

  const calls = section(
    { id: id("calls"), heading: "4. The calls", level: 4 },
    html`<div id="${id("calls-slot")}">${callsOf(null)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Opening Hours Board", scope: idPrefix },
    html`${schedule}${questions}${answer}${calls}`,
  );
}

export function callsOf(facts: BoardFacts | null): SafeHtml {
  const printed = facts === null ? null : callLines(facts.calls);
  // ui-standards-ok: the same codeFrame call as the other tools; a shared builder is a cross-tool change
  return codeFrame({
    label: "Calls made",
    // ui-standards-ok: the same codeFrame fields as the other tools; a shared builder is a cross-tool change
    copyLabel: "Copy calls",
    copyText: printed?.plain ?? "",
    ...(printed === null ? {} : { code: printed.code }),
    minLines: CALL_LINES,
    sizer: CALL_SAMPLE,
    gate: "codeframe",
  });
}
