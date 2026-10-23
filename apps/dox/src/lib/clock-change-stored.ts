/**
 * The saved-events section of a dated tz-change checker: "Did your saved events move?". A worked
 * example, a form of plain controls, and the Worker's answer drawn as one table row per line.
 * Plain DOM. The form posts to the checker's endpoint; the lines' wording and verdicts are
 * `clock-change-stored-lines.ts`, which the Worker shares.
 */
import {
  MARK_BAD,
  NO_SIGNAL,
  cityOf,
  signedOffset,
} from "./clock-change-common";
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  needsZonePicker,
  staleCheckText,
  storedAdvice,
  storedBadge,
  storedFix,
  storedZoneOf,
} from "./clock-change-stored-lines";
import type { StoredCheck, StoredRow } from "./clock-change-stored-lines";
import { escapeAttr, escapeHtml } from "./widget-ui";

const STORED_UNCHECKED_TEXT =
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

const STORED_BYTES_TEXT = STORED_MAX_BYTES.toLocaleString("en-US");
/**
 * The saved-times section. A title, one plain line and three steps say what it is for; then the
 * form and the answers. The form is plain controls (nothing is rebuilt from `div`s); the answers
 * are one compact table row per line, under a summary bar that holds the count, the stale-data
 * alert and the All / Only moved toggle. The textarea starts with the example and the check runs
 * once on load.
 */
function storedStepsHtml(ex: SavedExample): string {
  const chip = (text: string) => `<code>${escapeHtml(text)}</code>`;
  const at = (offset: string) => `${ex.wallHm} ${signedOffset(offset)}`;
  return (
    `<ol class="gmt-clockcheck-steps" aria-label="An example">` +
    `<li class="gmt-clockcheck-step"><span class="gmt-clockcheck-step-head">Booked before the change</span>` +
    `<span>${escapeHtml(`${Number(ex.wallHm.slice(0, 2))}:${ex.wallHm.slice(3)}, ${ex.dateText}, ${ex.city}`)}, saved as ${chip(at(ex.savedOffset))}</span></li>` +
    `<li class="gmt-clockcheck-step gmt-clockcheck-step--rule"><span class="gmt-clockcheck-step-head">New rule</span>` +
    `<span>${escapeHtml(ex.city)} stays on ${chip(signedOffset(ex.newOffset))}</span></li>` +
    `<li class="gmt-clockcheck-step gmt-clockcheck-step--now"><span class="gmt-clockcheck-step-head">Result</span>` +
    `<span>The saved event shows as ${chip(ex.shownHm)}. ${MARK_BAD} Fix: store ${chip(at(ex.newOffset))}</span></li>` +
    `</ol>`
  );
}

export function storedSectionHtml(config: StoredConfig): string {
  const titleId = `${config.idPrefix}-stored-title`;
  return (
    `<section class="gmt-widget-section gmt-clockcheck-stored" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Did your saved events move?</h4>` +
    `<p class="gmt-clockcheck-stored-lead">Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.</p>` +
    storedStepsHtml(config.example) +
    `<div class="gmt-clockcheck-stored-body">` +
    `<form class="gmt-clockcheck-stored-form" data-role="stored-form" novalidate>` +
    `<label class="gmt-clockcheck-stored-label" for="${titleId}-lines">Saved events, one per line</label>` +
    `<textarea id="${titleId}-lines" class="gmt-input gmt-clockcheck-stored-lines" name="lines" data-role="stored-lines" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(config.preset)}</textarea>` +
    `<p class="gmt-clockcheck-stored-help">Paste values like <code>${escapeHtml(config.example.saved)}</code>. Up to ${STORED_MAX_LINES} lines.</p>` +
    `<details class="gmt-clockcheck-formats"><summary>Accepted formats</summary>` +
    `<p>Up to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes. Forms: <code>${escapeHtml(config.example.saved)}</code>, <code>&lt;time&gt; &lt;zone&gt;</code>, or <code>&lt;time&gt;</code> with the zone picked below.</p></details>` +
    `<label class="gmt-clockcheck-stored-zone" data-role="stored-zone-row" hidden><span>Lines without a zone use</span>` +
    `<select class="gmt-select" name="zone" data-role="stored-zone">` +
    config.zones
      .map(
        (zone) =>
          `<option value="${escapeAttr(zone)}">${escapeHtml(zone)}</option>`,
      )
      .join("") +
    `</select></label>` +
    `<div class="gmt-clockcheck-stored-controls">` +
    `<button class="gmt-button gmt-button--pad gmt-clockcheck-btn--primary" type="submit" data-role="stored-check">Check</button>` +
    `<button class="gmt-button gmt-button--pad gmt-clockcheck-btn--ghost" type="button" data-role="stored-example">Reset example</button>` +
    `</div>` +
    `<p class="gmt-clockcheck-status" data-role="stored-status" role="status"></p>` +
    `</form>` +
    `<div class="gmt-clockcheck-stored-out">` +
    `<div class="gmt-clockcheck-stored-head">` +
    `<p class="gmt-clockcheck-stored-summary" data-role="stored-summary" role="status">Checking&hellip;</p>` +
    `<div class="gmt-clockcheck-seg" role="group" aria-label="Show">` +
    `<button type="button" class="gmt-clockcheck-seg-btn" data-role="stored-show-all" aria-pressed="true">All</button>` +
    `<button type="button" class="gmt-clockcheck-seg-btn" data-role="stored-show-moved" aria-pressed="false">Only moved</button>` +
    `</div>` +
    `<p class="gmt-clockcheck-alert" data-role="stored-stale" role="note" hidden></p>` +
    `</div>` +
    `<p class="gmt-clockcheck-status" data-role="stored-truncated"></p>` +
    `<div class="gmt-clockcheck-stored-results" data-role="stored-results">` +
    `<p class="gmt-widget-hint">Checking&hellip;</p></div>` +
    `</div>` +
    `</div>` +
    `</section>`
  );
}

type AuditModule = typeof import("./stored-time-audit");

/** The readings are a pure helper; it loads on the first answer, not with the page. */
async function loadAuditWords(): Promise<AuditModule> {
  return import("./stored-time-audit");
}

function storedRowHtml(
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
      : `<span class="gmt-clockcheck-badge" data-tone="${badge.tone}">${badge.mark === "" ? "" : `<span aria-hidden="true">${badge.mark}</span> `}${escapeHtml(badge.label)}</span>`;
  let todo: string;
  if (stale) {
    todo = `<p class="gmt-clockcheck-alt">Try again after the update.</p>`;
  } else if (fix !== null) {
    todo =
      `<p class="gmt-clockcheck-fix"><span>Keep ${escapeHtml(fix.localHm)} local: store <code>${escapeHtml(fix.keepLocal)}</code></span> ` +
      `<button type="button" class="gmt-button gmt-clockcheck-copy" data-role="stored-copy" data-copy-text="${escapeAttr(fix.keepLocal)}" aria-label="Copy ${escapeAttr(fix.keepLocal)}">Copy</button></p>` +
      (fix.oldLocal === null
        ? ""
        : `<p class="gmt-clockcheck-alt">Or keep the old instant (that is ${escapeHtml(fix.oldLocal)} local).</p>`);
  } else {
    todo = `<p>${escapeHtml(advice.todo)}</p>`;
  }
  const readings =
    result === null
      ? ""
      : `<details class="gmt-clockcheck-readings"><summary>Readings</summary><dl>` +
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
    `<td class="gmt-clockcheck-stored-result">${pill}</td>` +
    `<td class="gmt-clockcheck-stored-input"><code title="${escapeAttr(row.input)}">${escapeHtml(row.input)}</code></td>` +
    `<td class="gmt-clockcheck-stored-says">${todo}${stale ? "" : readings}</td>` +
    `</tr>`
  );
}

function storedTableHtml(
  rows: readonly StoredRow[],
  audit: AuditModule,
  staleZones: ReadonlySet<string>,
): string {
  return (
    `<table class="gmt-clockcheck-stored-table"><thead><tr>` +
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

type StoredAnswer =
  | { kind: "ok"; check: StoredCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "too-large" }
  | { kind: "failed" };

async function askStored(
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
 * Wires the stored-times form. Only plain controls: Tab, Enter and Space do the rest. The
 * textarea starts with the example, and the check runs once now.
 */
export function mountStoredTimes(
  root: HTMLElement,
  config: StoredConfig,
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
      lines.value = config.preset;
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
    if (status) status.textContent = "";
    const body = new FormData();
    body.set("lines", lines!.value);
    body.set("zone", zone!.value);
    const answer = await askStored(config.endpoint, fetchFn, body, signal);
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
