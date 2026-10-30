/**
 * @vitest-environment jsdom
 *
 * The Crossing Clock widget end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`, through roles and accessible names the way a
 * person (or a screen reader) meets the page. Every preset's printed call and result
 * are section 9 rows.
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
import { CROSSING_PRESETS } from "./crossing-clock";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { RANGE_EDGE_TEXT } from "./widget-ui";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCrossingClock"] as AnyWidgetEntry;

const EXPECTED: Record<string, [string, string | null]> = {
  canal: [
    '"2024-06-15T08:00:00Z", "2024-06-15T17:30:00Z", "Europe/Berlin"',
    '{ duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]" }',
  ],
  "spring-forward": [
    '"2024-03-31T00:00:00Z", "2024-03-31T07:00:00Z", "Europe/London"',
    '{ duration: "PT7H", enter: "2024-03-31T00:00:00+00:00[Europe/London]", exit: "2024-03-31T08:00:00+01:00[Europe/London]" }',
  ],
  "fall-back": [
    '"2024-10-27T00:30:00Z", "2024-10-27T01:30:00Z", "Europe/London"',
    '{ duration: "PT1H", enter: "2024-10-27T01:30:00+01:00[Europe/London]", exit: "2024-10-27T01:30:00+00:00[Europe/London]" }',
  ],
  "fixed-offset": [
    '"2024-03-31T00:00:00Z", "2024-03-31T07:00:00Z", "+02:00"',
    '{ duration: "PT7H", enter: "2024-03-31T02:00:00+02:00[+02:00]", exit: "2024-03-31T09:00:00+02:00[+02:00]" }',
  ],
  "read-elsewhere": [
    '"2024-06-15T08:00:00+02:00[Europe/Berlin]", "2024-06-15T17:30:00+02:00[Europe/Berlin]", "America/Panama"',
    '{ duration: "PT9H30M", enter: "2024-06-15T01:00:00-05:00[America/Panama]", exit: "2024-06-15T10:30:00-05:00[America/Panama]" }',
  ],
  inverted: [
    '"2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London"',
    null,
  ],
};

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const entryBox = () => screen.getByRole("textbox", { name: "Entry" });
const exitBox = () => screen.getByRole("textbox", { name: "Exit" });
const zone = () =>
  screen.getByRole("combobox", { name: "Read on the clock of" });
const call = () => screen.getByRole("group", { name: "Call made" });
const returned = () => screen.getByLabelText("What the call returned");
const strip = () => screen.getByRole("img");
const entryClock = () => screen.queryByRole("button", { name: /^Entry clock/ });
const exitClock = () => screen.queryByRole("button", { name: /^Exit clock/ });

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}

describe("renderCrossingClockTemplate", () => {
  it("is a named region with three numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Crossing Clock" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Log the crossing",
      "2. Elapsed, and what the clocks say",
      "3. What crossingTime returns",
    ]);
    expect(preset()).toBeInTheDocument();
    expect(entryBox()).toBeInTheDocument();
    expect(exitBox()).toBeInTheDocument();
    expect(zone()).toBeInTheDocument();
    expect(call()).toBeInTheDocument();
    expect(returned()).toBeInTheDocument();
  });

  it("has no placeholder on entry or exit", async () => {
    await open();
    expect(entryBox()).not.toHaveAttribute("placeholder");
    expect(exitBox()).not.toHaveAttribute("placeholder");
  });

  it("names every control through its prefix-scoped label", async () => {
    await open({}, "rail-7");
    expect(entryBox()).toBeInTheDocument();
    expect(exitBox()).toBeInTheDocument();
    expect(zone()).toBeInTheDocument();
  });
});

describe("mountCrossingClock", () => {
  it("opens on the first preset", async () => {
    const w = await open();
    expect(preset()).toHaveValue(CROSSING_PRESETS[0]!.id);
    expect(returned()).toHaveTextContent("duration:");
    await expectNoAxeViolations(w.root);
  });

  it.each(CROSSING_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const w = await open();
      await choose(w, id!);
      const [source, result] = EXPECTED[id!]!;
      expect(call()).toHaveTextContent(`crossingTime(${source})`);
      expect(returned()).toHaveTextContent(result ?? "NO SIGNAL");
      await expectNoAxeViolations(w.root);
    },
  );

  it("shows the elapsed and naive readings, agreeing on the fixed-offset preset", async () => {
    const w = await open();
    await choose(w, "fixed-offset");
    expect(screen.getByText(/PT7H elapsed/)).toBeInTheDocument();
    expect(screen.getByText(/Naive:/)).toHaveTextContent("agrees");
    await expectNoAxeViolations(w.root);
  });

  it("shows the naive reading disagreeing on spring-forward", async () => {
    const w = await open();
    await choose(w, "spring-forward");
    expect(screen.getByText(/PT7H elapsed/)).toBeInTheDocument();
    expect(screen.getByText(/Naive:/)).toHaveTextContent("more than elapsed");
    await expectNoAxeViolations(w.root);
  });

  it("shows the null reason for the inverted preset", async () => {
    const w = await open();
    await choose(w, "inverted");
    expect(
      screen.getByRole("complementary", { name: "Why null" }),
    ).toHaveTextContent("data error, not a negative transit");
    await expectNoAxeViolations(w.root);
  });

  it("names the skip and the repeat in the strip's summary and its change list", async () => {
    const w = await open();
    await choose(w, "spring-forward");
    expect(strip()).toHaveAccessibleName(/never shown/);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "01:00–02:00 never shown",
    );

    await choose(w, "fall-back");
    expect(strip()).toHaveAccessibleName(/shown twice/);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "01:00–02:00 shown twice",
    );

    await choose(w, "fixed-offset");
    expect(
      screen.getByText(/No clock change during the crossing/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("draws the entry and exit crystal clocks from the real result, not arithmetic", async () => {
    const w = await open();
    await choose(w, "spring-forward");

    expect(screen.getAllByText("00:00").length).toBeGreaterThan(0);
    expect(screen.getByText("+00:00 · London")).toBeInTheDocument();
    expect(screen.getAllByText("31 Mar 2024")).toHaveLength(2);
    expect(screen.getAllByText("08:00").length).toBeGreaterThan(0);
    expect(screen.getByText("+01:00 · London")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Entry clock, 00:00, plus 00:00, London. 01:00–02:00 never shown. Light up the face.",
        pressed: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Exit clock, 08:00, plus 01:00, London. 01:00–02:00 never shown. Light up the face.",
        pressed: false,
      }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("names the skipped hour on both clocks, and the repeated hour on both, and neither when nothing moves", async () => {
    const w = await open();
    await choose(w, "spring-forward");
    expect(entryClock()).toHaveAccessibleName(/01:00–02:00 never shown/);
    expect(exitClock()).toHaveAccessibleName(/01:00–02:00 never shown/);

    await choose(w, "fall-back");
    expect(entryClock()).toHaveAccessibleName(/01:00–02:00 shown twice/);
    expect(exitClock()).toHaveAccessibleName(/01:00–02:00 shown twice/);

    await choose(w, "fixed-offset");
    expect(entryClock()).not.toHaveAccessibleName(/never shown|shown twice/);
    expect(exitClock()).not.toHaveAccessibleName(/never shown|shown twice/);
    await expectNoAxeViolations(w.root);
  });

  it("toggles a clock's night-light glow independently, and it never touches a value or the permalink", async () => {
    const w = await open();
    await choose(w, "spring-forward");
    const before = w.permalink();

    await w.user.click(entryClock()!);
    expect(entryClock()).toBePressed();
    expect(exitClock()).not.toBePressed();
    expect(w.permalink()).toBe(before);
    await expectNoAxeViolations(w.root);

    await w.user.click(entryClock()!);
    expect(entryClock()).not.toBePressed();
  });

  it("reads both clocks as 01:30 when entry and exit show the same wall clock", async () => {
    const w = await open();
    await choose(w, "fall-back");
    expect(screen.getAllByText("01:30").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("+01:00 · London")).toBeInTheDocument();
    expect(screen.getByText("+00:00 · London")).toBeInTheDocument();
    expect(entryClock()).toHaveAccessibleName(/shown twice/);
    expect(exitClock()).toHaveAccessibleName(/shown twice/);
    await expectNoAxeViolations(w.root);
  });

  it("shows the disagrees badge only when the naive reading is wrong", async () => {
    const w = await open();
    await choose(w, "fixed-offset");
    expect(screen.queryByText("disagrees")).not.toBeInTheDocument();

    await choose(w, "spring-forward");
    expect(screen.getByText("disagrees")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("clears both clock faces on a null result", async () => {
    const w = await open();
    await choose(w, "inverted");
    expect(entryClock()).not.toBeInTheDocument();
    expect(exitClock()).not.toBeInTheDocument();
    expect(screen.queryByText("31 Mar 2024")).not.toBeInTheDocument();
    expect(strip()).toHaveAccessibleName("Crossing strip, not drawn");
    expect(returned()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
  });

  it("recomputes from typed entry and exit, and marks the preset custom", async () => {
    const w = await open();
    await choose(w, "spring-forward");
    await w.user.clear(exitBox());
    await w.user.paste("2024-03-31T06:00:00Z");
    expect(preset()).toHaveValue("custom");
    expect(screen.getByText(/PT6H elapsed/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("renders the chat seed (V94)", async () => {
    const w = await open({
      entry: "2024-03-10T00:00",
      exit: "2024-03-10T08:00",
      targetZone: "America/New_York",
    });
    expect(returned()).toHaveTextContent(
      '{ duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" }',
    );
    await expectNoAxeViolations(w.root);
  });

  it.each(CROSSING_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      const seeded = seedFromLocation("crossing", url.slice(url.indexOf("?")))!;
      expect(Object.values(seeded).every((v) => typeof v === "string")).toBe(
        true,
      );
      expect(encodeWidgetPermalink("crossing", seeded)).toBe(url);
      first.destroy();

      await open(seeded);
      const result = EXPECTED[id!]![1];
      expect(returned()).toHaveTextContent(result ?? "NO SIGNAL");
    },
  );

  it("is inert when aborted before the library loads", async () => {
    await renderWidget(entry, { args: {}, aborted: true });
    expect(call()).not.toHaveTextContent("crossingTime(");
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
  it("keeps a zone outside the curated list and reads it", async () => {
    const loaded = await entry.load();
    const w = await renderWidget(
      {
        ...loaded,
        renderTemplate: (idPrefix: string) =>
          loaded.renderTemplate(idPrefix, {} as never),
      } as never,
      {
        args: {
          entry: "2024-06-10T00:00",
          exit: "2024-06-10T08:00",
          targetZone: "Europe/Helsinki",
        },
      },
    );
    expect(zone()).toHaveValue("Europe/Helsinki");
    expect(returned()).not.toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
  });
});

describe("a crossing at the minimum instant", () => {
  it("shows the range-edge notice instead of throwing out of the input handler", async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener("error", onError);
    try {
      const w = await open();
      await w.user.clear(entryBox());
      await w.user.paste("-271821-04-20T00:00:00Z");
      expect(errors.map(String)).toEqual([]);
      expect(within(w.root).getByText(RANGE_EDGE_TEXT)).toBeInTheDocument();
    } finally {
      window.removeEventListener("error", onError);
    }
  });
});
