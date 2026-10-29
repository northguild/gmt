/* oxlint-disable dox-src/no-hand-markup -- the old string markup, kept only until the mounts use `storedSection`. */
/**
 * Old markup: L15e removes this file once both mounts use `storedSection` and `wireStoredTimes`.
 * The saved-events section as an HTML string, and the mount that fills it through `data-role`s.
 */
import {
  MARK_BAD,
  NO_SIGNAL,
  cityOf,
  signedOffset,
} from "./clock-change-common";
import {
  STORED_MAX_LINES,
  needsZonePicker,
  staleCheckText,
  storedAdvice,
  storedBadge,
  storedFix,
  storedZoneOf,
} from "./clock-change-stored-lines";
import type { StoredCheck, StoredRow } from "./clock-change-stored-lines";
import { codeBreakClass, codeBreakHtml } from "./code-break";
import {
  STORED_BYTES_TEXT,
  STORED_UNCHECKED_TEXT,
  askStored,
  loadAuditWords,
  presetRows,
  storedSummaryText,
  storedTruncatedText,
} from "./clock-change-stored";
import type {
  AuditModule,
  SavedExample,
  StoredConfig,
  StoredHandle,
} from "./clock-change-stored";
import { escapeAttr, escapeHtml } from "./widget-ui";

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
    `<ol class="gmt-clockcheck-steps" data-gate="stored-steps" aria-label="An example">` +
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
    `<section class="gmt-widget-section gmt-clockcheck-stored" data-gate="stored" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Did your saved events move?</h4>` +
    `<p class="gmt-clockcheck-stored-lead">Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.</p>` +
    storedStepsHtml(config.example) +
    `<div class="gmt-clockcheck-stored-body">` +
    `<form class="gmt-clockcheck-stored-form" data-gate="stored-form" data-role="stored-form" novalidate>` +
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
    `<div class="gmt-clockcheck-stored-head" data-gate="stored-head">` +
    `<p class="gmt-clockcheck-stored-summary" data-role="stored-summary" role="status">Checking&hellip;</p>` +
    `<div class="gmt-clockcheck-seg" data-gate="stored-toggle" role="group" aria-label="Show">` +
    `<button type="button" class="gmt-clockcheck-seg-btn" data-role="stored-show-all" aria-pressed="true">All</button>` +
    `<button type="button" class="gmt-clockcheck-seg-btn" data-role="stored-show-moved" aria-pressed="false">Only moved</button>` +
    `</div>` +
    `<p class="gmt-clockcheck-alert" data-role="stored-stale" role="note" hidden></p>` +
    `</div>` +
    `<p class="gmt-clockcheck-status" data-role="stored-truncated"></p>` +
    `<div class="gmt-clockcheck-stored-results" data-role="stored-results" style="--stored-rows:${presetRows(config.preset)}">` +
    `<p class="gmt-widget-hint">Checking&hellip;</p></div>` +
    `</div>` +
    `</div>` +
    `</section>`
  );
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
    `<td class="gmt-clockcheck-stored-input"><code${codeBreakClass(row.input) ? ` class="${codeBreakClass(row.input)}"` : ""} title="${escapeAttr(row.input)}">${codeBreakHtml(row.input)}</code></td>` +
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
    `<table class="gmt-clockcheck-stored-table" data-gate="stored-table"><thead><tr>` +
    `<th scope="col">Status</th><th scope="col">Saved event</th><th scope="col">What to do</th></tr></thead>` +
    `<tbody>${rows.map((row) => storedRowHtml(row, audit, staleZones)).join("")}</tbody></table>` +
    `<p class="gmt-widget-hint" data-role="stored-none" hidden>No line is left with this filter.</p>`
  );
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
    if (status) status.textContent = "Checking\u2026";
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
