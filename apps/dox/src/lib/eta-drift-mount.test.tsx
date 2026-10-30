/**
 * @vitest-environment jsdom
 *
 * The ETA Drift Chart end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names. Every printed pick and
 * report is an appendix Z row (ED1 to ED4, ED1a to ED1c, ED2r, EDR1 to EDR3).
 */
import { screen, waitFor, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { CHAT_STARTERS } from "./chat-constants";
import { ETA_PRESETS } from "./eta-drift";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showEtaDrift"] as AnyWidgetEntry;

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });
const openPreset = (id: string, extra: Record<string, unknown> = {}) =>
  open({ preset: id, ...extra });

// The controls and results, by the names a person reads.
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const countBox = () => screen.getByRole("combobox", { name: "Events" });
const tolBox = () =>
  screen.getByRole("textbox", { name: "Tolerance (optional)" });
const slider = () => screen.getByRole("slider", { name: "Drag the tolerance" });
const bestOutput = () =>
  screen.getByRole("status", { name: "What bestAvailable returned" });
const driftOutput = () =>
  screen.getByRole("status", { name: "What estimateDrift returned" });
const bestCall = () =>
  screen.getByRole("group", { name: "The bestAvailable call" });
const driftCall = () =>
  screen.getByRole("group", { name: "The estimateDrift call" });
const eventSet = (n: number) =>
  screen.getByRole("group", { name: `Event ${n}`, hidden: true });
const eventBox = (n: number, name: "At" | "Recorded at") =>
  within(eventSet(n)).getByRole("textbox", { name, hidden: true });
const classRadio = (n: number, name: string) =>
  within(eventSet(n)).getByRole("radio", { name, hidden: true });
const eventsTable = () =>
  screen.getByRole("table", { name: "Events in the order recorded" });
const note = () =>
  screen.queryByRole("complementary", { name: /^Nothing to measure yet/ });
const caution = () =>
  screen.queryByRole("complementary", { name: "Why NO SIGNAL" });

/** Replaces what a text box holds, in one input event. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

describe("renderEtaDriftTemplate", () => {
  it("names the widget and builds the tolerance as a real slider", async () => {
    const w = await open();
    expect(
      screen.getByRole("region", { name: "ETA Drift Chart" }),
    ).toBeInTheDocument();
    expect(slider()).toHaveValue("480");
    await expectNoAxeViolations(w.root);
  });

  it("gives each class a real radio, in a group named for the event", async () => {
    await open();
    const group = within(eventSet(1)).getByRole("group", { name: "Class" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("aria-label") ?? ""),
    ).toHaveLength(4);
    for (const name of [
      "PLN planned",
      "EST estimated",
      "REQ requested",
      "ACT actual",
    ]) {
      expect(within(group).getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(classRadio(1, "EST estimated")).toBeChecked();
  });

  it("keeps two widgets' radio groups apart", async () => {
    const first = await open();
    const second = await renderWidget(entry, { args: {}, idPrefix: "second" });
    const est = (w: Widget) =>
      within(
        within(w.root).getByRole("group", { name: "Event 1", hidden: true }),
      ).getByRole("radio", { name: "EST estimated", hidden: true });
    await second.user.click(
      within(
        within(second.root).getByRole("group", {
          name: "Event 1",
          hidden: true,
        }),
      ).getByRole("radio", { name: "ACT actual", hidden: true }),
    );
    expect(est(first)).toBeChecked();
    expect(est(second)).not.toBeChecked();
    second.destroy();
  });
});

describe("mountEtaDrift: every preset", () => {
  const EXPECTED: Record<
    string,
    {
      call: string;
      best: string;
      drift: string;
      bestCallout: string;
      naiveCallout: string | null;
      notes: string[];
    }
  > = {
    "vessel-slide": {
      call: 'estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }], { tolerance: "PT8H" })',
      best: '{ at: "2024-06-20T17:00:00Z", classifier: "EST" }',
      drift:
        '{ first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }',
      bestCallout:
        "Best available and the latest recorded are the same event: EST, Thu 20 Jun 17:00 (bestAvailable)",
      naiveCallout: null,
      notes: ["first EST", "", "best available, naive pick, last EST"],
    },
    "est-after-act": {
      call: 'estimateDrift([{ classifier: "PLN"',
      best: '{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }',
      drift:
        '{ first: "2024-06-15T12:40:00Z", last: "2024-06-15T13:05:00Z", drift: "PT25M", revisions: 2, exceedsTolerance: null }',
      bestCallout: "Best available: ACT, Sat 15 Jun 12:52 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 13:05",
      notes: ["", "first EST", "best available", "naive pick, last EST"],
    },
    "req-beats-est": {
      call: '{ tolerance: "PT15M" })',
      best: '{ at: "2024-06-15T12:30:00Z", classifier: "REQ" }',
      drift:
        '{ first: "2024-06-15T12:40:00Z", last: "2024-06-15T12:45:00Z", drift: "PT5M", revisions: 2, exceedsTolerance: false }',
      bestCallout: "Best available: REQ, Sat 15 Jun 12:30 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 12:45",
      notes: ["first EST", "best available", "naive pick, last EST"],
    },
    "one-estimate": {
      call: '{ tolerance: "PT15M" })',
      best: '{ at: "2024-06-15T12:00:00Z", classifier: "PLN" }',
      drift: "null",
      bestCallout: "Best available: PLN, Sat 15 Jun 12:00 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 12:40",
      notes: ["best available", "naive pick"],
    },
  };

  it.each(ETA_PRESETS.map((p) => [p.id]))("prints %s", async (id) => {
    const w = await openPreset(id!);
    const want = EXPECTED[id!]!;
    expect(driftCall()).toHaveTextContent(want.call, {
      normalizeWhitespace: true,
    });
    expect(bestCall()).toHaveTextContent("bestAvailable([{ classifier: ");
    expect(bestOutput()).toHaveTextContent(want.best);
    expect(driftOutput()).toHaveTextContent(want.drift);
    expect(screen.getByText(want.bestCallout)).toBeInTheDocument();
    if (want.naiveCallout === null) {
      expect(screen.getByText(/^Naive, latest recorded/)).not.toBeVisible();
    } else {
      expect(screen.getByText(want.naiveCallout)).toBeInTheDocument();
    }
    cellsInColumn(eventsTable(), "Note").forEach((cell, i) => {
      const expected = want.notes[i]!;
      expect(cell).toHaveTextContent(new RegExp(`^${expected}$`));
    });
    await expectNoAxeViolations(w.root);
  });

  it("omits the options argument when the tolerance is blank", async () => {
    await openPreset("est-after-act");
    expect(driftCall()).toHaveTextContent(/\}\]\)$/);
    expect(driftCall()).not.toHaveTextContent("tolerance");
  });

  it("says whether the drift exceeds the band, in words under the plot", async () => {
    await openPreset("vessel-slide");
    expect(
      screen.getByText(
        "±8 h around the first estimate · exceeds the tolerance: true",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about a band without a tolerance", async () => {
    await openPreset("est-after-act");
    expect(
      screen.queryByText(/around the first estimate/),
    ).not.toBeInTheDocument();
  });

  it("labels the drift with its sign", async () => {
    await openPreset("vessel-slide");
    expect(screen.getByText("↑ +9 h")).toBeInTheDocument();
  });

  it("makes the plot one image named by its summary, with nothing to tab to inside", async () => {
    await openPreset("est-after-act");
    const plot = screen.getByRole("img", {
      name: /Estimate drift \+25 min over 2 estimates/,
    });
    expect(plot).toHaveAccessibleName(
      /Recorded Sat 15 Jun 12:53: actual \(ACT\), naming Sat 15 Jun 12:52\./,
    );
    expect(within(plot).queryByRole("button")).not.toBeInTheDocument();
    expect(within(plot).queryByRole("slider")).not.toBeInTheDocument();
  });
});

describe("mountEtaDrift: the tolerance", () => {
  it("ED1a: the slider at 540 writes PT9H and exceedsTolerance is false", async () => {
    const w = await openPreset("vessel-slide");
    setRange(slider(), 540);
    expect(tolBox()).toHaveValue("PT9H");
    expect(driftOutput()).toHaveTextContent("exceedsTolerance: false");
    expect(slider()).toHaveAccessibleName("Drag the tolerance");
    expect(slider()).toHaveAttribute(
      "aria-valuetext",
      "Tolerance 9 hours, PT9H",
    );
    expect(presetBox()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("ED1b: the slider at 525 writes PT8H45M and exceedsTolerance is true", async () => {
    await openPreset("vessel-slide");
    setRange(slider(), 525);
    expect(tolBox()).toHaveValue("PT8H45M");
    expect(driftOutput()).toHaveTextContent("exceedsTolerance: true");
  });

  it("ED1c: clearing the tolerance gives null", async () => {
    const w = await openPreset("vessel-slide");
    await enter(w, tolBox(), "");
    expect(driftOutput()).toHaveTextContent("exceedsTolerance: null");
    expect(slider()).toHaveAttribute("aria-valuetext", "No tolerance");
    await expectNoAxeViolations(w.root);
  });

  it("moves the slider when a readable value is typed", async () => {
    const w = await openPreset("vessel-slide");
    await enter(w, tolBox(), "PT10H");
    expect(slider()).toHaveValue("600");
  });

  it("widens the slider past 24 hours when the drift needs it", async () => {
    await open({
      events: [
        {
          classifier: "EST",
          at: "2024-06-20T00:00:00Z",
          recordedAt: "2024-06-01T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-25T00:00:00Z",
          recordedAt: "2024-06-02T00:00:00Z",
        },
      ],
    });
    expect(Number(slider().getAttribute("max"))).toBeGreaterThan(1440);
  });

  it("EDR3: a weeks tolerance shows NO SIGNAL for the drift and its reason", async () => {
    const w = await openPreset("vessel-slide");
    await enter(w, tolBox(), "P1W");
    expect(driftOutput()).toHaveTextContent("NO SIGNAL");
    expect(bestOutput()).toHaveTextContent("classifier");
    expect(caution()).toHaveTextContent(
      "The tolerance is not an exact duration",
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("mountEtaDrift: classes and events", () => {
  it("ED2r: choosing EST on event 3 makes the plan the best available", async () => {
    const w = await openPreset("est-after-act");
    await w.user.click(classRadio(3, "EST estimated"));
    expect(bestOutput()).toHaveTextContent(
      '{ at: "2024-06-15T12:00:00Z", classifier: "PLN" }',
    );
    expect(driftOutput()).toHaveTextContent("revisions: 3");
    expect(presetBox()).toHaveValue("custom");
  });

  it("one-estimate: a correct empty answer, in a neutral note, never NO SIGNAL", async () => {
    const w = await openPreset("one-estimate");
    expect(driftOutput()).toHaveTextContent(/^null$/);
    expect(note()).toBeInTheDocument();
    expect(note()).toHaveTextContent("no drift from one estimate");
    expect(note()).not.toHaveTextContent("NO SIGNAL");
    expect(caution()).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /No estimate drift to measure yet: fewer than two estimates\./,
      }),
    ).toBeInTheDocument();
    // The best pick is real, so nothing on the page is a sentinel.
    expect(screen.queryByText("NO SIGNAL")).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("invalid input is still NO SIGNAL in a caution aside, apart from the empty note", async () => {
    await openPreset("vessel-slide", { tolerance: "P1W" });
    expect(driftOutput()).toHaveTextContent("NO SIGNAL");
    expect(caution()).toBeInTheDocument();
    expect(note()).not.toBeInTheDocument();
  });

  it("copies the last event into a new one after a preset switch, not only after a seed", async () => {
    // Bug: the count the select last held was read once at mount, so a preset that
    // changed the count left it stale and the next event came up blank.
    const w = await openPreset("vessel-slide");
    await w.user.selectOptions(presetBox(), "one-estimate");
    expect(
      screen.queryByRole("group", { name: "Event 3" }),
    ).not.toBeInTheDocument();
    await w.user.selectOptions(countBox(), "3");
    expect(screen.getByRole("group", { name: "Event 3" })).toBeInTheDocument();
    expect(eventBox(3, "At")).toHaveValue("2024-06-15T12:40:00Z");
    expect(eventBox(3, "Recorded at")).toHaveValue("2024-06-14T00:00:00Z");
    expect(classRadio(3, "EST estimated")).toBeChecked();
    expect(driftOutput()).toHaveTextContent("revisions: 2");
    expect(driftOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(bestOutput()).not.toHaveTextContent("NO SIGNAL");
  });

  it.each([
    "2024-02-30T08:00:00+00:00[Europe/London]",
    "2024-06-31T10:05:00+03:00[Europe/Helsinki]",
  ])(
    "an impossible date (%s) in a zoned event shows NO SIGNAL and does not throw",
    async (at) => {
      // Bug: the weekday label threw out of the mount for a date that does not exist.
      const w = await open({
        events: [{ classifier: "EST", at, recordedAt: "2024-06-14T00:00:00Z" }],
      });
      expect(bestOutput()).toHaveTextContent("NO SIGNAL");
      expect(driftOutput()).toHaveTextContent("NO SIGNAL");
      expect(screen.getByText(/^Best available:/)).toHaveTextContent(
        "NO SIGNAL",
      );
      expect(caution()).toHaveTextContent("Event 1 is not a timestamp");
      // The table prints the text as typed.
      expect(
        within(eventsTable()).getByRole("cell", { name: at }),
      ).toBeInTheDocument();
      await expectNoAxeViolations(w.root);
    },
  );

  it("re-renders without throwing when a typed date is impossible, and recovers", async () => {
    const w = await openPreset("vessel-slide");
    await enter(
      w,
      eventBox(2, "At"),
      "2024-02-30T08:00:00+00:00[Europe/London]",
    );
    expect(bestOutput()).toHaveTextContent("NO SIGNAL");
    await enter(w, eventBox(2, "At"), "2024-06-20T12:00:00Z");
    expect(bestOutput()).not.toHaveTextContent("NO SIGNAL");
  });

  it("gives the results table a name, headers, row headers and a focusable scroll box", async () => {
    const w = await openPreset("vessel-slide");
    const region = screen.getByRole("region", {
      name: "Events in the order recorded",
    });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(
      within(eventsTable())
        .getAllByRole("columnheader")
        .map((h) => h.getAttribute("scope")),
    ).toEqual(["col", "col", "col", "col", "col"]);
    expect(within(eventsTable()).getAllByRole("rowheader")).toHaveLength(3);
    await expectNoAxeViolations(w.root);
  });

  it("EDR2: a chat seed with a zoneless at shows NO SIGNAL twice", async () => {
    await open({
      events: [
        {
          classifier: "EST",
          at: "2024-06-15T12:40:00",
          recordedAt: "2024-06-14T00:00:00Z",
        },
      ],
    });
    expect(bestOutput()).toHaveTextContent("NO SIGNAL");
    expect(driftOutput()).toHaveTextContent("NO SIGNAL");
    expect(caution()).toHaveTextContent("Event 1 is not a timestamp");
    expect(screen.getByText(/^Best available:/)).toHaveTextContent("NO SIGNAL");
    expect(screen.getByText("invalid input")).toBeInTheDocument();
  });

  it("shows and hides event fieldsets with the count", async () => {
    const w = await openPreset("one-estimate");
    expect(screen.getByRole("group", { name: "Event 2" })).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Event 3" }),
    ).not.toBeInTheDocument();
    await w.user.selectOptions(countBox(), "3");
    expect(screen.getByRole("group", { name: "Event 3" })).toBeInTheDocument();
    // The new event starts as a copy of the last one, so it is a valid timestamp.
    expect(eventBox(3, "At")).toHaveValue("2024-06-15T12:40:00Z");
    expect(driftOutput()).toHaveTextContent("revisions: 2");
    await expectNoAxeViolations(w.root);
  });

  it("typing a time updates the result", async () => {
    const w = await openPreset("est-after-act");
    await enter(w, eventBox(4, "At"), "2024-06-15T13:30:00Z");
    expect(driftOutput()).toHaveTextContent('drift: "PT50M"');
  });

  it("reads the answer out in a status line once the change settles", async () => {
    await openPreset("vessel-slide");
    const status = screen.getByRole("status", { name: "ETA status" });
    setRange(slider(), 540);
    await waitFor(
      () =>
        expect(status).toHaveTextContent(
          "Estimate drift +9 h over 3 estimates",
        ),
      { timeout: 3000 },
    );
  });
});

describe("mountEtaDrift: chat seeds, permalinks and teardown", () => {
  it("ED1: the chat pill renders the vessel slide", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showEtaDrift")!;
    await open(pill.args as Record<string, unknown>);
    expect(driftOutput()).toHaveTextContent(
      '{ first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }',
    );
    expect(presetBox()).toHaveValue("vessel-slide");
  });

  it("PE2: the permalink seeds the tolerance on a template rendered without it", async () => {
    await open({ preset: "vessel-slide", tolerance: "PT9H" });
    expect(driftOutput()).toHaveTextContent("exceedsTolerance: false");
  });

  it("round-trips the preset form", async () => {
    const w = await openPreset("vessel-slide");
    setRange(slider(), 540);
    const link = w.permalink();
    const state = seedFromLocation("etadrift", link.slice(link.indexOf("?")));
    expect(state).toEqual({ preset: "vessel-slide", tolerance: "PT9H" });
    w.destroy();
    await open(state ?? {});
    expect(tolBox()).toHaveValue("PT9H");
  });

  it("round-trips the flat form of a chat seed", async () => {
    const w = await open({
      events: [
        {
          classifier: "PLN",
          at: "2024-06-15T12:00:00Z",
          recordedAt: "2024-06-01T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-15T12:40:00Z",
          recordedAt: "2024-06-14T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-15T12:50:00Z",
          recordedAt: "2024-06-14T05:00:00Z",
        },
      ],
      tolerance: "PT15M",
    });
    await enter(w, tolBox(), "PT20M");
    const link = w.permalink();
    const seed = seedFromLocation("etadrift", link.slice(link.indexOf("?")));
    expect(seed).toMatchObject({ eventCount: "3" });
    w.destroy();
    await open(seed ?? {});
    expect(driftOutput()).toHaveTextContent('drift: "PT10M"');
    expect(tolBox()).toHaveValue("PT20M");
  });

  it("is inert when aborted before the library loads", async () => {
    await renderWidget(entry, { args: {}, aborted: true });
    expect(bestOutput()).toBeEmptyDOMElement();
  });

  it("destroying twice does not throw", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });
});

function plate(caption: string): HTMLElement {
  const found = screen
    .getAllByRole("figure", { hidden: true })
    .find((f) => f.textContent?.startsWith(caption));
  if (found === undefined) throw new Error(`no plate captioned ${caption}`);
  return found;
}

describe("the plot's legend and plates", () => {
  const legend = () =>
    screen.getAllByRole("listitem", { hidden: true }).map((li) => li);

  it("lists only the classes present, in the dashboard's class order", async () => {
    await openPreset("est-after-act");
    const items = legend();
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("PLN");
    expect(items[1]).toHaveTextContent("EST");
    expect(items[2]).toHaveTextContent("ACT");
  });

  it("names the one class a single-class plot uses", async () => {
    await openPreset("vessel-slide");
    const items = legend();
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("estimated");
  });

  it("reads the drift on a plate: +9 h on the vessel slide", async () => {
    await openPreset("vessel-slide");
    const hero = plate("estimate drift");
    expect(hero).toHaveTextContent("+9 h");
    expect(hero).toHaveTextContent("PT9H · over 3 estimates");
    expect(hero).toHaveTextContent("exceeds ±8 h: yes");
  });

  it("reads the drift on a plate with no tolerance set", async () => {
    await openPreset("est-after-act");
    const hero = plate("estimate drift");
    expect(hero).toHaveTextContent("PT25M · over 2 estimates");
  });

  it("draws no drift plate when there is nothing to measure", async () => {
    await openPreset("one-estimate");
    expect(screen.queryByText("estimate drift")).not.toBeInTheDocument();
  });

  it.each(ETA_PRESETS.map((p) => [p.id]))(
    "draws the best pick's plate on %s",
    async (id) => {
      await openPreset(id!);
      const hero = plate("best available");
      expect(hero).toHaveTextContent(/^best available(PLN|EST|REQ|ACT) · /);
    },
  );

  it("keeps the plates out of the accessibility tree", async () => {
    await openPreset("vessel-slide");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
});

describe("releasing observers", () => {
  it("destroy disconnects every ResizeObserver the mount created", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await open();
      expect(spy.live.size).toBeGreaterThan(0);
      w.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
