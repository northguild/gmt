/**
 * @vitest-environment jsdom
 *
 * The Billing Deadlines widget end to end: template → mount → interact →
 * assert, against the real `@northguild/gmt`. Every preset's printed call and
 * result are checked against the literal `billingTimeline` JSDoc examples they
 * draw, and the strip's deadline cells against the library's own dates, so a
 * drift in the library or the widget fails here.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { BILLING_PRESETS, NULL_REASON_TEXT } from "./billing-deadlines";
import {
  mountBillingDeadlines,
  renderBillingDeadlinesTemplate,
} from "./billing-deadlines-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "anchor-on",
  "invoice-issued-on",
  "request-received-on",
  "issue-days",
  "dispute-days",
  "resolution-days",
  "agreed-resolution-on",
  "verdicts",
  "verdict-issued",
  "verdict-requested",
  "deadlines",
  "strip",
  "strip-summary",
  "legend",
  "reason-aside",
  "liability-note",
  "call-billing",
  "copy-billing",
  "billing-output",
];

/** The `billingTimeline.ts` JSDoc examples the presets draw, verbatim:
 *  [call, result]. */
const EXPECTED: Record<string, [string, string]> = {
  "thirty-day-30": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30", requestedByDeadline: null, resolutionDeadline: null }',
  ],
  "thirty-day-31": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01", requestedByDeadline: null, resolutionDeadline: null }',
  ],
  "thirty-rebill": [
    'billingTimeline({ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-05-05", requestedByDeadline: null, resolutionDeadline: null }',
  ],
  forecast: [
    'billingTimeline({ anchorOn: "2026-03-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    '{ invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }',
  ],
  "contract-14-14-45": [
    'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 })',
    '{ invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: true, resolutionDeadline: "2026-05-02" }',
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

const qa = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderBillingDeadlinesTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountBillingDeadlines(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const input = q<HTMLInputElement>(root, role);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const FIELD_ROLE: Record<string, string> = {
  anchorOn: "anchor-on",
  invoiceIssuedOn: "invoice-issued-on",
  requestReceivedOn: "request-received-on",
  issueDays: "issue-days",
  disputeDays: "dispute-days",
  resolutionDays: "resolution-days",
  agreedResolutionOn: "agreed-resolution-on",
};

function typeState(root: HTMLElement, state: Record<string, string>): void {
  for (const [field, role] of Object.entries(FIELD_ROLE)) {
    type(root, role, state[field] ?? "");
  }
}

/** Dates a lane's deadline badge is drawn on. */
function laneDeadlineDates(root: HTMLElement, lane: number): string[] {
  return qa(root, "strip")
    .flatMap((strip) => [
      ...strip.querySelectorAll<HTMLElement>(
        `[data-lanes*="${lane}-deadline"]`,
      ),
    ])
    .map((el) => el.dataset.date!);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderBillingDeadlinesTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("opens on the first preset when unseeded", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("thirty-day-30");
    expect(q<HTMLInputElement>(root, "anchor-on").value).toBe("2026-03-01");
  });

  it("seeds from args and shows custom when nothing matches", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate({
      anchorOn: "2026-05-01",
      issueDays: 20,
    });
    expect(q<HTMLInputElement>(root, "anchor-on").value).toBe("2026-05-01");
    expect(q<HTMLInputElement>(root, "issue-days").value).toBe("20");
    expect(q<HTMLInputElement>(root, "dispute-days").value).toBe("");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("gives window inputs no placeholder — a placeholder reads as a default", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate();
    for (const role of ["issue-days", "dispute-days", "resolution-days"]) {
      expect(
        q<HTMLInputElement>(root, role).hasAttribute("placeholder"),
        role,
      ).toBe(false);
      expect(q<HTMLInputElement>(root, role).type).toBe("number");
    }
  });

  it("uses text inputs for dates, never type=date", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate();
    for (const role of [
      "anchor-on",
      "invoice-issued-on",
      "request-received-on",
      "agreed-resolution-on",
    ]) {
      expect(q<HTMLInputElement>(root, role).type).toBe("text");
      expect(q<HTMLInputElement>(root, role).placeholder).toBe("YYYY-MM-DD");
    }
  });

  it("escapes what it interpolates", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate({
      anchorOn: '"><img src=x onerror=alert(1)>',
    });
    expect(root.querySelector("img")).toBeNull();
  });
});

describe("mountBillingDeadlines", () => {
  it.each(BILLING_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s, with matching lane deadlines",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;

      expect(q(root, "copy-billing").dataset.copyText).toBe(call);
      expect(
        q(root, "billing-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(result);

      const invoiceDeadline = /invoiceDeadline: "([^"]+)"/.exec(result)![1]!;
      expect(laneDeadlineDates(root, 1)).toEqual([invoiceDeadline]);

      const disputeDeadline = /disputeDeadline: "([^"]+)"/.exec(result)?.[1];
      expect(laneDeadlineDates(root, 2)).toEqual(
        disputeDeadline ? [disputeDeadline] : [],
      );

      const resolutionDeadline = /resolutionDeadline: "([^"]+)"/.exec(
        result,
      )?.[1];
      expect(laneDeadlineDates(root, 3)).toEqual(
        resolutionDeadline ? [resolutionDeadline] : [],
      );
    },
  );

  it("shows the verdicts for the thirty-day-30 preset", async () => {
    const { root } = await mount();
    choosePreset(root, "thirty-day-30");
    expect(q(root, "verdict-issued").textContent).toBe(
      "Invoice issued 2026-03-31: on or before the deadline",
    );
    expect(q(root, "verdict-requested").textContent).toBe(
      "No request date yet",
    );
  });

  it("turns the verdict to after the deadline on day 31", async () => {
    const { root } = await mount();
    choosePreset(root, "thirty-day-31");
    expect(q(root, "verdict-issued").textContent).toBe(
      "Invoice issued 2026-04-01: after the deadline",
    );
  });

  it("reads a request on the dispute deadline as on or before it (V4)", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "2026-04-19",
      issueDays: "30",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(q(root, "billing-output").textContent!.replace(/\n\s+/g, " ")).toBe(
      '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: true, resolutionDeadline: "2026-05-19" }',
    );
    expect(q(root, "verdict-requested").textContent).toBe(
      "Request received 2026-04-19: on or before the deadline",
    );
  });

  it("replaces the computed resolution deadline with an agreed date (V5)", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "2026-04-20",
      issueDays: "30",
      disputeDays: "30",
      resolutionDays: "30",
      agreedResolutionOn: "2026-06-01",
    });
    expect(q(root, "billing-output").textContent!.replace(/\n\s+/g, " ")).toBe(
      '{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: false, resolutionDeadline: "2026-06-01" }',
    );
    expect(q(root, "copy-billing").dataset.copyText).toBe(
      'billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-20" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30, agreedResolutionOn: "2026-06-01" })',
    );
  });

  it("defaults no window: a blank one prints no key and shows NO SIGNAL", async () => {
    const { root } = await mount({ anchorOn: "2026-03-01", issueDays: "30" });
    expect(q<HTMLInputElement>(root, "dispute-days").value).toBe("");
    expect(q<HTMLInputElement>(root, "resolution-days").value).toBe("");
    expect(q(root, "copy-billing").dataset.copyText).toBe(
      'billingTimeline({ anchorOn: "2026-03-01" }, { issueDays: 30 })',
    );
    expect(q(root, "billing-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "billing-output").classList).toContain(
      "gmt-playground-sentinel",
    );
    expect(q(root, "reason-aside").textContent).toContain(
      "disputeDays is missing",
    );
  });

  it("omits a blank agreed date from the call and stays live, never null (V1)", async () => {
    const { root } = await mount();
    choosePreset(root, "forecast");
    expect(q(root, "copy-billing").dataset.copyText).not.toContain(
      "agreedResolutionOn",
    );
    expect(q(root, "billing-output").classList).toContain(
      "gmt-playground-live",
    );
    expect(q(root, "billing-output").textContent).not.toBe("NO SIGNAL");
  });

  const REASON_CASES: [string, Record<string, string>, string][] = [
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
      const { root } = await mount();
      typeState(root, state);
      expect(q(root, "billing-output").textContent).toBe("NO SIGNAL");
      expect(q(root, "reason-aside").textContent).toContain(substring);
    },
  );

  it("never shows a forbidden verdict word, in the template or any preset's output", async () => {
    const forbidden = /\b(timely|untimely|late|void|payable|compliant)\b/i;
    const { root } = await mount();
    for (const preset of BILLING_PRESETS) {
      choosePreset(root, preset.id);
      expect(forbidden.test(root.innerHTML), preset.id).toBe(false);
    }
    for (const text of Object.values(NULL_REASON_TEXT)) {
      expect(forbidden.test(text)).toBe(false);
    }
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of BILLING_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state)) {
        expect(typeof value).toBe("string");
      }
      const url = encodeWidgetPermalink("billing", state);
      const seeded = seedFromLocation("billing", url.slice(url.indexOf("?")));
      const again = await mount(seeded);
      expect(q<HTMLSelectElement>(again.root, "preset").value).toBe(preset.id);
      expect(
        q(again.root, "billing-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(EXPECTED[preset.id]![1]);
      document.body.innerHTML = "";
    }
  });

  it("collapses a multi-year window to a gap row within the cell cap", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      issueDays: "3650",
      disputeDays: "3650",
      resolutionDays: "3650",
    });
    const cells = qa(root, "strip")[0]!.querySelectorAll(
      ".gmt-billing-cell, .gmt-billing-cell--padding",
    );
    expect(cells.length).toBeLessThanOrEqual(120);
    expect(
      qa(root, "strip")[0]!.querySelector(".gmt-billing-gap"),
    ).not.toBeNull();
    expect(q(root, "strip-summary").textContent).toContain("days not drawn");
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderBillingDeadlinesTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountBillingDeadlines(root, {}, controller.signal);
    expect(q(root, "billing-output").textContent).toBe(" ");
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});

/**
 * The widget draws and labels the library's canonical dates and orders them
 * with `Temporal.PlainDate.compare`, never by string. An annotated or
 * expanded-year date the library accepts must draw exactly as its bare ISO
 * form does, and string order breaks outside years 0000–9999.
 */
describe("mountBillingDeadlines: dates the library accepts in any ISO form", () => {
  const WINDOWS = { issueDays: "30", disputeDays: "30", resolutionDays: "30" };

  /** Real (non-padding) cells, as `[date, marks, lanes]`. */
  function cells(root: HTMLElement) {
    return qa(root, "strip").flatMap((strip) =>
      [
        ...strip.querySelectorAll<HTMLElement>(".gmt-billing-cell[data-marks]"),
      ].map((el) => ({
        date: el.dataset.date!,
        marks: el.dataset.marks!.split(" ").filter(Boolean),
        lanes: el.dataset.lanes!.split(" ").filter(Boolean),
      })),
    );
  }
  const laneCells = (root: HTMLElement, lane: number) =>
    cells(root).filter((c) => c.lanes.some((l) => l.startsWith(`${lane}-`)));

  it.each([
    "2026-03-01[u-ca=iso8601]",
    "2026-03-01[foo=bar]",
    "2026-03-01[Europe/London]",
    "+002026-03-01",
  ])(
    "draws anchor %s exactly as 2026-03-01: its mark, 31 lane cells, a bare summary",
    async (anchorOn) => {
      const { root } = await mount();
      typeState(root, { anchorOn, ...WINDOWS });
      expect(q(root, "billing-output").textContent).toContain(
        'invoiceDeadline: "2026-03-31"',
      );
      const lane1 = laneCells(root, 1);
      expect(lane1).toHaveLength(31);
      expect(lane1[0]).toMatchObject({
        date: "2026-03-01",
        marks: ["anchor"],
        lanes: ["1-zero"],
      });
      expect(lane1.at(-1)).toMatchObject({
        date: "2026-03-31",
        lanes: ["1-deadline"],
      });
      expect(q(root, "strip-summary").textContent).toBe(
        "31 days from 2026-03-01 to 2026-03-31.",
      );
    },
  );

  it("prints the call with the date as typed, so the printed call stays the real call", async () => {
    const { root } = await mount();
    typeState(root, { anchorOn: "2026-03-01[u-ca=iso8601]", ...WINDOWS });
    expect(q(root, "copy-billing").dataset.copyText).toBe(
      'billingTimeline({ anchorOn: "2026-03-01[u-ca=iso8601]" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })',
    );
  });

  it("marks, lanes and labels annotated invoice and request dates by their bare ISO form", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20[u-ca=iso8601]",
      requestReceivedOn: "2026-04-19[foo=bar]",
      ...WINDOWS,
    });
    const byDate = new Map(cells(root).map((c) => [c.date, c]));
    expect(byDate.get("2026-03-20")!.marks).toContain("invoice");
    expect(byDate.get("2026-03-20")!.lanes).toContain("2-zero");
    expect(byDate.get("2026-04-19")!.marks).toContain("request");
    expect(byDate.get("2026-04-19")!.lanes).toContain("3-zero");
    expect(laneCells(root, 2)).toHaveLength(31);
    expect(laneCells(root, 3)).toHaveLength(31);
    expect(q(root, "verdict-issued").textContent).toBe(
      "Invoice issued 2026-03-20: on or before the deadline",
    );
    expect(q(root, "verdict-requested").textContent).toBe(
      "Request received 2026-04-19: on or before the deadline",
    );
  });

  it("orders dates across year 9999 by date, not by string", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "9999-12-01",
      issueDays: "60",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(q(root, "billing-output").textContent).toContain(
      'invoiceDeadline: "+010000-01-30"',
    );
    expect(laneDeadlineDates(root, 1)).toEqual(["+010000-01-30"]);
    expect(laneCells(root, 1)).toHaveLength(61);
    expect(q(root, "strip-summary").textContent).toBe(
      "61 days from 9999-12-01 to +010000-01-30.",
    );
  });

  it("orders negative years by date, not by string", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "-000002-12-01",
      issueDays: "60",
      disputeDays: "30",
      resolutionDays: "30",
    });
    expect(q(root, "billing-output").textContent).toContain(
      'invoiceDeadline: "-000001-01-30"',
    );
    expect(laneDeadlineDates(root, 1)).toEqual(["-000001-01-30"]);
    expect(laneCells(root, 1)).toHaveLength(61);
    expect(q(root, "strip-summary").textContent).toBe(
      "61 days from -000002-12-01 to -000001-01-30.",
    );
  });

  it("explains a request dated before an expanded-year invoice", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "+002026-03-20",
      requestReceivedOn: "2026-03-10",
      ...WINDOWS,
    });
    expect(q(root, "billing-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      NULL_REASON_TEXT["request-before-invoice"],
    );
  });

  it("explains an agreed date before an expanded-year request", async () => {
    const { root } = await mount();
    typeState(root, {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-20",
      requestReceivedOn: "+002026-04-10",
      ...WINDOWS,
      agreedResolutionOn: "2026-04-01",
    });
    expect(q(root, "billing-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      NULL_REASON_TEXT["agreed-before-request"],
    );
  });
});
