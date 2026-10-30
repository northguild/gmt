/**
 * @vitest-environment jsdom
 *
 * The Connection Checker widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`, through roles and accessible names
 * the way a person meets the page. Every preset's printed call and result are
 * section 9 rows.
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
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { CONNECTION_PRESETS } from "./connection-checker";
import { SITE_BASE } from "./site";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showConnectionChecker"] as AnyWidgetEntry;

const EXPECTED: Record<string, [string, string | null]> = {
  made: [
    '[{ departure: "2024-06-14T22:10:00+02:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    '{ eta: "2024-06-16T02:00:00+02:00[Europe/Rome]", legTimes: [{ arrival: "2024-06-15T11:10:00Z", localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]", dwellAfter: "PT45M" }, { arrival: "2024-06-16T00:00:00Z", localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]", dwellAfter: "PT0S" }] }',
  ],
  "zero-slack": [
    '[{ departure: "2024-06-14T22:10:00+02:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT50M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    '{ eta: "2024-06-16T02:00:00+02:00[Europe/Rome]", legTimes: [{ arrival: "2024-06-15T11:10:00Z", localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]", dwellAfter: "PT50M" }, { arrival: "2024-06-16T00:00:00Z", localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]", dwellAfter: "PT0S" }] }',
  ],
  "spring-forward": [
    '[{ departure: "2024-03-30T22:10:00+01:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-03-31T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    null,
  ],
  "zone-change": [
    '[{ departure: "2024-06-15T12:10:00+01:00[Europe/London]", duration: "PT1H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    null,
  ],
};

const SPRING_SEED = {
  inboundDeparture: "2024-03-30T22:10:00+01:00[Europe/Berlin]",
  inboundDuration: "PT15H",
  portZone: "Europe/Amsterdam",
  handlingMinutes: 45,
  onwardDeparture: "2024-03-31T14:00:00[Europe/Amsterdam]",
};

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const handling = () =>
  screen.getByRole("slider", { name: "Handling time (minimum connect time)" });
const inboundDeparture = () =>
  screen.getByRole("textbox", { name: "Inbound departs" });
const inboundDuration = () =>
  screen.getByRole("textbox", { name: "Inbound duration" });
const portZone = () =>
  screen.getByRole("combobox", { name: "Arrives at the port in" });
const onwardZone = () =>
  screen.getByRole("combobox", { name: "Onward arrives in (optional)" });

const output = () => screen.getByLabelText("What scheduleDelivery returned");
const callFrame = () => screen.getByRole("group", { name: "Call made" });
const verdict = () => screen.getByRole("status", { name: "Made or missed" });
const naiveText = () => screen.getByText(/^Lands \d\d:\d\d · ready/);
const disagrees = () => screen.queryByText("disagrees");
const reason = () =>
  screen.queryByRole("complementary", { name: "Why no verdict" });

async function choosePreset(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}

describe("the template", () => {
  it("names every control and has no axe violations", async () => {
    const w = await open();
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    for (const control of [
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("combobox"),
    ]) {
      expect(control).toHaveAccessibleName(/\S/);
    }
    expect(handling()).toHaveAttribute("min", "0");
    expect(handling()).toHaveAttribute("max", "240");
    expect(handling()).toHaveAttribute("step", "1");
    expect(
      screen.getByRole("region", { name: "Connection Checker" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("puts the departure field first in each three-field row", async () => {
    await open();
    const boxes = screen.getAllByRole("textbox");
    expect(boxes[0]).toHaveAccessibleName("Inbound departs");
    expect(boxes[2]).toHaveAccessibleName("Onward departs");
    const zones = screen.getAllByRole("combobox");
    expect(zones[1]).toHaveAccessibleName("Arrives at the port in");
    expect(zones[2]).toHaveAccessibleName("Onward arrives in (optional)");
  });

  it("opens on the first preset", async () => {
    await open();
    expect(preset()).toHaveValue("made");
    expect(inboundDeparture()).toHaveValue(
      CONNECTION_PRESETS[0]!.state.inboundDeparture,
    );
    expect(handling()).toHaveValue("45");
    expect(handling()).toHaveAttribute("aria-valuetext", "45 minutes");
  });
});

describe("the call and its result", () => {
  it.each(CONNECTION_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const w = await open();
      await choosePreset(w, id!);
      const [call, result] = EXPECTED[id!]!;
      expect(callFrame()).toHaveTextContent(`scheduleDelivery(${call})`);
      if (result === null) {
        expect(output()).toHaveTextContent(/^NO SIGNAL$/);
      } else {
        expect(output()).toHaveTextContent(result);
        expect(output()).not.toHaveTextContent("NO SIGNAL");
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("copies the plain call", async () => {
    const w = await open();
    await w.user.click(
      within(callFrame()).getByRole("button", { name: "Copy call" }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `scheduleDelivery(${EXPECTED["made"]![0]})`,
    );
  });
});

describe("made or missed", () => {
  it("shows both verdicts, and the disagrees badge only on spring-forward and zone-change", async () => {
    for (const id of ["made", "zero-slack"]) {
      const w = await open();
      await choosePreset(w, id);
      expect(verdict()).toHaveTextContent(/Made/);
      expect(naiveText()).toHaveTextContent("made");
      expect(disagrees()).not.toBeInTheDocument();
      expect(reason()).not.toBeInTheDocument();
      w.destroy();
    }
    for (const id of ["spring-forward", "zone-change"]) {
      const w = await open();
      await choosePreset(w, id);
      expect(verdict()).toHaveTextContent("Missed");
      expect(naiveText()).toHaveTextContent("made");
      expect(disagrees()).toBeInTheDocument();
      w.destroy();
    }
  });

  it("gives zero slack at 50 minutes and misses by 1 minute at 51", async () => {
    const w = await open();
    setRange(handling(), 50);
    expect(verdict()).toHaveTextContent("zero slack");
    expect(preset()).toHaveValue("zero-slack");
    setRange(handling(), 51);
    expect(verdict()).toHaveTextContent("Missed");
    expect(verdict()).toHaveTextContent("1 min");
    expect(handling()).toHaveAttribute("aria-valuetext", "51 minutes");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("carries dwellAfter PT0M at zero handling (V64)", async () => {
    await open();
    setRange(handling(), 0);
    expect(callFrame()).toHaveTextContent('dwellAfter: "PT0M"');
    expect(handling()).toHaveAttribute("aria-valuetext", "0 minutes");
  });

  it("names the arrival, the handling and the departure on the strip", async () => {
    await open();
    const strip = screen.getByRole("group", { name: "Handoff" });
    expect(within(strip).getByRole("img", { name: /^Arrives / })).toBeVisible();
    expect(
      within(strip).getByRole("img", { name: /^Handling until ready / }),
    ).toBeVisible();
    expect(
      within(strip).getByRole("img", { name: /^Onward departure / }),
    ).toBeVisible();
  });

  it("says a missed departure is missed in the departure's own name", async () => {
    const w = await open();
    await choosePreset(w, "spring-forward");
    expect(
      screen.getByRole("img", { name: /^Onward departure .*, missed$/ }),
    ).toBeInTheDocument();
  });

  it("explains a missing verdict in a caution, and keeps NO SIGNAL distinct from a missed one", async () => {
    const w = await open();
    await w.user.clear(inboundDeparture());
    await w.user.paste("2024-06-14T22:10:00+05:00[Europe/Berlin]");
    expect(verdict()).toHaveTextContent("No verdict.");
    expect(output()).toHaveTextContent(/^NO SIGNAL$/);
    expect(reason()).toBeInTheDocument();
    expect(disagrees()).toBeInTheDocument();
    await choosePreset(w, "spring-forward");
    expect(verdict()).toHaveTextContent("Missed");
    expect(reason()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("seeds and permalinks", () => {
  it("renders the chat seed as NO SIGNAL, a missed verdict and a naive made", async () => {
    await open(SPRING_SEED);
    expect(output()).toHaveTextContent(/^NO SIGNAL$/);
    expect(verdict()).toHaveTextContent("Missed");
    expect(naiveText()).toHaveTextContent("made");
    expect(preset()).toHaveValue("custom");
  });

  it.each(CONNECTION_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choosePreset(first, id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/connection-checker/\\?w=connection&wa=`,
        ),
      );
      const seeded = seedFromLocation(
        "connection",
        url.slice(url.indexOf("?")),
      )!;
      expect(Object.values(seeded).every((v) => typeof v === "string")).toBe(
        true,
      );
      first.destroy();

      await open(seeded);
      const [, result] = EXPECTED[id!]!;
      if (result === null) {
        expect(output()).toHaveTextContent(/^NO SIGNAL$/);
      } else {
        expect(output()).toHaveTextContent(result);
      }
      expect(preset()).toHaveValue(id);
    },
  );

  it("keeps a zone outside the curated list when a seed is applied to the default template", async () => {
    const loaded = await entry.load();
    const w = await renderWidget({
      renderTemplate: (idPrefix) =>
        loaded.renderTemplate(idPrefix, {} as never),
      mount: loaded.mount,
    });
    w.destroy();
    const seeded = await renderWidget(
      {
        renderTemplate: (idPrefix) =>
          loaded.renderTemplate(idPrefix, {} as never),
        mount: loaded.mount,
      },
      {
        args: {
          inboundDeparture: "2024-06-10T10:00:00+03:00[Europe/Helsinki]",
          inboundDuration: "PT2H",
          portZone: "Europe/Helsinki",
          handlingMinutes: 45,
          onwardDeparture: "2024-06-10T14:00:00+03:00[Europe/Helsinki]",
        },
      },
    );
    expect(portZone()).toHaveValue("Europe/Helsinki");
    expect(onwardZone()).toHaveValue("");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    seeded.destroy();
  });
});

describe("a handoff at the minimum instant", () => {
  it("shows the range-edge notice instead of throwing out of the input handler", async () => {
    const w = await open();
    await w.user.clear(inboundDuration());
    await w.user.paste("PT0S");
    setRange(handling(), 0);
    await w.user.selectOptions(portZone(), "America/New_York");
    await w.user.clear(inboundDeparture());
    await w.user.paste("-271821-04-20T00:00:00Z");
    expect(
      screen.getByLabelText("Handoff strip", { selector: "output" }),
    ).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByText(/too near the limit of the supported time range/),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("lifecycle", () => {
  it("is inert when aborted before the library loads", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(callFrame()).not.toHaveTextContent("scheduleDelivery(");
    w.destroy();
    w.destroy();
  });

  it("can be destroyed twice", async () => {
    const w = await open();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });

  it("keeps two widgets on one page apart", async () => {
    const a = await renderWidget(entry, { idPrefix: "a" });
    const b = await renderWidget(entry, { idPrefix: "b" });
    await a.user.selectOptions(
      within(a.root).getByRole("combobox", { name: "Preset" }),
      "spring-forward",
    );
    expect(
      within(a.root).getByRole("combobox", { name: "Preset" }),
    ).toHaveValue("spring-forward");
    expect(
      within(b.root).getByRole("combobox", { name: "Preset" }),
    ).toHaveValue("made");
  });
});
