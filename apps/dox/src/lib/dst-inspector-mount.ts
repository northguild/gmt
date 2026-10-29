/**
 * The DST transition inspector, mountable on its tool page and in the chat rail.
 *
 * The question it answers: "what happens to 1:30am on November 3rd in New York".
 * A zone and a year give the real transitions from `getDstTransitions`; a probe, picked
 * by a preset or scrubbed along a strip, goes through `convertPlainDateTimeToZoned` with
 * the chosen disambiguation, and the widget says what happened to that wall time.
 *
 * Built on the component kit: `renderDstTemplate` writes the markup from builders only,
 * with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. The strip's
 * thumb is the kit's `<gmt-handle>`, which owns the drag and the keyboard, so there is no
 * pointer code here and nothing to release on teardown. The scrub state (`activeTransition`,
 * `tickerWindow`, `handleMinuteOfDay`) lives in the mount's closure, outside `render()`, so
 * an unrelated render cannot reset it. Every listener is delegated on the widget with the
 * mount's `signal`.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  dstBadge,
  dstTable,
  type DstRow,
} from "~/widgets/families/dst/dst-table";
import {
  dstTicker,
  dstTickerEmpty,
  dstTicks,
  tickerIds,
  type TickMark,
} from "~/widgets/families/dst/dst-ticker";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { grow } from "~/widgets/primitives/grow/grow";
import type { GmtHandle } from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { CURATED_TIMEZONES } from "./curated-timezones";
import {
  VALUE_PRESETS,
  buildValuePreset,
  buildZonedValueFromMinutes,
  classifyProbeResult,
  formatMinuteOfDay,
  getTickerWindow,
  isGap,
  isMinuteInZone,
  isOverlap,
  localDateAtTransition,
  localMinuteOfDayAtTransition,
  minuteToTickerPercent,
  probeContext,
  selectTickMinutes,
  toPlainLocalDateTime,
  transitionType,
  zoneMidpointMinutes,
  type DstTransition,
  type ProbeClassification,
  type TickerWindow,
  type ValuePreset,
} from "./dst-inspector";
import { GMT_MODULES } from "./gmt-modules";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

const WIDGET_NAME = "dst-inspector";
const DEFAULT_ZONE = "Europe/London";
const DEFAULT_YEAR = 2024;
const DISOPTIONS = ["compatible", "earlier", "later", "reject"] as const;
const KEY_STEP_MINUTES = 5;
const KEY_LARGE_STEP_MINUTES = 30;
const TICKER_EMPTY_TEXT =
  "This preset targets a single fixed value — nothing to scrub.";
const NO_TRANSITIONS_TICKER_TEXT =
  "Nothing to scrub: this zone has no DST transitions in this year.";

/** The tick pitch the strip shows in full, and the sparser pitch it keeps when narrow. */
const DENSE_TICK_PX = 960;
const SPARSE_TICK_PX = 320;

export interface DstArgs {
  zone?: string;
  year?: number;
  preset?: string;
  disambiguation?: string;
  offset?: string;
}

const PRESET_NOUN: Record<string, string> = {
  normal: "normal time",
  gap: "skipped hour",
  overlap: "repeated hour",
  transition: "transition instant",
};

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

export function renderDstTemplate(
  idPrefix: string,
  args: DstArgs = {},
): string {
  const id = idScope(idPrefix);
  const zone = args.zone ?? DEFAULT_ZONE;
  const year = args.year ?? DEFAULT_YEAR;
  const presetType = args.preset ?? "gap";
  const dis = args.disambiguation ?? "compatible";

  /* A seeded zone outside the curated list is appended rather than replacing the
     list, so the reader can still pick anything the page normally offers. */
  const zones: readonly string[] = CURATED_TIMEZONES.includes(
    zone as (typeof CURATED_TIMEZONES)[number],
  )
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, zone];

  const transitions = section(
    { id: id("transitions"), heading: "1. Find transitions", level: 4 },
    html`${fieldGrid(
      html`${field({
        id: id("zone"),
        label: "Zone",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: zone,
            options: zones.map((z) => ({ value: z, label: z })),
          }),
      })}${field({
        id: id("year"),
        label: "Year",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: String(year),
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
          }),
      })}`,
    )}${grow(
      html`<div id="${id("call-getdst")}">${callFrame("getDstTransitions call", "")}</div>`,
    )}${grow(html`<div id="${id("table")}">${dstTable([])}</div>`)}`,
  );

  const probe = section(
    { id: id("probe"), heading: "2. Probe a moment", level: 4 },
    html`${fieldGrid(
      html`${preset({
        id: id("preset"),
        label: "Value preset",
        value: presetType,
        options: VALUE_PRESETS.map((p) => ({
          value: p.type,
          label: p.label,
          description: p.description,
        })),
      })}${field({
        id: id("disambiguation"),
        label: "Disambiguation",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: dis,
            options: DISOPTIONS.map((d) => ({ value: d, label: d })),
          }),
      })}`,
    )}<p>Disambiguation: <code>compatible</code> takes the later instant in a gap and the earlier one in an overlap. <code>earlier</code> and <code>later</code> take that instant. <code>reject</code> gives no result.</p>${dstTicker({ id })}${dstTickerEmpty({ id }, TICKER_EMPTY_TEXT)}${grow(
      html`<div id="${id("call-convert")}">${callFrame("convertPlainDateTimeToZoned call", "")}</div>`,
    )}${grow(
      html`<div id="${id("probe-result")}">${callOutput({ label: "What the probe returned", state: "empty", lines: [] })}</div>`,
    )}${grow(html`<div id="${id("explanation")}"></div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "DST Inspector", scope: idPrefix },
    html`${transitions}${probe}`,
  ).toString();
}

function callFrame(label: string, plain: string, code?: SafeHtml): SafeHtml {
  return codeFrame({
    label,
    copyLabel: "Copy call",
    copyText: plain,
    ...(code === undefined ? {} : { code }),
    gate: "codeframe",
  });
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

async function loadModules() {
  const [getMod, convertMod] = await Promise.all([
    GMT_MODULES["zoned/get"](),
    GMT_MODULES["zoned/convert"](),
  ]);
  return {
    getDstTransitions: getMod["getDstTransitions"] as (
      zone: string,
      year: number,
    ) => DstTransition[],
    convertPlainDateTimeToZoned: convertMod["convertPlainDateTimeToZoned"] as (
      value: string,
      timeZone: string,
      options?: { disambiguation?: string },
    ) => string,
  };
}

type Modules = Awaited<ReturnType<typeof loadModules>>;

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function rowsOf(transitions: DstTransition[], zone: string): DstRow[] {
  return transitions.map((t) => {
    const minute = localMinuteOfDayAtTransition(t, zone);
    return {
      kind: transitionType(t),
      date: localDateAtTransition(t, zone) ?? "—",
      hour: Number.isNaN(minute) ? "—" : formatMinuteOfDay(minute),
      instant: t.instant,
      before: t.offsetBefore,
      after: t.offsetAfter,
    };
  });
}

function statusText(
  type: "gap" | "overlap",
  inZone: boolean,
  minute: number,
): string {
  const at = formatMinuteOfDay(minute);
  if (!inZone) return `${at} — normal local time`;
  return type === "gap"
    ? `${at} — inside the gap, this local time never happens`
    : `${at} — inside the overlap, this local time happens twice`;
}

/** The explanation, with the kind named by a badge and the span in words. */
function explanationAside(
  classification: ProbeClassification,
  transitions: DstTransition[],
  presetType: string,
  zone: string,
): SafeHtml {
  if (transitions.length === 0) {
    return aside(
      { label: "About this probe", tone: "note", title: "Note" },
      html`<p>No DST transitions in this zone and year, so there is nothing to probe.</p>`,
    );
  }
  const lead =
    classification.type === "normal"
      ? html`<p>${classification.explanation}</p>`
      : html`<p>${dstBadge(classification.type)} ${classification.explanation}</p>`;

  let span: SafeHtml | "" = "";
  const kind =
    presetType === "gap" ? "gap" : presetType === "overlap" ? "overlap" : null;
  if (kind !== null) {
    const found = transitions.find(kind === "gap" ? isGap : isOverlap);
    const win = found ? getTickerWindow(found, zone) : null;
    if (win) {
      const range = `${formatMinuteOfDay(win.zoneStartMinutes)}–${formatMinuteOfDay(win.zoneEndMinutes)}`;
      span =
        kind === "gap"
          ? html`<p>No local time in <code>${range}</code> happens on that date. Try <code>"earlier"</code> or <code>"later"</code> to see how each resolves it.</p>`
          : html`<p>Every local time in <code>${range}</code> happens twice on that date. <code>"earlier"</code> picks the first occurrence, <code>"later"</code> picks the second.</p>`;
    }
  }
  return aside(
    { label: "About this probe", tone: "note", title: "Note" },
    html`${lead}${span}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, m: Modules, signal: AbortSignal) {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const zoneEl = el<HTMLSelectElement>("zone");
  const yearEl = el<HTMLInputElement>("year");
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const disEl = el<HTMLSelectElement>("disambiguation");
  const tickerEl = el(tickerIds.root);
  const tickerEmptyEl = el(tickerIds.empty);
  const handleEl = el<GmtHandle>(tickerIds.handle);

  // Scrub state, owned here so an unrelated render cannot reset it.
  let activeTransition: DstTransition | null = null;
  let tickerWindow: TickerWindow | null = null;
  let handleMinuteOfDay: number | null = null;

  /** What the thumb reads aloud: the local time and what it is. */
  handleEl.formatValue = (minute) => {
    if (!activeTransition || !tickerWindow) return formatMinuteOfDay(minute);
    const type = transitionType(activeTransition);
    const inZone = isMinuteInZone(minute, tickerWindow);
    const offset =
      minute < tickerWindow.zoneStartMinutes
        ? activeTransition.offsetBefore
        : activeTransition.offsetAfter;
    return `${statusText(type, inZone, minute)}, offset ${inZone ? `${activeTransition.offsetBefore} to ${activeTransition.offsetAfter}` : offset}`;
  };

  function drawTicker(zone: string, transitions: DstTransition[]): void {
    el(tickerIds.empty).textContent =
      transitions.length === 0 ? NO_TRANSITIONS_TICKER_TEXT : TICKER_EMPTY_TEXT;
    if (!tickerWindow || !activeTransition || handleMinuteOfDay === null) {
      tickerEl.hidden = true;
      tickerEmptyEl.hidden = false;
      return;
    }
    tickerEl.hidden = false;
    tickerEmptyEl.hidden = true;
    void zone;

    const win = tickerWindow;
    const type = transitionType(activeTransition);
    const inZone = isMinuteInZone(handleMinuteOfDay, win);

    const band = el(tickerIds.band);
    band.dataset["kind"] = type;
    band.style.setProperty(
      "--gmt-band-from",
      String(minuteToTickerPercent(win.zoneStartMinutes, win)),
    );
    band.style.setProperty(
      "--gmt-band-to",
      String(minuteToTickerPercent(win.zoneEndMinutes, win)),
    );
    for (const [key, minute] of [
      [tickerIds.start, win.zoneStartMinutes],
      [tickerIds.end, win.zoneEndMinutes],
    ] as const) {
      const label = el(key);
      label.textContent = formatMinuteOfDay(minute);
      label.style.setProperty(
        "--gmt-at",
        String(minuteToTickerPercent(minute, win)),
      );
    }

    // Bounds first, then the value, so the clamp sees the new window.
    handleEl.setAttribute("min", String(win.windowStartMinutes));
    handleEl.setAttribute("max", String(win.windowEndMinutes));
    handleEl.setAttribute("step", String(KEY_STEP_MINUTES));
    handleEl.setAttribute("large-step", String(KEY_LARGE_STEP_MINUTES));
    handleEl.value = handleMinuteOfDay;
    handleEl.dataset["zone"] = inZone ? type : "none";

    const sparse = new Set(selectTickMinutes(win, SPARSE_TICK_PX));
    const ticks: TickMark[] = selectTickMinutes(win, DENSE_TICK_PX).map(
      (t) => ({
        at: minuteToTickerPercent(t, win),
        text: formatMinuteOfDay(t),
        major: sparse.has(t),
      }),
    );
    setHtml(el(tickerIds.ticks), dstTicks(ticks));
    el(tickerIds.status).textContent = statusText(
      type,
      inZone,
      handleMinuteOfDay,
    );
  }

  function render(): void {
    const zone = zoneEl.value;
    const year = parseInt(yearEl.value, 10);
    const presetType = presetEl.value;
    const dis = disEl.value || "compatible";

    const transitions = m.getDstTransitions(zone, year);
    setHtml(el("table"), dstTable(rowsOf(transitions, zone)));
    setHtml(
      el("call-getdst"),
      callFrame(
        "getDstTransitions call",
        `getDstTransitions("${zone}", ${year})`,
        raw(
          `${codeSpan("fn", "getDstTransitions")}(${codeSpan("str", `"${zone}"`)}, ${codeSpan("num", String(year))})`,
        ),
      ),
    );

    if (transitions.length === 0) {
      const desc = presetEl.querySelector("p");
      if (desc) {
        desc.textContent = `${zone} has no DST transitions in ${year}, so there is no ${PRESET_NOUN[presetType] ?? "value"} to probe. Pick another zone or year.`;
      }
    }

    // Scrubbable presets take their value from the strip; fixed ones do not.
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

    // The call resolves the wall time, so the [zone] and any offset the "transition"
    // preset embeds are stripped: an offset would answer the ambiguity `disambiguation`
    // exists to resolve.
    const plainValue = value ? toPlainLocalDateTime(value) : "";
    const result = plainValue
      ? m.convertPlainDateTimeToZoned(plainValue, zone, { disambiguation: dis })
      : "";

    drawTicker(zone, transitions);

    if (plainValue === "") {
      /* No transition means no value to probe, so there is no call to show: a call on
         "" would teach the sentinel, not the zone. */
      setHtml(
        el("call-convert"),
        callFrame(
          "convertPlainDateTimeToZoned call",
          "",
          raw(
            `// no call: ${escapeText(zone)} has no DST transitions in ${year}`,
          ),
        ),
      );
    } else {
      setHtml(
        el("call-convert"),
        callFrame(
          "convertPlainDateTimeToZoned call",
          `convertPlainDateTimeToZoned("${plainValue}", "${zone}", { disambiguation: "${dis}" })`,
          raw(
            `${codeSpan("fn", "convertPlainDateTimeToZoned")}(${codeSpan("str", `"${plainValue}"`)}, ${codeSpan("str", `"${zone}"`)}, { disambiguation: ${codeSpan("str", `"${dis}"`)} })`,
          ),
        ),
      );
    }

    // A probe can sit inside a transition's range, so classify against the transitions on
    // its own date. A fixed preset is not assumed normal: a southern zone's "Exact
    // transition instant" is the start of the repeated hour.
    const { onDate, probeHour } = probeContext(plainValue, transitions, zone);
    const classification = classifyProbeResult(
      result,
      onDate,
      probeHour,
      zone,
      {
        disambiguation: dis,
      },
    );

    setHtml(
      el("probe-result"),
      !value
        ? callOutput({
            label: "What the probe returned",
            state: "empty",
            lines: [
              { text: "— No transitions for this zone/year.", lost: false },
            ],
          })
        : callOutput({
            label: "What the probe returned",
            state: result === "" ? "sentinel" : "live",
            lines:
              result === ""
                ? [{ text: "NO SIGNAL", lost: true }]
                : [{ text: result, lost: false }],
          }),
    );
    setHtml(
      el("explanation"),
      explanationAside(classification, transitions, presetType, zone),
    );
  }

  /** Re-derive which transition the strip scrubs, then render. */
  function resetAndRender(): void {
    const zone = zoneEl.value;
    const year = parseInt(yearEl.value, 10);
    const presetType = presetEl.value;
    const transitions = m.getDstTransitions(zone, year);

    activeTransition =
      presetType === "gap"
        ? (transitions.find(isGap) ?? null)
        : presetType === "overlap"
          ? (transitions.find(isOverlap) ?? null)
          : null;
    tickerWindow = activeTransition
      ? getTickerWindow(activeTransition, zone)
      : null;
    // The thumb starts in the middle of the skipped or repeated range: the transition's
    // own local reading is the range's end for a gap, which is outside it.
    handleMinuteOfDay =
      activeTransition && tickerWindow
        ? zoneMidpointMinutes(tickerWindow)
        : null;
    if (handleMinuteOfDay !== null && Number.isNaN(handleMinuteOfDay)) {
      handleMinuteOfDay = null;
      tickerWindow = null;
    }
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === handleEl) {
        handleMinuteOfDay = handleEl.value;
        render();
      } else if (e.target === yearEl) {
        resetAndRender();
      }
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === zoneEl || e.target === presetEl) resetAndRender();
      else if (e.target === disEl) render();
    },
    { signal },
  );

  resetAndRender();

  return () => ({
    zone: zoneEl.value,
    year: yearEl.value ? Number(yearEl.value) : undefined,
    preset: presetEl.value,
    disambiguation: disEl.value,
    offset: undefined,
  });
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Write seeded arguments onto the controls. A zone the select has no option for is
 *  added; any other value a control does not offer is skipped, which leaves it on its
 *  default rather than on an empty selection. */
function applyArgs(root: HTMLElement, args: DstArgs): void {
  const { part: el } = findWidget(root, WIDGET_NAME);
  const zoneEl = el<HTMLSelectElement>("zone");
  if (args.zone !== undefined) {
    if (![...zoneEl.options].some((o) => o.value === args.zone)) {
      zoneEl.add(new Option(args.zone, args.zone));
    }
    zoneEl.value = args.zone;
  }
  if (args.year !== undefined)
    el<HTMLInputElement>("year").value = String(args.year);
  const presetEl = root.querySelector<GmtPreset>("gmt-preset");
  if (args.preset !== undefined && presetEl) presetEl.value = args.preset;
  const disEl = el<HTMLSelectElement>("disambiguation");
  if (
    args.disambiguation !== undefined &&
    [...disEl.options].some((o) => o.value === args.disambiguation)
  ) {
    disEl.value = args.disambiguation;
  }
}

export const mountDstInspector: MountFn<DstArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  /* Args go onto the controls before setup, so its first render reads the seeded values
     and there is no visible correction. A page bootstrap seeds from `window.location`,
     which the template cannot see, so this one path covers both entrances. */
  applyArgs(root, args);
  const permalink = setupWidget(root, modules, signal);
  return onceDestroy(() => {}, permalink);
};
