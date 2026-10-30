/**
 * @vitest-environment jsdom
 *
 * The Billing Deadlines widget end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`, through the roles and names a reader meets.
 * Every preset's printed call and result are checked against the literal
 * `billingTimeline` JSDoc examples they draw, and the strip's deadline days against
 * the library's own dates, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import { renderHtml } from "~/widgets/test-fixture";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { BILLING_PRESETS, NULL_REASON_TEXT } from "./billing-deadlines";
import { renderBillingDeadlinesTemplate } from "./billing-deadlines-mount";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showBillingDeadlines"] as AnyWidgetEntry;

/** The `billingTimeline.ts` JSDoc examples the presets draw, verbatim:
 *  [call, result, the three deadline days as the strip names them]. */
const EXPECTED: Record<
  string,
  [string, string, [string | null, string | null, string | null]]
> = {
  "thirty-day-30": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30", requestedByDeadline: null, resolutionDeadline: null }',
    ["Tue 31 Mar 2026", "Thu 30 Apr 2026", null],
  ],
  "thirty-day-31": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01", requestedByDeadline: null, resolutionDeadline: null }',
    ["Tue 31 Mar 2026", "Fri 1 May 2026", null],
  ],
  "thirty-rebill": [
    'billingTimeline({ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-05-05", requestedByDeadline: null, resolutionDeadline: null }',
    ["Thu 9 Apr 2026", "Tue 5 May 2026", null],
  ],
  forecast: [
    'billingTimeline({ anchorOn: "2026-03-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }',
    ["Tue 31 Mar 2026", null, null],
  ],
  "contract-14-14-45": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 })',
    '{ invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: true, resolutionDeadline: "2026-05-02" }',
    ["Sun 15 Mar 2026", "Thu 19 Mar 2026", "Sat 2 May 2026"],
  ],
};

const LANE_WORDS = [
  "",
  "issue window day",
  "dispute window day",
  "resolution window day",
];
const DEADLINE_WORDS = [
  "",
  "invoice deadline",
  "dispute deadline",
  "resolution deadline",
];

const flat = (text: string) => text.replace(/\n\s*/g, " ");
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const anchor = () =>
  screen.getByRole("textbox", { name: "Anchor date (day zero)" });
const invoice = () =>
  screen.getByRole("textbox", { name: "Invoice issued on (optional)" });
const request = () =>
  screen.getByRole("textbox", { name: "Request received on (optional)" });
const issueDays = () =>
  screen.getByRole("textbox", { name: "Issue window (days)" });
const disputeDays = () =>
  screen.getByRole("textbox", { name: "Dispute window (days)" });
const resolutionDays = () =>
  screen.getByRole("textbox", { name: "Resolution window (days)" });
const agreed = () =>
  screen.getByRole("textbox", { name: "Agreed resolution date (optional)" });

interface State {
  anchorOn?: string;
  invoiceIssuedOn?: string;
  requestReceivedOn?: string;
  issueDays?: string;
  disputeDays?: string;
  resolutionDays?: string;
  agreedResolutionOn?: string;
}

/** Replaces what a text box holds, in one input event. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

async function typeState(w: Widget, state: State) {
  await enter(w, anchor(), state.anchorOn ?? "");
  await enter(w, invoice(), state.invoiceIssuedOn ?? "");
  await enter(w, request(), state.requestReceivedOn ?? "");
  await enter(w, issueDays(), state.issueDays ?? "");
  await enter(w, disputeDays(), state.disputeDays ?? "");
  await enter(w, resolutionDays(), state.resolutionDays ?? "");
  await enter(w, agreed(), state.agreedResolutionOn ?? "");
}

const calls = () => screen.getByRole("group", { name: "Calls made" });
const output = () =>
  screen.getByRole("status", { name: "What billingTimeline returned" });
const verdicts = () => screen.getByRole("status", { name: "Verdicts" });
const deadlines = () => screen.getByRole("status", { name: "Deadlines" });
const summary = () => screen.getByRole("status", { name: "Strip summary" });
const plates = () => screen.getByRole("group", { name: "The three deadlines" });
const reason = () => screen.queryByRole("complementary", { name: "Why null" });
const strip = () => screen.getByRole("list", { name: "Day strip" });
const cellNames = () =>
  within(strip())
    .queryAllByRole("listitem")
    .map((c) => c.getAttribute("aria-label")!);

/** The names of the days that hold a lane, `lane` being 1, 2 or 3. */
const laneCells = (lane: 1 | 2 | 3) =>
  cellNames().filter((n) => n.includes(LANE_WORDS[lane]!));

/** The dates a lane's deadline is named on. */
const laneDeadlineDates = (lane: 1 | 2 | 3) =>
  laneCells(lane)
    .filter((n) => n.includes(DEADLINE_WORDS[lane]!))
    .map((n) => n.split(":")[0]!);

const NO_RESULT = "no result";

function template(args?: Record<string, unknown>): HTMLElement {
  return renderHtml(renderBillingDeadlinesTemplate("billing-deadlines", args))
    .host;
}

describe("renderBillingDeadlinesTemplate", () => {
  it("renders three numbered sections, every field by name, the legend and no result", () => {
    const host = within(template());
    expect(
      host.getByRole("region", { name: "Billing Deadlines" }),
    ).toBeInTheDocument();
    expect(
      host.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Set the dates and the windows",
      "2. The chain",
      "3. What billingTimeline returns",
    ]);
    for (const name of [
      "Anchor date (day zero)",
      "Invoice issued on (optional)",
      "Request received on (optional)",
      "Issue window (days)",
      "Dispute window (days)",
      "Resolution window (days)",
      "Agreed resolution date (optional)",
    ]) {
      expect(host.getByRole("textbox", { name })).toBeInTheDocument();
    }
    expect(host.getByRole("group", { name: "Dates" })).toBeInTheDocument();
    expect(
      host.getByRole("group", { name: "Windows, in calendar days" }),
    ).toBeInTheDocument();
    expect(
      within(host.getByRole("list", { name: "Legend" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(6);
    expect(host.getAllByText(NO_RESULT)).toHaveLength(3);
  });

  it("opens on the first preset when unseeded", () => {
    const host = within(template());
    expect(host.getByRole("combobox", { name: "Preset" })).toHaveValue(
      "thirty-day-30",
    );
    expect(
      host.getByRole("textbox", { name: "Anchor date (day zero)" }),
    ).toHaveValue("2026-03-01");
  });

  it("seeds from args and shows custom when nothing matches", () => {
    const host = within(template({ anchorOn: "2026-05-01", issueDays: 20 }));
    expect(
      host.getByRole("textbox", { name: "Anchor date (day zero)" }),
    ).toHaveValue("2026-05-01");
    expect(
      host.getByRole("textbox", { name: "Issue window (days)" }),
    ).toHaveValue("20");
    expect(
      host.getByRole("textbox", { name: "Dispute window (days)" }),
    ).toHaveValue("");
    expect(host.getByRole("combobox", { name: "Preset" })).toHaveValue(
      "custom",
    );
  });

  it("shows the date format as a placeholder on the dates and none on the windows", () => {
    const host = within(template());
    expect(host.getAllByPlaceholderText("YYYY-MM-DD")).toHaveLength(4);
    for (const name of [
      "Issue window (days)",
      "Dispute window (days)",
      "Resolution window (days)",
    ]) {
      expect(
        host.getByRole("textbox", { name }),
      ).not.toHaveAccessibleDescription("YYYY-MM-DD");
    }
    expect(host.queryAllByPlaceholderText(/./)).toHaveLength(4);
  });

  it("escapes what it interpolates", () => {
    const host = within(
      template({ anchorOn: '"><img src=x onerror=alert(1)>' }),
    );
    expect(host.queryByRole("img")).not.toBeInTheDocument();
    expect(
      host.getByRole("textbox", { name: "Anchor date (day zero)" }),
    ).toHaveValue('"><img src=x onerror=alert(1)>');
  });

  it("says that these are date comparisons, not liability", () => {
    expect(template()).toHaveTextContent("GMT computes dates, not liability.");
  });
});

describe("mountBillingDeadlines", () => {
  it.each(BILLING_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s, with matching lane deadlines",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      const [call, result, [issue, dispute, resolve]] = EXPECTED[id!]!;

      expect(calls()).toHaveTextContent(call);
      expect(output()).toHaveTextContent(exact(flat(result)));
      expect(laneDeadlineDates(1)).toEqual(issue === null ? [] : [issue]);
      expect(laneDeadlineDates(2)).toEqual(dispute === null ? [] : [dispute]);
      expect(laneDeadlineDates(3)).toEqual(resolve === null ? [] : [resolve]);
      await expectNoAxeViolations(w.root);
    },
  );

  it("names a preset's description beside the control", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "forecast");
    expect(preset()).toHaveValue("forecast");
    expect(
      screen.getAllByText(
        BILLING_PRESETS.find((p) => p.id === "forecast")!.description,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows the verdicts for the thirty-day-30 preset", async () => {
    await open();
    expect(verdicts()).toHaveTextContent(
      "Invoice issued 2026-03-31: on or before the deadline",
    );
    expect(verdicts()).toHaveTextContent("No request date yet");
  });

  it("turns the verdict to after the deadline on day 31", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "thirty-day-31");
    expect(verdicts()).toHaveTextContent(
      "Invoice issued 2026-04-01: after the deadline",
    );
  });

  it("reads a request on the dispute deadline as on or before it (V4)", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "2026-04-19",
      issueDays: "30",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(output()).toHaveTextContent(
      exact(
        '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: true, resolutionDeadline: "2026-05-19" }',
      ),
    );
    expect(verdicts()).toHaveTextContent(
      "Request received 2026-04-19: on or before the deadline",
    );
    await expectNoAxeViolations(w.root);
  });

  it("replaces the computed resolution deadline with an agreed date (V5)", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "2026-04-20",
      issueDays: "30",
      disputeDays: "30",
      resolutionDays: "30",
      agreedResolutionOn: "2026-06-01",
    });
    expect(output()).toHaveTextContent(
      exact(
        '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: false, resolutionDeadline: "2026-06-01" }',
      ),
    );
    expect(calls()).toHaveTextContent(
      'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-20" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30, agreedResolutionOn: "2026-06-01" })',
    );
  });

  it("defaults no window: a blank one prints no key and shows NO SIGNAL", async () => {
    const w = await open({ anchorOn: "2026-03-01", issueDays: "30" });
    expect(disputeDays()).toHaveValue("");
    expect(resolutionDays()).toHaveValue("");
    expect(calls()).toHaveTextContent(
      'billingTimeline({ anchorOn: "2026-03-01" }, { issueDays: 30 })',
    );
    expect(output()).toHaveTextContent(exact("NO SIGNAL"));
    expect(reason()).toHaveTextContent("disputeDays is missing");
    await expectNoAxeViolations(w.root);
  });

  it("omits a blank agreed date from the call and stays live, never null (V1)", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "forecast");
    expect(calls()).not.toHaveTextContent("agreedResolutionOn");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(reason()).not.toBeInTheDocument();
  });

  const REASON_CASES: [string, State, string][] = [
    [
      "invalid-anchor",
      {
        anchorOn: "not-a-date",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "anchor date is not a valid date",
    ],
    [
      "invalid-invoice",
      {
        anchorOn: "2026-03-01",
        invoiceIssuedOn: "not-a-date",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "invoice date is not a valid date",
    ],
    [
      "invalid-request",
      {
        anchorOn: "2026-03-01",
        invoiceIssuedOn: "2026-03-05",
        requestReceivedOn: "not-a-date",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "request date is not a valid date",
    ],
    [
      "request-without-invoice",
      {
        anchorOn: "2026-03-01",
        requestReceivedOn: "2026-04-19",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "needs the invoice it disputes",
    ],
    [
      "request-before-invoice",
      {
        anchorOn: "2026-03-01",
        invoiceIssuedOn: "2026-03-20",
        requestReceivedOn: "2026-03-19",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "before the invoice date",
    ],
    [
      "missing-window",
      {
        anchorOn: "2026-03-01",
        issueDays: "30",
        disputeDays: "",
        resolutionDays: "30",
      },
      "disputeDays is missing",
    ],
    [
      "invalid-window",
      {
        anchorOn: "2026-03-01",
        issueDays: "-1",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "issueDays must be a whole number",
    ],
    [
      "invalid-agreed",
      {
        anchorOn: "2026-03-01",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
        agreedResolutionOn: "not-a-date",
      },
      "agreed resolution date is not a valid date",
    ],
    [
      "agreed-before-request",
      {
        anchorOn: "2026-03-01",
        invoiceIssuedOn: "2026-03-20",
        requestReceivedOn: "2026-04-20",
        issueDays: "30",
        disputeDays: "30",
        resolutionDays: "30",
        agreedResolutionOn: "2026-04-01",
      },
      "before the request date",
    ],
    [
      "out-of-range",
      {
        anchorOn: "2026-03-01",
        issueDays: "999999999999",
        disputeDays: "30",
        resolutionDays: "30",
      },
      "runs past the calendar",
    ],
  ];

  it.each(REASON_CASES)(
    "explains %s, and the real billingTimeline agrees it is null",
    async (_reason, state, substring) => {
      const w = await open();
      await typeState(w, state);
      expect(output()).toHaveTextContent(exact("NO SIGNAL"));
      expect(reason()).toHaveTextContent(substring);
      await expectNoAxeViolations(w.root);
    },
  );

  it("never shows a forbidden verdict word, in any preset's words or any null reason", async () => {
    const forbidden = /\b(timely|untimely|late|void|payable|compliant)\b/i;
    const w = await open();
    for (const p of BILLING_PRESETS) {
      await w.user.selectOptions(preset(), p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
      for (const name of cellNames()) expect(name).not.toMatch(forbidden);
    }
    for (const text of Object.values(NULL_REASON_TEXT)) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it("collapses a multi-year window to a gap row within the cell cap", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      issueDays: "3650",
      disputeDays: "3650",
      resolutionDays: "3650",
    });
    const names = cellNames();
    expect(names.length).toBeLessThanOrEqual(120);
    expect(names.some((n) => /\d+ days not drawn$/.test(n))).toBe(true);
    expect(summary()).toHaveTextContent("days not drawn");
    await expectNoAxeViolations(w.root);
  });
});

describe("permalinks", () => {
  it.each(BILLING_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(new RegExp(`^${SITE_BASE}/.*\\?w=billing&wa=`));
      const state = seedFromLocation("billing", url.slice(url.indexOf("?")))!;
      expect(Object.values(state).every((v) => typeof v === "string")).toBe(
        true,
      );
      first.destroy();

      await open(state);
      expect(preset()).toHaveValue(id);
      expect(output()).toHaveTextContent(exact(flat(EXPECTED[id!]![1])));
    },
  );

  it("leaves a blank field out of the link", async () => {
    const w = await open();
    await enter(w, resolutionDays(), "");
    const url = w.permalink();
    const state = seedFromLocation("billing", url.slice(url.indexOf("?")))!;
    expect(state).not.toHaveProperty("resolutionDays");
    expect(state["anchorOn"]).toBe("2026-03-01");
  });

  it("seeds from a hand-built link", async () => {
    const url = encodeWidgetPermalink("billing", {
      anchorOn: "2026-03-01",
      issueDays: "30",
      disputeDays: "30",
      resolutionDays: "30",
    });
    const state = seedFromLocation("billing", url.slice(url.indexOf("?")))!;
    await open(state);
    expect(preset()).toHaveValue("forecast");
  });
});

/**
 * The widget draws and labels the library's canonical dates and orders them
 * with `Temporal.PlainDate.compare`, never by string. An annotated or
 * expanded-year date the library accepts must draw exactly as its bare ISO
 * form does, and string order breaks outside years 0000-9999.
 */
describe("dates the library accepts in any ISO form", () => {
  const WINDOWS = { issueDays: "30", disputeDays: "30", resolutionDays: "30" };

  it.each([
    "2026-03-01[u-ca=iso8601]",
    "2026-03-01[foo=bar]",
    "2026-03-01[Europe/London]",
    "+002026-03-01",
  ])(
    "draws anchor %s exactly as 2026-03-01: its mark, 31 lane cells, a bare summary",
    async (anchorOn) => {
      const w = await open();
      await typeState(w, { anchorOn, ...WINDOWS });
      expect(output()).toHaveTextContent('invoiceDeadline: "2026-03-31"');
      const lane1 = laneCells(1);
      expect(lane1).toHaveLength(31);
      expect(lane1[0]).toBe("Sun 1 Mar 2026: anchor; issue window day 0");
      expect(lane1.at(-1)).toBe(
        "Tue 31 Mar 2026: issue window day 30, invoice deadline",
      );
      expect(summary()).toHaveTextContent(
        exact("31 days from 2026-03-01 to 2026-03-31."),
      );
      await expectNoAxeViolations(w.root);
    },
  );

  it("prints the call with the date as typed, so the printed call stays the real call", async () => {
    const w = await open();
    await typeState(w, { anchorOn: "2026-03-01[u-ca=iso8601]", ...WINDOWS });
    expect(calls()).toHaveTextContent(
      'billingTimeline({ anchorOn: "2026-03-01[u-ca=iso8601]" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    );
  });

  it("marks, lanes and labels annotated invoice and request dates by their bare ISO form", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20[u-ca=iso8601]",
      requestReceivedOn: "2026-04-19[foo=bar]",
      ...WINDOWS,
    });
    const names = cellNames();
    expect(names).toContain(
      "Fri 20 Mar 2026: invoice issued; issue window day 19; dispute window day 0",
    );
    expect(names).toContain(
      "Sun 19 Apr 2026: dispute request received; dispute window day 30, dispute deadline; resolution window day 0",
    );
    expect(laneCells(2)).toHaveLength(31);
    expect(laneCells(3)).toHaveLength(31);
    expect(verdicts()).toHaveTextContent(
      "Invoice issued 2026-03-20: on or before the deadline",
    );
    expect(verdicts()).toHaveTextContent(
      "Request received 2026-04-19: on or before the deadline",
    );
  });

  it("orders dates across year 9999 by date, not by string", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "9999-12-01",
      issueDays: "60",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(output()).toHaveTextContent('invoiceDeadline: "+010000-01-30"');
    expect(laneDeadlineDates(1)).toEqual(["Sun 30 Jan 10000"]);
    expect(laneCells(1)).toHaveLength(61);
    expect(cellNames()[0]).toBe("Wed 1 Dec 9999: anchor; issue window day 0");
    expect(summary()).toHaveTextContent(
      exact("61 days from 9999-12-01 to +010000-01-30."),
    );
    await expectNoAxeViolations(w.root);
  });

  it("orders negative years by date, not by string", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "-000002-12-01",
      issueDays: "60",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(output()).toHaveTextContent('invoiceDeadline: "-000001-01-30"');
    expect(laneDeadlineDates(1)).toEqual(["Sat 30 Jan -1"]);
    expect(laneCells(1)).toHaveLength(61);
    expect(cellNames()[0]).toBe("Tue 1 Dec -2: anchor; issue window day 0");
    expect(summary()).toHaveTextContent(
      exact("61 days from -000002-12-01 to -000001-01-30."),
    );
    await expectNoAxeViolations(w.root);
  });

  it("explains a request dated before an expanded-year invoice", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "+002026-03-20",
      requestReceivedOn: "2026-03-10",
      ...WINDOWS,
    });
    expect(output()).toHaveTextContent(exact("NO SIGNAL"));
    expect(reason()).toHaveTextContent(
      NULL_REASON_TEXT["request-before-invoice"],
    );
  });

  it("explains an agreed date before an expanded-year request", async () => {
    const w = await open();
    await typeState(w, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "+002026-04-10",
      ...WINDOWS,
      agreedResolutionOn: "2026-04-01",
    });
    expect(output()).toHaveTextContent(exact("NO SIGNAL"));
    expect(reason()).toHaveTextContent(
      NULL_REASON_TEXT["agreed-before-request"],
    );
  });
});

describe("the three plates", () => {
  it("names three plates numbered as the lanes are", async () => {
    await open();
    expect(
      within(plates())
        .getAllByRole("term")
        .map((t) => t.textContent),
    ).toEqual(["1 Issue by", "2 Dispute by", "3 Resolve by"]);
  });

  it.each(BILLING_PRESETS.map((p) => [p.id]))(
    "reads each deadline the library returned, on %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      const [, , days] = EXPECTED[id!]!;
      const group = within(plates());
      for (const day of days) {
        if (day !== null) {
          expect(group.getAllByText(day).length).toBeGreaterThan(0);
        }
      }
      expect(group.queryAllByText("not set")).toHaveLength(
        days.filter((d) => d === null).length,
      );
      const preset_ = BILLING_PRESETS.find((p) => p.id === id)!;
      for (const n of [
        preset_.issueDays,
        preset_.disputeDays,
        preset_.resolutionDays,
      ]) {
        expect(group.getAllByText(`${n}-day window`).length).toBeGreaterThan(0);
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("reads no result when the library returns null, and keeps the plates", async () => {
    const w = await open();
    await enter(w, issueDays(), "");
    expect(output()).toHaveTextContent(exact("NO SIGNAL"));
    expect(within(plates()).getAllByText(NO_RESULT)).toHaveLength(3);
    expect(within(plates()).getAllByRole("term")).toHaveLength(3);
    await expectNoAxeViolations(w.root);
  });

  it("states the deadlines in one line for a screen reader, and the verdicts in plain words", async () => {
    await open();
    expect(deadlines()).toHaveTextContent(
      "Issue by 2026-03-31 · Dispute by 2026-04-30 · Resolve by —",
    );
    expect(verdicts()).toHaveTextContent("on or before");
  });
});

describe("the day strip and its key", () => {
  it("names each day by its date, its marks and its lane positions", async () => {
    const w = await open();
    const names = cellNames();
    expect(names[0]).toBe("Sun 1 Mar 2026: anchor; issue window day 0");
    expect(names).toContain(
      "Tue 31 Mar 2026: invoice issued; issue window day 30, invoice deadline; dispute window day 0",
    );
    await expectNoAxeViolations(w.root);
  });

  it("hides the cells outside the span from the list", async () => {
    await open();
    // Mar 1 is a Sunday, so the first week holds six empty cells before it: none is a list item.
    expect(cellNames().every((n) => /\d{4}|-\d/.test(n))).toBe(true);
  });

  it("lists the three lanes, the marks and the key", async () => {
    await open();
    const key = within(screen.getByRole("list", { name: "Legend" }));
    for (const text of [
      "anchor, day zero",
      "invoice issued",
      "dispute request received",
      "1 issue window, solid",
      "2 dispute window, dashed",
      "3 resolution window, dotted",
    ]) {
      expect(key.getByText(text)).toBeInTheDocument();
    }
  });

  it("draws nothing when the library returns null", async () => {
    await open({ anchorOn: "nope" });
    expect(cellNames()).toHaveLength(0);
  });
});

describe("lifecycle", () => {
  it("is inert when aborted before it mounts", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(output()).not.toHaveTextContent(/\S/);
    expect(cellNames()).toHaveLength(0);
    expect(screen.getAllByText(NO_RESULT)).toHaveLength(3);
    w.destroy();
  });

  it("survives a double destroy", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });

  it("starts from what was seeded, and edits from there", async () => {
    const w = await open({
      anchorOn: "2026-05-01",
      issueDays: "20",
      disputeDays: "10",
      resolutionDays: "10",
    });
    expect(preset()).toHaveValue("custom");
    expect(laneDeadlineDates(1)).toEqual(["Thu 21 May 2026"]);
    await enter(w, issueDays(), "10");
    expect(laneDeadlineDates(1)).toEqual(["Mon 11 May 2026"]);
    await expectNoAxeViolations(w.root);
  });
});
