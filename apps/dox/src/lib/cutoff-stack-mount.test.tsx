/**
 * @vitest-environment jsdom
 *
 * The Cut-off Stack widget end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person (or a screen reader)
 * meets the page. Every preset's printed call and result is an appendix Z row.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { STACK_PRESETS } from "./cutoff-stack";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCutoffStack"] as AnyWidgetEntry;

const EXPECTED: Record<string, [string, string | null]> = {
  "rotterdam-weekend": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "preceding" }',
    '[{ name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "rotterdam-following": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "following" }',
    '[{ name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-17T10:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-17T17:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  holiday: [
    '"2024-05-10T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "PT6H" }, { name: "documents", offset: "P1D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: ["2024-05-09"], timeZone: "Europe/Amsterdam" }, roll: "preceding" }',
    '[{ name: "documents", at: "2024-05-08T12:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-05-10T12:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "no-roll": [
    '"2024-06-17T18:00:00+02:00[Europe/Amsterdam]", [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" } }',
    null,
  ],
  "no-calendar": [
    '"2024-06-14T16:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "document", offset: "P2D", atLocalTime: "17:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam" }',
    '[{ name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" }]',
  ],
  "skipped-hour": [
    '"2024-04-01T17:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "VGM", offset: "P1D", atLocalTime: "01:30" }], { timeZone: "Europe/London" }',
    null,
  ],
};

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const zoneBox = () => screen.getByRole("combobox", { name: "Terminal clock" });
const calendarBox = () =>
  screen.getByRole("switch", { name: "Use a business calendar" });
const rollBox = () =>
  screen.getByRole("combobox", { name: /Roll a closed-day cut-off/ });
const offsetBox = (n: number) =>
  within(screen.getByRole("group", { name: `Cut-off ${n}` })).getByRole(
    "textbox",
    { name: "Offset" },
  );
const output = () =>
  screen.getByRole("status", { name: /cutoffSchedule returned/ });
const callFrame = () =>
  screen.getByRole("group", { name: /cutoffSchedule call/ });
const table = () => screen.getByRole("table", { name: "The cut-off stack" });
const rowOf = (name: string) =>
  within(table())
    .getAllByRole("row")
    .find((row) => within(row).queryByText(name) !== null)!;

const flat = (el: HTMLElement) => el.textContent!.replace(/\s+/g, " ").trim();

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(presetBox(), id);
}

describe("the template", () => {
  it("names every control a reader fills in", async () => {
    const w = await open();
    expect(presetBox()).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Departs" }),
    ).toBeInTheDocument();
    expect(zoneBox()).toBeInTheDocument();
    for (const n of [1, 2, 3, 4]) {
      expect(offsetBox(n)).toBeInTheDocument();
    }
    expect(calendarBox()).toBeInTheDocument();
    expect(rollBox()).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Holidays/ }),
    ).toBeInTheDocument();
    expect(callFrame()).toBeInTheDocument();
    expect(output()).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("mountCutoffStack", () => {
  it.each(STACK_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const w = await open();
      await choose(w, id);
      const [call, result] = EXPECTED[id]!;
      expect(flat(callFrame())).toContain(`cutoffSchedule(${call})`);
      if (result === null) {
        expect(output()).toHaveTextContent("NO SIGNAL");
      } else {
        expect(flat(output())).toContain(result);
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("shows the table's Closes and Moved cells for the pill preset", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    const closes = cellsInColumn(table(), "Closes");
    const moved = cellsInColumn(table(), "Moved");
    expect(closes).toHaveLength(2);
    const names = cellsInColumn(table(), "Cut-off").map((c) => flat(c));
    const gateIn = names.findIndex((n) => n.includes("gate-in"));
    const documents = names.findIndex((n) => n.includes("documents"));
    expect(closes[gateIn]).toHaveTextContent("Fri 14 Jun 17:00");
    expect(moved[gateIn]).toHaveTextContent("from Sat 15 Jun 17:00");
    expect(moved[documents]).toHaveTextContent("no");
    await expectNoAxeViolations(w.root);
  });

  it("names each cut-off's mark with where it closes and where it moved from", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    expect(
      screen.getByRole("img", {
        name: /gate-in closes Fri 14 Jun 17:00, moved from Sat 15 Jun 17:00/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /documents closes Fri 14 Jun 12:00$/ }),
    ).toBeInTheDocument();
  });

  it("names the closed days in words, so the shading is not the only carrier", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    expect(screen.getByText(/Closed days: .*Sat.*Sun/)).toBeInTheDocument();
  });

  it("shows the calendar-without-roll reason on no-roll", async () => {
    const w = await open();
    await choose(w, "no-roll");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why NO SIGNAL" }),
    ).toHaveTextContent("no default");
    await expectNoAxeViolations(w.root);
  });

  it("shows the skipped-hour reason on skipped-hour", async () => {
    const w = await open();
    await choose(w, "skipped-hour");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why NO SIGNAL" }),
    ).toHaveTextContent("Cut-off 2 lands on a local time the clock skipped");
  });

  it("renders the chat seed as gate-in moved from Sat 15 Jun, documents no", async () => {
    await open({
      anchor: "2024-06-17T18:00:00+02:00[Europe/Amsterdam]",
      timeZone: "Europe/Amsterdam",
      cutoffs: [
        { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
        { name: "documents", offset: "P3D", atLocalTime: "12:00" },
      ],
      weekend: [6, 7],
      roll: "preceding",
    });
    expect(flat(output())).toContain(EXPECTED["rotterdam-weekend"]![1]);
    expect(rowOf("gate-in")).toHaveTextContent("from Sat 15 Jun 17:00");
    expect(rowOf("documents")).toHaveTextContent(/no$/);
  });

  it("unticking the calendar gives roll-without-calendar and NO SIGNAL", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    await w.user.click(calendarBox());
    expect(calendarBox()).not.toBeChecked();
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why NO SIGNAL" }),
    ).toHaveTextContent("A roll convention needs a business calendar");
    await expectNoAxeViolations(w.root);
  });

  it("choosing '(not given)' in the roll select gives calendar-without-roll", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    await w.user.selectOptions(rollBox(), "(not given)");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why NO SIGNAL" }),
    ).toHaveTextContent("A business calendar needs a roll convention");
  });

  it("clearing every offset gives the empty state, not NO SIGNAL", async () => {
    const w = await open();
    await choose(w, "rotterdam-weekend");
    for (const n of [1, 2, 3, 4]) await w.user.clear(offsetBox(n));
    expect(flat(output())).toContain("[]");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(
      screen.queryByRole("complementary", { name: "Why NO SIGNAL" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("An empty list returns [].")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of STACK_PRESETS) {
      const w = await open();
      await choose(w, preset.id);
      const url = w.permalink();
      const seeded = seedFromLocation(entry.kind, url.slice(url.indexOf("?")));
      w.destroy();
      await open(seeded);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(output()).toHaveTextContent("NO SIGNAL");
      } else {
        expect(flat(output())).toContain(result);
      }
      document.body.replaceChildren();
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
  it("keeps a zone outside the curated list and reads it", async () => {
    await open({
      anchor: "2024-06-12T18:00:00+03:00[Europe/Helsinki]",
      timeZone: "Europe/Helsinki",
      cutoffs: [{ name: "gate-in", offset: "P2D", atLocalTime: "12:00" }],
    });
    expect(zoneBox()).toHaveValue("Europe/Helsinki");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
  });
});
