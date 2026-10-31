/**
 * @vitest-environment jsdom
 *
 * The Departure Board end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names. Every printed departure is an
 * appendix Z row (DB1 to DB4, DBR1 to DBR5).
 */
import { screen, within } from "@testing-library/dom";
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
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { CHAT_STARTERS } from "./chat-constants";
import { DEPARTURE_PRESETS } from "./departure-board";
import { withBase } from "./site";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDepartureBoard"] as AnyWidgetEntry;

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });
const openPreset = (id: string, extra: Record<string, unknown> = {}) =>
  open({ preset: id, ...extra });

const AMS = (t: string) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const HEL = (t: string) => `2024-06-15T${t}+03:00[Europe/Helsinki]`;

// The controls, by the names a person reads.
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const afterBox = () => screen.getByRole("textbox", { name: "Arrival" });
const connBox = () =>
  screen.getByRole("textbox", { name: "Minimum connection" });
const arrival = () => screen.getByRole("slider", { name: "Arrival" });
const madeOutput = () =>
  screen.getByRole("status", { name: "What nextDeparture returned" });
const naiveOutput = () =>
  screen.getByRole("status", { name: "What the naive call returned" });
const madeCall = () => screen.getByRole("group", { name: "The call made" });
const naiveCall = () =>
  screen.getByRole("group", {
    name: "The naive call, with no connection time",
  });
const rail = () => screen.getByRole("img", { name: /^Arrival / });
const note = () => screen.queryByRole("complementary", { name: "Why empty" });
const caution = () =>
  screen.queryByRole("complementary", { name: "Why NO SIGNAL" });
const live = () => screen.getByRole("status", { name: "Departure status" });
const handoff = () => screen.getByText("Send to Delivery Scheduler");

/** A text box that may be hidden with its field. */
const hiddenBox = (name: string) =>
  screen.getByRole("textbox", { name, hidden: true });

/** Replaces what a text box holds, in one input event. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

/** Moves focus to the arrival slider and presses keys. */
async function press(w: Widget, keys: string) {
  arrival().focus();
  await w.user.keyboard(keys);
}

const times = (n: number, key: string) => `{${key}}`.repeat(n);

describe("renderDepartureBoardTemplate", () => {
  it("makes the arrival handle a real slider, apart from the rail's image", async () => {
    const w = await open();
    expect(arrival()).toBeInTheDocument();
    expect(within(rail()).queryByRole("slider")).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("gives the two timetable forms real radios", async () => {
    await openPreset("ferry-list");
    expect(
      screen.getByRole("radio", { name: "A list of departures" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Every N minutes" }),
    ).not.toBeChecked();
  });

  it("keeps two widgets' radio groups apart", async () => {
    await openPreset("ferry-list");
    const second = await renderWidget(entry, {
      args: { preset: "shuttle-headway" },
      idPrefix: "second",
    });
    const radios = screen.getAllByRole("radio", { name: "Every N minutes" });
    expect(radios).toHaveLength(2);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    second.destroy();
  });

  it("builds the destination clock from the shared zone options", async () => {
    await openPreset("ferry-list");
    const zone = screen.getByRole("combobox", { name: "Destination clock" });
    expect(
      within(zone).getByRole("option", { name: "(not given)" }),
    ).toBeInTheDocument();
    expect(zone).toHaveValue("Europe/Tallinn");
  });
});

describe("mountDepartureBoard: every preset", () => {
  const EXPECTED: Record<
    string,
    {
      verdict: string;
      naive: string;
      made: string;
      naiveOut: string;
      href: Record<string, string> | null;
    }
  > = {
    "shuttle-headway": {
      verdict: "You make the 06:40.",
      naive: "Naive, with no connection time: the 06:20.",
      made: JSON.stringify(AMS("06:40:00")),
      naiveOut: JSON.stringify(AMS("06:20:00")),
      href: {
        legCount: "1",
        departure1: AMS("06:40:00"),
        duration1: "PT35M",
        timeZone1: "Europe/Amsterdam",
        mode1: "shuttle",
      },
    },
    "ferry-list": {
      verdict: "You make the 13:00.",
      naive: "Naive, with no connection time: the 10:30.",
      made: JSON.stringify(HEL("13:00:00")),
      naiveOut: JSON.stringify(HEL("10:30:00")),
      href: {
        legCount: "1",
        departure1: HEL("13:00:00"),
        duration1: "PT2H",
        timeZone1: "Europe/Tallinn",
        mode1: "ferry",
      },
    },
    "arrival-at-to": {
      verdict: "No departure you can make.",
      naive: "",
      made: '""',
      naiveOut: '""',
      href: null,
    },
    "fall-back-hourly": {
      verdict: "You make the 01:00.",
      naive: "The connection time changes nothing here.",
      made: JSON.stringify("2024-10-27T01:00:00+00:00[Europe/London]"),
      naiveOut: JSON.stringify("2024-10-27T01:00:00+00:00[Europe/London]"),
      href: null,
    },
  };

  it.each(DEPARTURE_PRESETS.map((p) => [p.id]))("prints %s", async (id) => {
    const w = await openPreset(id!);
    const want = EXPECTED[id!]!;
    expect(
      screen.getByRole("note", { name: "Departure verdict" }),
    ).toHaveTextContent(want.verdict);
    if (want.naive === "") {
      expect(
        screen.queryByText(/^Naive, with no connection time/),
      ).not.toBeInTheDocument();
    } else {
      expect(screen.getByText(want.naive)).toBeInTheDocument();
    }
    expect(madeOutput()).toHaveTextContent(want.made);
    expect(naiveOutput()).toHaveTextContent(want.naiveOut);
    expect(madeCall()).toHaveTextContent("nextDeparture(");
    if (want.href === null) {
      expect(handoff()).toHaveAttribute("aria-disabled", "true");
      expect(handoff()).not.toHaveAttribute("href");
    } else {
      const link = screen.getByRole("link", {
        name: "Send to Delivery Scheduler",
      });
      const href = link.getAttribute("href")!;
      expect(
        href.startsWith(withBase("/tools/delivery-scheduler/?w=delivery&wa=")),
      ).toBe(true);
      expect(link).not.toHaveAttribute("aria-disabled", "true");
      // The Delivery Scheduler's own reader takes these keys.
      expect(
        seedFromLocation("delivery", href.slice(href.indexOf("?"))),
      ).toEqual(want.href);
    }
    await expectNoAxeViolations(w.root);
  });

  it("prints the real calls", async () => {
    await openPreset("shuttle-headway");
    expect(madeCall()).toHaveTextContent(
      `nextDeparture("${AMS("06:12:00")}", { headway: "PT20M", from: "${AMS("06:00:00")}", to: "${AMS("09:00:00")}" }, { minimumConnection: "PT10M" })`,
    );
    expect(naiveCall()).toHaveTextContent(
      `nextDeparture("${AMS("06:12:00")}", { headway: "PT20M", from: "${AMS("06:00:00")}", to: "${AMS("09:00:00")}" })`,
    );
  });

  it("prints a list as an array in the order given", async () => {
    await openPreset("ferry-list");
    expect(madeCall()).toHaveTextContent(
      `["${HEL("16:30:00")}", "${HEL("07:30:00")}", "${HEL("10:30:00")}"`,
    );
  });

  it("shows only the active form's fields", async () => {
    await openPreset("ferry-list");
    expect(screen.getByRole("textbox", { name: "Departure 1" })).toBeVisible();
    expect(hiddenBox("Every")).not.toBeVisible();
  });

  it("draws the rail in words: the made and naive departures, the connection, the window", async () => {
    await openPreset("shuttle-headway");
    expect(screen.getByText("made: 06:40")).toBeInTheDocument();
    expect(screen.getByText("naive")).toBeInTheDocument();
    expect(screen.getByText("10 min to connect")).toBeInTheDocument();
    expect(screen.getByText("to, excluded")).toBeInTheDocument();
    expect(screen.getByText("from")).toBeInTheDocument();
    expect(rail()).toHaveAccessibleName(/Made: Sat 15 Jun 06:40\./);
  });

  it("draws a list with no brackets", async () => {
    await openPreset("ferry-list");
    expect(screen.queryByText("to, excluded")).not.toBeInTheDocument();
    expect(screen.queryByText("from")).not.toBeInTheDocument();
  });

  it("combines the made and naive labels when they are one departure", async () => {
    await openPreset("ferry-list", { minimumConnection: "none" });
    expect(screen.getByText("made: 10:30, naive")).toBeInTheDocument();
    expect(
      screen.getByText("The connection time changes nothing here."),
    ).toBeInTheDocument();
  });

  it("adds the wait to the rail's text, since the plate is hidden from assistive technology", async () => {
    await openPreset("shuttle-headway");
    expect(rail()).toHaveAccessibleName(/Wait: 28 min after arrival\./);
  });
});

describe("mountDepartureBoard: the empty answer is not a sentinel", () => {
  it("DB3: arriving at to prints an empty output and a note, no amber", async () => {
    const w = await openPreset("arrival-at-to");
    expect(madeOutput()).toHaveTextContent('""');
    expect(madeOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(note()).toHaveTextContent("the window ends at Sat 15 Jun 09:00");
    expect(caution()).not.toBeInTheDocument();
    expect(screen.getByText("No departure to send.")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("DB3: ArrowLeft 20 times writes 08:40 and the verdict reads You make the 08:40.", async () => {
    const w = await openPreset("arrival-at-to");
    await press(w, times(20, "ArrowLeft"));
    expect(afterBox()).toHaveValue(AMS("08:40:00"));
    expect(screen.getByText("You make the 08:40.")).toBeInTheDocument();
    expect(madeOutput()).toHaveTextContent(JSON.stringify(AMS("08:40:00")));
    expect(presetBox()).toHaveValue("custom");
  });

  it("DB2l: End moves the arrival past the last ferry: empty, none left", async () => {
    const w = await openPreset("ferry-list");
    await press(w, "{End}");
    expect(madeOutput()).toHaveTextContent('""');
    expect(note()).toHaveTextContent("the last one leaves before it");
    expect(caution()).not.toBeInTheDocument();
  });

  it("clearing the connection on the ferry preset makes the 10:30", async () => {
    const w = await openPreset("ferry-list");
    await enter(w, connBox(), "");
    expect(screen.getByText("You make the 10:30.")).toBeInTheDocument();
    expect(
      screen.getByText("The connection time changes nothing here."),
    ).toBeInTheDocument();
  });
});

describe("mountDepartureBoard: NO SIGNAL", () => {
  it("DBR1: a zoneless arrival shows NO SIGNAL and the arrival reason", async () => {
    const w = await openPreset("ferry-list");
    await enter(w, afterBox(), "2024-06-15T10:05:00");
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
    expect(caution()).toHaveTextContent("The arrival has no offset");
    expect(note()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("note", { name: "Departure verdict" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^Naive, with no connection time/),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("DBR4: a calendar connection is invalid, and the naive call still answers", async () => {
    const w = await openPreset("ferry-list");
    await enter(w, connBox(), "P1W");
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
    expect(naiveOutput()).toHaveTextContent(JSON.stringify(HEL("10:30:00")));
    expect(caution()).toHaveTextContent(
      "The minimum connection is not an exact duration",
    );
  });

  it("DBR5: a zero headway is invalid", async () => {
    const w = await openPreset("shuttle-headway");
    await enter(w, screen.getByRole("textbox", { name: "Every" }), "PT0S");
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
    expect(caution()).toHaveTextContent("The headway is not an exact duration");
  });

  it("an entry with no offset names its departure", async () => {
    const w = await openPreset("ferry-list");
    await enter(
      w,
      screen.getByRole("textbox", { name: "Departure 2" }),
      "2024-06-15T07:30:00",
    );
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
    expect(caution()).toHaveTextContent("Departure 2 has no offset");
  });
});

describe("mountDepartureBoard: the form and the list", () => {
  it("switching to headway shows the headway fields", async () => {
    const w = await openPreset("ferry-list");
    await w.user.click(screen.getByRole("radio", { name: "Every N minutes" }));
    expect(screen.getByRole("textbox", { name: "Every" })).toBeVisible();
    expect(hiddenBox("Departure 1")).not.toBeVisible();
    expect(presetBox()).toHaveValue("custom");
  });

  it("the departure count shows and hides list fields", async () => {
    const w = await openPreset("ferry-list");
    await w.user.selectOptions(
      screen.getByRole("combobox", { name: "Departures" }),
      "3",
    );
    expect(screen.getByRole("textbox", { name: "Departure 3" })).toBeVisible();
    expect(hiddenBox("Departure 4")).not.toBeVisible();
    expect(madeCall()).not.toHaveTextContent(HEL("19:30:00"));
  });

  it("choosing a preset replaces the timetable and the fields", async () => {
    const w = await openPreset("ferry-list");
    await w.user.selectOptions(presetBox(), "arrival-at-to");
    expect(afterBox()).toHaveValue(AMS("09:00:00"));
    expect(screen.getByRole("textbox", { name: "Every" })).toBeVisible();
    expect(presetBox()).toHaveAccessibleDescription(/half-open/);
    await expectNoAxeViolations(w.root);
  });
});

describe("mountDepartureBoard: the arrival handle", () => {
  it("keeps the arrival in its own notation: a bracketed zone, an offset, Z", async () => {
    const zoned = await openPreset("shuttle-headway");
    await press(zoned, "{ArrowRight}");
    expect(afterBox()).toHaveValue(AMS("06:13:00"));
    zoned.destroy();
    const offset = await open({
      after: "2024-06-15T06:12:00+02:00",
      headway: "PT20M",
      from: "2024-06-15T06:00:00+02:00",
      to: "2024-06-15T09:00:00+02:00",
    });
    await press(offset, "{ArrowRight}");
    expect(afterBox()).toHaveValue("2024-06-15T06:13:00+02:00");
    offset.destroy();
    const utc = await open({
      after: "2024-06-15T04:12:00Z",
      headway: "PT20M",
      from: "2024-06-15T04:00:00Z",
      to: "2024-06-15T07:00:00Z",
    });
    await press(utc, "{ArrowRight}");
    expect(afterBox()).toHaveValue("2024-06-15T04:13:00Z");
  });

  it("PageUp and PageDown move ten minutes", async () => {
    const w = await openPreset("shuttle-headway");
    await press(w, "{PageDown}");
    expect(afterBox()).toHaveValue(AMS("06:02:00"));
    await press(w, "{PageUp}");
    expect(afterBox()).toHaveValue(AMS("06:12:00"));
    await press(w, "{PageUp}");
    expect(afterBox()).toHaveValue(AMS("06:22:00"));
  });

  it("ArrowLeft and ArrowRight move one minute", async () => {
    const w = await openPreset("shuttle-headway");
    await press(w, "{ArrowLeft}");
    expect(afterBox()).toHaveValue(AMS("06:11:00"));
    await press(w, "{ArrowRight}{ArrowRight}");
    expect(afterBox()).toHaveValue(AMS("06:13:00"));
  });

  it("Home goes to the start of the rail", async () => {
    const w = await openPreset("shuttle-headway");
    await press(w, "{Home}");
    expect(afterBox()).toHaveValue(AMS("05:45:00"));
  });

  it("End goes to the end of the rail", async () => {
    const w = await openPreset("shuttle-headway");
    await press(w, "{End}");
    expect(afterBox()).toHaveValue(AMS("09:15:00"));
  });

  it("moves the made departure live", async () => {
    const w = await openPreset("shuttle-headway");
    expect(screen.getByText("You make the 06:40.")).toBeInTheDocument();
    await press(w, times(9, "ArrowRight"));
    // 06:21 plus 10 minutes is 06:31, so the 06:40 is still next.
    expect(screen.getByText("You make the 06:40.")).toBeInTheDocument();
    await press(w, times(10, "ArrowRight"));
    expect(screen.getByText("You make the 07:00.")).toBeInTheDocument();
  });

  it("refits the rail when the key commits, so the next press moves past the old edge", async () => {
    const w = await openPreset("shuttle-headway");
    await press(w, "{End}");
    expect(afterBox()).toHaveValue(AMS("09:15:00"));
    await press(w, "{ArrowRight}");
    expect(afterBox()).toHaveValue(AMS("09:16:00"));
  });

  it("keeps aria on the handle in step", async () => {
    await openPreset("shuttle-headway");
    expect(arrival()).toHaveAttribute("aria-valuemin", "0");
    expect(arrival()).toHaveAttribute("aria-valuemax", "210");
    expect(arrival()).toHaveValue(27);
    expect(arrival()).toHaveAttribute(
      "aria-valuetext",
      "Arrival Sat 15 Jun 06:12",
    );
  });

  it("a typed arrival moves the handle and refits on commit", async () => {
    const w = await openPreset("shuttle-headway");
    await enter(w, afterBox(), AMS("08:00:00"));
    expect(arrival()).toHaveValue(135);
    await w.user.tab();
    // 08:00 plus the 10-minute connection is 08:10: the 08:20 is next.
    expect(screen.getByText("You make the 08:20.")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("hides the handle when the arrival is not a moment", async () => {
    const w = await openPreset("shuttle-headway");
    await enter(w, afterBox(), "soon");
    expect(
      screen.getByRole("slider", { name: "Arrival", hidden: true }),
    ).not.toBeVisible();
    expect(
      screen.getByRole("img", { name: /No signal\./ }),
    ).toBeInTheDocument();
  });
});

describe("mountDepartureBoard: the live region", () => {
  it("speaks once, after the change settles", async () => {
    const w = await openPreset("shuttle-headway");
    expect(live()).toHaveTextContent(/^$/);
    await press(w, times(5, "ArrowRight"));
    expect(live()).not.toHaveTextContent("You make");
    await within(live()).findByText(/^You make the/, undefined, {
      timeout: 2000,
    });
  });

  it("drops a pending reading when destroyed", async () => {
    const w = await openPreset("shuttle-headway");
    const region = live();
    await press(w, "{ArrowRight}");
    w.destroy();
    await new Promise((r) => setTimeout(r, 800));
    expect(region).toHaveTextContent(/^$/);
  });
});

describe("mountDepartureBoard: text that is not a date", () => {
  it.each([
    "2024-06-31T10:05:00+03:00[Europe/Helsinki]",
    "2024-02-30T08:00:00+00:00[Europe/London]",
  ])(
    "an impossible zoned arrival (%s) is NO SIGNAL with its reason and no hand-off link",
    async (after) => {
      const w = await openPreset("ferry-list");
      expect(
        screen.getByRole("link", { name: "Send to Delivery Scheduler" }),
      ).toBeInTheDocument();
      await enter(w, afterBox(), after);
      expect(madeOutput()).toHaveTextContent("NO SIGNAL");
      expect(caution()).toHaveTextContent(
        "date does not exist on the calendar",
      );
      expect(handoff()).toHaveAttribute("aria-disabled", "true");
      expect(handoff()).not.toHaveAttribute("href");
      expect(
        screen.getByRole("img", { name: /No signal\./ }),
      ).toBeInTheDocument();
    },
  );

  it("names the true fault for each kind of bad arrival", async () => {
    const w = await openPreset("ferry-list");
    await enter(w, afterBox(), "soon");
    expect(caution()).toHaveTextContent("not a date and time");
    await enter(w, afterBox(), "2024-06-15T10:05:00");
    expect(caution()).toHaveTextContent("has no offset");
    await enter(w, afterBox(), "2024-06-15T10:05:00+05:00[Europe/Helsinki]");
    expect(caution()).toHaveTextContent("disagrees with its offset");
  });

  it("an impossible zoned entry in the timetable does not throw either", async () => {
    const w = await openPreset("ferry-list");
    await enter(
      w,
      screen.getByRole("textbox", { name: "Departure 2" }),
      "2024-06-31T10:05:00+03:00[Europe/Helsinki]",
    );
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
  });
});

describe("mountDepartureBoard: chat seeds, permalinks and teardown", () => {
  it("DB2: the chat pill renders the ferry", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showDepartureBoard")!;
    await open(pill.args as Record<string, unknown>);
    expect(screen.getByText("You make the 13:00.")).toBeInTheDocument();
    expect(
      screen.getByText("Naive, with no connection time: the 10:30."),
    ).toBeInTheDocument();
  });

  it("PD2: the preset seed fills a template rendered without it", async () => {
    await openPreset("arrival-at-to");
    expect(madeOutput()).toHaveTextContent('""');
  });

  it("PD3: the seed with the connection cleared", async () => {
    await openPreset("ferry-list", { minimumConnection: "none" });
    expect(screen.getByText("You make the 10:30.")).toBeInTheDocument();
  });

  it("round-trips the preset form", async () => {
    const w = await openPreset("arrival-at-to");
    await press(w, times(20, "ArrowLeft"));
    const link = w.permalink();
    const state = seedFromLocation("departure", link.slice(link.indexOf("?")));
    expect(state).toEqual({ preset: "arrival-at-to", after: AMS("08:40:00") });
    w.destroy();
    await open(state ?? {});
    expect(afterBox()).toHaveValue(AMS("08:40:00"));
  });

  it("round-trips the flat list form of a chat seed", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showDepartureBoard")!;
    const w = await open(pill.args as Record<string, unknown>);
    const link = w.permalink();
    const seed = seedFromLocation("departure", link.slice(link.indexOf("?")));
    expect(seed).toMatchObject({ form: "list" });
    w.destroy();
    await open(seed ?? {});
    expect(screen.getByText("You make the 13:00.")).toBeInTheDocument();
  });

  it("is inert when aborted before the library loads", async () => {
    await renderWidget(entry, { args: {}, aborted: true });
    expect(afterBox()).toBeInTheDocument();
  });

  it("destroying twice does not throw", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });
});

describe("mountDepartureBoard: the departure plate", () => {
  const plate = () => screen.getByRole("figure", { hidden: true });

  it("shows the departure made, large, with the wait from the library", async () => {
    await openPreset("shuttle-headway");
    expect(plate()).toHaveTextContent("06:40");
    expect(plate()).toHaveTextContent("wait 28 min after arrival");
    expect(plate()).toHaveTextContent("PT28M");
  });

  it("counts the wait in exact time across the repeated hour", async () => {
    await openPreset("fall-back-hourly");
    expect(plate()).toHaveTextContent("wait 30 min after arrival");
    expect(plate()).toHaveTextContent("PT30M");
  });

  it("reads none, with no wait, when no departure is left", async () => {
    await openPreset("arrival-at-to");
    expect(plate()).toHaveTextContent("none");
    expect(plate()).toHaveTextContent("no departure left");
  });

  it("hides the plate on an invalid arrival: the outputs carry NO SIGNAL", async () => {
    const w = await openPreset("shuttle-headway");
    await enter(w, afterBox(), "not a time");
    expect(
      screen.queryByRole("figure", { hidden: true }),
    ).not.toBeInTheDocument();
    expect(madeOutput()).toHaveTextContent("NO SIGNAL");
  });

  it("keeps the plates out of the accessibility tree", async () => {
    await openPreset("shuttle-headway");
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
