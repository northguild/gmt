/**
 * The Dwell Ledger widget (TRAN-8), mountable on its tool page and in the chat
 * rail.
 *
 * A dwell drawn on a zone's real local-day grid. The reader drags an entry and
 * an exit (or types them) and watches two numbers disagree: the elapsed bar,
 * which is hours, and the lit day columns, which are the local calendar days the
 * half-open dwell touched. Both sit in the ledger family's frame
 * (`gmt-ledger-widgets.css`) under two result plates. The printed result is always the real `dwellTime`
 * call's; the shading is a picture of it, and `dwell-ledger.test.ts` asserts
 * the two agree for every preset.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`: the markup
 * is a pure string so the page can server-render it and the rail can
 * string-mount it. Every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from a live pointer capture.
 */
import { codeFrameHtml } from "./code-frame";
import {
  CUSTOM_PRESET_ID,
  DWELL_PRESETS,
  LEDGER_ZONES,
  NO_ZONE,
  NULL_REASON_TEXT,
  axisLabels,
  createLedgerCanvas,
  dayCells,
  dayCountText,
  dwellMarks,
  dwellPlates,
  explainNull,
  fitLedgerCanvas,
  formatDayLabel,
  formatDwell,
  formatHandleValue,
  formatLocal,
  gridZone,
  matchPreset,
  resolveWallTime,
  toEpochMs,
  type DayCell,
  type DwellLedgerArgs,
  type DwellResult,
  type LedgerCanvas,
} from "./dwell-ledger";
import { GMT_MODULES } from "./gmt-modules";
import {
  descriptionHoldHtml,
  dayColumnFit,
  dayColumnsHtml,
  hourDurationText,
  PAGE_STEP_UNITS,
  plateHtml,
  platesHtml,
} from "./ledger-widgets";
import { fitDayColumns, onWidthChange, thinTickLabels } from "./label-fit";
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  codeSpan,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { DwellLedgerArgs } from "./dwell-ledger";

/** Arrow keys move one snap step; with Shift, four (an hour on a short canvas).
 *  PageUp and PageDown move `PAGE_STEP_UNITS`. */
const STEP_UNITS = 1;
const BIG_STEP_UNITS = 4;

function zoneOptions(
  zones: readonly string[],
  selected: string,
  noneLabel: string,
): string {
  const list =
    selected === NO_ZONE || zones.includes(selected)
      ? zones
      : [...zones, selected];
  return (
    `<option value=""${selected === NO_ZONE ? " selected" : ""}>${escapeHtml(noneLabel)}</option>` +
    list
      .map(
        (z) =>
          `<option value="${escapeAttr(z)}"${z === selected ? " selected" : ""}>${escapeHtml(z)}</option>`,
      )
      .join("")
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them.
 * With no args it shows the first preset. Day cells, the bar and the outputs are
 * drawn by `mount`, because they come from Temporal and the real library.
 */
export function renderDwellLedgerTemplate(args: DwellLedgerArgs = {}): string {
  const seeded = args.entry !== undefined || args.exit !== undefined;
  const base = DWELL_PRESETS[0]!;
  const entry = seeded ? (args.entry ?? "") : base.entry;
  const exit = seeded ? (args.exit ?? "") : base.exit;
  const zone = seeded ? (args.zone ?? NO_ZONE) : base.zone;
  const compareZone = seeded
    ? (args.compareZone ?? NO_ZONE)
    : (base.compareZone ?? NO_ZONE);
  const presetId = matchPreset(entry, exit, zone, compareZone);
  const preset = DWELL_PRESETS.find((p) => p.id === presetId);

  const presetOptions =
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    DWELL_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("");

  const handle = (role: string, label: string) =>
    `<div class="gmt-handle" data-role="${role}" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="${label}"></div>`;

  const row = (id: "dwell" | "compare", withHandles: boolean) =>
    `<div class="gmt-ledger-lane gmt-dwell-row" data-role="row-${id}" data-series="${id === "dwell" ? 1 : 2}"${id === "compare" && compareZone === NO_ZONE ? " hidden" : ""}>` +
    `<span class="gmt-ledger-lane-label gmt-dwell-row-label" data-role="label-${id}"></span>` +
    `<div class="gmt-ledger-lane-track gmt-dwell-track" data-role="track-${id}">` +
    `<div class="gmt-ledger-days gmt-dwell-cells" data-role="cells-${id}" role="list"></div>` +
    `<div class="gmt-ledger-bar gmt-dwell-bar" data-role="${id === "dwell" ? "bar" : "bar-compare"}">` +
    (withHandles
      ? handle("handle-entry", "Entry") + handle("handle-exit", "Exit")
      : "") +
    `</div></div></div>`;

  return (
    `<div class="gmt-dwell gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Place a dwell on the local-day grid</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptions}</select>` +
    `</label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      DWELL_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Count days in")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptions(LEDGER_ZONES, zone, "(the entry's zone)")}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Compare with")}` +
    `<select class="gmt-select" data-role="compare-zone">${zoneOptions(LEDGER_ZONES, compareZone, "(no comparison)")}</select>` +
    `</label>` +
    `</div>` +
    `<div class="gmt-ledger-frame" data-role="frame">` +
    platesHtml(
      "heroes",
      dwellPlates(
        { result: null, compare: null, zone: "", compareZone: "" },
        hourDurationText,
      ),
    ) +
    `<div class="gmt-dwell-timeline" data-role="timeline">` +
    row("dwell", true) +
    row("compare", false) +
    `<div class="gmt-ledger-axis gmt-dwell-axis" data-role="axis"><span></span><span></span><span></span></div>` +
    `</div>` +
    `</div>` +
    `<!-- Typed-input equivalent to dragging. -->` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Entry")}` +
    `<input class="gmt-input" data-role="entry" type="text" spellcheck="false" value="${escapeAttr(entry)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Exit")}` +
    `<input class="gmt-input" data-role="exit" type="text" spellcheck="false" value="${escapeAttr(exit)}"></label>` +
    `</div>` +
    `<p class="gmt-ledger-sr gmt-dwell-summary" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. What <code>dwellTime</code> returns</h4>` +
    codeFrameHtml("dwell") +
    `<output class="gmt-widget-output" data-role="dwell-output">&nbsp;</output>` +
    `<div class="gmt-dwell-compare-result" data-role="compare-result"${compareZone === NO_ZONE ? " hidden" : ""}>` +
    codeFrameHtml("compare") +
    `<output class="gmt-widget-output" data-role="compare-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

type DwellFn = (
  entry: string,
  exit: string,
  zone?: string,
) => DwellResult | null;

interface Modules {
  dwellTime: DwellFn;
  isValidInstant: (value: string) => boolean;
  isValidTimeZone: (value: string) => boolean;
  isValidZonedDateTime: (value: string) => boolean;
}

async function loadModules(): Promise<Modules> {
  const [transport, precision, zoned] = await Promise.all([
    GMT_MODULES["transport/calculate"](),
    GMT_MODULES["precision/validate"](),
    GMT_MODULES["zoned/validate"](),
  ]);
  return {
    dwellTime: transport["dwellTime"] as DwellFn,
    isValidInstant: precision["isValidInstant"] as (v: string) => boolean,
    isValidTimeZone: zoned["isValidTimeZone"] as (v: string) => boolean,
    isValidZonedDateTime: zoned["isValidZonedDateTime"] as (
      v: string,
    ) => boolean,
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function renderDays(
  el: HTMLElement | null,
  cells: readonly DayCell[],
  canvas: LedgerCanvas,
  series: 1 | 2,
  shade: boolean,
  trackPx: number,
): void {
  if (!el) return;
  el.innerHTML = dayColumnsHtml(
    cells,
    canvas,
    dwellMarks(cells, series, shade),
  );
  fitDayColumns(el, trackPx, dayColumnFit);
}

function placeBar(
  bar: HTMLElement | null,
  entryMs: number,
  exitMs: number,
  canvas: LedgerCanvas,
  invalid: boolean,
): void {
  if (!bar) return;
  if (Number.isNaN(entryMs) || Number.isNaN(exitMs)) {
    bar.hidden = true;
    return;
  }
  const left = canvas.toPercent(Math.min(entryMs, exitMs));
  const right = canvas.toPercent(Math.max(entryMs, exitMs));
  bar.hidden = false;
  bar.style.left = `${left}%`;
  bar.style.width = `${Math.max(0, right - left)}%`;
  bar.classList.toggle("gmt-dwell-bar--invalid", invalid);
  bar.classList.toggle("gmt-ledger-bar--invalid", invalid);
}

function callArgs(entry: string, exit: string, zone: string): [string, string] {
  const parts = [entry, exit, ...(zone === NO_ZONE ? [] : [zone])];
  return [
    parts.map((p) => codeSpan("str", JSON.stringify(p))).join(", "),
    parts.map((p) => JSON.stringify(p)).join(", "),
  ];
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  refit(): void;
  /** Release what outlives the subtree: a pointer capture held mid-drag and
   *  the track's width observer. */
  release(): void;
}

function setupWidget(container: HTMLElement, m: Modules): Controller | null {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const entryEl = q<HTMLInputElement>("entry");
  const exitEl = q<HTMLInputElement>("exit");
  const zoneEl = q<HTMLSelectElement>("zone");
  const compareEl = q<HTMLSelectElement>("compare-zone");
  if (!presetEl || !entryEl || !exitEl || !zoneEl || !compareEl) return null;

  let canvas: LedgerCanvas = createLedgerCanvas(0, 1);

  const state = () => {
    const entry = entryEl.value.trim();
    const exit = exitEl.value.trim();
    const zone = zoneEl.value;
    const compareZone = compareEl.value;
    return {
      entry,
      exit,
      zone,
      compareZone,
      entryMs: toEpochMs(entry),
      exitMs: toEpochMs(exit),
      grid: gridZone(entry, zone),
    };
  };

  function refit(): void {
    const s = state();
    const zones = [
      s.grid,
      s.compareZone === NO_ZONE ? null : gridZone("", s.compareZone),
    ].filter((z): z is string => z !== null);
    const fitted = fitLedgerCanvas(s.entryMs, s.exitMs, zones);
    if (fitted) canvas = fitted;
    render();
  }

  function syncPreset(): void {
    const s = state();
    presetEl!.value = matchPreset(s.entry, s.exit, s.zone, s.compareZone);
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        DWELL_PRESETS.find((p) => p.id === presetEl!.value)?.description ?? "",
      );
    }
  }

  function render(): void {
    const s = state();
    const result = m.dwellTime(
      s.entry,
      s.exit,
      s.zone === NO_ZONE ? undefined : s.zone,
    );
    const reason =
      result === null ? explainNull(s.entry, s.exit, s.zone, m) : null;

    // Primary row.
    const label = q("label-dwell");
    if (label) label.textContent = s.grid ?? "no zone";
    const trackPx = q("track-dwell")?.clientWidth ?? 0;
    renderDays(
      q("cells-dwell"),
      s.grid ? dayCells(canvas, s.grid, s.entryMs, s.exitMs) : [],
      canvas,
      1,
      result !== null,
      trackPx,
    );
    placeBar(q("bar"), s.entryMs, s.exitMs, canvas, reason === "inverted");
    for (const [role, ms] of [
      ["handle-entry", s.entryMs],
      ["handle-exit", s.exitMs],
    ] as const) {
      const h = q(role);
      if (!h) continue;
      const pct = canvas.toPercent(ms);
      h.setAttribute("aria-valuemin", "0");
      h.setAttribute("aria-valuemax", "100");
      h.setAttribute(
        "aria-valuenow",
        Number.isNaN(pct) ? "0" : String(Math.round(pct)),
      );
      h.setAttribute(
        "aria-valuetext",
        Number.isNaN(ms) ? "not a time" : formatLocal(ms, s.grid ?? "UTC"),
      );
    }

    // Axis.
    const axisEl = q("axis");
    const spans = axisEl?.querySelectorAll("span") ?? [];
    const labels = axisLabels(canvas, s.grid);
    spans.forEach((span, i) => {
      span.textContent = labels[i] ?? "";
    });
    // On a narrow track the three dates would touch: drop the ones that do.
    if (axisEl) thinTickLabels(axisEl, "span");

    // Primary result.
    const [argsHtml, argsPlain] = callArgs(s.entry, s.exit, s.zone);
    renderCallLine(q("call-dwell"), "dwellTime", argsHtml, argsPlain);
    const out = q("dwell-output");
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatDwell(result), "live");
    }

    // Comparison.
    const compareOn = s.compareZone !== NO_ZONE;
    const compareRow = q("row-compare");
    const compareBlock = q("compare-result");
    if (compareRow) compareRow.hidden = !compareOn;
    if (compareBlock) compareBlock.hidden = !compareOn;
    let compareResult: DwellResult | null = null;
    if (compareOn) {
      compareResult = m.dwellTime(s.entry, s.exit, s.compareZone);
      const compareLabel = q("label-compare");
      if (compareLabel) compareLabel.textContent = s.compareZone;
      const compareGrid = gridZone("", s.compareZone);
      renderDays(
        q("cells-compare"),
        compareGrid ? dayCells(canvas, compareGrid, s.entryMs, s.exitMs) : [],
        canvas,
        2,
        compareResult !== null,
        trackPx,
      );
      placeBar(
        q("bar-compare"),
        s.entryMs,
        s.exitMs,
        canvas,
        reason === "inverted",
      );
      const [cHtml, cPlain] = callArgs(s.entry, s.exit, s.compareZone);
      renderCallLine(q("call-compare"), "dwellTime", cHtml, cPlain);
      const cOut = q("compare-output");
      if (cOut) {
        if (compareResult === null)
          renderWidgetOutput(cOut, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(cOut, formatDwell(compareResult), "live");
      }
    }

    const heroes = q("heroes");
    if (heroes) {
      heroes.innerHTML = dwellPlates(
        {
          result,
          compare: compareResult,
          zone: s.grid ?? "",
          compareZone: compareOn ? s.compareZone : "",
        },
        hourDurationText,
      )
        .map(plateHtml)
        .join("");
    }

    // Summary: the library's numbers, never the drawing's.
    const summary = q("summary");
    if (summary) {
      if (result === null) {
        summary.textContent = "";
      } else {
        const lines = [
          `${result.duration} elapsed · ${dayCountText(result.calendarDays)} in ${s.grid ?? s.zone}`,
        ];
        if (compareResult) {
          lines.push(
            `${dayCountText(compareResult.calendarDays)} in ${s.compareZone}`,
          );
        }
        summary.textContent = lines.join(" · ");
      }
    }

    // Aside: why null, or what an odd-length day means.
    const aside = q("reason-aside");
    if (aside) {
      if (reason) {
        renderAside(
          aside,
          "caution",
          "Why null",
          `<p>${escapeHtml(NULL_REASON_TEXT[reason])}</p>`,
        );
      } else if (result) {
        const odd = s.grid
          ? dayCells(canvas, s.grid, s.entryMs, s.exitMs).find(
              (c) => c.touched && c.hours !== 24,
            )
          : undefined;
        if (odd) {
          renderAside(
            aside,
            "note",
            "Note",
            `<p>${escapeHtml(`${formatDayLabel(odd.date)} had ${odd.hours} hours in ${s.grid}. It still counts as one day: the count is of local dates, not of 24-hour blocks.`)}</p>`,
          );
        } else {
          aside.innerHTML = "";
        }
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = DWELL_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    entryEl!.value = preset.entry;
    exitEl!.value = preset.exit;
    zoneEl!.value = preset.zone;
    compareEl!.value = preset.compareZone ?? NO_ZONE;
    syncPreset();
    refit();
  }

  // ---- Drag ----

  const inputFor: Record<string, HTMLInputElement> = {
    "handle-entry": entryEl,
    "handle-exit": exitEl,
  };

  function setHandle(role: string, ms: number): void {
    const input = inputFor[role];
    if (!input || Number.isNaN(ms)) return;
    const s = state();
    // A handle cannot pass the other one.
    const bounded =
      role === "handle-entry"
        ? Number.isNaN(s.exitMs)
          ? ms
          : Math.min(ms, s.exitMs)
        : Number.isNaN(s.entryMs)
          ? ms
          : Math.max(ms, s.entryMs);
    input.value = formatHandleValue(bounded, s.grid);
    syncPreset();
    render();
  }

  let dragging: string | null = null;
  /** The pointer's distance from the dragged edge when it took hold, in px. */
  let grab = 0;
  let captured: { el: HTMLElement; id: number } | null = null;

  container.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    if (!target) return;
    dragging = target.dataset.role ?? null;
    // A grip leans out past its edge (gmt-dwell-ledger.css) and is taken hold of anywhere on it.
    // Keep the pointer's distance from the edge, so the first move does not jump the edge to it.
    const bar = target.parentElement?.getBoundingClientRect();
    grab = bar
      ? (dragging === "handle-entry" ? bar.left : bar.right) -
        (e as PointerEvent).clientX
      : 0;
    const id = (e as PointerEvent).pointerId;
    try {
      target.setPointerCapture(id);
      captured = { el: target, id };
    } catch {
      captured = null;
    }
    e.preventDefault();
  });

  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const track = q("track-dwell");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct =
      (((e as PointerEvent).clientX + grab - rect.left) / rect.width) * 100;
    setHandle(dragging, canvas.fromPercent(pct));
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = null;
    captured = null;
    refit();
  };
  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);

  // ---- Keyboard ----

  container.addEventListener("keydown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    const role = target?.dataset.role;
    const input = role ? inputFor[role] : undefined;
    if (!role || !input) return;
    const ev = e as KeyboardEvent;
    const units = ev.shiftKey ? BIG_STEP_UNITS : STEP_UNITS;
    const current = toEpochMs(input.value);
    let next: number | null = null;
    switch (ev.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = canvas.step(current, -units);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = canvas.step(current, units);
        break;
      case "PageUp":
        next = canvas.step(current, PAGE_STEP_UNITS);
        break;
      case "PageDown":
        next = canvas.step(current, -PAGE_STEP_UNITS);
        break;
      case "Home":
        next = canvas.startMs;
        break;
      case "End":
        next = canvas.endMs;
        break;
    }
    if (next === null) return;
    ev.preventDefault();
    setHandle(role, next);
    // Reaching the edge widens the canvas, so the handle can keep going.
    if (next <= canvas.startMs || next >= canvas.endMs) refit();
  });

  // ---- Typed inputs and selects ----

  for (const input of [entryEl, exitEl]) {
    input.addEventListener("input", () => {
      syncPreset();
      render();
    });
    // Refit on commit, not per keystroke: rescaling under a half-typed date
    // fights the caret.
    input.addEventListener("change", refit);
  }
  for (const select of [zoneEl, compareEl]) {
    select.addEventListener("change", () => {
      syncPreset();
      refit();
    });
  }
  presetEl.addEventListener("change", applyPreset);

  wireCopyButtons(container);

  /* The day columns drop their weekday, then their label, against the track's
     measured width, so a width change (rotation, the chat rail opening) re-fits
     them. */
  const trackEl = q<HTMLElement>("track-dwell");
  const disposeWidth = trackEl ? onWidthChange(trackEl, render) : () => {};

  return {
    refit,
    release() {
      disposeWidth();
      if (!captured) return;
      try {
        captured.el.releasePointerCapture(captured.id);
      } catch {
        /* Already released. */
      }
      captured = null;
    },
  };
}

/** Write seeded arguments onto the controls; a zone the select lacks is added. */
function applyArgs(root: HTMLElement, args: DwellLedgerArgs): void {
  if (args.entry === undefined && args.exit === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const zone = args.zone ?? NO_ZONE;
  const compareZone = args.compareZone ?? NO_ZONE;
  const setSelect = (el: HTMLSelectElement | null, value: string) => {
    if (!el) return;
    if (![...el.options].some((o) => o.value === value)) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      el.appendChild(opt);
    }
    el.value = value;
  };
  setSelect(q<HTMLSelectElement>("zone"), zone);
  setSelect(q<HTMLSelectElement>("compare-zone"), compareZone);
  const entryEl = q<HTMLInputElement>("entry");
  const exitEl = q<HTMLInputElement>("exit");
  /* A chat model answering "23:00 in New York" sends a wall time with no
     offset. Read it in the zone the reader named; see `resolveWallTime`. */
  if (entryEl) entryEl.value = resolveWallTime(args.entry ?? "", zone);
  if (exitEl) exitEl.value = resolveWallTime(args.exit ?? "", zone);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl && entryEl && exitEl) {
    presetEl.value = matchPreset(
      entryEl.value,
      exitEl.value,
      zone,
      compareZone,
    );
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        DWELL_PRESETS.find((p) => p.id === presetEl.value)?.description ?? "",
      );
    }
  }
}

export const mountDwellLedger: MountFn<DwellLedgerArgs> = async (
  root,
  args,
  signal,
) => {
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  const controller = setupWidget(root, modules);
  controller?.refit();

  return onceDestroy(
    () => controller?.release(),
    () => {
      const v = (role: string) =>
        (
          root.querySelector(`[data-role="${role}"]`) as
            | HTMLInputElement
            | HTMLSelectElement
            | null
        )?.value ?? "";
      const out: Record<string, string> = {
        entry: v("entry"),
        exit: v("exit"),
      };
      if (v("zone") !== NO_ZONE) out.zone = v("zone");
      if (v("compare-zone") !== NO_ZONE) out.compareZone = v("compare-zone");
      return out;
    },
  );
};
