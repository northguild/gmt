/**
 * The Delivery Scheduler widget (TRAN-9), mountable on its tool page and in the chat rail.
 *
 * A multi-leg journey (up to four legs) chained by the real `scheduleDelivery` into one ETA,
 * drawn two ways: a chart (a route schematic, or every leg to scale) and an itinerary that
 * groups every departure, arrival, handoff and DST transition by the local date on which it
 * happens. The mount never computes an arrival, a ready instant or a verdict: every one comes
 * from `buildItinerary` (`delivery-scheduler.ts`), which reads `collectJourneyFacts`
 * (`transport-widgets.ts`), the real library called on prefixes and zero-length legs.
 *
 * Built on the component kit: `renderDeliverySchedulerTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids.
 * Every listener is delegated on the widget with the mount's `signal`. The two charts are
 * TanStack Charts' own DOM; they are redrawn when the width crosses the compact breakpoint,
 * when the theme changes and when the hidden view is shown, and both observers are released
 * on destroy.
 */
import { mountChart } from "@tanstack/charts/dom";
import { tooltip } from "@tanstack/charts/tooltip";
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  section,
  select,
  setHtml,
  srOnly,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { paintCalls } from "~/widgets/families/cutoff/paint-calls";
import { paintOutput } from "~/widgets/families/cutoff/paint-output";
import { callOutput } from "~/widgets/families/gnss/call-output";
import {
  deliveryLegend,
  etaSummaryCard,
  itineraryList,
} from "~/widgets/families/transport/delivery-parts";
import {
  legFieldset,
  legHeader,
  setChoice,
  zoneChoices,
} from "~/widgets/families/transport/leg-fieldset";
import { viewToggle } from "~/widgets/families/transport/view-toggle";
import { chartHost } from "~/widgets/families/transport/chart-host";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/delivery-scheduler.module.css";
import {
  CUSTOM_PRESET_ID,
  DELIVERY_PRESETS,
  buildChartData,
  buildEtaSummary,
  buildItinerary,
  legCalls,
  legsOf,
  matchPreset,
  optionsOf,
  originZoneOf,
  permalinkOf,
  readArgs,
  type DeliverySchedulerArgs,
  type DeliveryPreset,
  type DeliveryState,
} from "./delivery-scheduler";
import {
  buildRouteChartDefinition,
  buildScaleChartDefinition,
  laneChartHeight,
} from "./delivery-scheduler-charts";
import { loadTransportLib } from "./transport-lib";
import {
  TRANSPORT_ZONES,
  collectJourneyFacts,
  failureText,
  formatSchedule,
  type JourneyFacts,
  type ScheduleLeg,
  type TransportLib,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";

/** The chart draws a picture and its summary text says the same thing: nothing
 *  in it is a control, so the chart takes no place in the tab order. The library
 *  writes `tabindex="0"` on the `<svg>` unless it is told otherwise. */
const CHART_TAB_INDEX = -1;

export type { DeliverySchedulerArgs } from "./delivery-scheduler";

const WIDGET_NAME = "delivery-scheduler";
const LEG_NUMBERS = [1, 2, 3, 4] as const;
const NO_SIGNAL = "NO SIGNAL";

/** Below this width the chart drops its own city and date text and leaves them to the tooltip. */
const COMPACT_PX = 640;

const isSeeded = (args: DeliverySchedulerArgs): boolean =>
  args.legs !== undefined ||
  args.legCount !== undefined ||
  args.duration1 !== undefined;

/** A preset as the form's state. */
function presetState(p: DeliveryPreset): DeliveryState {
  return readArgs({
    legs: p.legs as never,
    startTimeZone: p.startTimeZone || undefined,
  });
}

/**
 * The Journey Split's address for these legs. The two tools share the flat leg keys, so it is
 * the Delivery Scheduler's own permalink under the other kind.
 */
function journeySplitHref(state: DeliveryState): string {
  return encodeWidgetPermalink("journeysplit", permalinkOf(state));
}

function linksOf(state: DeliveryState): SafeHtml {
  return toolLinks({
    label: "Other tools",
    links: [
      {
        text: "Split this journey into moving and waiting",
        href: journeySplitHref(state),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. Seeded when
 * `args.legs`, `args.legCount` or `args.duration1` is defined, else the first preset. The
 * summary, the charts, the itinerary and the outputs are drawn by `mount`, because they come
 * from the real library calls.
 */
export function renderDeliverySchedulerTemplate(
  idPrefix: string,
  args: DeliverySchedulerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: DeliveryState = isSeeded(args)
    ? readArgs(args)
    : presetState(DELIVERY_PRESETS[0]!);
  const count = Number.parseInt(state.legCount, 10) || 1;

  const build = section(
    { id: id("build"), heading: "1. Build the journey", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...DELIVERY_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("leg-count"),
        label: "Legs",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: String(count),
            options: LEG_NUMBERS.map((n) => ({
              value: String(n),
              label: String(n),
            })),
          }),
      })}${field({
        id: id("start-zone"),
        label: "Start zone (optional)",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.startTimeZone,
            options: zoneChoices(
              TRANSPORT_ZONES,
              state.startTimeZone,
              "(none)",
            ),
          }),
      })}`,
    )}
      <p class="${styles.note}">For a published local first departure with no offset or zone of its own.</p>
      <p class="${styles.note}">Durations are ISO 8601: PT46H is 46 hours, PT2H30M is two and a half hours, P11D is 11 days.</p>
      ${LEG_NUMBERS.map((n) =>
        legFieldset({
          id,
          n,
          leg: state.legs[n - 1]!,
          hidden: n > count,
          zones: TRANSPORT_ZONES,
        }),
      )}</div>`,
  );

  const read = section(
    {
      id: id("read"),
      heading: "2. The journey, handoff by handoff",
      level: 4,
    },
    html`${grow(html`<div id="${id("eta-slot")}">${etaSummaryCard(null)}</div>`)}${viewToggle(
      {
        label: "Chart view",
        views: [
          { id: id("view-route"), label: "Route", pressed: true },
          { id: id("view-scale"), label: "To scale", pressed: false },
        ],
      },
    )}${grow(
      html`<div class="${styles.charts}">
        <div class="${styles.panel}" id="${id("panel-route")}">${chartHost(id("chart-route"))}</div>
        <div class="${styles.panel}" id="${id("panel-scale")}" hidden>${chartHost(id("chart-scale"))}</div>
      </div>`,
    )}
      <p id="${id("timeline-summary")}">${srOnly("")}</p>
      ${deliveryLegend()}${grow(
        html`<div id="${id("journey-slot")}">${itineraryList("Itinerary", null)}</div>`,
      )}${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const returns = section(
    {
      id: id("returns"),
      heading: "3. What scheduleDelivery returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("call-delivery")}">${codeFrame({
        label: "scheduleDelivery call",
        copyLabel: "Copy scheduleDelivery call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out-delivery")}">${callOutput({
        label: "scheduleDelivery returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(html`<div id="${id("links")}">${linksOf(state)}</div>`)}`,
  );

  const perLeg = section(
    {
      id: id("per-leg"),
      heading: "4. What transitTime and etaAtZone return",
      level: 4,
    },
    html`<p class="${styles.note}">Every arrival is transitTime of a departure and a duration, and every local time is etaAtZone of an instant and a zone. These are the two calls for one leg. Their results are that leg's arrival and localArrival in step 3.</p>${fieldGrid(
      field({
        id: id("leg-pick"),
        label: "Leg",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: "0",
            options: Array.from({ length: count }, (_, i) => ({
              value: String(i),
              label: `Leg ${i + 1}`,
            })),
          }),
      }),
    )}${grow(
      html`<div id="${id("call-transit")}">${codeFrame({
        label: "transitTime call",
        copyLabel: "Copy transitTime call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out-transit")}">${callOutput({
        label: "transitTime returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(
      html`<div id="${id("call-eta")}">${codeFrame({
        label: "etaAtZone call",
        copyLabel: "Copy etaAtZone call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out-eta")}">${callOutput({
        label: "etaAtZone returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Delivery Scheduler", scope: idPrefix },
    html`${build}${read}${returns}${perLeg}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DeliveryState;
  apply(state: DeliveryState): void;
  start(): void;
  release(): void;
}

type ChartHost = ReturnType<typeof mountChart>;

function setupWidget(
  root: HTMLElement,
  lib: TransportLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const legCountEl = el<HTMLSelectElement>("leg-count");
  const startZoneEl = el<HTMLSelectElement>("start-zone");
  const pickEl = el<HTMLSelectElement>("leg-pick");
  const routeButton = el<HTMLButtonElement>("view-route");
  const scaleButton = el<HTMLButtonElement>("view-scale");
  const legEls = LEG_NUMBERS.map((n) => ({
    fieldset: el<HTMLElement>(`leg-${n}`),
    legend: el<HTMLElement>(`leg-legend-${n}`),
    mode: el<HTMLSelectElement>(`mode-${n}`),
    duration: el<HTMLInputElement>(`duration-${n}`),
    zone: el<HTMLSelectElement>(`zone-${n}`),
    departure: el<HTMLInputElement>(`departure-${n}`),
    dwell: el<HTMLInputElement>(`dwell-${n}`),
  }));
  const typed: readonly EventTarget[] = legEls.flatMap((l) => [
    l.duration,
    l.departure,
    l.dwell,
  ]);
  const picked: readonly EventTarget[] = legEls.flatMap((l) => [
    l.zone,
    l.mode,
  ]);

  const legCount = (): number => Number.parseInt(legCountEl.value, 10) || 1;

  function readState(): DeliveryState {
    const legs = legEls.map((l) => ({
      departure: l.departure.value.trim(),
      duration: l.duration.value.trim(),
      timeZone: l.zone.value.trim(),
      dwellAfter: l.dwell.value.trim(),
      mode: l.mode.value.trim(),
    })) as DeliveryState["legs"];
    return {
      legCount: legCountEl.value,
      startTimeZone: startZoneEl.value,
      legs,
    };
  }

  function showFieldsets(count: number): void {
    legEls.forEach((l, i) => {
      l.fieldset.hidden = i + 1 > count;
    });
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function refreshLegends(): void {
    legEls.forEach((l, i) => {
      setHtml(
        l.legend,
        legHeader(i + 1, {
          mode: l.mode.value,
          duration: l.duration.value,
          timeZone: l.zone.value,
        }),
      );
    });
  }

  // The charts ------------------------------------------------------------

  let routeChart: ChartHost | null = null;
  let scaleChart: ChartHost | null = null;
  let drawnCharts: {
    data: NonNullable<ReturnType<typeof buildChartData>>;
    label: string;
    axisZone: string;
  } | null = null;

  const isCompact = (): boolean => widgetEl.clientWidth < COMPACT_PX;
  const routeShown = (): boolean =>
    routeButton.getAttribute("aria-pressed") === "true";

  function destroyCharts(): void {
    routeChart?.destroy();
    scaleChart?.destroy();
    routeChart = null;
    scaleChart = null;
  }

  /** Draws the shown chart. A hidden panel measures 0 wide, so the other waits until it is shown. */
  function drawCharts(): void {
    const routeHost = el("chart-route");
    const scaleHost = el("chart-scale");
    if (drawnCharts === null) {
      destroyCharts();
      routeHost.replaceChildren();
      scaleHost.replaceChildren();
      return;
    }
    const { data, label, axisZone } = drawnCharts;
    if (routeShown()) {
      const compact = isCompact();
      const definition = buildRouteChartDefinition(data, { tooltip, compact });
      // A one-row schematic needs far less height than a Gantt.
      const options = {
        definition: definition as never,
        ariaLabel: label,
        tabIndex: CHART_TAB_INDEX,
        aspectRatio: compact ? 1.5 : 3.5,
      };
      if (routeChart) routeChart.update(options);
      else routeChart = mountChart(routeHost, options);
    } else {
      const definition = buildScaleChartDefinition(data, {
        tooltip,
        axisZone,
        plotWidthPx: scaleHost.clientWidth || widgetEl.clientWidth,
      });
      // Content-sized: a fixed height per lane, so width is free to shrink and height never is.
      const options = {
        definition: definition as never,
        ariaLabel: `${label} — to scale`,
        tabIndex: CHART_TAB_INDEX,
        height: laneChartHeight(data.legs.length),
      };
      if (scaleChart) scaleChart.update(options);
      else scaleChart = mountChart(scaleHost, options);
    }
  }

  // The step 4 calls ------------------------------------------------------

  function drawLegCalls(facts: JourneyFacts, legs: ScheduleLeg[]): void {
    if (pickEl.options.length !== legs.length) {
      const current = pickEl.value;
      pickEl.replaceChildren(
        ...legs.map((_, i) => new Option(`Leg ${i + 1}`, String(i))),
      );
      pickEl.value = Number(current) < legs.length ? current : "0";
      if (pickEl.value === "") pickEl.value = "0";
    }
    const calls = legCalls(facts, legs, Number(pickEl.value) || 0, lib);
    const {
      departure = "",
      duration = "",
      arrival = "",
      zone = "",
      local = "",
    } = calls ?? {};
    const returned = (label: string, value: string) => ({
      label,
      state: value === "" ? ("sentinel" as const) : ("live" as const),
      lines: [
        value === ""
          ? { text: NO_SIGNAL, lost: true }
          : { text: JSON.stringify(value), lost: false },
      ],
    });
    paintCalls(el("call-transit"), [
      { fn: "transitTime", args: [departure, duration], result: arrival },
    ]);
    paintOutput(el("out-transit"), returned("transitTime returned", arrival));
    paintCalls(el("call-eta"), [
      { fn: "etaAtZone", args: [arrival, zone], result: local },
    ]);
    paintOutput(el("out-eta"), returned("etaAtZone returned", local));
  }

  // The whole reading -----------------------------------------------------

  function render(): void {
    refreshLegends();

    const state = readState();
    const legs = legsOf(state);
    const options = optionsOf(state);
    const result = lib.scheduleDelivery(legs, options);

    paintCalls(el("call-delivery"), [
      {
        fn: "scheduleDelivery",
        args: options === undefined ? [legs] : [legs, options],
        result,
      },
    ]);
    paintOutput(
      el("out-delivery"),
      result === null
        ? {
            label: "scheduleDelivery returned",
            state: "sentinel",
            lines: [{ text: NO_SIGNAL, lost: true }],
          }
        : {
            label: "scheduleDelivery returned",
            state: "live",
            lines: [{ text: formatSchedule(result), lost: false }],
          },
    );
    setHtml(el("links"), linksOf(state));

    const facts = collectJourneyFacts(legs, options, lib);
    drawLegCalls(facts, legs);
    const originZone = originZoneOf(state);
    const itinerary = buildItinerary(facts, legs, originZone, lib);
    const chartData = buildChartData(facts, legs, originZone, lib);
    setHtml(
      el("eta-slot"),
      etaSummaryCard(buildEtaSummary(facts, legs, chartData)),
    );

    const summary = itinerary?.summary ?? "";
    drawnCharts =
      chartData === null
        ? null
        : {
            data: chartData,
            label: summary || "Delivery schedule",
            axisZone: originZone ?? legs[0]?.timeZone ?? "UTC",
          };
    drawCharts();
    setHtml(el("timeline-summary"), srOnly(summary));
    setHtml(el("journey-slot"), itineraryList("Itinerary", itinerary));

    if (facts.failure) {
      const text = failureText(facts.failure, facts, legs, lib);
      setHtml(
        el("reason"),
        aside(
          {
            label: "Why NO SIGNAL",
            tone: "caution",
            title: "Why NO SIGNAL",
          },
          html`<p>${text}</p>`,
        ),
      );
    } else {
      setHtml(el("reason"), html``);
    }
  }

  function apply(state: DeliveryState): void {
    const count = Number.parseInt(state.legCount, 10) || 1;
    legCountEl.value = String(count);
    setChoice(startZoneEl, state.startTimeZone);
    legEls.forEach((l, i) => {
      const leg = state.legs[i]!;
      l.departure.value = leg.departure;
      l.duration.value = leg.duration;
      setChoice(l.zone, leg.timeZone);
      l.dwell.value = leg.dwellAfter;
      setChoice(l.mode, leg.mode);
    });
    showFieldsets(count);
    syncPreset();
  }

  function showView(route: boolean): void {
    routeButton.setAttribute("aria-pressed", String(route));
    scaleButton.setAttribute("aria-pressed", String(!route));
    el("panel-route").hidden = !route;
    el("panel-scale").hidden = route;
    drawCharts();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === null || !typed.includes(e.target)) return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = DELIVERY_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        syncPreset();
        render();
        return;
      }
      if (target === pickEl) {
        render();
        return;
      }
      if (target === legCountEl) {
        showFieldsets(legCount());
        syncPreset();
        render();
        return;
      }
      if (
        target === startZoneEl ||
        (target !== null && picked.includes(target))
      ) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "click",
    (e) => {
      if (!(e.target instanceof Element)) return;
      const button = e.target.closest("button");
      if (button === routeButton) showView(true);
      else if (button === scaleButton) showView(false);
    },
    { signal },
  );

  // A chart's marks are a fixed count once built; only the layout changes with width, so a
  // crossing of the breakpoint (not every resize) is what needs a new definition.
  let wasCompact = isCompact();
  const resizeObserver = new ResizeObserver(() => {
    const now = isCompact();
    if (now === wasCompact) return;
    wasCompact = now;
    drawCharts();
  });
  resizeObserver.observe(widgetEl);

  // The chart's colours resolve once, at draw time, from `var(--gmt-*)`: the bar-label ink is a
  // computed colour, not a variable, so a theme change needs a real redraw.
  const themeObserver = new MutationObserver(() => {
    if (drawnCharts !== null) {
      destroyCharts();
      el("chart-route").replaceChildren();
      el("chart-scale").replaceChildren();
      drawCharts();
    }
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  showFieldsets(legCount());
  syncPreset();

  return {
    readState,
    apply,
    start: render,
    release() {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      destroyCharts();
    },
  };
}

export const mountDeliveryScheduler: MountFn<DeliverySchedulerArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TransportLib;
  try {
    lib = await loadTransportLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) controller.apply(readArgs(args));
  controller.start();

  return onceDestroy(
    () => controller.release(),
    () => permalinkOf(controller.readState()),
  );
};
