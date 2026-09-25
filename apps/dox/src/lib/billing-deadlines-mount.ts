/**
 * The Billing Deadlines widget (INT-58), mountable on its tool page and in the
 * chat rail.
 *
 * A day strip wrapped by ISO week, with the three windows around a demurrage
 * or detention invoice — issue, dispute, resolve — drawn as numbered, patterned
 * lanes. The reader sets the anchor, the dates as they exist, and the windows;
 * the strip and the verdicts are always the real `billingTimeline` call's, and
 * the mount never computes a deadline itself.
 *
 * Follows the Free Time Ledger's split (`free-time-ledger-mount.ts`): every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown.
 */
import {
  BILLING_PRESETS,
  CUSTOM_PRESET_ID,
  callSource,
  datesOf,
  dayStrip,
  explainNull,
  formatDeadlines,
  matchPreset,
  nullReasonText,
  readArgs,
  verdictText,
  windowsOf,
  type BillingDeadlines,
  type BillingDeadlinesArgs,
  type BillingState,
  type DayStripDay,
  type DayStripItem,
  type DayStripResult,
  type DatesArg,
  type WindowsArg,
} from "./billing-deadlines";
import { codeFrameHtml } from "./code-frame";
import { GMT_MODULES } from "./gmt-modules";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { BillingDeadlinesArgs } from "./billing-deadlines";

/* Fixed English names, not Intl — the strip never asks the browser's locale,
   the same rule `interval-visualizer.ts`'s MONTH_NAMES and
   `free-time-ledger-mount.ts`'s WEEKDAY_NAMES follow. */
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MARK_LETTER: Record<string, string> = {
  anchor: "A",
  invoice: "I",
  request: "R",
};
const MARK_LABEL: Record<string, string> = {
  anchor: "anchor",
  invoice: "invoice issued",
  request: "dispute request received",
};
const LANE_NAME: Record<1 | 2 | 3, string> = {
  1: "issue window",
  2: "dispute window",
  3: "resolution window",
};
const LANE_DEADLINE_NAME: Record<1 | 2 | 3, string> = {
  1: "invoice deadline",
  2: "dispute deadline",
  3: "resolution deadline",
};

/**
 * Options for the preset `<select>`. Custom is first, unselected unless no
 * preset matches, following the Free Time Ledger's convention.
 */
function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    BILLING_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The strip and the outputs are drawn by
 * `mount`, because they come from the real `billingTimeline` call.
 */
export function renderBillingDeadlinesTemplate(
  args: BillingDeadlinesArgs = {},
): string {
  const seeded = args.anchorOn !== undefined;
  const state: BillingState = seeded
    ? readArgs(args)
    : { ...BILLING_PRESETS[0]! };
  const presetId = matchPreset(state);
  const preset = BILLING_PRESETS.find((p) => p.id === presetId);

  const dateField = (
    role: string,
    label: string,
    value: string,
  ): string =>
    `<label class="gmt-label"><span>${escapeHtml(label)}</span>` +
    `<input class="gmt-input" data-role="${role}" type="text" spellcheck="false" autocomplete="off" placeholder="YYYY-MM-DD" value="${escapeAttr(value)}"></label>`;

  const windowField = (role: string, label: string, value: string): string =>
    `<label class="gmt-label"><span>${escapeHtml(label)}</span>` +
    `<input class="gmt-input" data-role="${role}" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(value)}"></label>`;

  return (
    `<div class="gmt-billing gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Set the dates and the windows</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions(presetId)}</select>` +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<fieldset class="gmt-billing-group"><legend>Dates</legend>` +
    `<div class="gmt-widget-controls">` +
    dateField("anchor-on", "Anchor date (day zero)", state.anchorOn) +
    dateField(
      "invoice-issued-on",
      "Invoice issued on (optional)",
      state.invoiceIssuedOn,
    ) +
    dateField(
      "request-received-on",
      "Request received on (optional)",
      state.requestReceivedOn,
    ) +
    `</div></fieldset>` +
    `<fieldset class="gmt-billing-group"><legend>Windows, in calendar days</legend>` +
    `<div class="gmt-widget-controls">` +
    windowField("issue-days", "Issue window (days)", state.issueDays) +
    windowField("dispute-days", "Dispute window (days)", state.disputeDays) +
    windowField(
      "resolution-days",
      "Resolution window (days)",
      state.resolutionDays,
    ) +
    dateField(
      "agreed-resolution-on",
      "Agreed resolution date (optional)",
      state.agreedResolutionOn,
    ) +
    `</div></fieldset>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. The chain</h4>` +
    `<ul class="gmt-billing-verdicts" data-role="verdicts" aria-live="polite">` +
    `<li data-role="verdict-issued"></li>` +
    `<li data-role="verdict-requested"></li>` +
    `</ul>` +
    `<p class="gmt-billing-deadlines" data-role="deadlines"></p>` +
    `<div class="gmt-billing-weekdays" aria-hidden="true">${WEEKDAY_NAMES.map((w) => `<span>${w}</span>`).join("")}</div>` +
    `<div class="gmt-billing-strip" data-role="strip" role="list"></div>` +
    `<p class="gmt-billing-strip-summary" data-role="strip-summary" aria-live="polite"></p>` +
    renderLegend() +
    `<div data-role="reason-aside"></div>` +
    `<p class="gmt-billing-liability-note" data-role="liability-note">These are date comparisons. What follows from a date after a deadline is for you and the terms you bill under: GMT computes dates, not liability.</p>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>billingTimeline</code> returns</h4>` +
    codeFrameHtml("billing") +
    `<output class="gmt-widget-output" data-role="billing-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function renderLegend(): string {
  return (
    `<ul class="gmt-billing-legend" data-role="legend" aria-label="Legend">` +
    `<li><i class="gmt-billing-badge gmt-billing-badge--mark">A</i>anchor, day zero</li>` +
    `<li><i class="gmt-billing-badge gmt-billing-badge--mark">I</i>invoice issued</li>` +
    `<li><i class="gmt-billing-badge gmt-billing-badge--mark">R</i>dispute request received</li>` +
    `<li><i class="gmt-billing-lane gmt-billing-lane--1 gmt-billing-lane--in"></i>1 issue window, solid</li>` +
    `<li><i class="gmt-billing-lane gmt-billing-lane--2 gmt-billing-lane--in"></i>2 dispute window, dashed</li>` +
    `<li><i class="gmt-billing-lane gmt-billing-lane--3 gmt-billing-lane--in"></i>3 resolution window, dotted</li>` +
    `</ul>`
  );
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

type BillingTimelineFn = (
  dates: DatesArg,
  windows: WindowsArg,
) => BillingDeadlines | null;

interface Modules {
  billingTimeline: BillingTimelineFn;
  isValidDate: (value: string) => boolean;
}

async function loadModules(): Promise<Modules> {
  const [intermodal, plainValidate] = await Promise.all([
    GMT_MODULES["intermodal/calculate"](),
    GMT_MODULES["plain/validate"](),
  ]);
  return {
    billingTimeline: intermodal["billingTimeline"] as BillingTimelineFn,
    isValidDate: plainValidate["isValidDate"] as (v: string) => boolean,
  };
}

// ---------------------------------------------------------------------------
// Drawing the strip
// ---------------------------------------------------------------------------

function dateText(iso: string): { weekday: string; day: number; month: string; year: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  // Sakamoto's algorithm — proleptic Gregorian day of week, Monday-first
  // (0 = Monday). No Temporal here: this runs per cell on every render, and
  // the strip never needs the polyfill's zone or calendar machinery for a
  // bare ISO date's weekday.
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  const sunday0 = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1]! + d) % 7;
  const mondayFirst = (sunday0 + 6) % 7;
  return { weekday: WEEKDAY_NAMES[mondayFirst]!, day: d, month: MONTH_NAMES[m - 1]!, year: y };
}

function ariaLabelFor(item: DayStripDay): string {
  const { weekday, day, month, year } = dateText(item.date);
  const dateLabel = `${weekday} ${day} ${month} ${year}`;
  const parts: string[] = [];
  for (const mark of item.marks) parts.push(MARK_LABEL[mark]!);
  for (const lane of item.lanes) {
    const state =
      lane.state === "deadline"
        ? `day ${lane.day}, ${LANE_DEADLINE_NAME[lane.lane]}`
        : lane.state === "zero"
          ? "day 0"
          : `day ${lane.day}`;
    parts.push(`${LANE_NAME[lane.lane]} ${state}`);
  }
  return parts.length > 0 ? `${dateLabel}: ${parts.join("; ")}` : dateLabel;
}

function renderDayCell(item: DayStripDay, showMonth: boolean): string {
  if (item.padding) {
    return `<div class="gmt-billing-cell gmt-billing-cell--padding" role="listitem" aria-hidden="true"></div>`;
  }
  const { day, month } = dateText(item.date);
  const dayLabel = showMonth ? `${day} ${month}` : String(day);

  const marks = item.marks
    .map(
      (m) =>
        `<span class="gmt-billing-badge gmt-billing-badge--mark" data-mark="${m}">${MARK_LETTER[m]}</span>`,
    )
    .join("");
  const deadlines = item.lanes
    .filter((l) => l.state === "deadline")
    .map(
      (l) =>
        `<span class="gmt-billing-badge gmt-billing-badge--deadline gmt-billing-badge--lane-${l.lane}">${l.lane}</span>`,
    )
    .join("");
  const lanes = ([1, 2, 3] as const)
    .map((n) => {
      const lane = item.lanes.find((l) => l.lane === n);
      const state = lane?.state ?? "none";
      return `<span class="gmt-billing-lane gmt-billing-lane--${n} gmt-billing-lane--${state}"></span>`;
    })
    .join("");

  const dataMarks = item.marks.join(" ");
  const dataLanes = item.lanes.map((l) => `${l.lane}-${l.state}`).join(" ");
  const aria = ariaLabelFor(item);

  return (
    `<div class="gmt-billing-cell" role="listitem" data-date="${escapeAttr(item.date)}" data-marks="${escapeAttr(dataMarks)}" data-lanes="${escapeAttr(dataLanes)}" aria-label="${escapeAttr(aria)}">` +
    `<span class="gmt-billing-cell-date" aria-hidden="true">${escapeHtml(dayLabel)}</span>` +
    (marks
      ? `<span class="gmt-billing-marks" aria-hidden="true">${marks}</span>`
      : "") +
    (deadlines
      ? `<span class="gmt-billing-deadline-badges" aria-hidden="true">${deadlines}</span>`
      : "") +
    `<span class="gmt-billing-lanes" aria-hidden="true">${lanes}</span>` +
    `</div>`
  );
}

function renderGapRow(item: Extract<DayStripItem, { kind: "gap" }>): string {
  const aria = `${item.from} to ${item.to}: ${item.days} days not drawn`;
  return (
    `<div class="gmt-billing-gap" role="listitem" aria-label="${escapeAttr(aria)}">` +
    `<span aria-hidden="true">… ${item.days} days not drawn …</span>` +
    `</div>`
  );
}

function renderStrip(
  stripEl: HTMLElement | null,
  strip: DayStripResult | null,
): void {
  if (!stripEl) return;
  if (strip === null) {
    stripEl.innerHTML = "";
    return;
  }
  let firstDrawn = true;
  stripEl.innerHTML = strip.items
    .map((item) => {
      if (item.kind === "gap") return renderGapRow(item);
      if (item.padding) return renderDayCell(item, false);
      const { day } = dateText(item.date);
      const showMonth = firstDrawn || day === 1;
      firstDrawn = false;
      return renderDayCell(item, showMonth);
    })
    .join("");
}

/** One readable line naming the three deadlines, `—` for a deadline that
 *  does not exist yet. */
function deadlinesLineText(r: BillingDeadlines | null): string {
  if (r === null) return "";
  const item = (label: string, v: string | null) => `${label} ${v ?? "—"}`;
  return [
    item("Issue by", r.invoiceDeadline),
    item("Dispute by", r.disputeDeadline),
    item("Resolve by", r.resolutionDeadline),
  ].join(" · ");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(container: HTMLElement, m: Modules): void {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const anchorEl = q<HTMLInputElement>("anchor-on");
  const invoiceEl = q<HTMLInputElement>("invoice-issued-on");
  const requestEl = q<HTMLInputElement>("request-received-on");
  const issueEl = q<HTMLInputElement>("issue-days");
  const disputeEl = q<HTMLInputElement>("dispute-days");
  const resolutionEl = q<HTMLInputElement>("resolution-days");
  const agreedEl = q<HTMLInputElement>("agreed-resolution-on");
  if (
    !presetEl ||
    !anchorEl ||
    !invoiceEl ||
    !requestEl ||
    !issueEl ||
    !disputeEl ||
    !resolutionEl ||
    !agreedEl
  ) {
    return;
  }

  const state = (): BillingState => ({
    anchorOn: anchorEl.value.trim(),
    invoiceIssuedOn: invoiceEl.value.trim(),
    requestReceivedOn: requestEl.value.trim(),
    issueDays: issueEl.value.trim(),
    disputeDays: disputeEl.value.trim(),
    resolutionDays: resolutionEl.value.trim(),
    agreedResolutionOn: agreedEl.value.trim(),
  });

  function syncPreset(): void {
    const s = state();
    presetEl!.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        BILLING_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function render(): void {
    const s = state();
    const dates = datesOf(s);
    const windows = windowsOf(s);
    const result = m.billingTimeline(dates, windows);
    const explanation = result === null ? explainNull(s, m) : null;

    const [callHtml, callPlain] = callSource(s);
    renderCallLine(q("call-billing"), "billingTimeline", callHtml, callPlain);

    const out = q("billing-output");
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatDeadlines(result), "live");
    }

    const issuedEl = q("verdict-issued");
    if (issuedEl) {
      issuedEl.textContent = verdictText(
        "issued",
        dates.invoiceIssuedOn,
        result?.issuedByDeadline ?? null,
      );
    }
    const requestedEl = q("verdict-requested");
    if (requestedEl) {
      requestedEl.textContent = verdictText(
        "requested",
        dates.requestReceivedOn,
        result?.requestedByDeadline ?? null,
      );
    }

    const deadlinesEl = q("deadlines");
    if (deadlinesEl) deadlinesEl.textContent = deadlinesLineText(result);

    const strip = dayStrip(s, result);
    renderStrip(q("strip"), strip);
    const summaryEl = q("strip-summary");
    if (summaryEl) summaryEl.textContent = strip?.summary ?? "";

    const aside = q("reason-aside");
    if (aside) {
      if (explanation) {
        renderAside(
          aside,
          "caution",
          "Why null",
          `<p>${escapeHtml(nullReasonText(explanation))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = BILLING_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    anchorEl!.value = preset.anchorOn;
    invoiceEl!.value = preset.invoiceIssuedOn;
    requestEl!.value = preset.requestReceivedOn;
    issueEl!.value = preset.issueDays;
    disputeEl!.value = preset.disputeDays;
    resolutionEl!.value = preset.resolutionDays;
    agreedEl!.value = preset.agreedResolutionOn;
    syncPreset();
    render();
  }

  for (const input of [
    anchorEl,
    invoiceEl,
    requestEl,
    issueEl,
    disputeEl,
    resolutionEl,
    agreedEl,
  ]) {
    input.addEventListener("input", () => {
      syncPreset();
      render();
    });
  }
  presetEl.addEventListener("change", applyPreset);

  wireCopyButtons(container);
  render();
}

/** Write seeded arguments onto the controls. A no-op without `anchorOn`. */
function applyArgs(root: HTMLElement, args: BillingDeadlinesArgs): void {
  if (args.anchorOn === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement>(role);
    if (el) el.value = value;
  };
  set("anchor-on", s.anchorOn);
  set("invoice-issued-on", s.invoiceIssuedOn);
  set("request-received-on", s.requestReceivedOn);
  set("issue-days", s.issueDays);
  set("dispute-days", s.disputeDays);
  set("resolution-days", s.resolutionDays);
  set("agreed-resolution-on", s.agreedResolutionOn);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        BILLING_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

export const mountBillingDeadlines: MountFn<BillingDeadlinesArgs> = async (
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
  setupWidget(root, modules);

  return onceDestroy(
    () => {},
    () => {
      const v = (role: string) =>
        (
          root.querySelector(`[data-role="${role}"]`) as
            | HTMLInputElement
            | HTMLSelectElement
            | null
        )?.value ?? "";
      // Strings only, and only non-blank fields: a permalink carries no
      // numbers below 1900 and `seedFromLocation` drops empty strings, so a
      // blank window round-trips as blank rather than as a stray "" key.
      const out: Record<string, string> = {};
      const field = (role: string, key: string) => {
        const value = v(role).trim();
        if (value !== "") out[key] = value;
      };
      field("anchor-on", "anchorOn");
      field("invoice-issued-on", "invoiceIssuedOn");
      field("request-received-on", "requestReceivedOn");
      field("issue-days", "issueDays");
      field("dispute-days", "disputeDays");
      field("resolution-days", "resolutionDays");
      field("agreed-resolution-on", "agreedResolutionOn");
      return out;
    },
  );
};
