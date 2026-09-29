/**
 * The Cut-off Ruler widget (TRAN-10), mountable on its tool page and in the
 * chat rail.
 *
 * One departure's "N days before" read three ways by `cutoffAt` — calendar
 * days, exact hours, a pinned local time — on one axis, with any DST change
 * between them marked. Every reading, every hours-before figure and the
 * transition marker come from `cutoffAt`, `timeToCutoff` and the polyfill's
 * `getTimeZoneTransition` alone.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  CUSTOM_PRESET_ID,
  RULER_PRESETS,
  collectRulerFacts,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readingsOf,
  rulerNullReason,
  rulerNullText,
  transitionBetween,
  transitionLabel,
  type CutoffRulerArgs,
  type RulerFacts,
  type RulerReading,
  type RulerState,
} from "./cutoff-ruler";
import {
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  callSource,
  dayTickLabel,
  durationText,
  hourTickLabel,
  localLabel,
  epochMs,
  walkTicks,
} from "./cutoff-widgets";
import { codeFrameHtml } from "./code-frame";
import { loadCutoffLib } from "./cutoff-lib";
import type { CutoffLib } from "./cutoff-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { CutoffRulerArgs } from "./cutoff-ruler";

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    RULER_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

export function renderCutoffRulerTemplate(args: CutoffRulerArgs = {}): string {
  const seeded = args.anchor !== undefined || args.days !== undefined;
  const state: RulerState = seeded
    ? readArgs(args)
    : presetState(RULER_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = RULER_PRESETS.find((p) => p.id === presetId);
  const days = Number.parseInt(state.days, 10) || 1;

  return (
    `<div class="gmt-cutoff-ruler gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The departure and the rule</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Departs</span>` +
    `<input class="gmt-input" data-role="anchor" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.anchor)}"></label>` +
    `<label class="gmt-label"><span>Terminal clock</span>` +
    `<select class="gmt-select" data-role="time-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `<label class="gmt-label"><span>Days before</span>` +
    `<select class="gmt-select" data-role="days">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}"${n === days ? " selected" : ""}>${n}</option>`).join("")}</select></label>` +
    `<label class="gmt-label"><span>At local time</span>` +
    `<input class="gmt-input" data-role="at-local-time" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.atLocalTime)}"></label>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Three readings of "<span data-role="days-heading">${days}</span> days before"</h4>` +
    `<div class="gmt-cutoff-ruler-overview" data-role="ruler-overview" role="img" aria-labelledby="ruler-summary" tabindex="-1"></div>` +
    `<div class="gmt-cutoff-ruler-closeup" data-role="ruler-closeup" role="img" aria-labelledby="ruler-summary" tabindex="-1"></div>` +
    `<p class="gmt-widget-hint" id="ruler-summary" data-role="ruler-summary"></p>` +
    `<ul class="gmt-cutoff-ruler-readings" data-role="readings"></ul>` +
    `<p class="gmt-widget-hint" data-role="static-caption"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>cutoffAt</code> returns</h4>` +
    codeFrameHtml("ruler-calendar") +
    `<output class="gmt-widget-output" data-role="ruler-output-calendar">&nbsp;</output>` +
    codeFrameHtml("ruler-exact") +
    `<output class="gmt-widget-output" data-role="ruler-output-exact">&nbsp;</output>` +
    codeFrameHtml("ruler-pinned") +
    `<output class="gmt-widget-output" data-role="ruler-output-pinned">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const READING_ROLE: Record<string, string> = {
  calendar: "ruler-calendar",
  exact: "ruler-exact",
  pinned: "ruler-pinned",
};

/** The local midnight at or before `ms`, in `zone` — the polyfill's own
 *  `startOfDay`, for the overview's exact-time axis start. `ms` unchanged
 *  when the zone does not resolve. */
function localMidnightBefore(ms: number, zone: string): number {
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms)
      .toZonedDateTimeISO(zone)
      .startOfDay().epochMilliseconds;
  } catch {
    return ms;
  }
}

function renderOverview(
  el: HTMLElement,
  state: RulerState,
  facts: RulerFacts,
): void {
  if (!facts.departure) {
    el.innerHTML = "";
    return;
  }
  const timeZone = state.timeZone.trim();
  const departureMs = epochMs(facts.departure);
  const resolvedMs = facts.readings
    .filter((r) => r.at !== "")
    .map((r) => epochMs(r.at));
  const earliestMs =
    resolvedMs.length > 0 ? Math.min(...resolvedMs) : departureMs;
  const startMs = localMidnightBefore(earliestMs, timeZone);
  const span = Math.max(1, departureMs - startMs);
  const pct = (ms: number) => ((ms - startMs) / span) * 100;

  const lanes = facts.readings
    .map((r) => {
      if (r.at === "") {
        return (
          `<div class="gmt-cutoff-ruler-lane">` +
          `<span class="gmt-cutoff-ruler-lane-label">${escapeHtml(r.label)}</span>` +
          `<span class="gmt-widget-output gmt-playground-sentinel">NO SIGNAL</span>` +
          `</div>`
        );
      }
      const left = pct(epochMs(r.at));
      return (
        `<div class="gmt-cutoff-ruler-lane">` +
        `<span class="gmt-cutoff-ruler-lane-label">${escapeHtml(r.label)}</span>` +
        `<div class="gmt-cutoff-ruler-bar" style="left:${left}%;width:${Math.max(0, 100 - left)}%">` +
        `<span class="gmt-cutoff-ruler-marker gmt-cutoff-ruler-marker--solid"></span>` +
        `<span class="gmt-cutoff-ruler-bar-label">${escapeHtml(localLabel(r.at))} · ${escapeHtml(durationText(r.hoursBefore))}</span>` +
        `</div>` +
        `</div>`
      );
    })
    .join("");

  const transition = transitionBetween(state, facts);
  const transitionMarker = transition
    ? (() => {
        const left = pct(epochMs(transition.instant));
        const label = transitionLabel(transition, state.timeZone.trim());
        return (
          `<div class="gmt-cutoff-ruler-transition" style="left:${left}%" title="${escapeAttr(label)}">` +
          `<span class="gmt-widget-hint">${escapeHtml(label)}</span>` +
          `</div>`
        );
      })()
    : "";

  // Day and 6-hour ticks in local time: a day boundary shows the date, the
  // three in between show the hour.
  const ticks = walkTicks(startMs, departureMs, timeZone, "hours", 6, (z) =>
    z.hour === 0 ? dayTickLabel(z) : hourTickLabel(z),
  );
  const ticksHtml = ticks
    .map(
      (t) =>
        `<span class="gmt-cutoff-axis-tick" style="left:${pct(t.ms)}%">${escapeHtml(t.label)}</span>`,
    )
    .join("");

  el.innerHTML =
    `<div class="gmt-cutoff-ruler-lanes">${lanes}${transitionMarker}</div>` +
    `<div class="gmt-cutoff-ruler-departure-line">Departs ${escapeHtml(localLabel(facts.departure))}</div>` +
    `<div class="gmt-cutoff-ruler-ticks" data-role="ruler-overview-ticks">${ticksHtml}</div>`;
}

/**
 * An hour ruler from 2 h before the earliest resolved reading to 2 h after
 * the latest, with every local hour labelled as visible text — this is
 * where "an hour apart" (R1) has to be seen, not read from a tooltip. Each
 * reading gets its own row, so its label is never fighting another
 * reading's for the same space.
 */
function renderCloseup(
  el: HTMLElement,
  state: RulerState,
  facts: RulerFacts,
): void {
  const resolved = facts.readings.filter((r) => r.at !== "");
  if (resolved.length === 0) {
    el.innerHTML = "";
    return;
  }
  const timeZone = state.timeZone.trim();
  const ms = resolved.map((r) => epochMs(r.at));
  const startMs = Math.min(...ms) - 2 * 3_600_000;
  const endMs = Math.max(...ms) + 2 * 3_600_000;
  const span = Math.max(1, endMs - startMs);
  const pct = (v: number) => ((v - startMs) / span) * 100;

  const ticks = walkTicks(startMs, endMs, timeZone, "hours", 1, hourTickLabel);
  const ticksHtml = ticks
    .map(
      (t) =>
        `<span class="gmt-cutoff-axis-tick" style="left:${pct(t.ms)}%">${escapeHtml(t.label)}</span>`,
    )
    .join("");

  const rows = resolved
    .map(
      (r) =>
        `<div class="gmt-cutoff-ruler-closeup-row">` +
        `<span class="gmt-cutoff-ruler-marker gmt-cutoff-ruler-marker--solid" style="left:${pct(epochMs(r.at))}%"></span>` +
        `<span class="gmt-cutoff-ruler-closeup-label" style="left:${pct(epochMs(r.at))}%">${escapeHtml(r.label)}</span>` +
        `</div>`,
    )
    .join("");

  el.innerHTML =
    `<div class="gmt-cutoff-ruler-hourline">${rows}</div>` +
    `<div class="gmt-cutoff-ruler-ticks" data-role="ruler-closeup-ticks">${ticksHtml}</div>`;
}

function readingsList(facts: RulerFacts): string {
  return facts.readings
    .map((r) => {
      const gloss =
        r.key === "calendar"
          ? "keeps the departure's time of day"
          : r.key === "exact"
            ? "elapsed time, whatever the clock does"
            : "keeps the local time you pin, and lets the elapsed time move";
      const value =
        r.at === ""
          ? `<span class="gmt-widget-output gmt-playground-sentinel">NO SIGNAL</span>`
          : `${escapeHtml(localLabel(r.at))} — ${escapeHtml(r.at)} — ${escapeHtml(durationText(r.hoursBefore))} (${escapeHtml(r.hoursBefore)})`;
      return `<li><strong>${escapeHtml(r.label)}</strong>: ${value}<br><span class="gmt-widget-hint">${escapeHtml(gloss)}</span></li>`;
    })
    .join("");
}

function summaryText(facts: RulerFacts): string {
  return facts.readings
    .map((r) =>
      r.at === ""
        ? `${r.label} is NO SIGNAL.`
        : `${r.label} is ${localLabel(r.at)}, ${durationText(r.hoursBefore)} before departure.`,
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: CutoffLib): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const anchorEl = q<HTMLInputElement>("anchor");
  const timeZoneEl = q<HTMLSelectElement>("time-zone");
  const daysEl = q<HTMLSelectElement>("days");
  const atLocalTimeEl = q<HTMLInputElement>("at-local-time");
  if (!presetEl || !anchorEl || !timeZoneEl || !daysEl || !atLocalTimeEl)
    return;

  function state(): RulerState {
    return {
      anchor: anchorEl!.value.trim(),
      timeZone: timeZoneEl!.value.trim(),
      days: daysEl!.value.trim(),
      atLocalTime: atLocalTimeEl!.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        RULER_PRESETS.find((p) => p.id === presetEl!.value)?.description ?? "";
    }
  }

  function render(): void {
    const s = state();
    const heading = q("days-heading");
    if (heading) heading.textContent = s.days;

    const facts = collectRulerFacts(s, lib);
    for (const spec of readingsOf(s)) {
      const role = READING_ROLE[spec.key]!;
      const [callHtml, callPlain] = callSource("cutoffAt", [
        s.anchor.trim(),
        spec.offset,
        spec.options,
      ]);
      renderCallLine(q(`call-${role}`), "cutoffAt", callHtml, callPlain);
      const reading = facts.readings.find((r) => r.key === spec.key)!;
      const out = q(`ruler-output-${spec.key}`);
      if (out) {
        if (reading.at === "") renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, reading.at, "live");
      }
    }

    const overview = q<HTMLElement>("ruler-overview");
    if (overview) renderOverview(overview, s, facts);
    const closeup = q<HTMLElement>("ruler-closeup");
    if (closeup) renderCloseup(closeup, s, facts);
    const summary = q("ruler-summary");
    if (summary) summary.textContent = summaryText(facts);
    const readingsEl = q("readings");
    if (readingsEl) readingsEl.innerHTML = readingsList(facts);
    const caption = q("static-caption");
    if (caption) {
      caption.textContent = `Date arithmetic that subtracts ${s.days.trim() || "N"} × 86,400,000 ms is the exact-hours row.`;
    }

    const aside = q("reason-aside");
    if (aside) {
      const failing = facts.readings.find((r: RulerReading) => r.at === "");
      if (failing) {
        const reason = rulerNullReason(failing, s, lib);
        renderAside(
          aside,
          "caution",
          "Why NO SIGNAL",
          `<p>${escapeHtml(reason ? rulerNullText(reason) : "This reading could not be computed.")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = RULER_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    anchorEl!.value = preset.anchor;
    timeZoneEl!.value = preset.timeZone;
    daysEl!.value = preset.days;
    atLocalTimeEl!.value = preset.atLocalTime;
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    if (e.target === presetEl) return;
    syncPreset();
    render();
  });
  root.addEventListener("change", (e) => {
    if (e.target === presetEl) {
      applyPreset();
      return;
    }
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  render();
}

function applyArgs(root: HTMLElement, args: CutoffRulerArgs): void {
  if (args.anchor === undefined && args.days === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("anchor", s.anchor);
  set("time-zone", s.timeZone);
  set("days", s.days);
  set("at-local-time", s.atLocalTime);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        RULER_PRESETS.find((p) => p.id === presetEl.value)?.description ?? "";
    }
  }
}

export const mountCutoffRuler: MountFn<CutoffRulerArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
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
      const anchorEl = q<HTMLInputElement>("anchor");
      if (!anchorEl) return null;
      const state: RulerState = {
        anchor: anchorEl.value,
        timeZone: q<HTMLSelectElement>("time-zone")?.value ?? "",
        days: q<HTMLSelectElement>("days")?.value ?? "",
        atLocalTime: q<HTMLInputElement>("at-local-time")?.value ?? "",
      };
      return permalinkOf(state);
    },
  );
};
