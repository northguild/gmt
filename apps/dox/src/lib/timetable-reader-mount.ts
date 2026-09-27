/**
 * The Timetable Reader widget (TRAN-9), mountable on its tool page and in the
 * chat rail.
 *
 * A timetable prints wall times with no offset; `scheduleDelivery`'s
 * `startTimeZone` is what turns each printed departure into an exact instant.
 * Every row is its own single-leg call — the library decides whether a
 * printed time occurs once, twice (and which pass) or never, and this widget
 * draws that decision, never arithmetic of its own.
 *
 * Follows the Connection Checker's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
import {
  CUSTOM_PRESET_ID,
  MAX_ROWS,
  TIMETABLE_PRESETS,
  classify,
  leavesAt,
  matchPreset,
  optionsOf,
  permalinkOf,
  readArgs,
  rowBadge,
  rowLeg,
  rowResult,
  type TimetableReaderArgs,
  type TimetableRow,
  type TimetableState,
} from "./timetable-reader";
import { codeFrameHtml } from "./code-frame";
import { loadTransportLib } from "./transport-lib";
import {
  TRANSPORT_ZONES,
  formatSchedule,
  scheduleCallSource,
  zoneOptionsHtml,
  type TransportLib,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { TimetableReaderArgs } from "./timetable-reader";

function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    TIMETABLE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** Escapes `text`, then inserts `<wbr>` before a trailing written offset
 *  (`-05:00`) and before a trailing bracketed zone (`[America/New_York]`) —
 *  the only two natural break points in an ISO zoned string. Never breaks
 *  inside the date, the time or the zone name itself: `overflow-wrap:
 *  anywhere` did that, splitting `-05:00` into `-05:0` / `0` at a narrow
 *  width. */
function wbrBeforeOffsetAndBracket(text: string): string {
  const m = /^(.*?)([+-]\d{2}:\d{2})?(\[[^\]]*\])?$/.exec(text);
  if (!m) return escapeHtml(text);
  const [, base, offset, bracket] = m;
  let html = escapeHtml(base ?? "");
  if (offset) html += "<wbr>" + escapeHtml(offset);
  if (bracket) html += "<wbr>" + escapeHtml(bracket);
  return html;
}

/** A zoned instant string as a compact, readable cell: the local `HH:MM
 *  ±hh:mm` at normal size, with the full value underneath in smaller, muted
 *  text — never dropped, so the exact value stays visible without wrapping
 *  the table into long ISO prose. */
function timeCell(iso: string): string {
  const m = /T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)/.exec(iso);
  const short = m ? `${m[1]}${m[2] === "Z" ? " Z" : ` ${m[2]}`}` : iso;
  return (
    `<span class="gmt-timetable-time">${escapeHtml(short)}</span>` +
    `<span class="gmt-timetable-time-full">${wbrBeforeOffsetAndBracket(iso)}</span>`
  );
}

function rowGroup(i: number, row: TimetableRow): string {
  const n = i + 1;
  return (
    `<fieldset class="gmt-transport-leg" data-role="row-${n}">` +
    `<legend>Row ${n}</legend>` +
    `<div class="gmt-widget-controls gmt-timetable-fields">` +
    `<label class="gmt-label"><span>Printed departure</span>` +
    `<input class="gmt-input" data-role="departure-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(row.departure)}"></label>` +
    `<label class="gmt-label"><span>Offset</span>` +
    `<input class="gmt-input" data-role="offset-${n}" type="text" spellcheck="false" autocomplete="off" placeholder="optional" value="${escapeAttr(row.offset)}"></label>` +
    `</div>` +
    `</fieldset>`
  );
}

export function renderTimetableReaderTemplate(
  args: TimetableReaderArgs = {},
): string {
  const seeded = args.departures !== undefined || args.departure1 !== undefined;
  const state: TimetableState = seeded
    ? readArgs(args)
    : {
        startTimeZone: TIMETABLE_PRESETS[0]!.startTimeZone,
        duration: TIMETABLE_PRESETS[0]!.duration,
        timeZone: TIMETABLE_PRESETS[0]!.timeZone,
        rows: [
          TIMETABLE_PRESETS[0]!.rows[0] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[1] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[2] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[3] ?? { departure: "", offset: "" },
        ],
      };
  const presetId = matchPreset(state);
  const preset = TIMETABLE_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-timetable gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The timetable</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls gmt-timetable-fields">` +
    `<label class="gmt-label"><span>Printed in</span>` +
    `<select class="gmt-select" data-role="start-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.startTimeZone)}</select></label>` +
    `<label class="gmt-label"><span>Run time</span>` +
    `<input class="gmt-input" data-role="duration" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.duration)}"></label>` +
    `<label class="gmt-label"><span>Arrives in</span>` +
    `<select class="gmt-select" data-role="zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `</div>` +
    state.rows.map((row, i) => rowGroup(i, row)).join("") +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. What each printed time means</h4>` +
    `<table class="gmt-timetable-rows" data-role="rows" role="table">` +
    `<thead role="rowgroup"><tr role="row"><th role="columnheader">Printed</th><th role="columnheader">Leaves (exact)</th><th role="columnheader">Badge</th><th role="columnheader">Local arrival</th></tr></thead>` +
    `<tbody data-role="rows-body" role="rowgroup"></tbody>` +
    `</table>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `<p class="gmt-widget-hint">For the general rule behind a repeated or skipped hour, see the <a href="/tools/dst-inspector/">DST Inspector</a>.</p>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>scheduleDelivery</code> returns</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Show the call for</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="row-pick"></select></label>` +
    `</div>` +
    codeFrameHtml("timetable") +
    `<output class="gmt-widget-output" data-role="timetable-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: TransportLib): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const startZoneEl = q<HTMLSelectElement>("start-zone");
  const durationEl = q<HTMLInputElement>("duration");
  const zoneEl = q<HTMLSelectElement>("zone");
  const rowPickEl = q<HTMLSelectElement>("row-pick");
  const rowInputs = [1, 2, 3, 4].map((n) => ({
    departure: q<HTMLInputElement>(`departure-${n}`),
    offset: q<HTMLInputElement>(`offset-${n}`),
  }));
  if (
    !presetEl ||
    !startZoneEl ||
    !durationEl ||
    !zoneEl ||
    !rowPickEl ||
    rowInputs.some((r) => !r.departure || !r.offset)
  ) {
    return;
  }

  function state(): TimetableState {
    return {
      startTimeZone: startZoneEl!.value.trim(),
      duration: durationEl!.value.trim(),
      timeZone: zoneEl!.value.trim(),
      rows: rowInputs.map((r) => ({
        departure: r.departure!.value.trim(),
        offset: r.offset!.value.trim(),
      })) as TimetableState["rows"],
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        TIMETABLE_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function render(): void {
    const s = state();
    const body = q("rows-body");
    if (body) {
      const rowsHtml: string[] = [];
      for (let i = 0; i < MAX_ROWS; i++) {
        const row = s.rows[i]!;
        if (row.departure === "") continue;
        const kind = classify(row.departure, s.startTimeZone, lib);
        const badge = rowBadge(kind, row.offset !== "");
        const leaves = leavesAt(s, i, lib);
        const { result } = rowResult(s, i, lib);
        const local = result?.legTimes[0]?.localArrival ?? null;
        rowsHtml.push(
          `<tr data-role="row-${i + 1}-display" role="row">` +
            `<td data-label="Printed" role="cell">${wbrBeforeOffsetAndBracket(row.departure + row.offset)}</td>` +
            `<td data-label="Leaves (exact)" role="cell">${leaves ? timeCell(leaves) : "—"}</td>` +
            `<td data-label="Badge" role="cell">${badge ? `<span class="gmt-transport-badge" data-role="badge-${i + 1}">${escapeHtml(badge)}</span>` : ""}</td>` +
            `<td data-label="Local arrival" role="cell">${local ? timeCell(local) : "—"}</td>` +
            `</tr>`,
        );
      }
      body.innerHTML = rowsHtml.join("");
    }

    const nonBlankRows: number[] = [];
    for (let i = 0; i < MAX_ROWS; i++)
      if (s.rows[i]!.departure !== "") nonBlankRows.push(i);
    const currentPick = rowPickEl!.value;
    rowPickEl!.innerHTML = nonBlankRows
      .map(
        (i) =>
          `<option value="${i}">Row ${i + 1}${s.rows[i]!.departure ? ` (${escapeHtml(s.rows[i]!.departure)})` : ""}</option>`,
      )
      .join("");
    const pickedIndex = nonBlankRows.includes(Number.parseInt(currentPick, 10))
      ? Number.parseInt(currentPick, 10)
      : (nonBlankRows[0] ?? 0);
    rowPickEl!.value = String(pickedIndex);

    const leg = rowLeg(s, pickedIndex);
    const options = optionsOf(s);
    const [callHtml, callPlain] = scheduleCallSource(leg ? [leg] : [], options);
    renderCallLine(
      q("call-timetable"),
      "scheduleDelivery",
      callHtml,
      callPlain,
    );

    const out = q("timetable-output");
    const { result, reason } = rowResult(s, pickedIndex, lib);
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatSchedule(result), "live");
    }

    const aside = q("reason-aside");
    if (aside) {
      if (reason) {
        renderAside(
          aside,
          "caution",
          "Why null",
          `<p>${escapeHtml(reason)}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    startZoneEl!.value = preset.startTimeZone;
    durationEl!.value = preset.duration;
    zoneEl!.value = preset.timeZone;
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = preset.rows[i] ?? { departure: "", offset: "" };
      rowInputs[i]!.departure!.value = row.departure;
      rowInputs[i]!.offset!.value = row.offset;
    }
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      target === durationEl ||
      rowInputs.some((r) => r.departure === target || r.offset === target)
    ) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === rowPickEl) {
      render();
      return;
    }
    if (target === startZoneEl || target === zoneEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  render();
}

function applyArgs(root: HTMLElement, args: TimetableReaderArgs): void {
  if (args.departures === undefined && args.departure1 === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("start-zone", s.startTimeZone);
  set("duration", s.duration);
  set("zone", s.timeZone);
  for (let i = 0; i < MAX_ROWS; i++) {
    set(`departure-${i + 1}`, s.rows[i]!.departure);
    set(`offset-${i + 1}`, s.rows[i]!.offset);
  }
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        TIMETABLE_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

export const mountTimetableReader: MountFn<TimetableReaderArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: TransportLib;
  try {
    lib = await loadTransportLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  setupWidget(root, lib);

  return onceDestroy(
    () => {},
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const startZoneEl = q<HTMLSelectElement>("start-zone");
      if (!startZoneEl) return null;
      const state: TimetableState = {
        startTimeZone: startZoneEl.value,
        duration: q<HTMLInputElement>("duration")?.value ?? "",
        timeZone: q<HTMLSelectElement>("zone")?.value ?? "",
        rows: [1, 2, 3, 4].map((n) => ({
          departure: q<HTMLInputElement>(`departure-${n}`)?.value ?? "",
          offset: q<HTMLInputElement>(`offset-${n}`)?.value ?? "",
        })) as TimetableState["rows"],
      };
      return permalinkOf(state);
    },
  );
};
