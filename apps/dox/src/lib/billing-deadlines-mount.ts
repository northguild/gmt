/**
 * The Billing Deadlines widget (INT-58), mountable on its tool page and in the
 * chat rail.
 *
 * A day strip wrapped by ISO week, with the three windows around a demurrage
 * or detention invoice (issue, dispute, resolve) drawn as numbered, patterned
 * lanes. The reader sets the anchor, the dates as they exist, and the windows;
 * the strip and the verdicts are always the real `billingTimeline` call's, and
 * the mount never computes a deadline itself.
 *
 * Built on the component kit: `renderBillingDeadlinesTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its
 * parts by those ids and reads and writes element `value` properties. Every
 * listener is delegated on the widget with the mount's `signal`, so an abort is
 * a complete teardown.
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
  plates,
  raw,
  section,
  setHtml,
  srOnly,
  textInput,
  verdict,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callOutput,
  type CallOutputLine,
} from "~/widgets/families/gnss/call-output";
import {
  billingCalendar,
  billingCells,
  billingLegend,
} from "~/widgets/families/billing/billing-strip";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/billing-deadlines.module.css";
import {
  BILLING_PRESETS,
  CUSTOM_PRESET_ID,
  billingPlates,
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
  type DatesArg,
  type WindowsArg,
} from "./billing-deadlines";
import type { PlateSpec } from "./ledger-widgets";
import { GMT_MODULES } from "./gmt-modules";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { BillingDeadlinesArgs } from "./billing-deadlines";

const WIDGET_NAME = "billing-deadlines";

/** The widest date a plate shows, so the plates keep their width from one reading to the next. */
const PLATE_SAMPLE = "Wed 28 May 8888";

/** The typed fields, by the id part each carries. */
const TYPED = [
  ["anchor", "anchorOn"],
  ["invoice", "invoiceIssuedOn"],
  ["request", "requestReceivedOn"],
  ["issue-days", "issueDays"],
  ["dispute-days", "disputeDays"],
  ["resolution-days", "resolutionDays"],
  ["agreed", "agreedResolutionOn"],
] as const satisfies readonly (readonly [string, keyof BillingState])[];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(specs: readonly PlateSpec[]): Plate[] {
  return specs.map((s) => ({
    caption: s.caption,
    value: s.value,
    lines: s.lines,
    ...(s.series === undefined ? {} : { series: s.series }),
    samples: [PLATE_SAMPLE],
  }));
}

/** The two verdict lines, in plain words. Neither is ever a good or a bad tone. */
function verdictLines(
  s: BillingState,
  result: BillingDeadlines | null,
): SafeHtml {
  const dates = datesOf(s);
  return html`${verdict({
    tone: "neutral",
    title: verdictText(
      "issued",
      dates.invoiceIssuedOn,
      result?.issuedByDeadline ?? null,
    ),
    detail: "",
  })}${verdict({
    tone: "neutral",
    title: verdictText(
      "requested",
      dates.requestReceivedOn,
      result?.requestedByDeadline ?? null,
    ),
    detail: "",
  })}`;
}

/** One readable line naming the three deadlines, an em dash for one that does not exist. */
function deadlinesLine(r: BillingDeadlines | null): string {
  if (r === null) return "";
  const item = (label: string, v: string | null) => `${label} ${v ?? "—"}`;
  return [
    item("Issue by", r.invoiceDeadline),
    item("Dispute by", r.disputeDeadline),
    item("Resolve by", r.resolutionDeadline),
  ].join(" · ");
}

function callFrame(s: BillingState): SafeHtml {
  const [argsHtml, plain] = callSource(s);
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy call",
    copyText: `billingTimeline(${plain})`,
    code: raw(`${codeSpan("fn", "billingTimeline")}(${argsHtml})`),
    gate: "codeframe",
  });
}

function outputOf(result: BillingDeadlines | null | undefined): SafeHtml {
  if (result === undefined) {
    return callOutput({
      label: "What billingTimeline returned",
      state: "empty",
      lines: [],
    });
  }
  const lines: CallOutputLine[] =
    result === null
      ? [{ text: "", lost: true }]
      : [{ text: formatDeadlines(result), lost: false }];
  return callOutput({
    label: "What billingTimeline returned",
    state: result === null ? "sentinel" : "live",
    lines,
  });
}

function reasonOf(text: string | null): SafeHtml {
  if (text === null) return html``;
  return aside(
    { label: "Why null", tone: "caution", title: "Why null" },
    html`<p>${text}</p>`,
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The strip and the outputs are drawn by
 * `mount`, because they come from the real `billingTimeline` call.
 */
export function renderBillingDeadlinesTemplate(
  idPrefix: string,
  args: BillingDeadlinesArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.anchorOn !== undefined;
  const state: BillingState = seeded
    ? readArgs(args)
    : { ...BILLING_PRESETS[0]! };

  const dateField = (
    part: string,
    label: string,
    value: string,
    optional = false,
  ): SafeHtml =>
    field({
      id: id(part),
      label: optional ? `${label} (optional)` : label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          placeholder: "YYYY-MM-DD",
        }),
    });

  const windowField = (part: string, label: string, value: string): SafeHtml =>
    field({
      id: id(part),
      label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value,
          inputMode: "numeric",
          autocomplete: "off",
          spellcheck: false,
        }),
    });

  const pick = section(
    { id: id("pick"), heading: "1. Set the dates and the windows", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...BILLING_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}<fieldset class="${styles.group}"
        ><legend>Dates</legend>${fieldGrid(
          html`${dateField("anchor", "Anchor date (day zero)", state.anchorOn)}${dateField(
            "invoice",
            "Invoice issued on",
            state.invoiceIssuedOn,
            true,
          )}${dateField(
            "request",
            "Request received on",
            state.requestReceivedOn,
            true,
          )}`,
        )}</fieldset
      ><fieldset class="${styles.group}"
        ><legend>Windows, in calendar days</legend>${fieldGrid(
          html`${windowField("issue-days", "Issue window (days)", state.issueDays)}${windowField(
            "dispute-days",
            "Dispute window (days)",
            state.disputeDays,
          )}${windowField(
            "resolution-days",
            "Resolution window (days)",
            state.resolutionDays,
          )}${dateField(
            "agreed",
            "Agreed resolution date",
            state.agreedResolutionOn,
            true,
          )}`,
        )}</fieldset
      ></div
    >`,
  );

  const chain = section(
    { id: id("chain"), heading: "2. The chain", level: 4 },
    html`<div class="${styles.chain}"
      ><div id="${id("plates")}" role="group" aria-label="The three deadlines"
        >${plates(plateList(billingPlates(state, null)), { gate: "hero" })}</div
      >${grow(
        html`<div class="${styles.verdicts}" id="${id("verdicts")}" role="status" aria-label="Verdicts"
          >${verdictLines(state, null)}</div
        >`,
      )}<p role="status" aria-label="Deadlines" id="${id("deadlines")}">${srOnly("")}</p
      >${grow(billingCalendar(id("strip")))}${grow(html`<p role="status" aria-label="Strip summary" id="${id("strip-summary")}"></p>`)}${billingLegend()}${grow(html`<div id="${id("reason")}"></div>`)}<p class="${styles.note}"
        >These are date comparisons. What follows from a date after a deadline is for you and the terms you bill under: GMT computes dates, not liability.</p
      ></div
    >`,
  );

  const returns = section(
    {
      id: id("returns"),
      heading: "3. What billingTimeline returns",
      level: 4,
    },
    html`${grow(html`<div id="${id("call-slot")}">${callFrame(state)}</div>`)}${grow(
      html`<div id="${id("output-slot")}">${outputOf(undefined)}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Billing Deadlines", scope: idPrefix },
    html`${pick}${chain}${returns}`,
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
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): BillingState;
  /** Write a state onto the typed fields. */
  apply(state: BillingState): void;
  syncPreset(): void;
  render(): void;
}

function setupWidget(
  root: HTMLElement,
  m: Modules,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const inputs = TYPED.map(
    ([part, key]) => [el<HTMLInputElement>(part), key] as const,
  );

  function readState(): BillingState {
    const s: BillingState = {
      anchorOn: "",
      invoiceIssuedOn: "",
      requestReceivedOn: "",
      issueDays: "",
      disputeDays: "",
      resolutionDays: "",
      agreedResolutionOn: "",
    };
    for (const [input, key] of inputs) s[key] = input.value.trim();
    return s;
  }

  function apply(s: BillingState): void {
    for (const [input, key] of inputs) input.value = s[key];
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function render(): void {
    const s = readState();
    const dates = datesOf(s);
    const windows = windowsOf(s);
    const result = m.billingTimeline(dates, windows);
    const explanation = result === null ? explainNull(s, m) : null;

    setHtml(el("call-slot"), callFrame(s));
    setHtml(el("output-slot"), outputOf(result));
    setHtml(el("verdicts"), verdictLines(s, result));
    setHtml(
      el("plates"),
      plates(plateList(billingPlates(s, result)), { gate: "hero" }),
    );
    setHtml(el("deadlines"), srOnly(deadlinesLine(result)));

    const strip = dayStrip(s, result);
    setHtml(el("strip"), billingCells(strip));
    el("strip-summary").textContent = strip?.summary ?? "";

    setHtml(
      el("reason"),
      reasonOf(explanation === null ? null : nullReasonText(explanation)),
    );
  }

  const typed: ReadonlySet<EventTarget> = new Set(inputs.map(([i]) => i));
  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === null || !typed.has(e.target)) return;
      syncPreset();
      render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = BILLING_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(chosen);
      syncPreset();
      render();
    },
    { signal },
  );

  render();
  return { readState, apply, syncPreset, render };
}

export const mountBillingDeadlines: MountFn<BillingDeadlinesArgs> = async (
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
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, modules, signal);
  if (args.anchorOn !== undefined) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => {
      // Strings only, and only non-blank fields: a permalink carries no
      // numbers below 1900 and `seedFromLocation` drops empty strings, so a
      // blank window round-trips as blank rather than as a stray "" key.
      const s = controller.readState();
      const out: Record<string, string> = {};
      for (const key of Object.keys(s) as (keyof BillingState)[]) {
        if (s[key] !== "") out[key] = s[key];
      }
      return out;
    },
  );
};
