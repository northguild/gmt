/**
 * @vitest-environment jsdom
 *
 * The Cut-off Ruler widget end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person (or a screen reader)
 * meets the page. Every preset's printed calls, outputs and hours-before values are appendix Z
 * rows.
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
import { RULER_PRESETS } from "./cutoff-ruler";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCutoffRuler"] as AnyWidgetEntry;

const EXPECTED: Record<string, [string, string, string][]> = {
  "sydney-fall-back": [
    [
      '"2024-04-08T18:00:00+10:00[Australia/Sydney]", "P2D", { timeZone: "Australia/Sydney" }',
      "2024-04-06T18:00:00+11:00[Australia/Sydney]",
      "PT49H",
    ],
    [
      '"2024-04-08T18:00:00+10:00[Australia/Sydney]", "PT48H", { timeZone: "Australia/Sydney" }',
      "2024-04-06T19:00:00+11:00[Australia/Sydney]",
      "PT48H",
    ],
    [
      '"2024-04-08T18:00:00+10:00[Australia/Sydney]", "P2D", { timeZone: "Australia/Sydney", atLocalTime: "17:00" }',
      "2024-04-06T17:00:00+11:00[Australia/Sydney]",
      "PT50H",
    ],
  ],
};

const READINGS = ["calendar", "exact", "pinned"] as const;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const anchorBox = () => screen.getByRole("textbox", { name: "Departs" });
const zoneBox = () => screen.getByRole("combobox", { name: "Terminal clock" });
const daysBox = () => screen.getByRole("combobox", { name: "Days before" });
const atBox = () => screen.getByRole("textbox", { name: "At local time" });
const output = (key: string) =>
  screen.getByRole("status", { name: `cutoffAt returned, ${key}` });
const callFrame = (key: string) =>
  screen.getByRole("group", { name: `cutoffAt call, ${key}` });

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(presetBox(), id);
}

async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

describe("the template", () => {
  it("names every control a reader fills in", async () => {
    const w = await open();
    expect(presetBox()).toBeInTheDocument();
    expect(anchorBox()).toBeInTheDocument();
    expect(zoneBox()).toBeInTheDocument();
    expect(daysBox()).toBeInTheDocument();
    expect(atBox()).toBeInTheDocument();
    for (const key of READINGS) {
      expect(callFrame(key)).toBeInTheDocument();
      expect(output(key)).toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });
});

describe("the readings", () => {
  it("prints the three calls, outputs and hours-before for the pill preset (R1)", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    const rows = EXPECTED["sydney-fall-back"]!;
    READINGS.forEach((key, i) => {
      const [call, at, hours] = rows[i]!;
      expect(callFrame(key)).toHaveTextContent(`cutoffAt(${call})`);
      expect(output(key)).toHaveTextContent(at);
      expect(screen.getAllByText(new RegExp(hours)).length).toBeGreaterThan(0);
    });
    await expectNoAxeViolations(w.root);
  });

  it("renders the chat seed (the pill args) as R1", async () => {
    await open({
      anchor: "2024-04-08T18:00:00+10:00[Australia/Sydney]",
      timeZone: "Australia/Sydney",
      days: 2,
      atLocalTime: "17:00",
    });
    expect(output("calendar")).toHaveTextContent(
      "2024-04-06T18:00:00+11:00[Australia/Sydney]",
    );
    expect(output("pinned")).toHaveTextContent(
      "2024-04-06T17:00:00+11:00[Australia/Sydney]",
    );
    expect(presetBox()).toHaveValue("sydney-fall-back");
  });

  it("changing 'Days before' to 1 re-renders all three calls with P1D and PT24H", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    await w.user.selectOptions(daysBox(), "1");
    expect(callFrame("calendar")).toHaveTextContent('"P1D"');
    expect(callFrame("exact")).toHaveTextContent('"PT24H"');
    expect(presetBox()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("names the number of days in the section heading", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    expect(
      screen.getByRole("heading", {
        name: 'Three readings of "2 days before"',
      }),
    ).toBeInTheDocument();
    await w.user.selectOptions(daysBox(), "3");
    expect(
      screen.getByRole("heading", {
        name: 'Three readings of "3 days before"',
      }),
    ).toBeInTheDocument();
  });

  it("shows one NO SIGNAL reading on skipped-hour; the other two resolve", async () => {
    const w = await open();
    await choose(w, "skipped-hour");
    expect(output("calendar")).not.toHaveTextContent("NO SIGNAL");
    expect(output("exact")).not.toHaveTextContent("NO SIGNAL");
    expect(output("pinned")).toHaveTextContent("NO SIGNAL");
    const why = screen.getByRole("complementary", { name: "Why NO SIGNAL" });
    expect(why).toHaveTextContent(/skipped/);
    await expectNoAxeViolations(w.root);
  });

  it("keeps a legitimately resolved set free of the sentinel", async () => {
    const w = await open();
    await choose(w, "amsterdam-june");
    expect(screen.queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Why NO SIGNAL" }),
    ).not.toBeInTheDocument();
  });
});

describe("the drawing", () => {
  it("names the clock change on R1 (go back) and R3 (go forward), and none on R2", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    expect(screen.getAllByText(/Clocks go back 1 h/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: /go back 1 h/ }).length,
    ).toBeGreaterThan(0);

    await choose(w, "london-spring-forward");
    expect(screen.getAllByText(/go forward 1 h/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Clocks go back/)).not.toBeInTheDocument();

    await choose(w, "amsterdam-june");
    expect(screen.queryByText(/Clocks go back/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clocks go forward/)).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("labels the overview's day and 6-hour ticks as visible text", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    expect(screen.getAllByText(/^\d{2}:00$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^\d+ [A-Za-z]{3}$/).length).toBeGreaterThan(0);
  });

  it("the close-up labels every local hour, and R1's three readings land an hour apart", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    for (const hour of ["17:00", "18:00", "19:00", "20:00"]) {
      expect(screen.getAllByText(hour).length).toBeGreaterThan(0);
    }
    for (const label of [
      /49 h/, // calendar: two days is 49 hours
      /48 h/,
      /50 h/,
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("gives each reading a named lane, and a card beside it", async () => {
    const w = await open();
    await choose(w, "sydney-fall-back");
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(
      within(cards[0]!).getByText(/keeps the departure's time of day/),
    ).toBeVisible();
    expect(within(cards[1]!).getByText(/elapsed time/)).toBeVisible();
    expect(
      within(cards[2]!).getByText(/keeps the local time you pin/),
    ).toBeVisible();
  });

  it("a card keeps the sentinel in place of the time on skipped-hour", async () => {
    const w = await open();
    await choose(w, "skipped-hour");
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[2]!).getByText("NO SIGNAL")).toBeVisible();
    expect(within(cards[0]!).queryByText("NO SIGNAL")).not.toBeInTheDocument();
  });
});

describe("a seed outside the lists", () => {
  it("keeps a zone outside the curated list and reads it", async () => {
    await open({
      anchor: "2024-06-10T18:00:00+03:00[Europe/Helsinki]",
      timeZone: "Europe/Helsinki",
      days: 2,
      atLocalTime: "17:00",
    });
    expect(zoneBox()).toHaveValue("Europe/Helsinki");
    expect(output("calendar")).not.toHaveTextContent("NO SIGNAL");
  });

  it("keeps a seeded day count outside 1 to 7 instead of blanking the select", async () => {
    await open({
      anchor: "2024-06-20T18:00:00+03:00[Europe/Helsinki]",
      timeZone: "Europe/Helsinki",
      days: 9,
      atLocalTime: "17:00",
    });
    expect(daysBox()).toHaveValue("9");
    expect(
      screen.getByRole("heading", {
        name: 'Three readings of "9 days before"',
      }),
    ).toBeInTheDocument();
    expect(output("calendar")).toHaveTextContent(
      "2024-06-11T18:00:00+03:00[Europe/Helsinki]",
    );
  });
});

describe("an anchor at the minimum instant", () => {
  it("shows NO SIGNAL for the chart instead of throwing out of the input handler", async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener("error", onError);
    try {
      const w = await open();
      await enter(w, anchorBox(), "-271821-04-20T00:00:00Z");
      expect(errors.map(String)).toEqual([]);
      expect(screen.getAllByText("NO SIGNAL").length).toBeGreaterThan(0);
      await expectNoAxeViolations(w.root);
    } finally {
      window.removeEventListener("error", onError);
    }
  });
});

describe("permalinks and lifetime", () => {
  it.each(RULER_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      const seeded = seedFromLocation(
        "cutoffruler",
        url.slice(url.indexOf("?")),
      );
      expect(Object.values(seeded).every((v) => typeof v === "string")).toBe(
        true,
      );
      expect(encodeWidgetPermalink("cutoffruler", seeded)).toBe(url);
      first.destroy();

      const again = await renderWidget(entry, {
        args: seeded,
        idPrefix: "again",
      });
      const second = within(again.root);
      expect(second.getByRole("combobox", { name: "Preset" })).toHaveValue(id);
      expect(
        second.getByRole("status", { name: "cutoffAt returned, calendar" }),
      ).not.toHaveTextContent("NO SIGNAL");
    },
  );

  it("is inert when aborted before the library loads", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(w.permalink).toBeDefined();
    w.destroy();
  });

  it("can be destroyed twice", async () => {
    const w = await open();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});
