/**
 * The tense of a dated clock-change checker's words (CORE-89): every sentence about a change reads
 * true on the day it is read. A region states each change as a `Moment` (the UTC instant and the
 * offset in force just before it) and gives both forms of every tensed phrase. This module holds
 * the parts no region owns:
 *
 * - which form is true now: `changeTense`, which asks the library's `isBeforeUnix`, never a
 *   hand-written comparison;
 * - the date and time words of a moment, written by the library (`formatZonedDateTime` for the
 *   local clock reading, `formatUtc` for UTC), never typed;
 * - the markup that holds both forms in one grid cell, so the box is the longer form's and nothing
 *   moves when the tense flips, and the one-timer binding that flips the forms when a moment
 *   passes while the page is open.
 *
 * The library comes in as `TenseLib` (the page loads it lazily, `loadClockLib`), so this file
 * carries no polyfill. No region words live here.
 */
import { SIGNAL_LOST } from "./clock-change-common";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const escapeAttr = escapeHtml;

export type Tense = "before" | "after";

/** One change of clocks: the UTC instant it takes effect, and the UTC offset in force just before it. */
export interface Moment {
  at: string;
  from: string;
}

/** A moment in words: `20 September 2026 at 02:00` on the local clock, and `01:00` in UTC. */
export interface MomentWords {
  local: string;
  utc: string;
}

/** The library functions the tense needs. `ClockLib` (`clock-change-mount.ts`) carries them. */
export interface TenseLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  convertUtcToUnix(value: string): number | null;
  formatUtc(
    value: string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions & { timeZone?: string },
  ): string;
  formatZonedDateTime(
    value: string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  isBeforeUnix(value1: number, value2: number): boolean;
}

/** What a view needs to answer: which form is true, and the words of a moment. */
export interface TenseView {
  /** The form of the phrases that hang on the moment `key`. */
  tenseOf(key: string): Tense;
  /** The moment `key` in words, or `null` when the library could not write it. */
  words(key: string): MomentWords | null;
}

/** A phrase in both forms. `key` names the moment that decides the form; `null` for a phrase with one form. */
export interface Tensed {
  key: string | null;
  before: string;
  after: string;
}

/** The key of the moment that decides a whole region's phrases: its latest change. */
export const REGION_KEY = "region";

/** One fixed locale and format for every page and the chat: day month year, 24-hour. */
const LOCALE = "en-GB";
const DATE_FORMAT = { day: "numeric", month: "long", year: "numeric" } as const;
const TIME_FORMAT = {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as const;

/** `"before"` while `nowMs` is earlier than `atMs`; at the instant and after it, `"after"`. */
export function changeTense(
  lib: Pick<TenseLib, "isBeforeUnix">,
  nowMs: number,
  atMs: number,
): Tense {
  return lib.isBeforeUnix(nowMs, atMs) ? "before" : "after";
}

/**
 * The date and time of a moment, written by the library. The local reading is the instant at the
 * `from` offset, so it is the clock as it read just before the change; both the date and the time
 * come from `formatZonedDateTime`. The UTC time is `formatUtc`'s, with its date added when it is not
 * the local date. `null` when the library returns `""` for any part (invalid input).
 */
export function momentWords(lib: TenseLib, moment: Moment): MomentWords | null {
  const plain = lib.convertUtcToPlainDateTime(moment.at, {
    timeZone: moment.from,
  });
  if (plain === "") return null;
  const zoned = `${plain}${moment.from}[${moment.from}]`;
  const localDate = lib.formatZonedDateTime(zoned, LOCALE, DATE_FORMAT);
  const localTime = lib.formatZonedDateTime(zoned, LOCALE, TIME_FORMAT);
  const utcDate = lib.formatUtc(moment.at, LOCALE, DATE_FORMAT);
  const utcTime = lib.formatUtc(moment.at, LOCALE, TIME_FORMAT);
  if ([localDate, localTime, utcDate, utcTime].includes("")) return null;
  return {
    local: `${localDate} at ${localTime}`,
    utc: utcDate === localDate ? utcTime : `${utcDate} at ${utcTime}`,
  };
}

/**
 * A moment as the end of a phrase: `20 September 2026 at 02:00 local time`, with ` (01:00 UTC)`
 * when `withUtc`. The signal-lost mark when the library could not write the moment, never a blank.
 */
export function whenText(words: MomentWords | null, withUtc: boolean): string {
  if (words === null) return SIGNAL_LOST;
  return withUtc
    ? `${words.local} local time (${words.utc} UTC)`
    : `${words.local} local time`;
}

/** The three classes of a zone on a checker's map. */
export type ClassKind = "stopped" | "changes-after" | "none";

/**
 * The words of a map class in both forms. The class of the zones that stop names its change: the
 * zone's own moment when `id` is a zone, the region's when `id` is `null` (the legend). A zone's
 * text states local time and UTC; the legend adds UTC only when `sharedInstant`, that is when every
 * stopped zone changes at one instant. The other two classes have one form. A region whose change
 * has already happened passes `past`: its class has the one past form and no moment to follow.
 */
export function classPhrase(
  kind: ClassKind,
  id: string | null,
  view: TenseView,
  sharedInstant: boolean,
  past = false,
): Tensed {
  if (kind === "changes-after") return plainText("Still changes clocks");
  if (kind === "none") return plainText("Never changes clocks");
  const key = id ?? REGION_KEY;
  const when = whenText(view.words(key), id !== null || sharedInstant);
  if (past) return plainText(`Stopped changing clocks on ${when}`);
  return {
    key,
    before: `Stops changing clocks on ${when}`,
    after: `Stopped changing clocks on ${when}`,
  };
}

/** The region's change in words for a sentence: the date and local time, or the signal-lost mark. */
export function regionWhen(view: TenseView): string {
  return view.words(REGION_KEY)?.local ?? SIGNAL_LOST;
}

/** A phrase with one form. */
export function plainText(text: string): Tensed {
  return { key: null, before: text, after: text };
}

/**
 * The view at `now` (a UTC instant) of the moments a region states. A clock or a moment the library
 * cannot read leaves every phrase in its first form.
 */
export function tenseView(
  lib: TenseLib,
  moments: Readonly<Record<string, Moment>>,
  now: string,
): TenseView {
  const nowMs = lib.convertUtcToUnix(now);
  const worded = new Map<string, MomentWords | null>();
  const momentOf = (key: string): Moment => {
    const moment = moments[key];
    if (moment === undefined) throw new Error(`No change moment for ${key}.`);
    return moment;
  };
  return {
    tenseOf(key) {
      const atMs = lib.convertUtcToUnix(momentOf(key).at);
      return nowMs === null || atMs === null
        ? "before"
        : changeTense(lib, nowMs, atMs);
    },
    words(key) {
      if (!worded.has(key)) worded.set(key, momentWords(lib, momentOf(key)));
      return worded.get(key) ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/**
 * Both forms in one grid cell. The one that is not true now is `aria-hidden="true"` (the sheet
 * hides it with `visibility`), so it stays out of the accessibility tree and still sizes the box.
 * `block` is for a paragraph's worth of text; the default sits inside a line.
 */
export function slotHtml(
  key: string,
  beforeHtml: string,
  afterHtml: string,
  current: Tense,
  block = false,
): string {
  const hidden = ' aria-hidden="true"';
  return (
    `<span class="gmt-tense${block ? " gmt-tense--block" : ""}" data-moment="${escapeAttr(key)}">` +
    `<span data-form="before"${current === "after" ? hidden : ""}>${beforeHtml}</span>` +
    `<span data-form="after"${current === "before" ? hidden : ""}>${afterHtml}</span>` +
    `</span>`
  );
}

/** A phrase as HTML: plain text when it has one form, otherwise a slot. */
export function tensedHtml(
  phrase: Tensed,
  view: TenseView,
  block = false,
): string {
  if (phrase.key === null || phrase.before === phrase.after) {
    return escapeHtml(phrase.before);
  }
  return slotHtml(
    phrase.key,
    escapeHtml(phrase.before),
    escapeHtml(phrase.after),
    view.tenseOf(phrase.key),
    block,
  );
}

/** A phrase as plain text, in the form that is true now (for an attribute or an announcement). */
export function tensedPlain(phrase: Tensed, view: TenseView): string {
  return phrase.key === null ? phrase.before : phrase[view.tenseOf(phrase.key)];
}

/** Shows the true form of every slot under `root` and hides the other from the accessibility tree. */
export function syncTense(root: ParentNode, view: TenseView): void {
  for (const slot of root.querySelectorAll<HTMLElement>(
    ".gmt-tense[data-moment]",
  )) {
    const current = view.tenseOf(slot.dataset.moment ?? "");
    for (const form of slot.querySelectorAll<HTMLElement>(
      ":scope > [data-form]",
    )) {
      if (form.dataset.form === current) form.removeAttribute("aria-hidden");
      else form.setAttribute("aria-hidden", "true");
    }
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** The longest a timer can wait (a 32-bit signed count of milliseconds). */
const MAX_DELAY_MS = 2 ** 31 - 1;

export interface TenseBinding {
  /** The view at the page's clock, as of the last sync. */
  view(): TenseView;
}

export interface TenseBindingOptions {
  lib: TenseLib;
  moments: Readonly<Record<string, Moment>>;
  /** The page's clock, a UTC instant. */
  now: () => string;
  signal: AbortSignal;
  /** Called after each sync with the new view, for text the slots do not hold (labels). */
  onChange?: (view: TenseView) => void;
}

/**
 * Sets the form of every slot for the page's clock now, and again when the next moment passes: one
 * timer, set for the nearest moment still ahead, ended with `signal`.
 */
export function bindTense(
  root: ParentNode,
  { lib, moments, now, signal, onChange }: TenseBindingOptions,
): TenseBinding {
  let view = tenseView(lib, moments, now());
  let timer: ReturnType<typeof setTimeout> | undefined;

  function sync(): void {
    clearTimeout(timer);
    if (signal.aborted) return;
    const at = now();
    view = tenseView(lib, moments, at);
    syncTense(root, view);
    onChange?.(view);
    const nowMs = lib.convertUtcToUnix(at);
    if (nowMs === null) return;
    let wait = Infinity;
    for (const moment of Object.values(moments)) {
      const atMs = lib.convertUtcToUnix(moment.at);
      if (atMs !== null && lib.isBeforeUnix(nowMs, atMs)) {
        wait = Math.min(wait, atMs - nowMs);
      }
    }
    if (wait !== Infinity) {
      timer = setTimeout(sync, Math.min(Math.max(wait, 1), MAX_DELAY_MS));
    }
  }

  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  sync();
  return { view: () => view };
}
