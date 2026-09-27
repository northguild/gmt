/**
 * The Crossing Clock widget (TRAN-9), mountable on its tool page and in the
 * chat rail.
 *
 * A crossing — a canal transit, a strait passage, a border queue — is logged
 * as two instants and read on the clock of the zone that administers it. The
 * real `crossingTime` gives the exact elapsed hours; the widget's one naive
 * value, `naiveWallDifference`, is the printed `HH:MM` at either end
 * subtracted with no zone and no DST, which agrees when nothing moves the
 * zone's offset between the two ends and disagrees when a DST transition
 * does.
 *
 * Follows the Connection Checker's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
import { resolveWallTime } from "./dwell-ledger";
import {
  CROSSING_PRESETS,
  CROSSING_ZONES,
  CUSTOM_PRESET_ID,
  NULL_REASON_TEXT,
  crossingCallSource,
  crossingClockFace,
  crossingStrip,
  durationMinutes,
  explainNull,
  isRepeatedReading,
  matchPreset,
  naiveText,
  naiveWallDifference,
  permalinkOf,
  readArgs,
  spokenOffset,
  type ClockFace,
  type CrossingChangeMarker,
  type CrossingClockArgs,
  type CrossingState,
} from "./crossing-clock";
import { codeFrameHtml } from "./code-frame";
import {
  bindClockGlow,
  renderCrystalClock,
  type CrystalClockHighlight,
  type CrystalClockState,
} from "./crystal-clock";
import { loadTransportLib } from "./transport-lib";
import {
  formatCrossing,
  minutesText,
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

export type { CrossingClockArgs } from "./crossing-clock";

function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    CROSSING_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** The static shell of one clock column: an empty face host the mount fills
 *  with a crystal clock SVG, plus the large-mono time, the offset/zone and
 *  the local date `render()` sets below it. Empty until the library loads,
 *  the same "skeleton first, then filled" shape every other computed value
 *  in this widget follows.
 *
 *  Emits five direct children rather than a wrapping panel div: `.gmt-
 *  crossing-clocks` is a five-row grid (owner review — entry and exit were
 *  drifting out of vertical alignment when their columns were independent
 *  flex boxes), and each element's own `data-role` is what
 *  `gmt-crossing-clock.css` uses to place it in that grid's named areas, so
 *  the connector can sit centred on just the face row without needing to
 *  match a whole column's height. */
function clockPanelHtml(prefix: "entry" | "exit", heading: string): string {
  return (
    `<p class="gmt-crossing-clock-heading" data-role="${prefix}-heading">${escapeHtml(heading)}</p>` +
    `<div class="gmt-crossing-clock-face" data-role="${prefix}-clock"></div>` +
    `<p class="gmt-crossing-clock-time" data-role="${prefix}-time">&nbsp;</p>` +
    `<p class="gmt-crossing-clock-meta" data-role="${prefix}-meta">&nbsp;</p>` +
    `<p class="gmt-crossing-clock-date" data-role="${prefix}-date">&nbsp;</p>`
  );
}

export function renderCrossingClockTemplate(
  args: CrossingClockArgs = {},
): string {
  const seeded = args.entry !== undefined;
  const state: CrossingState = seeded
    ? readArgs(args)
    : { ...CROSSING_PRESETS[0]!.state };
  const presetId = matchPreset(state);
  const preset = CROSSING_PRESETS.find((p) => p.id === presetId);

  const text = (role: string, label: string, value: string) =>
    `<label class="gmt-label"><span>${escapeHtml(label)}</span>` +
    `<input class="gmt-input" data-role="${role}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(value)}"></label>`;

  return (
    `<div class="gmt-crossing gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Log the crossing</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls gmt-crossing-fields">` +
    text("entry", "Entry", state.entry) +
    text("exit", "Exit", state.exit) +
    `<label class="gmt-label"><span>Read on the clock of</span>` +
    `<select class="gmt-select" data-role="target-zone">${zoneOptionsHtml(CROSSING_ZONES, state.targetZone)}</select></label>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Elapsed, and what the clocks say</h4>` +
    `<div class="gmt-crossing-clocks">` +
    clockPanelHtml("entry", "Entry") +
    `<div class="gmt-crossing-connector" data-role="connector">` +
    `<p class="gmt-transport-verdict" data-role="elapsed" aria-live="polite">&nbsp;</p>` +
    `<div class="gmt-crossing-connector-line" aria-hidden="true"></div>` +
    `<p class="gmt-transport-verdict-detail" data-role="naive">&nbsp;</p>` +
    `</div>` +
    clockPanelHtml("exit", "Exit") +
    `</div>` +
    `<div class="gmt-crossing-strip-wrap">` +
    `<div class="gmt-crossing-strip" data-role="ruler" role="img" aria-labelledby="crossing-ruler-summary">` +
    `<span class="gmt-crossing-strip-end" data-role="strip-entry-label">&nbsp;</span>` +
    `<div class="gmt-crossing-strip-track" data-role="strip-track"></div>` +
    `<span class="gmt-crossing-strip-end" data-role="strip-exit-label">&nbsp;</span>` +
    `</div>` +
    `<div class="gmt-crossing-strip-changes" data-role="strip-changes"></div>` +
    `<p class="gmt-transport-visually-hidden" id="crossing-ruler-summary" data-role="ruler-summary"></p>` +
    `<p class="gmt-widget-hint" data-role="legend"></p>` +
    `</div>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>crossingTime</code> returns</h4>` +
    codeFrameHtml("crossing") +
    `<output class="gmt-widget-output" data-role="crossing-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const CHANGE_LEGEND_TEXT: Record<CrossingChangeMarker["kind"], string> = {
  skip: "Purple dashed marker: an hour the clock never showed (matches the clock face highlight).",
  repeat:
    "Purple doubled marker: an hour the clock showed twice (matches the clock face highlight).",
};

function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}

/** Fills the proportional strip — entry/exit end labels, faint unlabelled
 *  hour ticks and a marker at every DST transition, on the bar itself —
 *  plus the change list beneath it (or the quiet "no change" line), a
 *  legend limited to the kinds that actually occur, and the visually
 *  hidden summary that is the bar's accessible name. Every value comes
 *  from `crossingStrip`, itself read from the real `crossingTime` result;
 *  nothing here is computed. */
function renderStrip(
  q: <T extends HTMLElement>(role: string) => T | null,
  strip: ReturnType<typeof crossingStrip>,
): void {
  const entryLabelEl = q("strip-entry-label");
  if (entryLabelEl) entryLabelEl.textContent = strip.entryLabel;
  const exitLabelEl = q("strip-exit-label");
  if (exitLabelEl) exitLabelEl.textContent = strip.exitLabel;

  const trackEl = q("strip-track");
  if (trackEl) {
    const ticks = strip.ticks
      .map((t) =>
        t.label
          ? `<span class="gmt-crossing-strip-tick gmt-crossing-strip-tick--labeled" data-label="${escapeHtml(t.label)}" style="left:${pct(t.percent)}"></span>`
          : `<span class="gmt-crossing-strip-tick" style="left:${pct(t.percent)}"></span>`,
      )
      .join("");
    const markers = strip.changes
      .map(
        (c, i) =>
          `<span class="gmt-crossing-strip-marker gmt-crossing-strip-marker--${c.kind}" data-role="strip-marker-${i}" style="left:${pct(c.percent)}"></span>`,
      )
      .join("");
    trackEl.innerHTML = ticks + markers;
  }

  const changesEl = q("strip-changes");
  if (changesEl) {
    changesEl.innerHTML = strip.changes.length
      ? strip.changes
          .map(
            (c, i) =>
              `<p class="gmt-crossing-strip-change gmt-crossing-strip-change--${c.kind}" data-role="strip-change-${i}">` +
              `<span class="gmt-crossing-strip-change-mark" aria-hidden="true"></span>` +
              `${escapeHtml(c.label)}</p>`,
          )
          .join("")
      : `<p class="gmt-crossing-strip-quiet" data-role="strip-quiet">No clock change during the crossing — every hour showed once.</p>`;
  }

  const legendEl = q("legend");
  if (legendEl) {
    const kinds = Array.from(new Set(strip.changes.map((c) => c.kind)));
    legendEl.textContent = kinds.map((k) => CHANGE_LEGEND_TEXT[k]).join(" ");
  }

  const summaryEl = q("ruler-summary");
  if (summaryEl) summaryEl.textContent = strip.summary;
}

function clearStrip(
  q: <T extends HTMLElement>(role: string) => T | null,
): void {
  const entryLabelEl = q("strip-entry-label");
  if (entryLabelEl) entryLabelEl.textContent = "";
  const exitLabelEl = q("strip-exit-label");
  if (exitLabelEl) exitLabelEl.textContent = "";
  const trackEl = q("strip-track");
  if (trackEl) trackEl.innerHTML = "";
  const changesEl = q("strip-changes");
  if (changesEl) changesEl.innerHTML = "";
  const legendEl = q("legend");
  if (legendEl) legendEl.textContent = "";
  const summaryEl = q("ruler-summary");
  if (summaryEl) summaryEl.textContent = "";
}

/** Fills one clock panel: the crystal-clock SVG, the large-mono time, the
 *  offset/zone line and the local date — every value read out of `face`,
 *  which `crossingClockFace` already read out of `crossingTime`'s own
 *  string. Nothing here is computed. `highlight`, when the crossing has a
 *  DST change in it, draws that hour on the dial too — both clocks read
 *  the same `targetZone`, so both get it (the owner's call: the lesson
 *  reads clearest when it shows on the clock the reader is looking at,
 *  entry or exit, not only one of them). */
function renderClockPanel(
  q: <T extends HTMLElement>(role: string) => T | null,
  prefix: "entry" | "exit",
  heading: string,
  face: ClockFace,
  clockState: CrystalClockState,
  highlight: CrystalClockHighlight | undefined,
): void {
  const faceEl = q(`${prefix}-clock`);
  if (faceEl) {
    faceEl.innerHTML = renderCrystalClock({
      id: prefix,
      hour: face.hour,
      minute: face.minute,
      label: `${heading} clock`,
      sublabel: `${face.timeLabel}, ${spokenOffset(face.offset)}, ${face.zoneLabel}`,
      state: clockState,
      highlight,
    });
  }
  const timeEl = q(`${prefix}-time`);
  if (timeEl) timeEl.textContent = face.timeLabel;
  const metaEl = q(`${prefix}-meta`);
  if (metaEl) metaEl.textContent = `${face.offset} · ${face.zoneLabel}`;
  const dateEl = q(`${prefix}-date`);
  if (dateEl) dateEl.textContent = face.dateLabel;
}

function clearClockPanel(
  q: <T extends HTMLElement>(role: string) => T | null,
  prefix: "entry" | "exit",
): void {
  const faceEl = q(`${prefix}-clock`);
  if (faceEl) faceEl.innerHTML = "";
  for (const suffix of ["time", "meta", "date"] as const) {
    const el = q(`${prefix}-${suffix}`);
    if (el) el.textContent = "";
  }
}

function setupWidget(root: HTMLElement, lib: TransportLib): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const entryEl = q<HTMLInputElement>("entry");
  const exitEl = q<HTMLInputElement>("exit");
  const targetZoneEl = q<HTMLSelectElement>("target-zone");
  if (!presetEl || !entryEl || !exitEl || !targetZoneEl) return;

  function state(): CrossingState {
    return {
      entry: entryEl!.value.trim(),
      exit: exitEl!.value.trim(),
      targetZone: targetZoneEl!.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        CROSSING_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function render(): void {
    const s = state();
    const result = lib.crossingTime(s.entry, s.exit, s.targetZone);

    const [callHtml, callPlain] = crossingCallSource(s);
    renderCallLine(q("call-crossing"), "crossingTime", callHtml, callPlain);

    const out = q("crossing-output");
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatCrossing(result), "live");
    }

    const elapsedEl = q("elapsed");
    const naiveEl = q("naive");
    const aside = q("reason-aside");

    if (result === null) {
      if (elapsedEl) elapsedEl.textContent = "";
      if (naiveEl) naiveEl.textContent = "";
      clearStrip(q);
      clearClockPanel(q, "entry");
      clearClockPanel(q, "exit");
      if (aside) {
        const reason = explainNull(s.entry, s.exit, s.targetZone, lib);
        renderAside(
          aside,
          "caution",
          "Why null",
          `<p>${escapeHtml(reason ? NULL_REASON_TEXT[reason] : "The crossing could not be read.")}</p>`,
        );
      }
      return;
    }

    if (aside) aside.innerHTML = "";

    const naiveMinutes = naiveWallDifference(result);
    const elapsedMinutes = durationMinutes(result.duration);
    const disagrees = Math.round(naiveMinutes - elapsedMinutes) !== 0;
    if (elapsedEl) {
      elapsedEl.textContent = `${result.duration} elapsed — ${minutesText(elapsedMinutes)}`;
    }
    if (naiveEl) {
      naiveEl.textContent = `Naive: ${naiveText(elapsedMinutes, naiveMinutes)}`;
      if (disagrees) {
        naiveEl.insertAdjacentHTML(
          "beforeend",
          ` <span class="gmt-transport-badge gmt-transport-badge--disagrees" data-role="naive-disagrees">disagrees</span>`,
        );
      }
    }

    const entryFace = crossingClockFace(result.enter);
    const exitFace = crossingClockFace(result.exit);
    const repeated = isRepeatedReading(entryFace, exitFace);

    const strip = crossingStrip(result, s.targetZone);
    // Both clocks read the same targetZone, so a change found anywhere in
    // the crossing shows on both — see renderClockPanel's own comment.
    // Only the first change draws (a highlight is one hour, not a list);
    // realistic crossings have at most one in practice.
    const firstChange = strip.changes[0];
    const highlight: CrystalClockHighlight | undefined = firstChange
      ? {
          fromHour: firstChange.fromHour,
          fromMinute: firstChange.fromMinute,
          toHour: firstChange.toHour,
          toMinute: firstChange.toMinute,
          kind: firstChange.kind === "skip" ? "skipped" : "repeated",
        }
      : undefined;

    renderClockPanel(
      q,
      "entry",
      "Entry",
      entryFace,
      repeated ? "repeated" : "normal",
      highlight,
    );
    renderClockPanel(
      q,
      "exit",
      "Exit",
      exitFace,
      repeated ? "repeated" : "normal",
      highlight,
    );

    renderStrip(q, strip);
  }

  function applyPreset(): void {
    const preset = CROSSING_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    entryEl!.value = preset.state.entry;
    exitEl!.value = preset.state.exit;
    targetZoneEl!.value = preset.state.targetZone;
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === entryEl || target === exitEl) {
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
    if (target === targetZoneEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  render();
}

function applyArgs(root: HTMLElement, args: CrossingClockArgs): void {
  if (args.entry === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const zone = s.targetZone.trim();
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("entry", zone === "" ? s.entry : resolveWallTime(s.entry, zone));
  set("exit", zone === "" ? s.exit : resolveWallTime(s.exit, zone));
  set("target-zone", zone);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    const matched = matchPreset({
      entry: q<HTMLInputElement>("entry")?.value ?? "",
      exit: q<HTMLInputElement>("exit")?.value ?? "",
      targetZone: zone,
    });
    presetEl.value = matched;
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        CROSSING_PRESETS.find((p) => p.id === matched)?.description ?? "";
    }
  }
}

export const mountCrossingClock: MountFn<CrossingClockArgs> = async (
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
  // The night-light toggle (crystal-clock.ts): delegated once here, not
  // rebound in render(), because it survives every re-render whether the
  // clock panels it's watching for exist yet or not.
  bindClockGlow(root, signal);

  return onceDestroy(
    () => {},
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const entryEl = q<HTMLInputElement>("entry");
      if (!entryEl) return null;
      const state: CrossingState = {
        entry: entryEl.value,
        exit: q<HTMLInputElement>("exit")?.value ?? "",
        targetZone: q<HTMLSelectElement>("target-zone")?.value ?? "",
      };
      return permalinkOf(state);
    },
  );
};
