/**
 * @vitest-environment jsdom
 *
 * The Dwell Ledger end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names. Every preset's printed result is
 * checked against the literal `dwellTime` JSDoc example it draws, so a drift in the
 * library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import { Temporal } from "@js-temporal/polyfill";
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
import { DWELL_PRESETS } from "./dwell-ledger";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDwellLedger"] as AnyWidgetEntry;

/** The `dwellTime` JSDoc examples the presets draw, verbatim. */
const EXPECTED: Record<string, string[]> = {
  "two-hours-two-days": [
    '{ duration: "PT2H",\n  enter: "2024-06-15T23:00:00+02:00[Africa/Johannesburg]",\n  exit: "2024-06-16T01:00:00+02:00[Africa/Johannesburg]",\n  calendarDays: 2 }',
  ],
  "exit-at-midnight": [
    '{ duration: "PT6H",\n  enter: "2024-06-15T18:00:00+09:00[Asia/Tokyo]",\n  exit: "2024-06-16T00:00:00+09:00[Asia/Tokyo]",\n  calendarDays: 1 }',
  ],
  "spring-forward": [
    '{ duration: "PT7H",\n  enter: "2024-03-31T00:00:00+00:00[Europe/London]",\n  exit: "2024-03-31T08:00:00+01:00[Europe/London]",\n  calendarDays: 1 }',
  ],
  "london-vs-amsterdam": [
    '{ duration: "PT2H30M",\n  enter: "2024-06-15T23:30:00+01:00[Europe/London]",\n  exit: "2024-06-16T02:00:00+01:00[Europe/London]",\n  calendarDays: 2 }',
    '{ duration: "PT2H30M",\n  enter: "2024-06-16T00:30:00+02:00[Europe/Amsterdam]",\n  exit: "2024-06-16T03:00:00+02:00[Europe/Amsterdam]",\n  calendarDays: 1 }',
  ],
  "no-zone": ["NO SIGNAL"],
};

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const zone = () => screen.getByRole("combobox", { name: "Count days in" });
const compare = () => screen.getByRole("combobox", { name: "Compare with" });
const entryBox = () => screen.getByRole("textbox", { name: "Entry" });
const exitBox = () => screen.getByRole("textbox", { name: "Exit" });
const entryHandle = () => screen.getByRole("slider", { name: "Entry" });
const exitHandle = () => screen.getByRole("slider", { name: "Exit" });
const summary = () => screen.getByRole("status", { name: "Dwell summary" });

const outputOf = (label: string) => screen.getByLabelText(label);
const dwellOutput = () => outputOf("What dwellTime returned");
const compareOutput = () =>
  outputOf("What dwellTime returned for the comparison zone");

/** What the first copy button puts on the clipboard: the call made. */
async function callText(w: Widget): Promise<string> {
  await w.user.click(screen.getAllByRole("button", { name: "Copy call" })[0]!);
  return navigator.clipboard.readText();
}

/** The days the dwell lit in one lane, by date. */
const lit = (lane: string) =>
  within(screen.getByRole("list", { name: new RegExp(`^${lane}`) }))
    .getAllByRole("listitem")
    .map((d) => d.getAttribute("aria-label") ?? "")
    .filter((name) => /counted/.test(name))
    .map((name) => name.split(" ").slice(0, 2).join(" "));

async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  await w.user.paste(value);
  await w.user.tab();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-10-15T00:00:00Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderDwellLedgerTemplate", () => {
  it("is a named region with two numbered sections and the controls a person names", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Dwell Ledger" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Place a dwell on the local-day grid",
      "2. What dwellTime returns",
    ]);
    for (const control of [preset, zone, compare, entryBox, exitBox]) {
      expect(control()).toBeInTheDocument();
    }
    expect(entryHandle()).toBeInTheDocument();
    expect(exitHandle()).toBeInTheDocument();
  });

  it("opens on the first preset with the comparison lane hidden", async () => {
    const w = await open();
    const first = DWELL_PRESETS[0]!;
    expect(preset()).toHaveValue(first.id);
    expect(entryBox()).toHaveValue(first.entry);
    expect(zone()).toHaveValue(first.zone);
    await expectNoAxeViolations(w.root);
  });

  it("paints seeded arguments, adding an unlisted zone", async () => {
    await open({
      entry: "2024-06-15T22:30:00Z",
      exit: "2024-06-16T01:00:00Z",
      zone: "America/Halifax",
      compareZone: "Europe/Amsterdam",
    });
    expect(zone()).toHaveValue("America/Halifax");
    expect(compare()).toHaveValue("Europe/Amsterdam");
    expect(preset()).toHaveValue("custom");
  });

  it("neutralises what it interpolates", async () => {
    const w = await open({
      entry: '"><img src=x onerror=alert(1)>',
      exit: "x",
      zone: "<b>Zone</b>",
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(entryBox()).toHaveValue('"><img src=x onerror=alert(1)>');
    expect(zone()).toHaveValue("<b>Zone</b>");
    await expectNoAxeViolations(w.root);
  });
});

describe("mountDwellLedger", () => {
  it.each(DWELL_PRESETS.map((p) => [p.id]))(
    "prints dwellTime's documented result for %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      const [primary, other] = EXPECTED[id]!;
      expect(dwellOutput()).toHaveTextContent(primary!.replace(/\s+/g, " "));
      if (other) {
        expect(compareOutput()).toHaveTextContent(other.replace(/\s+/g, " "));
      } else {
        expect(
          screen.queryByLabelText(
            "What dwellTime returned for the comparison zone",
          ),
        ).not.toBeVisible();
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("lights the two dates a 23:00 to 01:00 dwell touches, and says so", async () => {
    await open();
    expect(lit("Africa/Johannesburg")).toEqual(["15 Jun", "16 Jun"]);
    expect(summary()).toHaveTextContent(
      "PT2H elapsed · 2 local days in Africa/Johannesburg",
    );
  });

  it("drops to one day when the exit is typed as local midnight", async () => {
    const w = await open();
    await enter(w, exitBox(), "2024-06-16T00:00:00+02:00[Africa/Johannesburg]");
    expect(lit("Africa/Johannesburg")).toEqual(["15 Jun"]);
    expect(dwellOutput()).toHaveTextContent("calendarDays: 1 }");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("draws the spring-forward day as 23 hours and notes it", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "spring-forward");
    const day = screen
      .getAllByRole("listitem")
      .find((d) => d.getAttribute("aria-label")?.startsWith("31 Mar"))!;
    expect(day).toHaveAccessibleName(/23 hours.*counted/);
    expect(
      screen.getByRole("complementary", { name: "About this day" }),
    ).toHaveTextContent("had 23 hours");
    await expectNoAxeViolations(w.root);
  });

  it("shows two days in London and one in Amsterdam on one canvas", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "london-vs-amsterdam");
    expect(lit("Europe/London")).toEqual(["15 Jun", "16 Jun"]);
    expect(lit("Europe/Amsterdam")).toEqual(["16 Jun"]);
    expect(summary()).toHaveTextContent(
      "PT2H30M elapsed · 2 local days in Europe/London · 1 local day in Europe/Amsterdam",
    );
    await expectNoAxeViolations(w.root);
  });

  it("renders the sentinel and the reason when no zone is given", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "no-zone");
    expect(dwellOutput()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why no result" }),
    ).toHaveTextContent("no place to count days in");
    expect(summary()).toHaveTextContent(/^$/);
    expect(await callText(w)).toBe(
      'dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z")',
    );
    await expectNoAxeViolations(w.root);
  });

  it("marks an inverted dwell and lights nothing", async () => {
    const w = await open();
    await enter(w, entryBox(), "2024-06-16T02:00:00-04:00[America/New_York]");
    expect(dwellOutput()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why no result" }),
    ).toHaveTextContent("exit is before the entry");
    expect(lit("Africa/Johannesburg")).toEqual([]);
    await expectNoAxeViolations(w.root);
  });

  it("moves the exit when its handle is stepped", async () => {
    const w = await open();
    const before = (exitBox() as HTMLInputElement).value;
    exitHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    const after = (exitBox() as HTMLInputElement).value;
    expect(after).not.toBe(before);
    expect(after).toMatch(/\[Africa\/Johannesburg\]$/);
    await expectNoAxeViolations(w.root);
  });

  it("steps a handle with the keyboard and keeps the pair in order", async () => {
    const w = await open();
    exitHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    expect(exitBox()).toHaveValue(
      "2024-06-16T01:15:00+02:00[Africa/Johannesburg]",
    );
    await w.user.keyboard("{Home}");
    // The exit cannot pass the entry.
    expect(exitBox()).toHaveValue((entryBox() as HTMLInputElement).value);
    expect(entryHandle()).toHaveAttribute("aria-valuetext", "15 Jun 23:00");
    await expectNoAxeViolations(w.root);
  });

  it("keeps the entry from passing the exit", async () => {
    const w = await open();
    entryHandle().focus();
    await w.user.keyboard("{End}");
    expect(entryBox()).toHaveValue((exitBox() as HTMLInputElement).value);
  });

  it("moves a handle twelve snap units on PageUp and PageDown", async () => {
    const w = await open();
    const ms = () =>
      Temporal.Instant.from(
        (exitBox() as HTMLInputElement).value.replace(/\[.*\]$/, ""),
      ).epochMilliseconds;
    const before = ms();
    exitHandle().focus();
    await w.user.keyboard("{PageUp}");
    expect(ms() - before).toBe(12 * 15 * 60_000);
    await w.user.keyboard("{PageDown}");
    expect(ms()).toBe(before);
  });

  it("shows the elapsed time and the local days on two plates", async () => {
    const w = await open();
    expect(w.root).toHaveTextContent("2 h");
    expect(w.root).toHaveTextContent("PT2H");
    expect(w.root).toHaveTextContent("in Africa/Johannesburg");
    await w.user.selectOptions(preset(), "london-vs-amsterdam");
    expect(w.root).toHaveTextContent("2 h 30 min");
    expect(w.root).toHaveTextContent("1 in Europe/Amsterdam");
    await w.user.selectOptions(preset(), "no-zone");
    expect(w.root).toHaveTextContent("no result");
  });

  it("counts days in the chosen zone when the zone changes", async () => {
    const w = await open();
    await w.user.selectOptions(zone(), "Asia/Tokyo");
    expect(lit("Asia/Tokyo")).toEqual(["16 Jun"]);
    expect(await callText(w)).toContain('"Asia/Tokyo"');
    await expectNoAxeViolations(w.root);
  });

  it("reads a zoneless wall time from the chat in the named zone", async () => {
    await open({
      entry: "2024-06-15T23:00:00",
      exit: "2024-06-16T01:00:00",
      zone: "Africa/Johannesburg",
    });
    expect(entryBox()).toHaveValue(
      "2024-06-15T23:00:00+02:00[Africa/Johannesburg]",
    );
    expect(dwellOutput()).toHaveTextContent(
      EXPECTED["two-hours-two-days"]![0]!.replace(/\s+/g, " "),
    );
    expect(preset()).toHaveValue("two-hours-two-days");
  });

  it("round-trips its state as a permalink, omitting empty zones", async () => {
    const w = await open();
    expect(w.permalink()).toContain("Africa%2FJohannesburg");
    await w.user.selectOptions(preset(), "no-zone");
    expect(w.permalink()).not.toContain("zone");
    const again = await open({
      entry: "2024-06-15T22:30:00Z",
      exit: "2024-06-16T01:00:00Z",
    });
    expect(
      within(again.root).getAllByLabelText("What dwellTime returned")[0],
    ).toHaveTextContent("NO SIGNAL");
  });

  it("is inert when aborted before the library loads", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(
      screen.getByRole("region", { name: "Dwell Ledger" }),
    ).toBeInTheDocument();
    expect(() => w.destroy()).not.toThrow();
  });

  it("can be destroyed twice", async () => {
    const w = await open();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});
