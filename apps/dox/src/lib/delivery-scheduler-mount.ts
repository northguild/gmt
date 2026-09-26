/**
 * The Delivery Scheduler widget (TRAN-9), mountable on its tool page and in
 * the chat rail.
 *
 * A multi-leg journey — up to four legs — chained by the real
 * `scheduleDelivery` into one ETA, drawn two ways: an unlabelled exact-time
 * overview strip, and an itinerary that groups every departure, arrival,
 * handoff and DST transition by the local date on which it happens. The
 * mount never computes an arrival, a ready instant or a verdict: every one
 * comes from `buildItinerary` (`delivery-scheduler.ts`), which reads
 * `collectJourneyFacts` (`transport-widgets.ts`) — the real library called on
 * prefixes and zero-length legs — and computes nothing itself beyond axis
 * padding, date grouping and the Date Line / DST wall-clock notes, all from
 * Temporal values.
 *
 * Follows the Free Time Ledger's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
import {
  CUSTOM_PRESET_ID,
  DELIVERY_PRESETS,
  MAX_LEGS,
  buildChartData,
  buildEtaSummary,
  buildItinerary,
  legsOf,
  matchPreset,
  optionsOf,
  originZoneOf,
  permalinkOf,
  readArgs,
  shortZoneLabel,
  type ChartData,
  type DeliverySchedulerArgs,
  type DeliveryState,
  type EtaSummary,
  type Itinerary,
  type ItineraryEvent,
} from "./delivery-scheduler";
import { codeFrameHtml } from "./code-frame";
import {
  buildRouteChartDefinition,
  buildScaleChartDefinition,
  laneChartHeight,
} from "./delivery-scheduler-charts";
import { loadTransportLib } from "./transport-lib";
import { TRANSPORT_MODES, transportIcon } from "./transport-icons";
import { mountChart } from "@tanstack/charts/dom";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  collectJourneyFacts,
  formatSchedule,
  scheduleCallSource,
  scheduleNullText,
  TRANSPORT_ZONES,
  zoneOptionsHtml,
  type JourneyFacts,
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

export type { DeliverySchedulerArgs } from "./delivery-scheduler";

function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    DELIVERY_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function modeDisplayLabel(mode: string): string {
  return mode.length === 0 ? mode : mode[0]!.toUpperCase() + mode.slice(1);
}

/** `<option>`s for a mode `<select>`, mirroring `zoneOptionsHtml`: a selected
 *  value the known list lacks (a caller's own free-text `mode` tag, which
 *  `scheduleDelivery` never validates) is appended rather than dropped. */
function modeOptionsHtml(selected: string): string {
  const known: readonly string[] = TRANSPORT_MODES;
  const list =
    selected === "" || known.includes(selected) ? known : [...known, selected];
  return (
    `<option value=""${selected === "" ? " selected" : ""}>(none)</option>` +
    list
      .map(
        (m) =>
          `<option value="${escapeAttr(m)}"${m === selected ? " selected" : ""}>${escapeHtml(modeDisplayLabel(m))}</option>`,
      )
      .join("")
  );
}

/** Sets a mode `<select>`'s value, inserting a matching `<option>` first when
 *  `mode` is a custom tag the list does not already offer — a permalink or
 *  chat seed's mode is never silently dropped. */
function setModeSelect(el: HTMLSelectElement | null, mode: string): void {
  if (!el) return;
  if (mode !== "" && ![...el.options].some((o) => o.value === mode)) {
    const opt = document.createElement("option");
    opt.value = mode;
    opt.textContent = modeDisplayLabel(mode);
    el.append(opt);
  }
  el.value = mode;
}

/** `①②③④` — a leg's own number badge, plain Unicode circled digits so no
 *  image or extra markup is needed; `gmt-delivery-scheduler.css` colours it
 *  per `data-leg`. */
const LEG_NUMERALS = ["①", "②", "③", "④"];

/** `data-leg="N"` (1-4, cycling past 4) — the attribute every leg-coloured
 *  element carries, matched by `[data-leg="N"]` in the stylesheet to set that
 *  element's `--leg-color`/`--leg-ink`. `legIndex` is 0-based. */
function legAccentAttr(legIndex: number): string {
  return ` data-leg="${(legIndex % LEG_NUMERALS.length) + 1}"`;
}

/** `① Truck · PT46H → Los Angeles` — the leg card's own header, refreshed
 *  whenever that leg's mode, duration or arrival zone changes. Mode falls
 *  back to "Leg" when blank (`scheduleDelivery` never requires it); duration
 *  and arrival city are each dropped when not yet typed, so a fresh card
 *  reads as `① Leg` rather than a row of dangling separators. */
function legHeaderHtml(n: number, leg: LegHeaderFields): string {
  const trimmedMode = leg.mode.trim();
  const modeLabel = trimmedMode === "" ? "Leg" : modeDisplayLabel(trimmedMode);
  const duration = leg.duration.trim();
  const city = leg.timeZone.trim();
  const tail = [
    duration !== "" ? escapeHtml(duration) : "",
    city !== "" ? `→ ${escapeHtml(shortZoneLabel(city))}` : "",
  ]
    .filter((s) => s !== "")
    .join(" ");
  return (
    `<span class="gmt-delivery-leg-number"${legAccentAttr(n - 1)}>${LEG_NUMERALS[n - 1]}</span> ` +
    transportIcon(trimmedMode, { className: "gmt-delivery-leg-icon" }) +
    escapeHtml(modeLabel) +
    (tail !== "" ? ` · ${tail}` : "")
  );
}

interface LegHeaderFields {
  mode: string;
  duration: string;
  timeZone: string;
}

function optionalSuffix(): string {
  return `<span class="gmt-delivery-optional">optional</span>`;
}

function legFieldset(n: number, state: DeliveryState, count: number): string {
  const leg = state.legs[n - 1]!;
  const hidden = n > count ? " hidden" : "";
  const departureLabel = n === 1 ? "Departs" : "Scheduled departure";

  const textField = (
    role: string,
    area: string,
    label: string,
    value: string,
    optional: boolean,
  ) =>
    `<label class="gmt-label gmt-delivery-field gmt-delivery-field--${area}"><span>${escapeHtml(label)}${optional ? optionalSuffix() : ""}</span>` +
    `<input class="gmt-input" data-role="${role}-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(value)}"></label>`;

  const modeField =
    `<label class="gmt-label gmt-delivery-field gmt-delivery-field--mode"><span>Mode${optionalSuffix()}</span>` +
    `<select class="gmt-select" data-role="mode-${n}">${modeOptionsHtml(leg.mode)}</select></label>`;

  const arrivesField =
    `<label class="gmt-label gmt-delivery-field gmt-delivery-field--arrives"><span>Arrives in</span>` +
    `<select class="gmt-select" data-role="zone-${n}">${zoneOptionsHtml(TRANSPORT_ZONES, leg.timeZone)}</select></label>`;

  return (
    `<fieldset class="gmt-transport-leg gmt-delivery-leg-fieldset" data-role="leg-${n}"${legAccentAttr(n - 1)}${hidden}>` +
    `<legend><span data-role="leg-legend-${n}">${legHeaderHtml(n, leg)}</span></legend>` +
    `<div class="gmt-delivery-leg-grid">` +
    modeField +
    textField("duration", "duration", "Duration", leg.duration, false) +
    arrivesField +
    textField("departure", "departs", departureLabel, leg.departure, n !== 1) +
    textField("dwell", "dwell", "Dwell after", leg.dwellAfter, true) +
    `</div>` +
    `</fieldset>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. Seeded
 * when `args.legs`, `args.legCount` or `args.duration1` is defined, else the
 * first preset.
 */
export function renderDeliverySchedulerTemplate(
  args: DeliverySchedulerArgs = {},
): string {
  const seeded =
    args.legs !== undefined ||
    args.legCount !== undefined ||
    args.duration1 !== undefined;
  const state: DeliveryState = seeded
    ? readArgs(args)
    : (() => {
        const preset = DELIVERY_PRESETS[0]!;
        return readArgs({
          legs: preset.legs as never,
          startTimeZone: preset.startTimeZone || undefined,
        });
      })();
  const presetId = matchPreset(state);
  const preset = DELIVERY_PRESETS.find((p) => p.id === presetId);
  const count = Number.parseInt(state.legCount, 10) || 1;

  const legFieldsets = [1, 2, 3, 4]
    .map((n) => legFieldset(n, state, count))
    .join("");

  return (
    `<div class="gmt-delivery gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Build the journey</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label"><span>Legs</span>` +
    `<select class="gmt-select" data-role="leg-count">${[1, 2, 3, 4].map((n) => `<option value="${n}"${n === count ? " selected" : ""}>${n}</option>`).join("")}</select></label>` +
    `<label class="gmt-label gmt-label-wide"><span>Start zone${optionalSuffix()}</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="start-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.startTimeZone, "(none)")}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">For a published local first departure with no offset or zone of its own.</p>` +
    legFieldsets +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. The journey, handoff by handoff</h4>` +
    `<div class="gmt-delivery-summary" data-role="eta-summary">` +
    `<p class="gmt-delivery-summary-headline" data-role="eta-headline">&nbsp;</p>` +
    `<p class="gmt-transport-verdict" data-role="eta" aria-live="polite"></p>` +
    `<p class="gmt-delivery-summary-duration" data-role="eta-duration"></p>` +
    `<p class="gmt-delivery-summary-legs" data-role="eta-legs"></p>` +
    `<ul class="gmt-delivery-summary-flags" data-role="eta-flags"></ul>` +
    `</div>` +
    `<div class="gmt-chart-toggle not-content" role="group" aria-label="Chart view" data-role="chart-toggle">` +
    `<button type="button" class="gmt-chart-toggle__button" data-role="view-route" aria-pressed="true">Route</button>` +
    `<button type="button" class="gmt-chart-toggle__button" data-role="view-scale" aria-pressed="false">To scale</button>` +
    `</div>` +
    `<div class="gmt-delivery-charts" data-role="timeline" aria-labelledby="delivery-timeline-summary">` +
    `<div class="gmt-chart-view" data-gmt-chart-panel="route">` +
    `<div class="gmt-chart" data-gmt-chart="route" data-role="chart-route"></div>` +
    `</div>` +
    `<div class="gmt-chart-view" data-gmt-chart-panel="scale" hidden>` +
    `<div class="gmt-chart" data-gmt-chart="scale" data-role="chart-scale"></div>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-delivery-visually-hidden" id="delivery-timeline-summary" data-role="timeline-summary"></p>` +
    renderLegend() +
    `<ol class="gmt-delivery-itinerary" data-role="journey"></ol>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>scheduleDelivery</code> returns</h4>` +
    codeFrameHtml("delivery") +
    `<output class="gmt-widget-output" data-role="delivery-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function renderLegend(): string {
  return (
    `<ul class="gmt-delivery-legend" data-role="legend" aria-label="Legend">` +
    `<li><i class="gmt-delivery-swatch gmt-delivery-swatch--stop"></i>departure / arrival</li>` +
    `<li><i class="gmt-delivery-swatch gmt-delivery-swatch--handoff"></i>handoff</li>` +
    `<li><i class="gmt-delivery-swatch gmt-delivery-swatch--missed"></i>missed connection</li>` +
    `<li><i class="gmt-delivery-swatch gmt-delivery-swatch--dst"></i>DST / Date Line note</li>` +
    `</ul>`
  );
}

// ---------------------------------------------------------------------------
// The ETA summary card: the answer, first. Every value is `EtaSummary`'s own
// — this only lays it out.
// ---------------------------------------------------------------------------

function renderEtaSummary(root: HTMLElement, summary: EtaSummary | null): void {
  const card = root.querySelector<HTMLElement>('[data-role="eta-summary"]');
  if (!card) return;
  const byRole = <T extends HTMLElement>(role: string) =>
    card.querySelector(`[data-role="${role}"]`) as T | null;
  const headlineEl = byRole("eta-headline");
  const etaEl = byRole("eta");
  const durationEl = byRole("eta-duration");
  const legsEl = byRole("eta-legs");
  const flagsEl = byRole("eta-flags");
  if (!summary) {
    card.dataset.state = "";
    if (headlineEl) headlineEl.textContent = "";
    if (etaEl) etaEl.textContent = "";
    if (durationEl) durationEl.textContent = "";
    if (legsEl) legsEl.textContent = "";
    if (flagsEl) flagsEl.innerHTML = "";
    return;
  }

  card.dataset.state = summary.status;

  if (headlineEl) {
    headlineEl.textContent =
      summary.status === "ok"
        ? (summary.etaLocal ?? "")
        : `${summary.failureLeg !== undefined ? `Leg ${summary.failureLeg}: ` : ""}${summary.failureHeadline ?? "No ETA"}`;
  }
  if (etaEl) {
    etaEl.textContent =
      summary.status === "ok"
        ? `ETA ${summary.etaIso ?? ""}`
        : "No ETA — see the reason below.";
  }
  if (durationEl) durationEl.textContent = summary.doorToDoor ?? "—";
  if (legsEl) {
    legsEl.textContent = `${summary.legCount} leg${summary.legCount === 1 ? "" : "s"}`;
  }
  if (flagsEl) {
    flagsEl.innerHTML = summary.flags
      .map((f) => `<li class="gmt-transport-badge">${escapeHtml(f)}</li>`)
      .join("");
  }
}

// ---------------------------------------------------------------------------
// Shared badge helpers — the ETA card and the itinerary both use
// `.gmt-transport-badge` plus at most one modifier; never a bespoke chip
// style of its own. The charts' own tooltip rows are plain text, not HTML,
// so they need no class helper here.
// ---------------------------------------------------------------------------

const ETA_BADGE = `<span class="gmt-transport-badge gmt-transport-badge--accent">ETA</span>`;

// ---------------------------------------------------------------------------
// The itinerary: date-grouped events, one per row.
// ---------------------------------------------------------------------------

function eventLine(ev: ItineraryEvent): string {
  const icon =
    ev.kind === "dst"
      ? ""
      : transportIcon(ev.mode ?? "", { className: "gmt-delivery-event-icon" });
  const legLabel = ev.legIndex !== undefined ? `Leg ${ev.legIndex + 1}` : "";
  let headline: string;
  let detail = "";

  switch (ev.kind) {
    case "departure":
      headline = `${legLabel}${ev.mode ? `, ${escapeHtml(ev.mode)}` : ""} departs`;
      break;
    case "arrival": {
      const etaTag = ev.isEta ? ETA_BADGE : "";
      headline = `${legLabel} arrives${etaTag}`;
      if (ev.offsetCheck) {
        const badgeClass = ev.offsetCheck.agrees
          ? "gmt-transport-badge"
          : "gmt-transport-badge gmt-transport-badge--disagrees";
        detail =
          `<span class="${badgeClass}">${escapeHtml(ev.offsetCheck.badge)}</span>` +
          (ev.offsetCheck.naiveTime
            ? `<span class="gmt-delivery-naive">offset table: ${escapeHtml(ev.offsetCheck.naiveTime)}</span>`
            : "");
      }
      break;
    }
    case "handoff": {
      const dwellText = `Ready after ${escapeHtml(ev.dwell ?? "PT0S")} handling`;
      const tailText =
        ev.tail === "missed"
          ? escapeHtml(ev.missedText ?? "Missed connection.")
          : ev.tail === "waits"
            ? escapeHtml(ev.waitText ?? "")
            : "the next leg leaves now";
      headline = `${dwellText} — ${tailText}`;
      break;
    }
    case "dst":
      headline = escapeHtml(ev.note ?? "");
      break;
  }

  const missedClass = ev.tail === "missed" ? " gmt-delivery-event--missed" : "";
  const legAttr = ev.legIndex !== undefined ? legAccentAttr(ev.legIndex) : "";

  if (ev.kind === "dst") {
    // Its own small marker on the rail (never a full stop, never floating
    // off it) so a DST / Date Line note reads as an annotation on the same
    // line the journey's other stops sit on, not a separate aside.
    return (
      `<li class="gmt-delivery-event gmt-delivery-event--dst" data-role="event">` +
      `<span class="gmt-delivery-rail-dot gmt-delivery-rail-dot--dst" aria-hidden="true"></span>` +
      `<p class="gmt-delivery-event-headline">${headline}</p>` +
      `</li>`
    );
  }

  // A rail dot per stop: a solid dot for a departure/arrival, a hollow one
  // (same size) for a handoff — the rail itself (drawn in CSS, one leg
  // colour per event) is solid for a leg's own stops and dashed for its
  // handoff. The mode icon sits inline with the time, on the same line.
  return (
    `<li class="gmt-delivery-event gmt-delivery-event--${ev.kind}${missedClass}" data-role="event"${legAttr}>` +
    `<span class="gmt-delivery-rail-dot gmt-delivery-rail-dot--${ev.kind}" aria-hidden="true"></span>` +
    `<div class="gmt-delivery-event-body">` +
    `<p class="gmt-delivery-event-headline">${icon}<strong>${escapeHtml(ev.time)}</strong> ${escapeHtml(ev.city)} <span class="gmt-delivery-offset">(${escapeHtml(ev.offset)})</span> — ${headline}${detail}</p>` +
    `<p class="gmt-delivery-event-iso">${escapeHtml(ev.isoText)}</p>` +
    `</div>` +
    `</li>`
  );
}

function renderItinerary(
  el: HTMLElement | null,
  itinerary: Itinerary | null,
): void {
  if (!el) return;
  if (!itinerary || itinerary.groups.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = itinerary.groups
    .map((g) => {
      const anomaly = g.anomaly
        ? `<p class="gmt-delivery-day-anomaly">${escapeHtml(g.anomaly)}</p>`
        : "";
      return (
        `<li class="gmt-delivery-day">` +
        `<h5 class="gmt-delivery-day-heading">${escapeHtml(g.heading)}</h5>` +
        anomaly +
        `<ol class="gmt-delivery-events">${g.events.map(eventLine).join("")}</ol>` +
        `</li>`
      );
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: TransportLib): () => void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const legCountEl = q<HTMLSelectElement>("leg-count");
  const startZoneEl = q<HTMLSelectElement>("start-zone");
  if (!presetEl || !legCountEl || !startZoneEl) return () => {};

  let routeChartHost: ReturnType<typeof mountChart> | null = null;
  let scaleChartHost: ReturnType<typeof mountChart> | null = null;

  /** Narrow container: drop the chart's own city/date/badge text, keep the
   *  time and the segment's duration, and rely on the tooltip (focus or
   *  hover) for the rest — real text at 12px cannot fit both a station's
   *  full detail and four legs' worth of segments in ~350px. */
  function isCompact(): boolean {
    return root.clientWidth < 640;
  }

  function renderCharts(
    chartData: ChartData | null,
    ariaLabel: string,
    axisZone: string,
  ): void {
    const routeHost = q<HTMLElement>("chart-route");
    const scaleHost = q<HTMLElement>("chart-scale");
    if (!routeHost || !scaleHost) return;
    if (!chartData) {
      routeChartHost?.destroy();
      scaleChartHost?.destroy();
      routeChartHost = null;
      scaleChartHost = null;
      routeHost.replaceChildren();
      scaleHost.replaceChildren();
      return;
    }
    const compact = isCompact();
    const routeDefinition = buildRouteChartDefinition(chartData, {
      tooltip,
      compact,
    });
    const scaleDefinition = buildScaleChartDefinition(chartData, {
      tooltip,
      axisZone,
      plotWidthPx: scaleHost.clientWidth || root.clientWidth,
    });
    // A one-row schematic needs far less height than a Gantt: the margin
    // in `buildRouteChartDefinition` already reserves exactly the room its
    // own labels rise/fall into, so the aspect ratio only has to fit that,
    // not a generic landscape shape.
    const routeAspectRatio = compact ? 1.5 : 3.5;
    if (routeChartHost) {
      routeChartHost.update({
        definition: routeDefinition as never,
        ariaLabel,
        aspectRatio: routeAspectRatio,
      });
    } else {
      routeChartHost = mountChart(routeHost, {
        definition: routeDefinition as never,
        ariaLabel,
        aspectRatio: routeAspectRatio,
      });
    }
    // Content-sized, not an aspect ratio: a fixed height per lane, so a
    // 3-leg journey is the same ~150-180px tall at 1440px and at 390px —
    // width is free to shrink, height never grows or shrinks with it.
    const scaleHeight = laneChartHeight(chartData.legs.length);
    if (scaleChartHost) {
      scaleChartHost.update({
        definition: scaleDefinition as never,
        ariaLabel: `${ariaLabel} — to scale`,
        height: scaleHeight,
      });
    } else {
      scaleChartHost = mountChart(scaleHost, {
        definition: scaleDefinition as never,
        ariaLabel: `${ariaLabel} — to scale`,
        height: scaleHeight,
      });
    }
  }

  const legEl = (n: number, field: string) =>
    q<HTMLInputElement | HTMLSelectElement>(`${field}-${n}`);

  function readState(): DeliveryState {
    const legs = [1, 2, 3, 4].map((n) => ({
      departure: legEl(n, "departure")?.value.trim() ?? "",
      duration: legEl(n, "duration")?.value.trim() ?? "",
      timeZone: legEl(n, "zone")?.value.trim() ?? "",
      dwellAfter: legEl(n, "dwell")?.value.trim() ?? "",
      mode: legEl(n, "mode")?.value.trim() ?? "",
    })) as DeliveryState["legs"];
    return {
      legCount: legCountEl!.value,
      startTimeZone: startZoneEl!.value,
      legs,
    };
  }

  function showFieldsets(count: number): void {
    for (let n = 1; n <= MAX_LEGS; n++) {
      const fs = q<HTMLElement>(`leg-${n}`);
      if (fs) fs.hidden = n > count;
    }
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(readState());
    const preset = DELIVERY_PRESETS.find((p) => p.id === presetEl!.value);
    const desc = q("preset-description");
    if (desc) desc.textContent = preset?.description ?? "";
  }

  function refreshLegends(): void {
    for (let n = 1; n <= MAX_LEGS; n++) {
      const legendEl = q<HTMLElement>(`leg-legend-${n}`);
      if (!legendEl) continue;
      legendEl.innerHTML = legHeaderHtml(n, {
        mode: legEl(n, "mode")?.value ?? "",
        duration: legEl(n, "duration")?.value ?? "",
        timeZone: legEl(n, "zone")?.value ?? "",
      });
    }
  }

  function render(): void {
    refreshLegends();

    const state = readState();
    const count = Number.parseInt(state.legCount, 10) || 1;
    const legs = legsOf(state);
    const options = optionsOf(state);
    const result = lib.scheduleDelivery(legs, options);

    const [callHtml, callPlain] = scheduleCallSource(legs, options);
    renderCallLine(q("call-delivery"), "scheduleDelivery", callHtml, callPlain);

    const out = q("delivery-output");
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatSchedule(result), "live");
    }

    const facts: JourneyFacts = collectJourneyFacts(legs, options, lib);
    const originZone = originZoneOf(state);
    const itinerary = buildItinerary(facts, legs, originZone, lib);
    const chartData = buildChartData(facts, legs, originZone, lib);
    const etaSummary = buildEtaSummary(facts, legs, chartData);
    renderEtaSummary(root, etaSummary);
    const summary = itinerary?.summary ?? "";
    const axisZone = originZone ?? legs[0]?.timeZone ?? "UTC";
    renderCharts(chartData, summary || "Delivery schedule", axisZone);
    const summaryEl = q("timeline-summary");
    if (summaryEl) summaryEl.textContent = summary;

    renderItinerary(q("journey"), itinerary);

    const aside = q("reason-aside");
    if (aside) {
      if (facts.failure) {
        const n = facts.failure.leg + 1;
        let text: string;
        if (facts.failure.reason === "missed-connection") {
          const k = facts.failure.leg;
          const dep = facts.departures[k];
          const arr = facts.arrivals[k - 1];
          const dwell = legs[k - 1]?.dwellAfter ?? "PT0S";
          const ready = facts.readies[k - 1];
          text =
            dep && arr && ready
              ? scheduleNullText("missed-connection", n, {
                  dep: lib.etaAtZone(dep, legs[k - 1]!.timeZone),
                  arr: lib.etaAtZone(arr, legs[k - 1]!.timeZone),
                  dwell,
                  ready: lib.etaAtZone(ready, legs[k - 1]!.timeZone),
                })
              : scheduleNullText("missed-connection", n);
        } else {
          text = scheduleNullText(facts.failure.reason, n);
        }
        renderAside(aside, "caution", "Why null", `<p>${escapeHtml(text)}</p>`);
      } else {
        aside.innerHTML = "";
      }
    }

    void count;
  }

  function applyPreset(): void {
    const preset = DELIVERY_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    legCountEl!.value = String(preset.legs.length);
    startZoneEl!.value = preset.startTimeZone;
    for (let n = 1; n <= MAX_LEGS; n++) {
      const leg = preset.legs[n - 1] ?? {
        departure: "",
        duration: "",
        timeZone: "",
        dwellAfter: "",
        mode: "",
      };
      const dep = legEl(n, "departure") as HTMLInputElement | null;
      const dur = legEl(n, "duration") as HTMLInputElement | null;
      const zone = legEl(n, "zone") as HTMLSelectElement | null;
      const dwell = legEl(n, "dwell") as HTMLInputElement | null;
      const mode = legEl(n, "mode") as HTMLSelectElement | null;
      if (dep) dep.value = leg.departure;
      if (dur) dur.value = leg.duration;
      if (zone) zone.value = leg.timeZone;
      if (dwell) dwell.value = leg.dwellAfter;
      setModeSelect(mode, leg.mode);
    }
    showFieldsets(preset.legs.length);
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      !target.matches(
        '[data-role^="departure-"],[data-role^="duration-"],[data-role^="dwell-"]',
      )
    ) {
      return;
    }
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === legCountEl) {
      showFieldsets(Number.parseInt(legCountEl!.value, 10) || 1);
      syncPreset();
      render();
      return;
    }
    if (
      target === startZoneEl ||
      target.matches('[data-role^="zone-"],[data-role^="mode-"]')
    ) {
      syncPreset();
      render();
    }
  });

  // The view toggle: two ordinary buttons (aria-pressed), root-delegated so
  // it survives whatever the widget's own render() replaces elsewhere.
  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(
      '[data-role="view-route"],[data-role="view-scale"]',
    );
    if (!button) return;
    const showRoute = button.dataset.role === "view-route";
    const routeBtn = q<HTMLButtonElement>("view-route");
    const scaleBtn = q<HTMLButtonElement>("view-scale");
    routeBtn?.setAttribute("aria-pressed", showRoute ? "true" : "false");
    scaleBtn?.setAttribute("aria-pressed", showRoute ? "false" : "true");
    const routePanel = q<HTMLElement>("chart-route")?.closest<HTMLElement>(
      "[data-gmt-chart-panel]",
    );
    const scalePanel = q<HTMLElement>("chart-scale")?.closest<HTMLElement>(
      "[data-gmt-chart-panel]",
    );
    if (routePanel) routePanel.hidden = !showRoute;
    if (scalePanel) scalePanel.hidden = showRoute;
  });

  // A chart's own marks are a fixed count once built; only the layout
  // changes with width, so a breakpoint crossing (not every resize) is
  // what needs a redefinition (`compact` drops text marks that would
  // otherwise collide at 390px).
  let wasCompact = isCompact();
  const resizeObserver = new ResizeObserver(() => {
    const nowCompact = isCompact();
    if (nowCompact !== wasCompact) {
      wasCompact = nowCompact;
      render();
    }
  });
  resizeObserver.observe(root);

  // The chart's own colours resolve once, at mount/update time, from
  // `var(--gmt-*)` — a genuine re-render, not a live CSS re-cascade,
  // because the bar-label ink is a *computed* colour, not itself a
  // variable. A dark/light toggle changes `data-theme` on `<html>`, so a
  // full re-render is what actually picks the new leg colours back up.
  const themeObserver = new MutationObserver(() => render());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  wireCopyButtons(root);
  showFieldsets(Number.parseInt(legCountEl.value, 10) || 1);
  render();

  return () => {
    resizeObserver.disconnect();
    themeObserver.disconnect();
    routeChartHost?.destroy();
    scaleChartHost?.destroy();
  };
}

/** Write seeded arguments onto the controls, including hiding fieldsets past
 *  the seeded leg count. */
function applyArgs(root: HTMLElement, args: DeliverySchedulerArgs): void {
  const seeded =
    args.legs !== undefined ||
    args.legCount !== undefined ||
    args.duration1 !== undefined;
  if (!seeded) return;
  const state = readArgs(args);
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const count = Number.parseInt(state.legCount, 10) || 1;
  const legCountEl = q<HTMLSelectElement>("leg-count");
  if (legCountEl) legCountEl.value = String(count);
  const startZoneEl = q<HTMLSelectElement>("start-zone");
  if (startZoneEl) startZoneEl.value = state.startTimeZone;
  for (let n = 1; n <= MAX_LEGS; n++) {
    const leg = state.legs[n - 1]!;
    const set = (field: string, value: string) => {
      const el = q<HTMLInputElement | HTMLSelectElement>(`${field}-${n}`);
      if (el) el.value = value;
    };
    set("departure", leg.departure);
    set("duration", leg.duration);
    set("zone", leg.timeZone);
    set("dwell", leg.dwellAfter);
    setModeSelect(q<HTMLSelectElement>(`mode-${n}`), leg.mode);
    const fs = q<HTMLElement>(`leg-${n}`);
    if (fs) fs.hidden = n > count;
  }
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(state);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        DELIVERY_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

export const mountDeliveryScheduler: MountFn<DeliverySchedulerArgs> = async (
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
  const teardown = setupWidget(root, lib);

  return onceDestroy(teardown, () => {
    const q = <T extends HTMLElement>(role: string) =>
      root.querySelector(`[data-role="${role}"]`) as T | null;
    const legCountEl = q<HTMLSelectElement>("leg-count");
    const startZoneEl = q<HTMLSelectElement>("start-zone");
    if (!legCountEl || !startZoneEl) return null;
    const legs = [1, 2, 3, 4].map((n) => ({
      departure: q<HTMLInputElement>(`departure-${n}`)?.value ?? "",
      duration: q<HTMLInputElement>(`duration-${n}`)?.value ?? "",
      timeZone: q<HTMLSelectElement>(`zone-${n}`)?.value ?? "",
      dwellAfter: q<HTMLInputElement>(`dwell-${n}`)?.value ?? "",
      mode: q<HTMLSelectElement>(`mode-${n}`)?.value ?? "",
    })) as DeliveryState["legs"];
    const state: DeliveryState = {
      legCount: legCountEl.value,
      startTimeZone: startZoneEl.value,
      legs,
    };
    return permalinkOf(state);
  });
};
