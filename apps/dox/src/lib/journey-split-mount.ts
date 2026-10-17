/**
 * The Journey Split widget (INT-14), mountable on its tool page and in the chat
 * rail.
 *
 * A multi-leg journey's hours, sorted two ways on one scale: "as it happens",
 * the legs in order with each wait where it falls, and "gathered", the same
 * segments pushed together with the moving time at the left and the waiting
 * time at the right. Three plates say the ETA, the moving time and the waiting
 * time. A table under the ribbons lists each hand-off, and a link opens the
 * same legs in the Delivery Scheduler, which draws the legs themselves.
 *
 * The mount never computes a time. Every instant comes from
 * `collectJourneyFacts`, every total from `multimodalETA`, and every wait from
 * `diffUtcAsDuration` (`readJourney`, journey-split.ts). The ribbons only place
 * what those calls returned.
 *
 * On screen the stated `dwellAfter` is "handling" and the time at a hand-off is
 * "waiting". The printed call keeps the library's keys.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`, and the
 * ledger family's wiring: every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from the width observer.
 * There is no drag handle: the tool is a form and presets, and the plates, the
 * frame, the ribbons and the table keep their boxes from one preset to the next.
 */
import { codeFrameHtml } from "./code-frame";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { MAX_LEGS, type DeliveryState } from "./delivery-scheduler";
import {
  CUSTOM_PRESET_ID,
  JOURNEY_PRESETS,
  NO_HANDOFF_TEXT,
  NO_JOURNEY_TEXT,
  TABLE_COLUMNS,
  axisTicks,
  bracketTexts,
  hopCells,
  isSeeded,
  journeyPlates,
  layoutRibbons,
  legSeries,
  matchPreset,
  nudgeBadges,
  clampChip,
  permalinkOf,
  presetState,
  readArgs,
  readJourney,
  ribbonsAria,
  summaryText,
  waitChipText,
  type JourneyRead,
  type JourneySplitArgs,
  type Placed,
} from "./journey-split";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import { legFieldset, legHeaderHtml, setModeSelect } from "./leg-form";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { loadJourneyLib, type JourneyLib } from "./transport-lib";
import { TRANSPORT_ZONES, zoneOptionsHtml } from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { JourneySplitArgs } from "./journey-split";

/** The number of hand-offs the table reserves: one fewer than the most legs. */
const TABLE_ROWS = MAX_LEGS - 1;

/** The width of a number badge, for the placer (px). It matches `.gmt-js-badge`. */
const BADGE_PX = 24;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    JOURNEY_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** The Delivery Scheduler's address for these legs: the same flat leg keys under the other kind. */
function deliveryHref(state: DeliveryState): string {
  return encodeWidgetPermalink("delivery", permalinkOf(state));
}

/** A table row that holds a hand-off's box and shows nothing. */
function blankRowHtml(): string {
  return (
    `<tr role="row" class="gmt-js-row gmt-js-row--blank" aria-hidden="true">` +
    TABLE_COLUMNS.map(
      (c) => `<td role="cell" data-label="${escapeAttr(c)}">&nbsp;</td>`,
    ).join("") +
    `</tr>`
  );
}

function rowHtml(read: JourneyRead, index: number): string {
  const hop = read.hops[index];
  if (!hop) return blankRowHtml();
  const cells = hopCells(hop);
  return (
    `<tr role="row" class="gmt-js-row" data-role="hop" data-hop="${hop.after}">` +
    TABLE_COLUMNS.map(
      (c, i) =>
        `<td role="cell" data-label="${escapeAttr(c)}">${escapeHtml(cells[i]!)}</td>`,
    ).join("") +
    `</tr>`
  );
}

const pct = (value: number, span: number): number =>
  Math.round((value / span) * 1_000_000) / 10_000;

function segmentHtml(s: Placed, span: number): string {
  const moving = s.kind === "moving";
  return (
    `<div class="gmt-js-seg${moving ? "" : " gmt-punct-hatch"}"` +
    ` data-kind="${s.kind}" data-leg="${s.leg}" data-ms="${s.toMs - s.fromMs}"` +
    (moving ? ` data-series="${legSeries(s.leg)}"` : "") +
    ` style="left:${pct(s.fromMs, span)}%;width:${pct(s.toMs - s.fromMs, span)}%"></div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the ribbons, the table and the
 * outputs are drawn by `mount`, because they come from the real library calls.
 */
export function renderJourneySplitTemplate(
  args: JourneySplitArgs = {},
): string {
  const state: DeliveryState = isSeeded(args)
    ? readArgs(args)
    : presetState(JOURNEY_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = JOURNEY_PRESETS.find((p) => p.id === presetId);
  const count = Number.parseInt(state.legCount, 10) || 1;

  return (
    `<div class="gmt-journey-split gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The legs
    `<div class="gmt-widget-section">` +
    `<h4>1. Set the legs</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      JOURNEY_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Legs")}` +
    `<select class="gmt-select" data-role="leg-count">${[1, 2, 3, 4].map((n) => `<option value="${n}"${n === count ? " selected" : ""}>${n}</option>`).join("")}</select></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Start zone", { optional: true })}` +
    `<select class="gmt-select" data-role="start-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.startTimeZone, "(none)")}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">For a published local first departure with no offset or zone of its own.</p>` +
    `<p class="gmt-widget-hint">Durations are ISO 8601: PT46H is 46 hours, PT2H30M is two and a half hours, P11D is 11 days. Handling after is the time the cargo needs at the hand-off before the next leg may leave.</p>` +
    [1, 2, 3, 4].map((n) => legFieldset(n, state, count)).join("") +
    `</div>` +
    // 2. Moving and waiting
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Moving and waiting</h4>` +
    `<div class="gmt-ledger-frame" data-role="frame">` +
    platesHtml("heroes", journeyPlates(null)) +
    `<div class="gmt-ledger-lane gmt-js-lane" data-lane="happens">` +
    `<span class="gmt-ledger-lane-label">As it happens</span>` +
    `<div class="gmt-ledger-lane-track gmt-js-track" data-role="track-happens" role="img">` +
    `<div class="gmt-js-badges" data-role="badges" aria-hidden="true"></div>` +
    `<div class="gmt-js-bars" data-role="bars-happens" aria-hidden="true"></div>` +
    `<div class="gmt-js-notes" data-role="notes" aria-hidden="true"></div>` +
    `<p class="gmt-js-empty" data-role="empty-happens" aria-hidden="true" hidden></p>` +
    `</div></div>` +
    `<div class="gmt-ledger-lane gmt-js-lane" data-lane="gathered">` +
    `<span class="gmt-ledger-lane-label">Gathered</span>` +
    `<div class="gmt-ledger-lane-track gmt-js-track" data-role="track-gathered" role="img">` +
    `<div class="gmt-js-bars" data-role="bars-gathered" aria-hidden="true"></div>` +
    `<div class="gmt-js-brackets" data-role="brackets" aria-hidden="true"></div>` +
    `<p class="gmt-js-empty" data-role="empty-gathered" aria-hidden="true" hidden></p>` +
    `</div></div>` +
    `<div class="gmt-ledger-axis gmt-js-axis" data-role="axis" aria-hidden="true"></div>` +
    `<ul class="gmt-ledger-legend" aria-label="Legend">` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch" data-state="lit" data-series="1" aria-hidden="true"></i>moving, one colour for each leg</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch gmt-js-swatch gmt-punct-hatch" aria-hidden="true"></i>handling</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch gmt-js-swatch gmt-js-swatch--dense gmt-punct-hatch" aria-hidden="true"></i>waiting for the scheduled departure</li>` +
    `</ul>` +
    `</div>` +
    `<p class="gmt-ledger-sr" data-role="summary" aria-live="polite"></p>` +
    `<div class="gmt-js-table-wrap" data-role="table-wrap">` +
    `<table class="gmt-js-table" data-role="table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${TABLE_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody data-role="table-body" role="rowgroup">${Array.from({ length: TABLE_ROWS }, blankRowHtml).join("")}</tbody>` +
    `</table>` +
    `<p class="gmt-js-empty gmt-js-empty--table" data-role="empty-table" hidden></p>` +
    `</div>` +
    `<div class="gmt-widget-controls"><a class="gmt-button gmt-button--pad" data-role="handoff" href="${escapeAttr(deliveryHref(state))}">Open these legs in the Delivery Scheduler</a></div>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    // 3. What multimodalETA returns
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>multimodalETA</code> returns</h4>` +
    codeFrameHtml("journey") +
    `<output class="gmt-widget-output" data-role="journey-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DeliveryState;
  apply(state: DeliveryState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: JourneyLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const legCountEl = q<HTMLSelectElement>("leg-count")!;
  const startZoneEl = q<HTMLSelectElement>("start-zone")!;
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
      legCount: legCountEl.value,
      startTimeZone: startZoneEl.value,
      legs,
    };
  }

  function showFieldsets(count: number): void {
    for (let n = 1; n <= MAX_LEGS; n++) {
      const fs = q<HTMLElement>(`leg-${n}`);
      if (fs) fs.hidden = n > count;
    }
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

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        JOURNEY_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** Show or clear the words a ribbon or the table says when it has nothing to draw. */
  function setEmpty(role: string, text: string): void {
    const el = q(role);
    if (!el) return;
    el.hidden = text === "";
    el.textContent = text;
  }

  function drawRibbons(read: JourneyRead): void {
    const ribbons = layoutRibbons(read.segments);
    const drawn = read.journey !== null && ribbons.spanMs > 0;
    const span = Math.max(1, ribbons.spanMs);
    const bars = (role: string, segments: readonly Placed[]) => {
      const el = q(role);
      if (el)
        el.innerHTML = drawn
          ? segments.map((s) => segmentHtml(s, span)).join("")
          : "";
    };
    bars("bars-happens", ribbons.happens);
    bars("bars-gathered", ribbons.gathered);

    // Number badges over the moving stems; the fit pass keeps them apart.
    const badges = q("badges");
    if (badges) {
      badges.innerHTML = drawn
        ? ribbons.happens
            .filter((s) => s.kind === "moving")
            .map((s) => {
              const center = pct((s.fromMs + s.toMs) / 2, span);
              return (
                `<span class="gmt-js-badge" data-series="${legSeries(s.leg)}" data-center="${center}"` +
                ` style="left:calc(${center}% - ${BADGE_PX / 2}px)">${s.leg}</span>`
              );
            })
            .join("")
        : "";
    }

    // A chip under each wait, one row for each hand-off, with a leader up to the wait.
    const notes = q("notes");
    if (notes) {
      notes.innerHTML = drawn
        ? read.hops
            .map((hop, i) => {
              const mid = ribbons.happens.filter(
                (s) => s.kind !== "moving" && s.leg === hop.after,
              );
              const from = Math.min(...mid.map((s) => s.fromMs));
              const to = Math.max(...mid.map((s) => s.toMs));
              const center = pct((from + to) / 2, span);
              return (
                `<i class="gmt-js-leader" style="left:${center}%;--row:${i}"></i>` +
                `<span class="gmt-cutoff-chip gmt-js-note" data-hop="${hop.after}" data-center="${center}"` +
                ` style="left:${center}%;--row:${i}">${escapeHtml(waitChipText(hop))}</span>`
              );
            })
            .join("")
        : "";
    }

    // Two brackets under the gathered ribbon, with the totals as returned.
    const brackets = q("brackets");
    if (brackets) {
      if (drawn && read.journey !== null) {
        const moving = ribbons.gathered.filter((s) => s.kind === "moving");
        const movingEnd = Math.max(...moving.map((s) => s.toMs));
        const texts = bracketTexts(read.journey);
        brackets.innerHTML =
          `<div class="gmt-js-bracket" data-side="moving" style="left:0;width:${pct(movingEnd, span)}%"></div>` +
          `<div class="gmt-js-bracket" data-side="waiting" style="left:${pct(movingEnd, span)}%;width:${pct(ribbons.spanMs - movingEnd, span)}%"></div>` +
          `<div class="gmt-js-bracket-chips">` +
          `<span class="gmt-cutoff-chip gmt-js-bracket-chip" data-side="moving">${escapeHtml(texts.moving)}</span>` +
          `<span class="gmt-cutoff-chip gmt-js-bracket-chip" data-side="waiting">${escapeHtml(texts.waiting)}</span>` +
          `</div>`;
      } else {
        brackets.innerHTML = "";
      }
    }

    // The scale: elapsed time from the first departure.
    const axis = q("axis");
    if (axis) {
      axis.innerHTML = drawn
        ? axisTicks(ribbons.spanMs)
            .map(
              (t) =>
                `<span class="gmt-js-tick" style="left:${pct(t.ms, span)}%">${escapeHtml(t.label)}</span>`,
            )
            .join("")
        : "";
    }

    const words = drawn ? "" : NO_JOURNEY_TEXT;
    setEmpty("empty-happens", words);
    setEmpty("empty-gathered", words);
    for (const role of ["track-happens", "track-gathered"]) {
      q(role)?.setAttribute("aria-label", ribbonsAria(read));
    }
  }

  function drawTable(read: JourneyRead): void {
    const body = q("table-body");
    if (!body) return;
    body.innerHTML = Array.from({ length: TABLE_ROWS }, (_, i) =>
      rowHtml(read, i),
    ).join("");
    setEmpty(
      "empty-table",
      read.journey === null
        ? NO_JOURNEY_TEXT
        : read.hops.length === 0
          ? NO_HANDOFF_TEXT
          : "",
    );
  }

  /**
   * The passes that need layout: badges kept apart, chips kept inside the
   * track, and axis labels thinned. Jsdom and a hidden widget have no width,
   * so they keep the percentages the markup carries.
   */
  function fit(): void {
    const track = q<HTMLElement>("bars-happens");
    const trackPx = track ? layoutWidth(track) : 0;
    if (trackPx > 0) {
      const badges = [...root.querySelectorAll<HTMLElement>(".gmt-js-badge")];
      const centers = badges.map(
        (b) => (Number(b.dataset["center"] ?? 0) / 100) * trackPx,
      );
      nudgeBadges(centers, BADGE_PX, trackPx).forEach((left, i) => {
        badges[i]!.style.left = `${left}px`;
      });
      for (const chip of root.querySelectorAll<HTMLElement>(".gmt-js-note")) {
        const center = (Number(chip.dataset["center"] ?? 0) / 100) * trackPx;
        chip.style.left = `${clampChip(center, layoutWidth(chip), trackPx)}px`;
        chip.style.translate = "none";
      }
    }
    const axis = q<HTMLElement>("axis");
    if (axis) thinTickLabels(axis, ".gmt-js-tick");
  }

  function render(): void {
    refreshLegends();
    const state = readState();
    const read = readJourney(state, lib);

    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = journeyPlates(read).map(plateHtml).join("");

    drawRibbons(read);
    drawTable(read);
    fit();

    // The calls made, and what they returned.
    renderCalls(q("call-journey"), read.calls);
    const out = q("journey-output");
    if (out) {
      if (read.journey === null) {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else {
        renderWidgetOutput(out, callResultsText(read.calls), "live");
      }
    }

    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read);
    const aside = q("reason-aside");
    if (aside) {
      if (read.journey === null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.failure ?? "")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    const link = q<HTMLAnchorElement>("handoff");
    if (link) link.setAttribute("href", deliveryHref(state));
  }

  function apply(state: DeliveryState): void {
    const count = Number.parseInt(state.legCount, 10) || 1;
    setControlValue(legCountEl, String(count));
    setControlValue(startZoneEl, state.startTimeZone);
    for (let n = 1; n <= MAX_LEGS; n++) {
      const leg = state.legs[n - 1]!;
      const set = (field: string, value: string) =>
        setControlValue(legEl(n, field), value);
      set("departure", leg.departure);
      set("duration", leg.duration);
      set("zone", leg.timeZone);
      set("dwell", leg.dwellAfter);
      setModeSelect(q<HTMLSelectElement>(`mode-${n}`), leg.mode);
    }
    showFieldsets(count);
  }

  function applyPreset(): void {
    const preset = JOURNEY_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!/^(departure|duration|dwell)-\d$/.test(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    const role = target.dataset?.["role"] ?? "";
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === legCountEl) {
      showFieldsets(Number.parseInt(legCountEl.value, 10) || 1);
      syncPreset();
      render();
      return;
    }
    if (target === startZoneEl || /^(zone|mode)-\d$/.test(role)) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);

  // The fit passes read the track's measured width, so a width change
  // (rotation, the chat rail opening) fits the badges and chips again.
  const trackEl = q<HTMLElement>("bars-happens");
  const disposeWidth = trackEl ? onWidthChange(trackEl, fit) : () => {};

  showFieldsets(Number.parseInt(legCountEl.value, 10) || 1);
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: disposeWidth };
}

export const mountJourneySplit: MountFn<JourneySplitArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: JourneyLib;
  try {
    lib = await loadJourneyLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
