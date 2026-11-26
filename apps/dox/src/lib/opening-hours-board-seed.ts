/**
 * The Opening Hours Board's seeds: the presets as fields, the arguments a chat call or a
 * permalink carries as fields, and the fields back as a permalink's strings.
 *
 * Pure and DOM-free. The only reading of a schedule's text here is `JSON.parse` followed by
 * `editorFromSchedule`, which reads the shape and never says whether the schedule is valid: the
 * library decides that.
 */
import {
  BOARD_PRESETS,
  type BoardPreset,
} from "~/data/operating-schedule-presets";
import type { BoardState, DisambiguationChoice } from "./opening-hours-board";
import { editorFromSchedule, type EditorState } from "./opening-hours-editor";

export { BOARD_PRESETS, type BoardPreset };

export const CUSTOM_PRESET_ID = "custom";

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface BoardArgs {
  schedule?: string;
  from?: string;
  to?: string;
  weekOf?: string;
  duration?: string;
  within?: string;
  disambiguation?: string;
  preset?: string;
}

const CHOICES: readonly string[] = ["compatible", "earlier", "later", "reject"];

export const disambiguationOf = (
  s: string | undefined,
): DisambiguationChoice =>
  s !== undefined && CHOICES.includes(s) ? (s as DisambiguationChoice) : "";

/** The permalink's strings: what is typed, and nothing for an empty box. */
export function permalinkOf(
  state: BoardState,
  scheduleText: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: string) => {
    if (v !== "") out[k] = v;
  };
  set("schedule", scheduleText);
  set("from", state.from);
  set("to", state.to);
  set("weekOf", state.weekOf);
  set("duration", state.duration);
  set("within", state.within);
  set("disambiguation", state.disambiguation);
  return out;
}

/** The empty fields: a blank zone and no windows. */
export const BLANK_EDITOR: EditorState = {
  timeZone: "",
  weekdays: [[], [], [], [], [], [], []],
  holidays: "",
  overrides: [],
};

/** The fields for a schedule's text, or `null` when it is not JSON or the editor cannot hold it. */
function editorOfText(text: string): EditorState | null {
  try {
    const reading = editorFromSchedule(JSON.parse(text));
    return reading.kind === "fits" ? reading.state : null;
  } catch {
    return null;
  }
}

/** A preset's fields. A preset the editor cannot hold is a content error the facts test catches. */
export function presetBoardState(p: BoardPreset): BoardState {
  return {
    editor: editorOfText(p.text) ?? BLANK_EDITOR,
    weekOf: p.board.weekOf,
    from: p.board.from,
    to: p.board.to,
    duration: "",
    within: "",
    disambiguation: "",
  };
}

interface SeededBoard {
  state: BoardState;
  /** The schedule text was given, and the editor cannot hold it (or it is not JSON). */
  unfit: boolean;
}

const isBlank = (s: string | undefined): boolean =>
  s === undefined || s.trim() === "";

/** Whether the args name anything, so the widget opens on them and not on the first preset. */
export const isSeeded = (a: BoardArgs): boolean =>
  !isBlank(a.schedule) || a.preset !== undefined;

/**
 * The seed as fields. A schedule the args leave out comes from the named preset, or the first
 * one. An instant, week, duration or horizon is never defaulted when the args carry a schedule of
 * their own: the preset's own come with the preset alone.
 */
export function readBoardArgs(a: BoardArgs): SeededBoard {
  const named = BOARD_PRESETS.find((p) => p.id === a.preset);
  const base = named ?? BOARD_PRESETS[0]!;
  const fromPreset = isBlank(a.schedule) || named !== undefined;
  const seed = presetBoardState(base);
  const given = isBlank(a.schedule) ? null : editorOfText(a.schedule ?? "");
  const pick = (v: string | undefined, preset: string): string =>
    v ?? (fromPreset ? preset : "");
  return {
    state: {
      editor:
        named !== undefined || isBlank(a.schedule)
          ? seed.editor
          : (given ?? BLANK_EDITOR),
      weekOf: pick(a.weekOf, seed.weekOf),
      from: pick(a.from, seed.from),
      to: pick(a.to, seed.to),
      duration: a.duration ?? "",
      within: a.within ?? "",
      disambiguation: disambiguationOf(a.disambiguation),
    },
    unfit: named === undefined && !isBlank(a.schedule) && given === null,
  };
}

/** The preset whose editor fields these are, or the custom id. */
export function matchBoardPreset(editor: EditorState): string {
  const text = JSON.stringify(editor);
  const same = BOARD_PRESETS.find(
    (p) => JSON.stringify(editorOfText(p.text)) === text,
  );
  return same?.id ?? CUSTOM_PRESET_ID;
}
