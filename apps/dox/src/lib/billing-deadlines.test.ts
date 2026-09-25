/// <reference types="vitest/globals" />
import {
  BILLING_PRESETS,
  CUSTOM_PRESET_ID,
  MAX_STRIP_CELLS,
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
  type BillingState,
  type DayStripDay,
} from "./billing-deadlines";

/** A validator that agrees with the library for the ISO dates these tests use. */
const validators = {
  isValidDate: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
};

const base: BillingState = { ...BILLING_PRESETS[0]! };

/** Every value below is section 9 of the execution spec, verified against
 *  `packages/gmt/dist` on 2026-09-24. */
const W = { issueDays: "30", disputeDays: "30", resolutionDays: "30" };
const C = { issueDays: "14", disputeDays: "14", resolutionDays: "45" };

const V1: BillingDeadlines = {
  invoiceDeadline: "2026-03-31",
  issuedByDeadline: null,
  disputeDeadline: null,
  requestedByDeadline: null,
  resolutionDeadline: null,
};
const V2: BillingDeadlines = {
  invoiceDeadline: "2026-03-31",
  issuedByDeadline: true,
  disputeDeadline: "2026-04-30",
  requestedByDeadline: null,
  resolutionDeadline: null,
};
const V7: BillingDeadlines = {
  invoiceDeadline: "2026-03-15",
  issuedByDeadline: true,
  disputeDeadline: "2026-03-19",
  requestedByDeadline: true,
  resolutionDeadline: "2026-05-02",
};
const V24: BillingDeadlines = {
  invoiceDeadline: "2026-04-09",
  issuedByDeadline: true,
  disputeDeadline: "2026-04-04",
  requestedByDeadline: null,
  resolutionDeadline: null,
};
const V25: BillingDeadlines = {
  invoiceDeadline: "2026-03-01",
  issuedByDeadline: true,
  disputeDeadline: "2026-03-01",
  requestedByDeadline: null,
  resolutionDeadline: null,
};
const V26: BillingDeadlines = {
  invoiceDeadline: "2036-02-27",
  issuedByDeadline: null,
  disputeDeadline: null,
  requestedByDeadline: null,
  resolutionDeadline: null,
};

const V7_STATE: BillingState = {
  anchorOn: "2026-03-01",
  invoiceIssuedOn: "2026-03-05",
  requestReceivedOn: "2026-03-18",
  ...C,
  agreedResolutionOn: "",
};

describe("presets", () => {
  it("have unique ids and are recognised from their own controls", () => {
    const ids = BILLING_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of BILLING_PRESETS) {
      expect(matchPreset(preset)).toBe(preset.id);
    }
  });

  it("label with numbers only, and never the forbidden verdict words", () => {
    const forbidden = /\b(timely|untimely|late|void|payable|compliant)\b/i;
    for (const preset of BILLING_PRESETS) {
      expect(forbidden.test(preset.label)).toBe(false);
      expect(forbidden.test(preset.description)).toBe(false);
    }
  });
});

describe("readArgs", () => {
  it("keeps a finite integer number as text", () => {
    expect(readArgs({ issueDays: 30 }).issueDays).toBe("30");
    expect(readArgs({ issueDays: 0 }).issueDays).toBe("0");
  });

  it("keeps a non-empty string as typed, from a permalink", () => {
    expect(readArgs({ issueDays: "30" }).issueDays).toBe("30");
    expect(readArgs({ anchorOn: "2026-03-01" }).anchorOn).toBe("2026-03-01");
  });

  it("never falls back to a preset: a missing window is blank, not defaulted", () => {
    const s = readArgs({ anchorOn: "2026-03-01" });
    expect(s.issueDays).toBe("");
    expect(s.disputeDays).toBe("");
    expect(s.resolutionDays).toBe("");
  });

  it("turns junk into an empty string", () => {
    expect(readArgs({ issueDays: Number.NaN }).issueDays).toBe("");
    expect(readArgs({ issueDays: 30.5 }).issueDays).toBe("");
    expect(readArgs({ anchorOn: "" }).anchorOn).toBe("");
    expect(readArgs({}).anchorOn).toBe("");
  });
});

describe("matchPreset", () => {
  it("falls back to custom when any field differs", () => {
    expect(matchPreset({ ...base, issueDays: "31" })).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset({ ...base, agreedResolutionOn: "2026-06-01" })).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("matches on trimmed fields", () => {
    expect(matchPreset({ ...base, anchorOn: " 2026-03-01 " })).toBe(
      BILLING_PRESETS[0]!.id,
    );
  });
});

describe("datesOf and windowsOf", () => {
  it("always includes anchorOn, and omits blank optional dates", () => {
    expect(datesOf({ ...base, invoiceIssuedOn: "", requestReceivedOn: "" })).toEqual(
      { anchorOn: base.anchorOn },
    );
    expect(
      datesOf({ ...base, invoiceIssuedOn: "2026-03-31" }).invoiceIssuedOn,
    ).toBe("2026-03-31");
  });

  it("omits a blank window and a blank agreed date", () => {
    expect(
      windowsOf({
        anchorOn: "2026-03-01",
        invoiceIssuedOn: "",
        requestReceivedOn: "",
        issueDays: "",
        disputeDays: "",
        resolutionDays: "",
        agreedResolutionOn: "",
      }),
    ).toEqual({});
  });

  it("passes a non-blank window exactly as typed, NaN and decimals included", () => {
    const state: BillingState = {
      ...base,
      issueDays: "abc",
      disputeDays: "30.5",
      resolutionDays: "30",
    };
    const w = windowsOf(state);
    expect(Number.isNaN(w.issueDays)).toBe(true);
    expect(w.disputeDays).toBe(30.5);
    expect(w.resolutionDays).toBe(30);
  });
});

describe("callSource", () => {
  it("matches the billingTimeline JSDoc call text verbatim for every preset", () => {
    const expected: Record<string, string> = {
      "thirty-day-30":
        '{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }',
      "thirty-day-31":
        '{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }',
      "thirty-rebill":
        '{ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }',
      forecast:
        '{ anchorOn: "2026-03-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }',
      "contract-14-14-45":
        '{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 }',
    };
    for (const preset of BILLING_PRESETS) {
      const [, plain] = callSource(preset);
      expect(plain, preset.id).toBe(expected[preset.id]);
    }
  });
});

describe("formatDeadlines", () => {
  it("prints one key per line, collapsing to the JSDoc result literal", () => {
    for (const [result, literal] of [
      [
        V1,
        '{ invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }',
      ],
      [
        V7,
        '{ invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: true, resolutionDeadline: "2026-05-02" }',
      ],
    ] as const) {
      const formatted = formatDeadlines(result);
      expect(formatted.replace(/\n\s+/g, " ")).toBe(literal);
    }
  });
});

describe("verdictText", () => {
  it("names the only three states, and never a forbidden word", () => {
    expect(verdictText("issued", "2026-03-31", true)).toBe(
      "Invoice issued 2026-03-31: on or before the deadline",
    );
    expect(verdictText("issued", "2026-04-01", false)).toBe(
      "Invoice issued 2026-04-01: after the deadline",
    );
    expect(verdictText("issued", undefined, null)).toBe(
      "No invoice date yet: this is a forecast",
    );
    expect(verdictText("requested", "2026-03-18", true)).toBe(
      "Request received 2026-03-18: on or before the deadline",
    );
    expect(verdictText("requested", "2026-03-20", false)).toBe(
      "Request received 2026-03-20: after the deadline",
    );
    expect(verdictText("requested", undefined, null)).toBe(
      "No request date yet",
    );
  });
});

describe("dayStrip", () => {
  it("returns null when the result is null", () => {
    expect(dayStrip(base, null)).toBeNull();
  });

  it("pads the first and last weeks, drawing every real day between", () => {
    const strip = dayStrip({ ...base, ...W, invoiceIssuedOn: "2026-03-31" }, V2);
    expect(strip).not.toBeNull();
    const days = strip!.items.filter(
      (i): i is DayStripDay => i.kind === "day",
    );
    expect(days.length % 7).toBe(0);
    const real = days.filter((d) => !d.padding);
    expect(real[0]!.date).toBe("2026-03-01");
    expect(real.at(-1)!.date).toBe("2026-04-30"); // the dispute deadline
    for (const d of days.filter((d) => d.padding)) {
      expect(d.marks).toEqual([]);
      expect(d.lanes).toEqual([]);
    }
  });

  it("lays out lanes and day ordinals for a three-window contract (V7)", () => {
    const strip = dayStrip(V7_STATE, V7)!;
    const byDate = new Map(
      strip.items
        .filter((i): i is DayStripDay => i.kind === "day" && !i.padding)
        .map((d) => [d.date, d]),
    );

    // The invoice deadline: lane 1 ends here (day 14), lane 2 is mid-window.
    expect(byDate.get("2026-03-15")!.lanes).toEqual(
      expect.arrayContaining([
        { lane: 1, state: "deadline", day: 14 },
        { lane: 2, state: "in", day: 10 },
      ]),
    );
    // The dispute deadline: lane 2 ends here (day 14), lane 3 has just begun.
    expect(byDate.get("2026-03-19")!.lanes).toEqual(
      expect.arrayContaining([
        { lane: 2, state: "deadline", day: 14 },
        { lane: 3, state: "in", day: 1 },
      ]),
    );
    // The request date itself: lane 3's day zero.
    expect(byDate.get("2026-03-18")!.marks).toContain("request");
    expect(byDate.get("2026-03-18")!.lanes).toEqual(
      expect.arrayContaining([{ lane: 3, state: "zero", day: 0 }]),
    );
  });

  it("spans back to the invoice date when it precedes the anchor (V24)", () => {
    const state: BillingState = {
      anchorOn: "2026-03-10",
      invoiceIssuedOn: "2026-03-05",
      requestReceivedOn: "",
      ...W,
      agreedResolutionOn: "",
    };
    const strip = dayStrip(state, V24)!;
    const first = strip.items.find(
      (i): i is DayStripDay => i.kind === "day" && !i.padding,
    )!;
    expect(first.date).toBe("2026-03-05");
    expect(first.marks).toContain("invoice");
    expect(first.lanes).toEqual([{ lane: 2, state: "zero", day: 0 }]);

    const anchorCell = strip.items.find(
      (i): i is DayStripDay => i.kind === "day" && i.date === "2026-03-10",
    )!;
    expect(anchorCell.marks).toContain("anchor");
    expect(anchorCell.lanes).toEqual(
      expect.arrayContaining([{ lane: 1, state: "zero", day: 0 }]),
    );
  });

  it("marks a 0-day window's only cell as deadline, not zero", () => {
    const state: BillingState = {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "2026-03-01",
      requestReceivedOn: "",
      issueDays: "0",
      disputeDays: "0",
      resolutionDays: "0",
      agreedResolutionOn: "",
    };
    const strip = dayStrip(state, V25)!;
    const cell = strip.items.find(
      (i): i is DayStripDay => i.kind === "day" && i.date === "2026-03-01",
    )!;
    expect(cell.lanes).toEqual(
      expect.arrayContaining([
        { lane: 1, state: "deadline", day: 0 },
        { lane: 2, state: "deadline", day: 0 },
      ]),
    );
  });

  it("collapses a multi-year span (issueDays: 3650) to a gap row within the cell cap", () => {
    const state: BillingState = {
      anchorOn: "2026-03-01",
      invoiceIssuedOn: "",
      requestReceivedOn: "",
      issueDays: "3650",
      disputeDays: "3650",
      resolutionDays: "3650",
      agreedResolutionOn: "",
    };
    const strip = dayStrip(state, V26)!;
    const dayCount = strip.items.filter((i) => i.kind === "day").length;
    const gapCount = strip.items.filter((i) => i.kind === "gap").length;
    expect(dayCount).toBeLessThanOrEqual(MAX_STRIP_CELLS);
    expect(gapCount).toBeGreaterThan(0);
    expect(strip.summary).toContain("days not drawn");
  });
});

describe("explainNull", () => {
  const withDates = (over: Partial<BillingState> = {}): BillingState => ({
    ...base,
    ...W,
    ...over,
  });

  it("names each reason in the library's own check order", () => {
    expect(
      explainNull(withDates({ anchorOn: "not-a-date" }), validators),
    ).toEqual({ reason: "invalid-anchor" });
    expect(
      explainNull(
        withDates({ invoiceIssuedOn: "not-a-date" }),
        validators,
      ),
    ).toEqual({ reason: "invalid-invoice" });
    expect(
      explainNull(
        withDates({ invoiceIssuedOn: "", requestReceivedOn: "not-a-date" }),
        validators,
      ),
    ).toEqual({ reason: "invalid-request" });
    expect(
      explainNull(
        withDates({
          invoiceIssuedOn: "",
          requestReceivedOn: "2026-04-19",
        }),
        validators,
      ),
    ).toEqual({ reason: "request-without-invoice" });
    expect(
      explainNull(
        withDates({
          invoiceIssuedOn: "2026-03-20",
          requestReceivedOn: "2026-03-19",
        }),
        validators,
      ),
    ).toEqual({ reason: "request-before-invoice" });
    expect(
      explainNull(withDates({ issueDays: "" }), validators),
    ).toEqual({ reason: "missing-window", field: "issueDays" });
    expect(
      explainNull(withDates({ disputeDays: "" }), validators),
    ).toEqual({ reason: "missing-window", field: "disputeDays" });
    expect(
      explainNull(withDates({ resolutionDays: "" }), validators),
    ).toEqual({ reason: "missing-window", field: "resolutionDays" });
    expect(
      explainNull(withDates({ issueDays: "-1" }), validators),
    ).toEqual({ reason: "invalid-window", field: "issueDays" });
    expect(
      explainNull(withDates({ issueDays: "30.5" }), validators),
    ).toEqual({ reason: "invalid-window", field: "issueDays" });
    expect(
      explainNull(
        withDates({ agreedResolutionOn: "not-a-date" }),
        validators,
      ),
    ).toEqual({ reason: "invalid-agreed" });
    expect(
      explainNull(
        withDates({
          requestReceivedOn: "2026-04-20",
          invoiceIssuedOn: "2026-03-20",
          agreedResolutionOn: "2026-04-01",
        }),
        validators,
      ),
    ).toEqual({ reason: "agreed-before-request" });
    expect(
      explainNull(
        withDates({ anchorOn: "2026-03-01", issueDays: "99999999999999" }),
        validators,
      ),
    ).toEqual({ reason: "out-of-range" });
  });

  it("returns null for every valid state", () => {
    for (const preset of BILLING_PRESETS) {
      expect(explainNull(preset, validators)).toBeNull();
    }
  });

  it("names the field in missing- and invalid-window text", () => {
    expect(nullReasonText({ reason: "missing-window", field: "issueDays" })).toBe(
      "issueDays is missing. Windows have no defaults: type the number your tariff or contract sets.",
    );
    expect(
      nullReasonText({ reason: "invalid-window", field: "disputeDays" }),
    ).toBe("disputeDays must be a whole number of days, 0 or more.");
  });

  it("never uses a forbidden verdict word in any reason text", () => {
    const forbidden = /\b(timely|untimely|late|void|payable|compliant)\b/i;
    for (const text of Object.values(
      Object.fromEntries(
        Object.entries({
          "invalid-anchor": nullReasonText({ reason: "invalid-anchor" }),
          "request-before-invoice": nullReasonText({
            reason: "request-before-invoice",
          }),
        }),
      ),
    )) {
      expect(forbidden.test(text)).toBe(false);
    }
  });
});
