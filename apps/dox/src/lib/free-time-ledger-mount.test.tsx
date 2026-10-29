/**
 * @vitest-environment jsdom
 *
 * The Free Time Ledger end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`, through the roles and names a reader meets. Expected
 * values are from a run of the built library.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { FREE_TIME_PRESETS } from "./free-time-ledger";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showFreeTimeLedger"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const zone = () => screen.getByRole("combobox", { name: "Terminal zone" });
const basis = () => screen.getByRole("combobox", { name: "Free days count" });
const chargeBasis = () =>
  screen.getByRole("combobox", { name: "Charged days count" });
const firstDay = () =>
  screen.getByRole("combobox", { name: "Free day one is" });
const freeDays = () => screen.getByRole("textbox", { name: "Free days" });
const tiers = () => screen.getByRole("textbox", { name: "Tier end days" });
const startBox = () => screen.getByRole("textbox", { name: "Clock start" });
const endBox = () => screen.getByRole("textbox", { name: "Clock end" });
const startHandle = () => screen.getByRole("slider", { name: "Clock start" });
const endHandle = () => screen.getByRole("slider", { name: "Clock end" });
const holidays = () =>
  screen.getByRole("textbox", { name: "Holidays, one date per line" });
const expiryOut = () =>
  screen.getByRole("status", { name: "What freeTimeExpiry returned" });
const chargesOut = () =>
  screen.getByRole("status", { name: "What chargeableDays returned" });
const summary = () => screen.getByRole("status", { name: "Reading summary" });
const days = () =>
  within(screen.getByRole("list", { name: "Local days" })).getAllByRole(
    "listitem",
  );
const dayLabels = () => days().map((d) => d.getAttribute("aria-label"));
const workingTerms = () => screen.queryByRole("group", { name: "Weekend" });

async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const FRIDAY_EXPIRY = `{ freeTimeStart: "2024-06-14",
  lastFreeDay: "2024-06-16",
  expiresAt: "2024-06-16T23:00:00Z" }`;

const expiry = (start: string, last: string, at: string) =>
  `{ freeTimeStart: "${start}",\n  lastFreeDay: "${last}",\n  expiresAt: "${at}" }`;

const NO_SIGNAL = "NO SIGNAL";

const EXPECTED: Record<string, { expiry: string; charges: RegExp[] }> = {
  "friday-three-days": {
    expiry: FRIDAY_EXPIRY,
    charges: [
      /freeDaysUsed: 3/,
      /chargeableDays: 1/,
      /chargedDates: \["2024-06-17"\]/,
    ],
  },
  "read-as-next-day": {
    expiry: expiry("2024-06-15", "2024-06-17", "2024-06-17T23:00:00Z"),
    charges: [/freeDaysUsed: 3/, /chargeableDays: 0/, /chargedDates: \[\]/],
  },
  "out-at-expiry": {
    expiry: FRIDAY_EXPIRY,
    charges: [/chargeableDays: 0/, /expiresAt: "2024-06-16T23:00:00Z"/],
  },
  "working-days": {
    expiry: expiry("2024-06-14", "2024-06-19", "2024-06-19T22:00:00Z"),
    charges: [
      /freeDaysUsed: 3/,
      /chargeableDays: 5/,
      /chargedDates: \["2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24"\]/,
      /byTier: \[\{ from: 1, to: null, days: 5 \}\]/,
    ],
  },
  "terminal-holiday": {
    expiry: expiry("2024-06-14", "2024-06-19", "2024-06-19T22:00:00Z"),
    charges: [
      /chargeableDays: 3/,
      /chargedDates: \["2024-06-20", "2024-06-21", "2024-06-24"\]/,
    ],
  },
  tiers: {
    expiry: expiry("2024-06-14", "2024-06-16", "2024-06-16T22:00:00Z"),
    charges: [
      /chargeableDays: 12/,
      /byTier: \[\{ from: 1, to: 5, days: 5 \}, \{ from: 6, to: 10, days: 5 \}, \{ from: 11, to: null, days: 2 \}\]/,
    ],
  },
  "no-free-time": {
    expiry: NO_SIGNAL,
    charges: [
      /freeDaysUsed: 0/,
      /chargeableDays: 3/,
      /expiresAt: "2024-06-13T22:00:00Z"/,
      /chargedDates: \["2024-06-14", "2024-06-15", "2024-06-16"\]/,
    ],
  },
};

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      FREE_TIME_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(FREE_TIME_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id!);
    expect(preset()).toHaveValue(id);
    const want = EXPECTED[id!]!;
    expect(expiryOut()).toHaveTextContent(
      want.expiry === NO_SIGNAL
        ? NO_SIGNAL
        : want.expiry.replace(/\n\s*/g, " "),
    );
    for (const re of want.charges) expect(chargesOut()).toHaveTextContent(re);
    await expectNoAxeViolations(w.root);
  });
});

describe("the default view", () => {
  it("opens on the first preset with the working terms hidden", async () => {
    const w = await open();
    expect(preset()).toHaveValue("friday-three-days");
    expect(workingTerms()).not.toBeInTheDocument();
    expect(summary()).toHaveTextContent("3 free days used · 1 chargeable day");
    expect(expiryOut()).toHaveTextContent("2024-06-16T23:00:00Z");
    await expectNoAxeViolations(w.root);
  });

  it("calls the library with the fields it shows", async () => {
    await open();
    expect(
      screen.getByRole("group", { name: "Call to chargeableDays" }),
    ).toHaveTextContent(
      'chargeableDays("2024-06-14T19:00:00Z", "2024-06-16T23:00:01Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "Europe/London", firstDay: "eventDay" })',
    );
  });

  it("describes the preset it opens on", async () => {
    await open();
    expect(preset()).toHaveAccessibleDescription(
      /Discharged Friday 20:00 in London with three free calendar days/,
    );
  });

  it("makes the preset custom when a field changes", async () => {
    const w = await open();
    await enter(w, freeDays(), "2");
    expect(preset()).toHaveValue("custom");
  });

  it("makes the preset custom for an edit to the zone, and back when it matches", async () => {
    const w = await open();
    await w.user.selectOptions(zone(), "Europe/Paris");
    expect(preset()).toHaveValue("custom");
    await w.user.selectOptions(zone(), "Europe/London");
    expect(preset()).toHaveValue("friday-three-days");
  });
});

describe("days", () => {
  it("colours exactly the library's free and charged days", async () => {
    await open();
    expect(dayLabels()).toEqual([
      "14 Jun Fri, free",
      "15 Jun Sat, free",
      "16 Jun Sun, free",
      "17 Jun Mon, charged",
    ]);
  });

  it("says charged, never chargeable or a price, in the legend and the days", async () => {
    await open();
    const legend = screen.getByText("charged", { selector: "li *, li" });
    expect(legend).toBeInTheDocument();
    for (const label of dayLabels()) expect(label).not.toMatch(/chargeable|\$/);
  });

  it("marks closed days, tiers and the days after the dwell", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "terminal-holiday");
    const labels = dayLabels();
    expect(labels).toContain("15 Jun Sat, closed, not counted");
    expect(labels).toContain("17 Jun Mon, closed, not counted");
    expect(labels).toContain("20 Jun Thu, charged");
    expect(labels).toContain("24 Jun Mon, charged");
    expect(labels).toContain("25 Jun Tue");
  });

  it("puts each tier on its own days", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "tiers");
    const labels = dayLabels();
    expect(labels).toContain("17 Jun Mon, tier 1, charged");
    expect(labels).toContain("21 Jun Fri, tier 1, charged");
    expect(labels).toContain("22 Jun Sat, tier 2, charged");
    expect(labels).toContain("26 Jun Wed, tier 2, charged");
    expect(labels).toContain("27 Jun Thu, tier 3, charged");
    expect(labels.filter((l) => /, tier \d, charged/.test(l!))).toHaveLength(
      12,
    );
    expect(screen.getAllByText("tier 1").length).toBeGreaterThan(0);
  });

  it("shows the 23-hour day of a clock change", async () => {
    await open({
      clockStart: "2024-03-09T20:00:00-05:00[America/New_York]",
      clockEnd: "2024-03-11T04:00:00-04:00[America/New_York]",
      freeDays: 3,
      zone: "America/New_York",
    });
    expect(screen.getByText("23 h")).toBeInTheDocument();
  });
});

describe("the readings", () => {
  it("shows the plates and the expiry on the gate", async () => {
    await open();
    expect(screen.getByText("of 3 free")).toBeInTheDocument();
    expect(screen.getByText("17 Jun 00:00")).toBeInTheDocument();
    expect(screen.getAllByText("Europe/London").length).toBeGreaterThan(0);
    expect(screen.getByText("expires 17 Jun 00:00")).toBeInTheDocument();
  });

  it("explains a missing last free day as a note", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "no-free-time");
    expect(
      screen.getByRole("complementary", { name: /Note|Why null/ }),
    ).toHaveTextContent(/no last free day/);
    await expectNoAxeViolations(w.root);
  });

  it("says a dwell that ends before it starts has no charges, while the expiry answers", async () => {
    const w = await open();
    await enter(w, startBox(), "2024-06-18T19:00:00Z");
    expect(chargesOut()).toHaveTextContent(NO_SIGNAL);
    expect(expiryOut()).toHaveTextContent("2024-06-18");
    expect(
      screen.getByRole("complementary", { name: /Why null/ }),
    ).toHaveTextContent(/before the clock start/);
    await expectNoAxeViolations(w.root);
  });

  it("charges nothing when the clock stops exactly at expiry, and says the dwell is half-open", async () => {
    const w = await open();
    await enter(w, endBox(), "2024-06-16T23:00:00Z");
    expect(chargesOut()).toHaveTextContent("chargeableDays: 0");
    expect(screen.getByRole("complementary")).toHaveTextContent(
      /half-open|expiry/i,
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("first day", () => {
  it("slides the free days a day when free day one is the day after", async () => {
    const w = await open();
    await w.user.selectOptions(firstDay(), "nextDay");
    expect(expiryOut()).toHaveTextContent('freeTimeStart: "2024-06-15"');
    expect(expiryOut()).toHaveTextContent('lastFreeDay: "2024-06-17"');
    expect(preset()).toHaveValue("read-as-next-day");
    expect(dayLabels()[0]).toMatch(/^14 Jun Fri, event day/);
  });
});

describe("working terms", () => {
  it("shows the weekend and holidays only when a basis is working", async () => {
    const w = await open();
    expect(workingTerms()).not.toBeInTheDocument();
    await w.user.selectOptions(chargeBasis(), "working");
    expect(workingTerms()).toBeInTheDocument();
    await w.user.selectOptions(chargeBasis(), "calendar");
    expect(workingTerms()).not.toBeInTheDocument();
    await w.user.selectOptions(basis(), "working");
    expect(workingTerms()).toBeInTheDocument();
  });

  it("turns working-days into terminal-holiday when the charge basis becomes working", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "working-days");
    expect(preset()).toHaveValue("working-days");
    await w.user.selectOptions(chargeBasis(), "working");
    expect(preset()).toHaveValue("terminal-holiday");
    await expectNoAxeViolations(w.root);
  });

  it("refuses a calendar with every weekday closed", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "working-days");
    const weekend = within(screen.getByRole("group", { name: "Weekend" }));
    for (const box of weekend.getAllByRole("checkbox")) {
      if (!(box as HTMLInputElement).checked) await w.user.click(box);
    }
    expect(screen.getByRole("complementary")).toHaveTextContent(
      /at least one working day/,
    );
    await expectNoAxeViolations(w.root);
  });

  it("reads the holidays one date per line", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "terminal-holiday");
    expect(holidays()).toHaveValue("2024-06-17");
    await enter(w, holidays(), "2024-06-17\n2024-06-20");
    expect(chargesOut()).toHaveTextContent(/chargeableDays: 2/);
  });
});

describe("tiers", () => {
  it("refuses end days that do not rise, and leaves the expiry alone", async () => {
    const w = await open();
    await enter(w, tiers(), "10, 5");
    expect(screen.getByRole("complementary")).toHaveTextContent(
      /larger than the last/,
    );
    expect(expiryOut()).toHaveTextContent(FRIDAY_EXPIRY.replace(/\n\s*/g, " "));
    await expectNoAxeViolations(w.root);
  });
});

describe("the clock handles", () => {
  it("keeps the typed field and the handle in step", async () => {
    const w = await open();
    startHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    expect((startBox() as HTMLInputElement).value).toMatch(
      /\[Europe\/London\]$/,
    );
    expect(startHandle()).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/Jun/),
    );
  });

  it("moves the end by one step with an arrow and twelve with a page key", async () => {
    const w = await open();
    const before = Number(endHandle().getAttribute("aria-valuenow"));
    endHandle().focus();
    await w.user.keyboard("{ArrowLeft}");
    const one = Number(endHandle().getAttribute("aria-valuenow"));
    await w.user.keyboard("{PageDown}");
    const page = Number(endHandle().getAttribute("aria-valuenow"));
    const step = before - one;
    expect(step).toBeGreaterThan(0);
    expect(one - page).toBeCloseTo(step * 12, -1);
    await w.user.keyboard("{PageUp}");
    expect(Number(endHandle().getAttribute("aria-valuenow"))).toBeCloseTo(
      one,
      5,
    );
    await expectNoAxeViolations(w.root);
  });

  it("names the handles' values in local time, or says it is not a time", async () => {
    const w = await open();
    expect(endHandle()).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/\d{2}:\d{2}/),
    );
    await enter(w, endBox(), "garbage");
    expect(endHandle()).toHaveAttribute("aria-valuetext", "not a time");
  });
});

describe("a seed from the chat", () => {
  it("reads a wall time with no offset in the stated zone", async () => {
    await open({
      clockStart: "2024-06-14T15:00:00",
      clockEnd: "2024-06-17T00:00:01",
      freeDays: 3,
      zone: "America/New_York",
    });
    expect(chargesOut()).toHaveTextContent('chargedDates: ["2024-06-17"]');
    expect(
      screen.getByRole("group", { name: "Call to chargeableDays" }),
    ).toHaveTextContent("2024-06-14T15:00:00-04:00[America/New_York]");
  });

  it("shows a hostile value as text", async () => {
    await open({
      clockStart: "<img src=x onerror=alert(1)>",
      zone: "Europe/London",
    });
    expect(startBox()).toHaveValue("<img src=x onerror=alert(1)>");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("adds a zone the list lacks, and shows the working terms it was given", async () => {
    await open({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-20T19:00:00Z",
      zone: "Africa/Accra",
      basis: "working",
      chargeBasis: "working",
      weekend: [6, 7],
      holidays: "2024-06-17",
    });
    expect(zone()).toHaveValue("Africa/Accra");
    expect(workingTerms()).toBeInTheDocument();
    expect(holidays()).toHaveValue("2024-06-17");
  });
});

describe("the widget's life", () => {
  it("round-trips its state through the permalink", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "tiers");
    const url = w.permalink();
    const state = seedFromLocation("freetime", url.slice(url.indexOf("?")))!;
    expect(state).toMatchObject({ freeDays: "3", tiers: "5, 10" });
    w.destroy();
    await open(state);
    expect(preset()).toHaveValue("tiers");
    expect(summary()).toHaveTextContent("12 chargeable days");
  });

  it("is inert when aborted before it mounts", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(chargesOut()).not.toHaveTextContent("chargeableDays:");
    w.destroy();
  });

  it("survives a double destroy", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });

  it("re-places the gate on a width change and releases the observer on destroy", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await open();
      expect(spy.live.size).toBeGreaterThan(0);
      spy.fire();
      expect(screen.getByText("expires 17 Jun 00:00")).toBeInTheDocument();
      w.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
