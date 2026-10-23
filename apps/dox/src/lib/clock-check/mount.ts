/**
 * The page-side wiring every clock-change checker shares: the browser column, the transitions, the
 * live clocks, the saved-times form and the fetch of the Worker's answer. A checker's own mount
 * composes these with whatever else its page has (a map, say). The markup they act on is
 * built by `template.ts`; every selector here is a `data-role` or a `gmt-check-*` class under
 * the root passed in.
 */
import { bindClockGlow, updateCrystalClock } from "../crystal-clock";
import { spokenOffset } from "../crossing-clock";
import { GMT_MODULES } from "../gmt-modules";
import { withBase } from "../site";
import { WidgetLoadError } from "../widget-mount";
import { escapeAttr, escapeHtml, wireCopyButtons } from "../widget-ui";
import {
  STORED_MAX_LINES,
  cityOf,
  offsetFromIntl,
  probeEpochMs,
  signedOffset,
  wallHms,
  type ClockCheckFacts,
  type StoredCheck,
  type StoredRow,
  type TransitionRow,
  type ZoneNow,
} from "./facts";
import {
  MARK_BAD,
  MARK_OK,
  NO_SIGNAL,
  SIGNAL_LOST,
  STORED_BYTES_TEXT,
  UNREADABLE_HTML,
  verdictHtml,
  type CheckPage,
} from "./template";
import {
  needsZonePicker,
  staleCheckText,
  storedAdvice,
  storedBadge,
  storedFix,
  storedZoneOf,
} from "./stored-times";

const STORED_UNCHECKED_TEXT =
  "This browser’s time zone data could not be checked, so no line can be judged yet. Press Check again under Your browser.";

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

export interface CheckLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  getUtcNow(): string;
  isBeforeUtc(value1: string, value2: string): boolean;
}

function pick<T>(module: Record<string, unknown>, name: string): T {
  if (typeof module[name] !== "function") {
    throw new Error(`The library module has no ${name}.`);
  }
  return module[name] as T;
}

export async function loadCheckLib(): Promise<CheckLib> {
  try {
    const [convert, get, compare] = await Promise.all([
      GMT_MODULES["utc/convert"]!(),
      GMT_MODULES["utc/get"]!(),
      GMT_MODULES["utc/compare"]!(),
    ]);
    return {
      convertUtcToPlainDateTime: pick(convert, "convertUtcToPlainDateTime"),
      getUtcNow: pick(get, "getUtcNow"),
      isBeforeUtc: pick(compare, "isBeforeUtc"),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

// ---------------------------------------------------------------------------
// The browser column
// ---------------------------------------------------------------------------

export type BrowserReading =
  | { kind: "offset"; offset: string }
  | { kind: "unknown-zone" }
  | { kind: "unsupported" };

/**
 * The offset this browser's own time zone data gives `zone` at `facts.probeInstant`. A `RangeError`
 * for the zone is "unknown to this browser"; an engine that cannot format `longOffset` at all is
 * `unsupported`, a different answer.
 */
export function readBrowserOffset(
  facts: Pick<ClockCheckFacts, "probeInstant">,
  zone: string,
): BrowserReading {
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: "UTC",
      timeZoneName: "longOffset",
    });
  } catch {
    return { kind: "unsupported" };
  }
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(probeEpochMs(facts));
    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const offset = offsetFromIntl(name);
    return offset === "" ? { kind: "unsupported" } : { kind: "offset", offset };
  } catch (error) {
    if (error instanceof RangeError) return { kind: "unknown-zone" };
    throw error;
  }
}

/**
 * Fills the "Your browser" card from the browser's own readings. On the page the inline script has
 * already done it (`data-sig` holds its readings), and the same readings are not drawn again.
 * Returns the number of cells the browser could not read.
 */
export function fillBrowserColumn(page: CheckPage, root: HTMLElement): number {
  const browserOffsets = new Map<string, BrowserReading>();
  const wrong: string[] = [];
  let unread = 0;
  const sig: string[] = [];
  for (const fact of page.table) {
    const reading = readBrowserOffset(page.facts, fact.zone);
    browserOffsets.set(fact.zone, reading);
    if (reading.kind === "offset") {
      if (reading.offset !== fact.offset) wrong.push(cityOf(fact.zone));
    } else {
      unread += 1;
    }
    sig.push(reading.kind === "offset" ? reading.offset : "?");
  }
  const verdict = root.querySelector<HTMLElement>('[data-role="verdict"]');
  if (verdict && verdict.dataset.sig !== sig.join(",")) {
    for (const fact of page.table) {
      const reading = browserOffsets.get(fact.zone)!;
      const cell = (
        root.querySelector<HTMLElement>(`tr[data-zone="${fact.zone}"]`) ?? root
      ).querySelector<HTMLElement>('[data-role="browser"]');
      if (!cell) continue;
      cell.innerHTML =
        reading.kind === "offset"
          ? `${reading.offset === fact.offset ? MARK_OK : MARK_BAD} ${escapeHtml(signedOffset(reading.offset))}`
          : NO_SIGNAL;
    }
    verdict.innerHTML = unread > 0 ? UNREADABLE_HTML : verdictHtml(page, wrong);
    verdict.dataset.state =
      unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
    verdict.dataset.sig = sig.join(",");
  }
  return unread;
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

export type Answer<A> =
  | { kind: "ok"; check: A }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "failed" };

function retryAfter(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** The checker's endpoint under the site base. The literal sits inside the `withBase` call so the bundle scan sees it guarded. */
function apiUrl(facts: Pick<ClockCheckFacts, "id">): string {
  return withBase(`/api/${facts.id}-clock-change`);
}

/** GETs the checker's answer from the Worker. */
export async function ask<A>(
  facts: Pick<ClockCheckFacts, "id">,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<Answer<A>> {
  try {
    const response = await fetchFn(apiUrl(facts), { signal });
    if (response.status === 429) {
      return { kind: "rate-limited", seconds: retryAfter(response) };
    }
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as A };
  } catch {
    return { kind: "failed" };
  }
}

/** The status line's words for an answer that is not `ok`. */
export function failureText(
  answer: { kind: "rate-limited"; seconds: number | null } | { kind: "failed" },
): string {
  if (answer.kind === "failed") return "The check could not finish.";
  return answer.seconds === null
    ? "Too many checks. Try again shortly."
    : `Try again in ${answer.seconds} s`;
}

type StoredAnswer =
  | { kind: "ok"; check: StoredCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "too-large" }
  | { kind: "failed" };

export async function askStored(
  facts: Pick<ClockCheckFacts, "id">,
  fetchFn: typeof fetch,
  form: FormData,
  signal: AbortSignal,
): Promise<StoredAnswer> {
  try {
    const response = await fetchFn(apiUrl(facts), {
      method: "POST",
      body: form,
      signal,
    });
    if (response.status === 429) {
      return { kind: "rate-limited", seconds: retryAfter(response) };
    }
    if (response.status === 413) return { kind: "too-large" };
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as StoredCheck };
  } catch {
    return { kind: "failed" };
  }
}

/** Milliseconds from `now` to the next minute boundary, read from its seconds field. */
export function msToNextMinute(now: string): number {
  const match = /:(\d{2})(?:\.(\d+))?Z$/.exec(now);
  if (match === null) return 60_000;
  const seconds = Number(match[1]);
  const millis = match[2] === undefined ? 0 : Number(`0.${match[2]}`) * 1000;
  return Math.max(50, Math.ceil(60_000 - (seconds * 1000 + millis)));
}

/** Milliseconds from `now` to the next whole second, read from its fraction. */
export function msToNextSecond(now: string): number {
  const match = /:\d{2}\.(\d+)Z$/.exec(now);
  const millis = match === null ? 0 : Number(`0.${match[1]}`) * 1000;
  return Math.max(50, Math.ceil(1000 - millis));
}

// ---------------------------------------------------------------------------
// The transitions and the clocks
// ---------------------------------------------------------------------------

function wallText(wallBefore: string): string {
  return wallBefore.replace("T", " ").slice(0, 16);
}

function changeRowHtml(row: TransitionRow): string {
  if (row.wallBefore === "") return `<li>${NO_SIGNAL}</li>`;
  return (
    `<li class="gmt-check-change">` +
    `<span class="gmt-check-when">${escapeHtml(wallText(row.wallBefore))}</span>` +
    `<span class="gmt-check-shift">${escapeHtml(row.offsetBefore)} → ${escapeHtml(row.offsetAfter)}</span>` +
    `<span class="gmt-check-utc">${escapeHtml(row.instant)}</span></li>`
  );
}

/** Draws the answer's transitions into the table the template made. */
export function drawTransitions(
  page: CheckPage,
  root: HTMLElement,
  rows: readonly TransitionRow[],
): void {
  for (const zone of page.transitionZones) {
    const list = root.querySelector<HTMLElement>(
      `.gmt-check-group[data-zone="${zone}"] [data-role="changes"]`,
    );
    if (!list) continue;
    list.innerHTML = page.facts.transitionYears
      .map((year) => {
        const found = rows.filter(
          (row) => row.zone === zone && row.year === year,
        );
        return found.length === 0
          ? `<li class="gmt-check-none">No clock change in ${year}</li>`
          : found.map(changeRowHtml).join("");
      })
      .join("");
  }
}

export interface ClocksHandle {
  /** Gives the clocks the answer's zones and starts them. */
  start(zones: readonly ZoneNow[]): void;
}

/**
 * The live clocks. The wall time of each is the library reading the client's now at the Worker's
 * offset (or, past the zone's next change, the offset after it); no named zone reaches the
 * browser's tz data.
 */
export function mountClocks(
  facts: Pick<ClockCheckFacts, "id">,
  root: HTMLElement,
  signal: AbortSignal,
  lib: CheckLib,
  now: () => string,
): ClocksHandle {
  let zones: readonly ZoneNow[] | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function offsetAt(zone: ZoneNow, at: string): string {
    const next = zone.next;
    if (next !== null && !lib.isBeforeUtc(at, next.instant)) {
      return next.offsetAfter;
    }
    return zone.offset;
  }

  function drawClock(
    item: HTMLElement,
    zone: ZoneNow | undefined,
    at: string,
  ): void {
    const host = item.querySelector<HTMLElement>('[data-role="clock"]')!;
    const readout = item.querySelector<HTMLElement>(
      '[data-role="clock-time"]',
    )!;
    const id = item.dataset.zone ?? "";
    const offset = zone ? offsetAt(zone, at) : "";
    const wall =
      offset === ""
        ? ""
        : lib.convertUtcToPlainDateTime(at, { timeZone: offset });
    if (wall === "") {
      readout.innerHTML = NO_SIGNAL;
      readout.title = SIGNAL_LOST;
      return;
    }
    readout.removeAttribute("title");
    const hour = Number(wall.slice(11, 13));
    const minute = Number(wall.slice(14, 16));
    // Two spans for the readout's two voices: "HH:MM:SS" and the offset. The readout is plain text
    // (no live region), so the second ticking never reaches a screen reader.
    readout.innerHTML = `<span class="gmt-check-clock-hm">${escapeHtml(wallHms(wall))}</span> <span class="gmt-check-clock-off">${escapeHtml(offset)}</span>`;
    updateCrystalClock(host, {
      id: `${facts.id}-${id.replace(/[^A-Za-z0-9]/g, "-")}`,
      hour,
      minute,
      second: Number(wallHms(wall).slice(6, 8)),
      label: id,
      sublabel: `${wall.slice(11, 16)}, ${spokenOffset(offset)}`,
    });
  }

  function tick(): void {
    clearTimeout(timer);
    if (signal.aborted || zones === null) return;
    const at = now();
    root.querySelectorAll<HTMLElement>(".gmt-check-clock").forEach((item) => {
      drawClock(
        item,
        zones!.find((z) => z.zone === item.dataset.zone),
        at,
      );
    });
    timer = setTimeout(tick, msToNextSecond(at));
  }

  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  bindClockGlow(root, signal);
  return {
    start(next) {
      zones = next;
      tick();
    },
  };
}

/** Makes the copy button announce "Copied" in the card's live line. */
export function wireCopyAnnounce(root: HTMLElement, signal: AbortSignal): void {
  wireCopyButtons(root);
  const copyStatus = root.querySelector<HTMLElement>(
    '[data-role="copy-status"]',
  );
  root
    .querySelector<HTMLElement>('[data-role="copy-node-probe"]')
    ?.addEventListener(
      "click",
      () => {
        if (copyStatus) copyStatus.textContent = "Copied";
      },
      { signal },
    );
}

// ---------------------------------------------------------------------------
// Which saved events moved?
// ---------------------------------------------------------------------------

type AuditModule = typeof import("../stored-time-audit");

/** The readings are a pure helper; it loads on the first answer, not with the page. */
async function loadAuditWords(): Promise<AuditModule> {
  return import("../stored-time-audit");
}

export function storedRowHtml(
  row: StoredRow,
  audit: AuditModule,
  staleZones: ReadonlySet<string>,
): string {
  const result = row.result;
  const zone = storedZoneOf(row.value);
  const stale = result !== null && zone !== null && staleZones.has(zone);
  const badge = storedBadge(result, stale);
  const advice = storedAdvice(row.value, result);
  const fix = stale ? null : storedFix(row.value, result);
  const pill =
    result === null
      ? NO_SIGNAL
      : `<span class="gmt-check-badge" data-tone="${badge.tone}">${badge.mark === "" ? "" : `<span aria-hidden="true">${badge.mark}</span> `}${escapeHtml(badge.label)}</span>`;
  let todo: string;
  if (stale) {
    todo = `<p class="gmt-check-alt">Try again after the update.</p>`;
  } else if (fix !== null) {
    todo =
      `<p class="gmt-check-fix"><span>Keep ${escapeHtml(fix.localHm)} local: store <code>${escapeHtml(fix.keepLocal)}</code></span> ` +
      `<button type="button" class="gmt-button gmt-check-copy" data-role="stored-copy" data-copy-text="${escapeAttr(fix.keepLocal)}" aria-label="Copy ${escapeAttr(fix.keepLocal)}">Copy</button></p>` +
      (fix.oldLocal === null
        ? ""
        : `<p class="gmt-check-alt">Or keep the old instant (that is ${escapeHtml(fix.oldLocal)} local).</p>`);
  } else {
    todo = `<p>${escapeHtml(advice.todo)}</p>`;
  }
  const readings =
    result === null
      ? ""
      : `<details class="gmt-check-readings"><summary>Readings</summary><dl>` +
        audit
          .readingsOf(result)
          .map(
            ({ name, value }) =>
              `<div><dt><code>${escapeHtml(name)}</code></dt><dd>${escapeHtml(value)}</dd></div>`,
          )
          .join("") +
        `</dl></details>`;
  const ok = result !== null && !stale && advice.ok;
  const state = result === null || stale ? "unknown" : String(ok);
  return (
    `<tr data-kind="${result?.kind ?? "none"}" data-ok="${state}">` +
    `<td class="gmt-check-stored-result">${pill}</td>` +
    `<td class="gmt-check-stored-input"><code title="${escapeAttr(row.input)}">${escapeHtml(row.input)}</code></td>` +
    `<td class="gmt-check-stored-says">${todo}${stale ? "" : readings}</td>` +
    `</tr>`
  );
}

export function storedTableHtml(
  rows: readonly StoredRow[],
  audit: AuditModule,
  staleZones: ReadonlySet<string>,
): string {
  return (
    `<table class="gmt-check-stored-table"><thead><tr>` +
    `<th scope="col">Status</th><th scope="col">Saved event</th><th scope="col">What to do</th></tr></thead>` +
    `<tbody>${rows.map((row) => storedRowHtml(row, audit, staleZones)).join("")}</tbody></table>` +
    `<p class="gmt-widget-hint" data-role="stored-none" hidden>No line is left with this filter.</p>`
  );
}

/** The message under the filter when the Worker cut the input. */
export function storedTruncatedText(check: StoredCheck): string {
  const last = check.rows.at(-1);
  const base = `The input was over ${STORED_MAX_LINES} lines or ${STORED_BYTES_TEXT} bytes;`;
  return last === undefined
    ? `${base} no line was read.`
    : `${base} lines after line ${last.line} were not read.`;
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
 * Wires the stored-times form. Only plain controls: Tab, Enter and Space do the rest. The
 * textarea starts with the page's example, and the check runs once now.
 */
export function mountStoredTimes(
  page: Pick<CheckPage, "facts" | "storedPreset">,
  root: HTMLElement,
  signal: AbortSignal,
  fetchFn: typeof fetch,
): StoredHandle {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector<T>(`[data-role="${role}"]`);
  const form = q<HTMLFormElement>("stored-form");
  const lines = q<HTMLTextAreaElement>("stored-lines");
  const zone = q<HTMLSelectElement>("stored-zone");
  const zoneRow = q<HTMLElement>("stored-zone-row");
  const check = q<HTMLButtonElement>("stored-check");
  const example = q<HTMLButtonElement>("stored-example");
  const showAll = q<HTMLButtonElement>("stored-show-all");
  const showMoved = q<HTMLButtonElement>("stored-show-moved");
  const status = q<HTMLElement>("stored-status");
  const truncated = q<HTMLElement>("stored-truncated");
  const results = q<HTMLElement>("stored-results");
  const stale = q<HTMLElement>("stored-stale");
  const summary = q<HTMLElement>("stored-summary");
  let staleZones: ReadonlySet<string> | null = null;
  let last: StoredCheck | null = null;
  let audit: AuditModule | null = null;
  let browserFailed = false;
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
      if (stale) {
        stale.hidden = ids.length === 0;
        stale.textContent =
          ids.length === 0
            ? ""
            : staleCheckText(
                ids.length === 1 ? ids[0]! : null,
                ids.map(cityOf),
              );
      }
      draw();
    },
  };
  if (!form || !lines || !zone || !results) return handle;

  let busy = false;
  let onlyMoved = false;

  /** Hides the rows that are not moved when the toggle says so: filtering, not counting. */
  function applyFilter(): void {
    const rows = results!.querySelectorAll<HTMLElement>("tbody tr");
    let shown = 0;
    rows.forEach((row) => {
      const hide = onlyMoved && row.dataset.ok !== "false";
      row.hidden = hide;
      if (!hide) shown += 1;
    });
    const none = results!.querySelector<HTMLElement>(
      '[data-role="stored-none"]',
    );
    if (none) none.hidden = rows.length === 0 || shown > 0;
  }

  function setShow(moved: boolean): void {
    onlyMoved = moved;
    showAll?.setAttribute("aria-pressed", String(!moved));
    showMoved?.setAttribute("aria-pressed", String(moved));
    applyFilter();
  }
  showAll?.addEventListener("click", () => setShow(false), { signal });
  showMoved?.addEventListener("click", () => setShow(true), { signal });

  /** Draws the last answer. Waits for the stale-zone list, so no line is ever judged on data known to be old. */
  function draw(): void {
    if (last === null || audit === null) return;
    if (staleZones === null) {
      if (!browserFailed) return;
      results!.innerHTML = `<p class="gmt-widget-hint">${STORED_UNCHECKED_TEXT}</p>`;
      if (truncated) truncated.textContent = "";
      if (summary) summary.textContent = "Not judged yet.";
      return;
    }
    const result = last;
    results!.innerHTML =
      result.rows.length === 0
        ? `<p class="gmt-widget-hint">${result.truncated ? "No line was read." : "Nothing to check. Paste a line, or press Reset example."}</p>`
        : storedTableHtml(result.rows, audit, staleZones);
    if (truncated) {
      truncated.textContent = result.truncated
        ? storedTruncatedText(result)
        : "";
    }
    if (summary) {
      summary.textContent =
        result.rows.length === 0
          ? ""
          : storedSummaryText(result.rows, staleZones);
    }
    applyFilter();
  }

  // The Copy buttons in the rows: one handler for however many the answer draws.
  results.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        '[data-role="stored-copy"]',
      );
      const text = button?.dataset.copyText;
      if (!button || !text || !navigator.clipboard) return;
      void navigator.clipboard.writeText(text).then(
        () => {
          button.textContent = "Copied";
          if (status) status.textContent = "Copied";
          setTimeout(() => {
            button.textContent = "Copy";
          }, 1500);
        },
        () => {},
      );
    },
    { signal },
  );

  // The zone picker is only needed when a line has no zone of its own.
  const syncZoneRow = (): void => {
    if (zoneRow) zoneRow.hidden = !needsZonePicker(lines.value);
  };
  lines.addEventListener("input", syncZoneRow, { signal });
  syncZoneRow();

  example?.addEventListener(
    "click",
    () => {
      lines.value = page.storedPreset;
      syncZoneRow();
      lines.focus();
      void run();
    },
    { signal },
  );

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
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
    check?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking…";
    const body = new FormData();
    body.set("lines", lines!.value);
    body.set("zone", zone!.value);
    const answer = await askStored(page.facts, fetchFn, body, signal);
    if (mine !== runs) return;
    let message = "";
    if (answer.kind === "ok") {
      try {
        audit = await loadAuditWords();
        if (signal.aborted || mine !== runs) return;
        last = answer.check;
        draw();
      } catch {
        message = "The results could not be drawn. Reload the page.";
      }
    } else if (answer.kind === "rate-limited") {
      message =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else if (answer.kind === "too-large") {
      message = `That is too much text to read. Keep it to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes.`;
    } else {
      message = "The check could not finish.";
    }
    busy = false;
    check?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (status) status.textContent = message;
  }

  handle.ready = run();
  return handle;
}
