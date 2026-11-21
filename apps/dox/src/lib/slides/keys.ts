/**
 * The deck's keyboard: one table of keys, read two ways. `mountKeys` listens for them; the help
 * dialog renders the same `KEY_TABLE`, so the dialog and the listener cannot drift.
 *
 * One `keydown` listener sits on `document` and goes with the mount's `signal`. It leaves an event
 * alone when the event is `defaultPrevented`, carries Ctrl, Meta or Alt, targets something a
 * reader types in or adjusts, presses Space or Enter on a focused button or link (that is the
 * button's click), or arrives while a `<dialog>` is open. Escape is never handled here: a dialog
 * closes through the site's Escape order (`lib/esc-layers.ts`) and the browser leaves fullscreen.
 *
 * Clickers send PageUp and PageDown, F5 or Shift+F5, Escape, and `.` or `B`; all are in the table.
 *
 * Free flight (W A S D tilt and turn, Q E zoom, Shift doubles the rate) is the one held-key row:
 * the keys a reader holds make a rate, `actions.fly` gets the whole vector on every key or Shift
 * change, and releasing a key, losing the window's focus or aborting the signal lets it go. A
 * release is read even while a dialog is open, so a held key can never stay stuck. R flies home.
 *
 * Single-character keys (letters, digits, punctuation) can be turned off with the keys dialog's
 * switch (`character-keys.ts`, WCAG 2.1.4). Off, they reach the page untouched; the arrows,
 * PageUp and PageDown, Home, End, Space, Enter, Backspace and F5 still work.
 *
 * Time: the digit buffer ("1", "2", Enter) forgets itself after `DIGIT_BUFFER_MS` on a timer the
 * signal clears. No clock is read.
 */

import {
  characterKeysOn,
  isCharacterKey,
  mountCharacterKeysSwitch,
} from "./character-keys";
import { FLY_KEYS, flyVector, type FlyVector } from "./stage-keys";

/** What a key does. `goTo` is the digits-then-Enter row. */
export type DeckAction =
  | "next"
  | "prev"
  | "nextSlide"
  | "prevSlide"
  | "first"
  | "last"
  | "goTo"
  | "overview"
  | "help"
  | "blank"
  | "fullscreen"
  | "present"
  | "presenter"
  | "fly"
  | "zoom"
  | "home";

interface KeyRow {
  action: DeckAction;
  /** What the help dialog shows, one `<kbd>` each. */
  keys: readonly string[];
  /** What the key does, for the help dialog. */
  label: string;
}

export const KEY_TABLE: readonly KeyRow[] = [
  {
    action: "next",
    keys: ["→", "↓", "Page Down", "Space", "Enter", "N"],
    label: "Next step: the next build, then the next slide",
  },
  {
    action: "prev",
    keys: ["←", "↑", "Page Up", "Shift+Space", "Backspace", "P"],
    label: "Previous step",
  },
  { action: "nextSlide", keys: ["Shift+→"], label: "Next slide" },
  { action: "prevSlide", keys: ["Shift+←"], label: "Previous slide" },
  { action: "first", keys: ["Home"], label: "First slide" },
  { action: "last", keys: ["End"], label: "Last slide" },
  { action: "goTo", keys: ["Digits, then Enter"], label: "Go to that slide" },
  { action: "overview", keys: ["O"], label: "Overview of every slide" },
  { action: "help", keys: ["?"], label: "This list of keys" },
  {
    action: "blank",
    keys: ["B", "."],
    label: "Blank the stage; any step key brings it back",
  },
  { action: "fullscreen", keys: ["F"], label: "Fullscreen on or off" },
  {
    action: "present",
    keys: ["F5", "Shift+F5"],
    label: "Start presenting: fullscreen",
  },
  {
    action: "presenter",
    keys: ["T"],
    label: "Open the presenter view in a second window",
  },
  {
    action: "fly",
    keys: ["W", "A", "S", "D"],
    label:
      "Fly over the Earth while held: W north, S south, A west, D east; Shift is twice as fast",
  },
  {
    action: "zoom",
    keys: ["Q", "E"],
    label: "Zoom out and in while held",
  },
  {
    action: "home",
    keys: ["R"],
    label: "Fly back to this slide's place; the next step does too",
  },
];

/** The digit buffer forgets what it holds after this long, in milliseconds. */
const DIGIT_BUFFER_MS = 1500;
const DIGITS_MAX = 3;

const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREV = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

/** The action a key press means, ignoring where it happened; null for a key the deck has no use for. */
function actionFor(
  event: Pick<KeyboardEvent, "key" | "shiftKey">,
): DeckAction | null {
  const { key, shiftKey } = event;
  if (key === "ArrowRight" && shiftKey) return "nextSlide";
  if (key === "ArrowLeft" && shiftKey) return "prevSlide";
  if (key === " " && shiftKey) return "prev";
  if (key === "F5") return "present";
  if (NEXT.has(key)) return "next";
  if (PREV.has(key)) return "prev";
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case "n":
      return "next";
    case "p":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "o":
      return "overview";
    case "?":
      return "help";
    case "b":
    case ".":
      return "blank";
    case "f":
      return "fullscreen";
    case "r":
      return "home";
    case "t":
      return "presenter";
    default:
      return null;
  }
}

/** Things a reader types in or adjusts with the arrow keys: the deck keeps its hands off them. */
const OWN_KEYS = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  ...["textbox", "combobox", "slider", "spinbutton", "listbox"].map(
    (role) => `[role=${role}]`,
  ),
  // A focusable separator is a splitter, which its arrow keys move (the Dox rail's handle).
  "[role=separator][tabindex]",
].join(", ");
/** Space and Enter on these are the control's own click. */
const CLICKABLE = "button, a[href], summary";

/** Whether the deck leaves this key press to the page. */
function ignored(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const doc = (event.target as Node | null)?.ownerDocument ?? document;
  if (doc.querySelector("dialog[open]")) return true;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest(OWN_KEYS)) return true;
  if ((event.key === " " || event.key === "Enter") && target.closest(CLICKABLE))
    return true;
  return false;
}

export interface DeckKeyActions {
  /** One step: a build, else a slide. */
  step(delta: 1 | -1): void;
  slide(delta: 1 | -1): void;
  first(): void;
  last(): void;
  /** `n` is the number the reader typed: one-based. */
  goTo(n: number): void;
  overview(): void;
  help(): void;
  blank(): void;
  fullscreen(): void;
  present(): void;
  /** Opens the presenter view in its own window. */
  presenter(): void;
  /** The camera rate the held flight keys make; all zeros when none is held. */
  fly(vector: FlyVector): void;
  /** Flies back to the slide's place. */
  home(): void;
}

/** Listens on `doc` until `signal` aborts, and wires the keys dialog's switch if `doc` has one. */
export function mountKeys(
  doc: Document,
  o: { signal: AbortSignal; actions: DeckKeyActions },
): void {
  const { signal, actions } = o;
  const win = doc.defaultView;
  if (!win || signal.aborted) return;
  let digits = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clearDigits = (): void => {
    digits = "";
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  signal.addEventListener("abort", clearDigits, { once: true });
  mountCharacterKeysSwitch(doc, signal);

  const run = (action: DeckAction): void => {
    switch (action) {
      case "next":
        return actions.step(1);
      case "prev":
        return actions.step(-1);
      case "nextSlide":
        return actions.slide(1);
      case "prevSlide":
        return actions.slide(-1);
      case "first":
        return actions.first();
      case "last":
        return actions.last();
      case "overview":
        return actions.overview();
      case "help":
        return actions.help();
      case "blank":
        return actions.blank();
      case "fullscreen":
        return actions.fullscreen();
      case "present":
        return actions.present();
      case "presenter":
        return actions.presenter();
      case "home":
        return actions.home();
      case "fly":
      case "zoom":
      case "goTo":
        return;
    }
  };

  const held = new Set<string>();
  let flying = false;
  /** Tells the camera the current rate; stays quiet while nothing is held and nothing was. */
  const syncFlight = (shift: boolean): void => {
    if (held.size === 0 && !flying) return;
    flying = held.size > 0;
    actions.fly(flyVector(held, shift));
  };
  const release = (): void => {
    held.clear();
    syncFlight(false);
  };
  signal.addEventListener("abort", release, { once: true });
  win.addEventListener("blur", release, { signal });
  doc.addEventListener(
    "keyup",
    (event) => {
      const key = event.key.toLowerCase();
      if (key === "shift") return syncFlight(false);
      if (held.delete(key)) syncFlight(event.shiftKey);
    },
    { signal },
  );

  doc.addEventListener(
    "keydown",
    (event) => {
      if (ignored(event)) return;
      if (isCharacterKey(event) && !characterKeysOn()) {
        if (digits !== "") clearDigits();
        return;
      }
      const flight = event.key.toLowerCase();
      if (event.key === "Shift") {
        syncFlight(true);
        return;
      }
      if (Object.hasOwn(FLY_KEYS, flight)) {
        if (digits !== "") clearDigits();
        event.preventDefault();
        held.add(flight);
        syncFlight(event.shiftKey);
        return;
      }
      if (/^[0-9]$/.test(event.key) && !event.shiftKey) {
        event.preventDefault();
        digits = (digits + event.key).slice(-DIGITS_MAX);
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(clearDigits, DIGIT_BUFFER_MS);
        return;
      }
      if (event.key === "Enter" && digits !== "") {
        event.preventDefault();
        const n = Number(digits);
        clearDigits();
        actions.goTo(n);
        return;
      }
      const action = actionFor(event);
      if (digits !== "") clearDigits();
      if (action === null) return;
      event.preventDefault();
      run(action);
    },
    { signal },
  );
}
