/**
 * DOX-C3b (#139) — the DST transition inspector, mountable.
 *
 * The last and hardest of the three Tier 2 extractions, and the one the story's
 * motivating example needs: *"what happens to 1:30am on November 3rd in New
 * York"* is this widget.
 *
 * ## The scrub state, and why React never touches it
 *
 * `setupWidget` deliberately holds `activeTransition`, `tickerWindow`,
 * `handleMinuteOfDay` and `dragging` outside `render()`, so an unrelated
 * re-render cannot reset a drag in progress. That was flagged as the piece most
 * likely to break silently under React.
 *
 * It does not break, and not by luck: the mount contract puts this DOM outside
 * React entirely. `MountedWidget` renders an empty host, writes
 * `renderTemplate()` into it, and never renders inside it again — so there is no
 * React re-render for closure state to be lost across. The risk is removed
 * structurally rather than managed.
 *
 * ## Teardown
 *
 * Listeners are all bound inside the container and go when the host drops the
 * subtree. The one thing that outlives it is a pointer capture held mid-drag,
 * which `destroy()` releases explicitly — otherwise the browser keeps routing
 * pointer events to a detached node.
 */
import { codeFrameHtml } from "./code-frame";
import { CURATED_TIMEZONES } from "./curated-timezones";
import { onceDestroy, type MountFn } from "./widget-mount";
import {
  VALUE_PRESETS,
  buildValuePreset,
  buildZonedValueFromMinutes,
  classifyProbeResult,
  formatMinuteOfDay,
  getTickerTickStepMinutes,
  getTickerWindow,
  isGap,
  isMinuteInZone,
  isOverlap,
  localDateAtTransition,
  localMinuteOfDayAtTransition,
  minuteToTickerPercent,
  tickerPercentToMinute,
  transitionType,
  type DstTransition,
  type ProbeClassification,
  type TickerWindow,
  type ValuePreset,
} from "./dst-inspector";
import { GMT_MODULES } from "./gmt-modules";
import { renderResult } from "./playground-client";
import {
  codeSpan,
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  wireCopyButtons,
} from "./widget-ui";

const DEFAULT_ZONE = "America/New_York";
const DEFAULT_YEAR = 2024;
const DISOPTIONS = ["compatible", "earlier", "later", "reject"] as const;
const OFFSETOPTIONS = ["prefer", "use", "ignore", "reject"] as const;
const UNITOPTIONS = ["hour", "day"] as const;

export interface DstArgs {
  zone?: string;
  year?: number;
  preset?: string;
  disambiguation?: string;
  offset?: string;
}

/** Astro renders `selected={true}` as a bare attribute and `false` as nothing. */
function options(values: readonly string[], selected: string): string {
  return values
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`,
    )
    .join("");
}

export function renderDstTemplate(args: DstArgs = {}): string {
  const zone = args.zone ?? DEFAULT_ZONE;
  const year = args.year ?? DEFAULT_YEAR;
  const preset = args.preset ?? "gap";
  const dis = args.disambiguation ?? "compatible";
  const off = args.offset ?? "ignore";

  /* A seeded zone outside the curated twenty is appended rather than replacing
     the list, so the reader can still pick anything the page normally offers
     after Dox seeds an unusual one. */
  const zones = CURATED_TIMEZONES.includes(
    zone as (typeof CURATED_TIMEZONES)[number],
  )
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, zone];

  const presetOptions = VALUE_PRESETS.map(
    (p) =>
      `<option value="${escapeAttr(p.type)}"${p.type === preset ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
  ).join("");

  return (
    `<div class="gmt-dst gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<!-- Step 1 — find the transitions -->` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Find transitions</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label"><span>Zone</span>` +
    `<select class="gmt-select" data-role="zone">${options(zones, zone)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Year</span>` +
    `<input class="gmt-input" data-role="year" type="number" value="${escapeAttr(String(year))}" min="1900" max="2100" step="1">` +
    `</label>` +
    `</div>` +
    codeFrameHtml("getdst") +
    `<table class="gmt-dst-table">` +
    `<thead><tr>` +
    `<th>Type</th><th>Local Date</th><th>Local Hour</th><th>UTC Instant</th><th>Offset Before → After</th>` +
    `</tr></thead>` +
    `<tbody data-role="transition-body"></tbody>` +
    `</table>` +
    `</div>` +
    `<!-- Step 2 — probe a moment -->` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Probe a moment</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Value preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="value-preset">${presetOptions}</select>` +
    `</label>` +
    `<label class="gmt-label gmt-label-small"><span>Unit</span>` +
    `<select class="gmt-select" data-role="unit">${options(UNITOPTIONS, "hour")}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Disambiguation</span>` +
    `<select class="gmt-select" data-role="disambiguation">${options(DISOPTIONS, dis)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Offset</span>` +
    `<select class="gmt-select" data-role="offset">${options(OFFSETOPTIONS, off)}</select>` +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description"></p>` +
    `<!-- Scrubbable local-time ticker (drag or arrow keys) -->` +
    `<div class="gmt-dst-ticker" data-role="ticker" hidden>` +
    `<div class="gmt-dst-ticker-status" data-role="ticker-status"></div>` +
    `<div class="gmt-dst-ticker-track" data-role="ticker-track">` +
    `<div class="gmt-dst-ticker-zone" data-role="ticker-zone"></div>` +
    `<span class="gmt-dst-ticker-zone-label" data-role="zone-label-start"></span>` +
    `<span class="gmt-dst-ticker-zone-label" data-role="zone-label-end"></span>` +
    `<div class="gmt-dst-ticker-handle" data-role="ticker-handle" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="Local probe time"></div>` +
    `</div>` +
    `<div class="gmt-dst-ticker-ticks" data-role="ticker-ticks"></div>` +
    `</div>` +
    `<p class="gmt-dst-ticker-empty" data-role="ticker-empty" hidden>` +
    `This preset targets a single fixed value — nothing to scrub.` +
    `</p>` +
    codeFrameHtml("startof") +
    `<output class="gmt-widget-output gmt-playground-live" data-role="probe-result">&nbsp;</output>` +
    `<div data-role="explanation"></div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

const KEY_STEP_MINUTES = 5;

async function loadModules() {
  const [getMod, calcMod] = await Promise.all([
    GMT_MODULES["zoned/get"](),
    GMT_MODULES["zoned/calculate"](),
  ]);
  return {
    getDstTransitions: getMod["getDstTransitions"] as (
      zone: string,
      year: number,
    ) => DstTransition[],
    startOfZoned: calcMod["startOfZoned"] as (
      value: string,
      unit: string,
      options?: { disambiguation?: string; offset?: string },
    ) => string,
  };
}

// -----------------------------------------------------------------------
// Render helpers
// -----------------------------------------------------------------------

function renderTransitionTable(
  tbody: HTMLElement,
  transitions: DstTransition[],
  zone: string,
) {
  tbody.innerHTML = "";

  if (transitions.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "gmt-dst-empty-cell";
    td.textContent = "No DST transitions in this zone/year.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const t of transitions) {
    const tr = document.createElement("tr");
    const type = transitionType(t);
    tr.dataset.type = type;

    const tdType = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `gmt-dst-badge gmt-dst-badge-${type}`;
    badge.textContent = type === "gap" ? "Gap" : "Overlap";
    tdType.appendChild(badge);
    tr.appendChild(tdType);

    const tdDate = document.createElement("td");
    tdDate.textContent = localDateAtTransition(t, zone) ?? "—";
    tr.appendChild(tdDate);

    const tdHour = document.createElement("td");
    const lm = localMinuteOfDayAtTransition(t, zone);
    tdHour.textContent = Number.isNaN(lm) ? "—" : formatMinuteOfDay(lm);
    tr.appendChild(tdHour);

    const tdUtc = document.createElement("td");
    tdUtc.className = "gmt-dst-mono";
    tdUtc.textContent = t.instant;
    tr.appendChild(tdUtc);

    const tdOffset = document.createElement("td");
    tdOffset.className = "gmt-dst-mono";
    const arrow = document.createElement("span");
    arrow.className = `gmt-dst-arrow--${type}`;
    arrow.textContent = "→";
    tdOffset.appendChild(document.createTextNode(`${t.offsetBefore} `));
    tdOffset.appendChild(arrow);
    tdOffset.appendChild(document.createTextNode(` ${t.offsetAfter}`));
    tr.appendChild(tdOffset);

    tbody.appendChild(tr);
  }
}

function renderTicker(
  tickerEl: HTMLElement,
  emptyEl: HTMLElement | null,
  window_: TickerWindow | null,
  transition: DstTransition | null,
  minuteOfDay: number | null,
) {
  if (!window_ || !transition || minuteOfDay === null) {
    tickerEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  tickerEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;

  const type = transitionType(transition);
  const inZone = isMinuteInZone(minuteOfDay, window_);

  const zoneEl = tickerEl.querySelector(
    '[data-role="ticker-zone"]',
  ) as HTMLElement | null;
  if (zoneEl) {
    zoneEl.className = `gmt-dst-ticker-zone gmt-dst-ticker-zone--${type}`;
    const left = minuteToTickerPercent(window_.zoneStartMinutes, window_);
    const right = minuteToTickerPercent(window_.zoneEndMinutes, window_);
    zoneEl.style.left = `${left}%`;
    zoneEl.style.width = `${right - left}%`;
  }

  const startLabel = tickerEl.querySelector(
    '[data-role="zone-label-start"]',
  ) as HTMLElement | null;
  const endLabel = tickerEl.querySelector(
    '[data-role="zone-label-end"]',
  ) as HTMLElement | null;
  if (startLabel) {
    startLabel.textContent = formatMinuteOfDay(window_.zoneStartMinutes);
    startLabel.style.left = `${minuteToTickerPercent(window_.zoneStartMinutes, window_)}%`;
  }
  if (endLabel) {
    endLabel.textContent = formatMinuteOfDay(window_.zoneEndMinutes);
    endLabel.style.left = `${minuteToTickerPercent(window_.zoneEndMinutes, window_)}%`;
  }

  const handle = tickerEl.querySelector(
    '[data-role="ticker-handle"]',
  ) as HTMLElement | null;
  if (handle) {
    handle.className = `gmt-dst-ticker-handle${inZone ? ` gmt-dst-ticker-handle--${type}` : ""}`;
    handle.style.left = `${minuteToTickerPercent(minuteOfDay, window_)}%`;
    handle.setAttribute("aria-valuemin", String(window_.windowStartMinutes));
    handle.setAttribute("aria-valuemax", String(window_.windowEndMinutes));
    handle.setAttribute("aria-valuenow", String(minuteOfDay));
    handle.setAttribute("aria-valuetext", formatMinuteOfDay(minuteOfDay));
  }

  const ticksEl = tickerEl.querySelector(
    '[data-role="ticker-ticks"]',
  ) as HTMLElement | null;
  if (ticksEl) {
    ticksEl.innerHTML = "";
    const step = getTickerTickStepMinutes(window_);
    const firstTick = Math.ceil(window_.windowStartMinutes / step) * step;
    for (let m = firstTick; m <= window_.windowEndMinutes; m += step) {
      const tick = document.createElement("span");
      tick.className = "gmt-dst-ticker-tick";
      tick.textContent = formatMinuteOfDay(m);
      tick.style.left = `${minuteToTickerPercent(m, window_)}%`;
      ticksEl.appendChild(tick);
    }
  }

  const statusEl = tickerEl.querySelector(
    '[data-role="ticker-status"]',
  ) as HTMLElement | null;
  if (statusEl) {
    statusEl.textContent = inZone
      ? type === "gap"
        ? `${formatMinuteOfDay(minuteOfDay)} — inside the gap, this local time never happens`
        : `${formatMinuteOfDay(minuteOfDay)} — inside the overlap, this local time happens twice`
      : `${formatMinuteOfDay(minuteOfDay)} — normal local time`;
  }
}

function renderPresetDescription(el: HTMLElement, presetType: string) {
  const info = VALUE_PRESETS.find((p) => p.type === presetType);
  el.textContent = info?.description ?? "";
}

function renderProbeResult(
  outputEl: HTMLElement,
  probeTime: string,
  result: string,
  classification: ProbeClassification,
) {
  if (!probeTime) {
    outputEl.textContent = "— No transitions for this zone/year.";
    outputEl.classList.remove("gmt-playground-sentinel");
    return;
  }

  if (result === "") {
    renderResult(outputEl, classification.explanation, true);
  } else {
    renderResult(outputEl, result, false);
  }
}

/**
 * A single aside combining the plain-language explanation of the current
 * probe result with, when there's one, the deeper pedagogical point
 * (the gap/overlap span, or the offset:"prefer"-makes-disambiguation-inert
 * gotcha). One box instead of two or three.
 */
function renderExplanationAside(
  el: HTMLElement,
  classification: ProbeClassification,
  transitions: DstTransition[],
  presetType: string,
  probeMinute: number | null,
  dis: string,
  off: string,
  zone: string,
) {
  if (transitions.length === 0) {
    renderAside(
      el,
      "note",
      "Note",
      "<p>No DST transitions in this zone/year — the value resolves normally.</p>",
    );
    return;
  }

  const typeLabel =
    classification.type === "gap"
      ? '<span class="gmt-dst-badge gmt-dst-badge-gap">Gap</span>'
      : classification.type === "overlap"
        ? '<span class="gmt-dst-badge gmt-dst-badge-overlap">Overlap</span>'
        : "Normal";

  const probeLabel =
    presetType === "normal"
      ? "The selected normal time"
      : presetType === "transition"
        ? "The exact transition instant"
        : probeMinute !== null
          ? `Local time <strong>${formatMinuteOfDay(probeMinute)}</strong>`
          : "The selected value";

  let content = `<p>${probeLabel} is ${typeLabel} — ${classification.explanation}</p>`;
  let type: "note" | "caution" = "note";
  let title = "Note";

  if (off === "prefer" && dis === "reject") {
    type = "caution";
    title = "Key insight";
    content += `<p><code>offset: "prefer"</code> makes <code>disambiguation</code> inert — the source offset is nearly always still valid after a same-day field reset, so <code>"reject"</code> never fires. Try <code>disambiguation: "reject"</code> + <code>offset: "ignore"</code> (fails) vs <code>offset: "prefer"</code> (succeeds).</p>`;
  } else if (presetType === "gap") {
    const gapTrans = transitions.find(isGap);
    const win = gapTrans ? getTickerWindow(gapTrans, zone) : null;
    if (gapTrans && win) {
      const span = `${formatMinuteOfDay(win.zoneStartMinutes)}–${formatMinuteOfDay(win.zoneEndMinutes)}`;
      content += `<p>Local time jumps from <code>${gapTrans.offsetBefore}</code> to <code>${gapTrans.offsetAfter}</code> — local times in <code>${span}</code> never happen on that date. Try <code>"earlier"</code> or <code>"later"</code> to see how each resolves it.</p>`;
    }
  } else if (presetType === "overlap") {
    const overlapTrans = transitions.find(isOverlap);
    const win = overlapTrans ? getTickerWindow(overlapTrans, zone) : null;
    if (overlapTrans && win) {
      const span = `${formatMinuteOfDay(win.zoneStartMinutes)}–${formatMinuteOfDay(win.zoneEndMinutes)}`;
      content += `<p>Local times in <code>${span}</code> happen twice — once with offset <code>${overlapTrans.offsetBefore}</code>, once with <code>${overlapTrans.offsetAfter}</code>. <code>"earlier"</code> picks the first occurrence, <code>"later"</code> picks the second.</p>`;
    }
  }

  renderAside(el, type, title, content);
}

// -----------------------------------------------------------------------
// Widget wiring
// -----------------------------------------------------------------------

function setupWidget(
  container: HTMLElement,
  getDstTransitions: (zone: string, year: number) => DstTransition[],
  startOfZoned: (
    value: string,
    unit: string,
    options?: { disambiguation?: string; offset?: string },
  ) => string,
): void {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;

  const zoneEl = q<HTMLSelectElement>("zone");
  const yearEl = q<HTMLInputElement>("year");
  const presetEl = q<HTMLSelectElement>("value-preset");
  const unitEl = q<HTMLSelectElement>("unit");
  const disEl = q<HTMLSelectElement>("disambiguation");
  const offEl = q<HTMLSelectElement>("offset");
  const tbodyEl = q("transition-body");
  const outputEl = q("probe-result");
  const tickerEl = q("ticker");
  const tickerEmptyEl = q("ticker-empty");
  const trackEl = q("ticker-track");
  const handleEl = q("ticker-handle");

  if (!zoneEl || !yearEl || !presetEl || !unitEl || !tbodyEl || !outputEl)
    return;

  // Scrub state — owned here so a drag isn't reset by an unrelated re-render.
  let activeTransition: DstTransition | null = null;
  let tickerWindow: TickerWindow | null = null;
  let handleMinuteOfDay: number | null = null;
  let dragging = false;

  function render() {
    const zone = zoneEl!.value;
    const year = parseInt(yearEl!.value, 10);
    const presetType = presetEl!.value;
    const unit = unitEl!.value;
    const dis = disEl?.value ?? "compatible";
    const off = offEl?.value ?? "ignore";

    const transitions = getDstTransitions(zone, year);

    renderTransitionTable(tbodyEl!, transitions, zone);
    renderCallLine(
      q("call-getdst"),
      "getDstTransitions",
      `${codeSpan("str", `"${zone}"`)}, ${codeSpan("num", String(year))}`,
      `"${zone}", ${year}`,
    );

    const presetDescEl = q("preset-description");
    if (presetDescEl) renderPresetDescription(presetDescEl, presetType);

    // Scrubbable presets take their value from the ticker; fixed ones don't.
    const scrubbable =
      activeTransition !== null &&
      tickerWindow !== null &&
      handleMinuteOfDay !== null;

    const value = scrubbable
      ? buildZonedValueFromMinutes(
          zone,
          localDateAtTransition(activeTransition!, zone) ?? "",
          handleMinuteOfDay!,
        )
      : buildValuePreset(presetType as ValuePreset, zone, transitions);

    const result = value
      ? startOfZoned(value, unit, { disambiguation: dis, offset: off })
      : "";

    if (tickerEl) {
      renderTicker(
        tickerEl,
        tickerEmptyEl,
        tickerWindow,
        activeTransition,
        handleMinuteOfDay,
      );
    }

    renderCallLine(
      q("call-startof"),
      "startOfZoned",
      `${codeSpan("str", `"${value}"`)}, ${codeSpan("str", `"${unit}"`)}, { disambiguation: ${codeSpan("str", `"${dis}"`)}, offset: ${codeSpan("str", `"${off}"`)} }`,
      `"${value}", "${unit}", { disambiguation: "${dis}", offset: "${off}" }`,
    );

    const probeHour = handleMinuteOfDay !== null ? handleMinuteOfDay / 60 : 0;
    const classification = classifyProbeResult(
      result,
      transitions,
      probeHour,
      zone,
      {
        disambiguation: dis,
        offset: off,
      },
    );

    renderProbeResult(outputEl!, value, result, classification);

    const explanationEl = q("explanation");
    if (explanationEl) {
      renderExplanationAside(
        explanationEl,
        classification,
        transitions,
        presetType,
        handleMinuteOfDay,
        dis,
        off,
        zone,
      );
    }
  }

  // Re-derive which transition the ticker scrubs, then render.
  function resetAndRender() {
    const zone = zoneEl!.value;
    const year = parseInt(yearEl!.value, 10);
    const presetType = presetEl!.value;
    const transitions = getDstTransitions(zone, year);

    activeTransition =
      presetType === "gap"
        ? (transitions.find(isGap) ?? null)
        : presetType === "overlap"
          ? (transitions.find(isOverlap) ?? null)
          : null;

    tickerWindow = activeTransition
      ? getTickerWindow(activeTransition, zone)
      : null;
    handleMinuteOfDay =
      activeTransition && tickerWindow
        ? localMinuteOfDayAtTransition(activeTransition, zone)
        : null;

    if (handleMinuteOfDay !== null && Number.isNaN(handleMinuteOfDay)) {
      handleMinuteOfDay = null;
      tickerWindow = null;
    }

    render();
  }

  function updateHandle(minute: number) {
    handleMinuteOfDay = minute;
    render();
  }

  zoneEl.addEventListener("change", resetAndRender);
  yearEl.addEventListener("input", resetAndRender);
  presetEl.addEventListener("change", resetAndRender);
  unitEl.addEventListener("change", render);
  disEl?.addEventListener("change", render);
  offEl?.addEventListener("change", render);

  // Pointer scrubbing
  if (trackEl) {
    trackEl.addEventListener("pointerdown", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.role !== "ticker-handle" || !tickerWindow) return;
      dragging = true;
      target.setPointerCapture((e as PointerEvent).pointerId);
    });

    trackEl.addEventListener("pointermove", (e) => {
      if (!dragging || !tickerWindow) return;
      const rect = trackEl.getBoundingClientRect();
      const pct =
        (((e as PointerEvent).clientX - rect.left) / rect.width) * 100;
      updateHandle(tickerPercentToMinute(pct, tickerWindow));
    });

    const stopDrag = () => {
      dragging = false;
    };
    trackEl.addEventListener("pointerup", stopDrag);
    trackEl.addEventListener("pointercancel", stopDrag);
  }

  // Keyboard scrubbing — the non-drag equivalent, required by DOX-B2b.
  handleEl?.addEventListener("keydown", (e) => {
    const ev = e as KeyboardEvent;
    if (!tickerWindow || handleMinuteOfDay === null) return;

    switch (ev.key) {
      case "ArrowLeft":
      case "ArrowDown":
        updateHandle(
          Math.max(
            tickerWindow.windowStartMinutes,
            handleMinuteOfDay - KEY_STEP_MINUTES,
          ),
        );
        ev.preventDefault();
        break;
      case "ArrowRight":
      case "ArrowUp":
        updateHandle(
          Math.min(
            tickerWindow.windowEndMinutes,
            handleMinuteOfDay + KEY_STEP_MINUTES,
          ),
        );
        ev.preventDefault();
        break;
      case "Home":
        updateHandle(tickerWindow.windowStartMinutes);
        ev.preventDefault();
        break;
      case "End":
        updateHandle(tickerWindow.windowEndMinutes);
        ev.preventDefault();
        break;
    }
  });

  wireCopyButtons(container);

  resetAndRender();
}

/** Write seeded arguments onto the controls. Silently skips anything the
 *  control does not offer — a zone the `<select>` has no option for leaves the
 *  widget on its default rather than on an empty selection. */
function applyArgs(root: HTMLElement, args: DstArgs): void {
  const set = (role: string, value: string | number | undefined) => {
    if (value === undefined) return;
    const el = root.querySelector(`[data-role="${role}"]`) as
      | HTMLSelectElement
      | HTMLInputElement
      | null;
    if (!el) return;
    const next = String(value);
    if (el instanceof HTMLSelectElement) {
      if (![...el.options].some((o) => o.value === next)) return;
    }
    el.value = next;
  };

  set("zone", args.zone);
  set("year", args.year);
  set("value-preset", args.preset);
  set("disambiguation", args.disambiguation);
  set("offset", args.offset);
}

export const mountDstInspector: MountFn<DstArgs> = async (
  root,
  args,
  signal,
) => {
  let modules: Awaited<ReturnType<typeof loadModules>>;
  try {
    modules = await loadModules();
  } catch {
    // The page stays readable without the library, exactly as before.
    return onceDestroy(() => {});
  }
  if (signal.aborted) return onceDestroy(() => {});

  /* Args are applied to the controls *before* setup, so `setupWidget`'s first
     render reads the seeded values and there is no visible correction.
     `renderDstTemplate` paints the same values when it is given them — which it
     is from the chat rail, but not from a page bootstrap, where the seed comes
     from `window.location` and Astro's frontmatter has no window. Applying them
     here covers both entrances with one path. */
  applyArgs(root, args);
  setupWidget(root, modules.getDstTransitions, modules.startOfZoned);

  return onceDestroy(
    () => {
      /* Release a capture held mid-drag. Listeners inside `root` go with the
         subtree, but a pointer capture is held by the browser against the
         element, and leaving one set routes subsequent pointer events to a node
         that is no longer in the document. */
      const handle = root.querySelector(
        '[data-role="ticker-handle"]',
      ) as HTMLElement | null;
      if (handle?.hasPointerCapture) {
        for (const id of [0, 1]) {
          try {
            if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
          } catch {
            // Nothing captured under that id.
          }
        }
      }
    },
    () => {
      const v = (role: string) =>
        (
          root.querySelector(`[data-role="${role}"]`) as
            | HTMLSelectElement
            | HTMLInputElement
            | null
        )?.value;
      const year = v("year");
      return {
        zone: v("zone"),
        year: year ? Number(year) : undefined,
        preset: v("value-preset"),
        disambiguation: v("disambiguation"),
        offset: v("offset"),
      };
    },
  );
};
