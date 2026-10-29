/**
 * The saved-events section of a dated tz-change checker: "Did your saved events move?". The
 * markup is `storedSection` (families/clockcheck); this file holds the worked example's values, the
 * Worker's answer as words, and `wireStoredTimes`, which makes the form live. The lines' wording
 * and verdicts are `clock-change-stored-lines.ts`, which the Worker shares.
 */
import type { FoundWidget } from "~/widgets/root";
import { html, setHtml } from "~/widgets/builders/html";
import { wireDisclosure } from "~/widgets/builders/disclosure";
import {
  storedTable,
  rowMoved,
} from "~/widgets/families/clockcheck/stored-table";
import { cityOf } from "./clock-change-common";
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  needsZonePicker,
  storedAdvice,
  staleCheckText,
  storedZoneOf,
} from "./clock-change-stored-lines";
import type { StoredCheck, StoredRow } from "./clock-change-stored-lines";

export const STORED_UNCHECKED_TEXT =
  "This browser’s time zone data could not be checked, so no line can be judged yet. Press Check again under Your browser.";

/** The worked example at the top of the section: one saved value, its new rule and its fix. */
export interface SavedExample {
  city: string;
  /** `09:00`, the local time the meeting was booked for. */
  wallHm: string;
  /** The date as the step says it: `15 Nov`. */
  dateText: string;
  /** The offset that applied when it was saved. */
  savedOffset: string;
  /** The offset the place has now. */
  newOffset: string;
  /** What the saved value shows now. */
  shownHm: string;
  /** The value as an app saved it. */
  saved: string;
}

/** What a region states once about its worked example: the zone, its offset now, and the old one. */
export interface SavedFact {
  zone: string;
  /** The offset the place has now: the reference fact, `+HH:mm`. */
  offset: string;
  /** Minutes the offset an app saved before the change differs from `offset` by: `-60` or `60`. */
  savedShiftMinutes: number;
}

/** A `SavedExample` with the zone it is for, the value that keeps the local time, and the date it shows on. */
export interface SavedExampleValues extends SavedExample {
  zone: string;
  /** The value that keeps the local time. */
  fixed: string;
  /** The date the saved value shows on now, `YYYY-MM-DD`: the next date when the shift wraps past midnight. */
  shownDate: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const DAY_MINUTES = 24 * 60;

const isLeap = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function monthLength(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** `YYYY-MM-DD` moved by `days` (-1, 0 or 1 here), in the calendar and nothing else. */
function addDays(date: string, days: number): string {
  let [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  day += days;
  if (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    day = monthLength(year, month);
  } else if (day > monthLength(year, month)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function offsetMinutes(offset: string): number {
  return (
    (offset.startsWith("-") ? -1 : 1) *
    (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)))
  );
}

function offsetText(minutes: number): string {
  const abs = Math.abs(minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * The worked example of the saved-times section, from a region's one fact and one wall time
 * (`YYYY-MM-DDTHH:mm:ss`). The saved offset is the fact's offset moved by `savedShiftMinutes`;
 * the time the saved value shows now is the wall time moved the other way, wrapped into the day
 * (23:30 shifted an hour reads `00:30` on the next date, never `24:30`). The page states no tz
 * data of its own.
 */
export function savedExample(
  fact: SavedFact,
  wall: string,
): SavedExampleValues {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wallMinutes =
    Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
  const savedMinutes = offsetMinutes(fact.offset) + fact.savedShiftMinutes;
  const shown = wallMinutes - fact.savedShiftMinutes;
  const dayShift = Math.floor(shown / DAY_MINUTES);
  const shownOfDay = shown - dayShift * DAY_MINUTES;
  const [, month, day] = wall.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const shownDate = addDays(wall.slice(0, 10), dayShift);
  const savedOffset = offsetText(savedMinutes);
  return {
    zone: fact.zone,
    city: cityOf(fact.zone),
    wallHm: `${pad(Math.floor(wallMinutes / 60))}:${pad(wallMinutes % 60)}`,
    dateText: `${day} ${MONTHS[month - 1]}`,
    savedOffset,
    newOffset: fact.offset,
    shownHm: `${pad(Math.floor(shownOfDay / 60))}:${pad(shownOfDay % 60)}`,
    shownDate,
    saved: `${wall}${savedOffset}[${fact.zone}]`,
    fixed: `${wall}${fact.offset}[${fact.zone}]`,
  };
}

export interface StoredConfig {
  /** Namespaces the title and the textarea ids. */
  idPrefix: string;
  /** The Worker's endpoint, already through `withBase` (the config applies it, so the bundle never holds a bare root path). */
  endpoint: string;
  /** The zone picker, in order. */
  zones: readonly string[];
  /** What the textarea holds on load and after "Reset example". */
  preset: string;
  /** The worked example card. */
  example: SavedExample;
}

export const STORED_BYTES_TEXT = STORED_MAX_BYTES.toLocaleString("en-US");

/** How many rows the prefilled example's answer holds: its non-empty lines, up to the line limit. */
export function presetRows(preset: string): number {
  const lines = preset.split(/\r?\n/).filter((line) => line.trim() !== "");
  return Math.min(lines.length, STORED_MAX_LINES);
}

export type AuditModule = typeof import("./stored-time-audit");

/** The readings are a pure helper; it loads on the first answer, not with the page. */
export async function loadAuditWords(): Promise<AuditModule> {
  return import("./stored-time-audit");
}

/** The message under the filter when the Worker cut the input. */
export function storedTruncatedText(check: StoredCheck): string {
  const last = check.rows.at(-1);
  const base = `The input was over ${STORED_MAX_LINES} lines or ${STORED_BYTES_TEXT} bytes;`;
  return last === undefined
    ? `${base} no line was read.`
    : `${base} lines after line ${last.line} were not read.`;
}

type StoredAnswer =
  | { kind: "ok"; check: StoredCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "too-large" }
  | { kind: "failed" };

export async function askStored(
  endpoint: string,
  fetchFn: typeof fetch,
  form: FormData,
  signal: AbortSignal,
): Promise<StoredAnswer> {
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      body: form,
      signal,
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      return {
        kind: "rate-limited",
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    if (response.status === 413) return { kind: "too-large" };
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as StoredCheck };
  } catch {
    return { kind: "failed" };
  }
}

/**
 * The summary's words: how many of the lines this check can judge moved. A line in a zone the data
 * is stale for is counted apart, never as moved or as right.
 */
export function storedSummaryText(
  rows: readonly StoredRow[],
  staleZones: ReadonlySet<string> = new Set(),
): string {
  const readable = rows.filter((row) => row.result !== null);
  const unknown = readable.filter((row) =>
    staleZones.has(storedZoneOf(row.value) ?? ""),
  );
  const judged = readable.filter((row) => !unknown.includes(row));
  const moved = judged.filter((row) => !storedAdvice(row.value, row.result).ok);
  const tail =
    unknown.length === 0 ? "" : ` · ${unknown.length} can’t be checked yet`;
  if (judged.length === 0) {
    return unknown.length > 0
      ? "No saved event can be checked yet"
      : "Nothing checked";
  }
  const movedText = moved.length === 0 ? "none moved" : `${moved.length} moved`;
  return `${judged.length} checked · ${movedText}${tail}`;
}

export interface StoredHandle {
  /**
   * Says which zones this check's own time zone data has wrong. Lines in them get no verdict and
   * no advice. Until it is called, no answer is drawn.
   */
  setStaleZones(zones: readonly string[]): void;
  /**
   * Says the browser check failed before any stale-zone list arrived. The section then says so
   * instead of waiting; a later `setStaleZones` draws the answer as usual.
   */
  browserUnchecked(): void;
  /** Settles when the first check, the one that runs on load, has drawn. */
  ready: Promise<void>;
}

/**
 * Wires the stored-times section `storedSection` wrote. The controls are native, so Tab, Enter and
 * Space do the rest. The textarea starts with the example, and the check runs once now. The
 * Check button posts the lines; there is no `<form>`, so the mount listens for the click.
 */
export function wireStoredTimes(
  w: FoundWidget,
  config: StoredConfig,
  signal: AbortSignal,
  fetchFn: typeof fetch,
): StoredHandle {
  const lines = w.part<HTMLTextAreaElement>("stored-lines");
  const zone = w.part<HTMLSelectElement>("stored-zone");
  const zoneRow = w.part("stored-zone-row");
  const check = w.part<HTMLButtonElement>("stored-check");
  const example = w.part<HTMLButtonElement>("stored-example");
  const showAll = w.part<HTMLButtonElement>("stored-show-all");
  const showMoved = w.part<HTMLButtonElement>("stored-show-moved");
  const status = w.part("stored-status");
  const truncated = w.part("stored-truncated");
  const results = w.part("stored-results");
  const none = w.part("stored-none");
  const stale = w.part("stored-stale");
  const summary = w.part("stored-summary");
  const message = (text: string): void => {
    setHtml(results, html`<p>${text}</p>`);
  };
  let staleZones: ReadonlySet<string> | null = null;
  let last: StoredCheck | null = null;
  let audit: AuditModule | null = null;
  let browserFailed = false;
  let onlyMoved = false;
  let busy = false;

  /** Hides the rows that are not moved when the toggle says so: filtering, not counting. */
  function applyFilter(): void {
    const rows = results.querySelectorAll<HTMLElement>("tbody tr");
    let shown = 0;
    rows.forEach((row, i) => {
      const source = last?.rows[i];
      const moved =
        source !== undefined && rowMoved(source, staleZones ?? new Set());
      row.hidden = onlyMoved && !moved;
      if (!row.hidden) shown += 1;
    });
    none.hidden = rows.length === 0 || shown > 0;
  }

  function setShow(moved: boolean): void {
    onlyMoved = moved;
    showAll.setAttribute("aria-pressed", String(!moved));
    showMoved.setAttribute("aria-pressed", String(moved));
    applyFilter();
  }
  showAll.addEventListener("click", () => setShow(false), { signal });
  showMoved.addEventListener("click", () => setShow(true), { signal });

  /** Draws the last answer. Waits for the stale-zone list, so no line is ever judged on data known to be old. */
  function draw(): void {
    if (last === null || audit === null) return;
    if (staleZones === null) {
      if (!browserFailed) return;
      message(STORED_UNCHECKED_TEXT);
      truncated.textContent = "";
      summary.textContent = "Not judged yet.";
      return;
    }
    const result = last;
    if (result.rows.length === 0) {
      message(
        result.truncated
          ? "No line was read."
          : "Nothing to check. Paste a line, or press Reset example.",
      );
    } else {
      setHtml(
        results,
        storedTable({
          idPrefix: config.idPrefix,
          rows: result.rows,
          readings: audit.readingsOf,
          staleZones,
        }),
      );
      results
        .querySelectorAll<HTMLElement>("[data-disclosure]")
        .forEach((el) => wireDisclosure(el, { signal }));
    }
    truncated.textContent = result.truncated ? storedTruncatedText(result) : "";
    summary.textContent =
      result.rows.length === 0
        ? ""
        : storedSummaryText(result.rows, staleZones);
    applyFilter();
  }

  const handle: StoredHandle = {
    ready: Promise.resolve(),
    browserUnchecked() {
      if (staleZones !== null) return;
      browserFailed = true;
      draw();
    },
    setStaleZones(ids) {
      staleZones = new Set(ids);
      browserFailed = false;
      stale.hidden = ids.length === 0;
      stale.textContent =
        ids.length === 0
          ? ""
          : staleCheckText(ids.length === 1 ? ids[0]! : null, ids.map(cityOf));
      draw();
    },
  };

  // The zone picker is only needed when a line has no zone of its own.
  const syncZoneRow = (): void => {
    zoneRow.hidden = !needsZonePicker(lines.value);
  };
  lines.addEventListener("input", syncZoneRow, { signal });
  syncZoneRow();

  example.addEventListener(
    "click",
    () => {
      lines.value = config.preset;
      syncZoneRow();
      lines.focus();
      void run();
    },
    { signal },
  );
  check.addEventListener(
    "click",
    () => {
      if (busy) return;
      void run();
    },
    { signal },
  );

  // Each run takes a number; an answer that lands after a newer run started is dropped, so the
  // rows always match the text in the box and only the newest run clears `busy`.
  let runs = 0;

  async function run(): Promise<void> {
    const mine = ++runs;
    busy = true;
    check.setAttribute("aria-busy", "true");
    status.textContent = "Checking\u2026";
    const body = new FormData();
    body.set("lines", lines.value);
    body.set("zone", zone.value);
    const answer = await askStored(config.endpoint, fetchFn, body, signal);
    if (mine !== runs) return;
    let text = "";
    if (answer.kind === "ok") {
      try {
        audit = await loadAuditWords();
        if (signal.aborted || mine !== runs) return;
        last = answer.check;
        draw();
      } catch {
        text = "The results could not be drawn. Reload the page.";
      }
    } else if (answer.kind === "rate-limited") {
      text =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else if (answer.kind === "too-large") {
      text = `That is too much text to read. Keep it to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes.`;
    } else {
      text = "The check could not finish.";
    }
    // No answer has ever arrived: say so, rather than leave "Checking…" standing.
    if (answer.kind !== "ok" && last === null) {
      summary.textContent = "Not checked.";
      message("No answer yet. The line under Check says why.");
    }
    busy = false;
    check.removeAttribute("aria-busy");
    if (signal.aborted) return;
    status.textContent = text;
  }

  handle.ready = run();
  return handle;
}

/** Old markup: L15e removes these once the mounts use `storedSection` and `wireStoredTimes`. */
export { mountStoredTimes, storedSectionHtml } from "./clock-change-stored-old";
