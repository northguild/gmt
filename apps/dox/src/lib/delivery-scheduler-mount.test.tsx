/**
 * @vitest-environment jsdom
 *
 * The Delivery Scheduler widget end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names the way a person (or a screen
 * reader) meets the page. Every preset's printed call and result are appendix rows, verified
 * against a build of the final library.
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
import { DELIVERY_PRESETS } from "./delivery-scheduler";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDeliveryScheduler"] as AnyWidgetEntry;

/** [call, result], collapsed. `dwell-handoff` is the `scheduleDelivery.ts`
 *  JSDoc example V2, verbatim; the rest are section 9 rows. */
const EXPECTED: Record<string, [string, string | null]> = {
  "truck-ship-rail": [
    '[{ departure: "2024-03-29T08:00:00+01:00[Europe/Rome]", duration: "PT45H", timeZone: "Europe/London", dwellAfter: "PT2H", mode: "truck" }, { duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    '{ eta: "2024-04-12T17:30:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-31T04:00:00Z", localArrival: "2024-03-31T05:00:00+01:00[Europe/London]", dwellAfter: "PT2H", mode: "truck" }, { arrival: "2024-04-11T06:00:00Z", localArrival: "2024-04-11T15:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-04-12T08:30:00Z", localArrival: "2024-04-12T17:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }',
  ],
  "ship-scheduled": [
    '[{ departure: "2024-03-29T08:00:00+01:00[Europe/Rome]", duration: "PT45H", timeZone: "Europe/London", dwellAfter: "PT2H", mode: "truck" }, { departure: "2024-03-31T07:30:00[Europe/London]", duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    '{ eta: "2024-04-12T18:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-31T04:00:00Z", localArrival: "2024-03-31T05:00:00+01:00[Europe/London]", dwellAfter: "PT2H", mode: "truck" }, { arrival: "2024-04-11T06:30:00Z", localArrival: "2024-04-11T15:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-04-12T09:00:00Z", localArrival: "2024-04-12T18:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }',
  ],
  "missed-connection": [
    '[{ departure: "2024-03-29T08:00:00+01:00[Europe/Rome]", duration: "PT45H", timeZone: "Europe/London", dwellAfter: "PT2H", mode: "truck" }, { departure: "2024-03-31T06:30:00[Europe/London]", duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    null,
  ],
  "trans-pacific": [
    '[{ departure: "2024-06-17T17:00:00+09:00[Asia/Tokyo]", duration: "PT10H", timeZone: "America/Los_Angeles", dwellAfter: "PT3H", mode: "air" }, { duration: "PT44H", timeZone: "America/Chicago", mode: "truck" }]',
    '{ eta: "2024-06-19T12:00:00-05:00[America/Chicago]", legTimes: [{ arrival: "2024-06-17T18:00:00Z", localArrival: "2024-06-17T11:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT3H", mode: "air" }, { arrival: "2024-06-19T17:00:00Z", localArrival: "2024-06-19T12:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "truck" }] }',
  ],
  "fall-back-night": [
    '[{ departure: "2024-10-26T22:00:00+01:00[Europe/London]", duration: "PT6H", timeZone: "Europe/London", dwellAfter: "PT1H", mode: "rail" }, { duration: "PT2H", timeZone: "Europe/London", mode: "truck" }]',
    '{ eta: "2024-10-27T06:00:00+00:00[Europe/London]", legTimes: [{ arrival: "2024-10-27T03:00:00Z", localArrival: "2024-10-27T03:00:00+00:00[Europe/London]", dwellAfter: "PT1H", mode: "rail" }, { arrival: "2024-10-27T06:00:00Z", localArrival: "2024-10-27T06:00:00+00:00[Europe/London]", dwellAfter: "PT0S", mode: "truck" }] }',
  ],
  "dwell-handoff": [
    '[{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]',
    '{ eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }',
  ],
};

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const NUMERALS = ["①", "②", "③", "④"];

const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const countBox = () => screen.getByRole("combobox", { name: "Legs" });
const startZoneBox = () =>
  screen.getByRole("combobox", { name: "Start zone (optional)" });
const legGroup = (n: number) =>
  screen.getByRole("group", { name: new RegExp(`^${NUMERALS[n - 1]}`) });
const legField = (n: number, name: string) =>
  within(legGroup(n)).getByRole("textbox", { name });
const dwellBox = (n: number) => legField(n, "Handling after (optional)");
const departureBox = (n: number) =>
  legField(n, /^(Departs|Scheduled departure)/ as never);
const callFrame = () =>
  screen.getByRole("group", { name: /scheduleDelivery call/ });
const output = () =>
  screen.getByRole("status", { name: /scheduleDelivery returned/ });
const etaLine = () => screen.getByRole("status", { name: "ETA" });
const itinerary = () => screen.getByRole("list", { name: "Itinerary" });
const reason = () =>
  screen.queryByRole("complementary", { name: "Why NO SIGNAL" });
const legPick = () => screen.getByRole("combobox", { name: "Leg" });

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(presetBox(), id);
}

async function replace(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  await w.user.click(box);
  await w.user.paste(value);
}

describe("the template", () => {
  it("names every control a reader fills in", async () => {
    const w = await open();
    expect(presetBox()).toBeInTheDocument();
    expect(countBox()).toBeInTheDocument();
    expect(startZoneBox()).toBeInTheDocument();
    for (const n of [1, 2, 3]) {
      const group = within(legGroup(n));
      expect(
        group.getByRole("combobox", { name: "Mode (optional)" }),
      ).toBeInTheDocument();
      expect(
        group.getByRole("textbox", { name: "Duration" }),
      ).toBeInTheDocument();
      expect(
        group.getByRole("combobox", { name: "Arrives in" }),
      ).toBeInTheDocument();
      expect(dwellBox(n)).toBeInTheDocument();
    }
    expect(callFrame()).toBeInTheDocument();
    expect(output()).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Chart view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Split this journey into moving and waiting",
      }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("offers mode as a list of (none) plus the known modes, with the first leg's chosen", async () => {
    await open();
    const modes = within(
      within(legGroup(1)).getByRole("combobox", { name: "Mode (optional)" }),
    ).getAllByRole("option");
    expect(modes.map((o) => o.textContent)).toEqual([
      "(none)",
      "Truck",
      "Rail",
      "Ship",
      "Barge",
      "Air",
    ]);
    expect(
      within(legGroup(1)).getByRole("combobox", { name: "Mode (optional)" }),
    ).toHaveDisplayValue("Truck");
  });

  it("keeps a custom seeded mode as an extra option rather than dropping it", async () => {
    await open({
      legs: [{ duration: "PT1H", timeZone: "UTC", mode: "barge-express" }],
    });
    expect(
      within(legGroup(1)).getByRole("combobox", { name: "Mode (optional)" }),
    ).toHaveDisplayValue("Barge-express");
  });

  it("shows only as many legs as the journey has", async () => {
    await open({
      legs: [
        {
          departure: "2024-01-01T00:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
      ],
    });
    expect(countBox()).toHaveDisplayValue("1");
    expect(screen.getAllByRole("group", { name: /^[①②③④]/ })).toHaveLength(1);
  });
});

describe("handling, in the reader's words", () => {
  it("labels the stated dwellAfter 'Handling after' on every leg and says dwell nowhere on screen", async () => {
    const w = await open();
    await w.user.selectOptions(countBox(), "4");
    expect(
      screen.getAllByRole("textbox", { name: "Handling after (optional)" }),
    ).toHaveLength(4);
    expect(screen.queryAllByLabelText(/dwell/i)).toHaveLength(0);
    for (const p of DELIVERY_PRESETS) {
      expect(p.description, p.id).not.toMatch(/\bdwell/i);
    }
  });

  it("names a bad handling time in words and keeps the library's key in the printed call", async () => {
    const w = await open();
    await replace(w, dwellBox(1), "soon");
    expect(reason()).toHaveTextContent(
      "Leg 1's handling time is not a duration of time units, or it is negative.",
    );
    expect(
      screen.getByText("Leg 1: Invalid handling time"),
    ).toBeInTheDocument();
    expect(callFrame()).toHaveTextContent('dwellAfter: "soon"');
    await expectNoAxeViolations(w.root);
  });
});

describe("the hand-off to the Journey Split", () => {
  const link = () =>
    screen.getByRole("link", {
      name: "Split this journey into moving and waiting",
    });

  it("is always a link to the Journey Split, whichever preset is chosen", async () => {
    const w = await open();
    const heading = screen.getByRole("heading", {
      name: "3. What scheduleDelivery returns",
    });
    expect(heading).toBeInTheDocument();
    for (const p of DELIVERY_PRESETS) {
      await choose(w, p.id);
      expect(link(), p.id).toHaveAttribute(
        "href",
        expect.stringMatching(
          new RegExp(`^${SITE_BASE}/tools/journey-split/\\?w=journeysplit&wa=`),
        ),
      );
    }
  });

  it("carries every leg key, legCount and startTimeZone, and follows the form", async () => {
    const w = await open();
    await choose(w, "ship-scheduled");
    await replace(w, dwellBox(2), "PT12H");
    const href = link().getAttribute("href")!;
    const seeded = seedFromLocation(
      "journeysplit",
      href.slice(href.indexOf("?")),
    );
    expect(seeded).toEqual({
      legCount: "3",
      departure1: "2024-03-29T08:00:00+01:00[Europe/Rome]",
      duration1: "PT45H",
      timeZone1: "Europe/London",
      dwellAfter1: "PT2H",
      mode1: "truck",
      departure2: "2024-03-31T07:30:00[Europe/London]",
      duration2: "P11D",
      timeZone2: "Asia/Tokyo",
      dwellAfter2: "PT12H",
      mode2: "ship",
      duration3: "PT2H30M",
      timeZone3: "Asia/Tokyo",
      mode3: "rail",
    });
    expect(href).toBe(encodeWidgetPermalink("journeysplit", seeded));
  });

  it("is present before the library has answered", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(link()).toHaveAttribute(
      "href",
      expect.stringMatching(new RegExp(`^${SITE_BASE}/tools/journey-split/`)),
    );
    w.destroy();
  });
});

describe("mountDeliveryScheduler", () => {
  it.each(DELIVERY_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const w = await open();
      await choose(w, id);
      const [call, result] = EXPECTED[id]!;
      expect(callFrame()).toHaveTextContent(`scheduleDelivery(${call})`, {
        normalizeWhitespace: true,
      });
      if (result === null) {
        expect(output()).toHaveTextContent("NO SIGNAL");
      } else {
        expect(output()).toHaveTextContent(result);
        expect(output()).not.toHaveTextContent("NO SIGNAL");
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("names leg 2, 06:30, 05:00 and 07:00 in London for the missed connection", async () => {
    const w = await open();
    await choose(w, "missed-connection");
    const why = reason()!;
    for (const part of ["leg 2", "06:30", "05:00", "07:00"]) {
      expect(why).toHaveTextContent(part);
    }
    await expectNoAxeViolations(w.root);
  });

  it("shows the two calls behind the picked leg, and follows the leg picker", async () => {
    const w = await open();
    expect(
      within(legPick())
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Leg 1", "Leg 2", "Leg 3"]);
    const transit = () =>
      screen.getByRole("group", { name: /transitTime call/ });
    const eta = () => screen.getByRole("group", { name: /etaAtZone call/ });
    expect(transit()).toHaveTextContent("transitTime(");
    expect(transit()).toHaveTextContent('"PT45H"');
    expect(eta()).toHaveTextContent('"Europe/London"');
    // The arrival the first call returns is the instant the second is given.
    const arrival = screen.getByRole("status", {
      name: /transitTime returned/,
    });
    expect(arrival).not.toHaveTextContent("NO SIGNAL");
    const arrivalText = arrival.textContent!.trim();
    expect(eta()).toHaveTextContent(arrivalText.replaceAll('"', ""));
    expect(
      screen.getByRole("status", { name: /etaAtZone returned/ }),
    ).toHaveTextContent("[Europe/London]");

    await w.user.selectOptions(legPick(), "Leg 2");
    expect(eta()).not.toHaveTextContent('"Europe/London"');
    expect(transit()).toHaveTextContent("P11D");
    expect(transit()).not.toHaveTextContent("PT45H");
    await expectNoAxeViolations(w.root);
  });

  it("shows the ETA line from the real result", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    expect(etaLine()).toHaveTextContent(
      "ETA 2024-04-12T17:30:00+09:00[Asia/Tokyo]",
    );
  });

  it("leads with the ETA summary: headline, door-to-door and flags", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    expect(
      screen.getByText("Fri 12 Apr 2024 · 17:30 Tokyo (+09:00)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("14 d 1 h 30 min door to door"),
    ).toBeInTheDocument();
    const flags = within(screen.getByRole("list", { name: "Flags" }));
    expect(flags.getByText("DST ×2")).toBeInTheDocument();
    expect(flags.getByText("1 h offset-table error")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("turns the summary into a failure naming the leg on a missed connection", async () => {
    const w = await open();
    await choose(w, "missed-connection");
    expect(screen.getByText(/^Leg 2: Missed connection/)).toBeInTheDocument();
    expect(etaLine()).toHaveTextContent("No ETA — see the reason below.");
    expect(screen.queryByText(/^ETA 20/)).not.toBeInTheDocument();
  });

  it("draws the Route chart with each segment's own numeral as real text", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    for (const numeral of ["①", "②", "③"]) {
      expect(
        screen.getAllByText(new RegExp(`^${numeral} `)).length,
      ).toBeGreaterThan(0);
    }
    await expectNoAxeViolations(w.root);
  });

  it("keeps both charts out of the tab order, before and after a re-draw", async () => {
    const w = await open();
    const walk = async () => {
      for (let i = 0; i < 60; i++) {
        await w.user.tab();
        expect(document.activeElement?.localName).not.toBe("svg");
      }
    };
    await walk();
    await choose(w, "missed-connection");
    await walk();
  });

  it("switches to the To-scale chart, which says 'missed' for a missed connection", async () => {
    const w = await open();
    await choose(w, "missed-connection");
    expect(
      screen.getByRole("button", { name: "Route", pressed: true }),
    ).toBeInTheDocument();
    await w.user.click(screen.getByRole("button", { name: "To scale" }));
    expect(
      screen.getByRole("button", { name: "To scale", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Route", pressed: false }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("missed").length).toBeGreaterThan(0);
    await w.user.click(screen.getByRole("button", { name: "Route" }));
    expect(
      screen.getByRole("button", { name: "Route", pressed: true }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("reads an offset-table badge of 1 h early on leg 1 of truck-ship-rail", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    expect(within(itinerary()).getByText("1 h early")).toBeInTheDocument();
  });

  it("reads an offset-table badge of 1 h late on both legs of fall-back-night", async () => {
    const w = await open();
    await choose(w, "fall-back-night");
    expect(within(itinerary()).getAllByText("1 h late")).toHaveLength(2);
  });

  it("disagrees with no badge on trans-pacific", async () => {
    const w = await open();
    await choose(w, "trans-pacific");
    expect(
      within(itinerary()).queryAllByText(/^\d+ h (early|late)$/),
    ).toHaveLength(0);
  });

  it("groups the itinerary by date, with the final arrival tagged ETA and a spring-forward DST note", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    const list = within(itinerary());
    expect(
      list.getByRole("heading", { name: "Fri 29 Mar 2024" }),
    ).toBeInTheDocument();
    expect(list.getByText("ETA")).toBeInTheDocument();
    expect(list.getByText(/London clocks spring forward/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("annotates the Date Line crossing in the itinerary for trans-pacific", async () => {
    const w = await open();
    await choose(w, "trans-pacific");
    expect(within(itinerary()).getByText(/Date Line/)).toBeInTheDocument();
  });

  it("marks the missed handoff in the itinerary for missed-connection", async () => {
    const w = await open();
    await choose(w, "missed-connection");
    expect(
      within(itinerary()).getByText(/Missed connection/),
    ).toBeInTheDocument();
  });

  it("seeds the chat starter V38 and sets the leg count to 2", async () => {
    await open({
      legs: [
        {
          departure: "2024-03-29T08:00:00+01:00[Europe/Rome]",
          duration: "PT45H",
          timeZone: "Europe/London",
          mode: "truck",
        },
        { duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" },
      ],
    });
    expect(countBox()).toHaveDisplayValue("2");
    expect(output()).toHaveTextContent("2024-04-11T13:00:00+09:00[Asia/Tokyo]");
  });

  // The truck lands in London at 04:00Z on 31 March and is ready at 06:00Z after its 2-hour
  // dwell. The ship's printed 07:30 is read on London's clock (+01:00 after that morning's
  // spring-forward) as 06:30Z, so the connection is made and the rail leg lands in Tokyo on
  // the 12th.
  it("reads a zoneless leg 2 departure on leg 1's clock", async () => {
    const w = await open();
    await choose(w, "truck-ship-rail");
    await replace(w, departureBox(2), "2024-03-31T07:30:00");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(output()).toHaveTextContent("2024-04-12T18:00:00+09:00[Asia/Tokyo]");
  });

  it("follows the leg count, hiding legs past it", async () => {
    const w = await open();
    await w.user.selectOptions(countBox(), "2");
    expect(screen.getAllByRole("group", { name: /^[①②③④]/ })).toHaveLength(2);
    expect(presetBox()).toHaveDisplayValue("Custom");
    await expectNoAxeViolations(w.root);
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of DELIVERY_PRESETS) {
      const w = await open();
      await choose(w, preset.id);
      const url = w.permalink();
      const seeded = seedFromLocation(entry.kind, url.slice(url.indexOf("?")));
      expect(seeded).not.toBeNull();
      w.destroy();
      const again = await open(seeded as Record<string, unknown>);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(output()).toHaveTextContent("NO SIGNAL");
      } else {
        expect(output()).toHaveTextContent(result);
      }
      again.destroy();
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(w.permalink()).toBe(encodeWidgetPermalink(entry.kind, {}));
  });

  it("can be destroyed twice", async () => {
    const w = await open();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("a seed applied to the default template (the tool page)", () => {
  it("keeps zones outside the curated list and reads them", async () => {
    await open({
      startTimeZone: "Europe/Helsinki",
      legs: [
        {
          departure: "2024-06-10T08:00:00+03:00[Europe/Helsinki]",
          duration: "PT2H",
          timeZone: "Europe/Helsinki",
          mode: "truck",
        },
      ],
    });
    expect(startZoneBox()).toHaveDisplayValue("Europe/Helsinki");
    expect(
      within(legGroup(1)).getByRole("combobox", { name: "Arrives in" }),
    ).toHaveDisplayValue("Europe/Helsinki");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
  });
});
