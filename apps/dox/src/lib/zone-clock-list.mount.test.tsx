/**
 * @vitest-environment jsdom
 *
 * Mounting the zone clock list onto the kit listbox, rather than only its pure helpers.
 *
 * The virtualizer renders its first rows synchronously from `_willUpdate()`, so a `const`
 * declared lower in the module than the render path is still in its temporal dead zone when
 * the first row is written, and the entire mount throws. These tests run the real mount.
 *
 * jsdom has no layout, so every element reports a zero size and the virtualizer would
 * conclude that nothing is visible, which would pass against the very breakage these tests
 * exist for. The panel is therefore given a measured height, and the tests assert that rows
 * appear.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { installJsdomShims } from "../test/jsdom-shims";
import { listbox, type GmtListbox } from "~/widgets/primitives/listbox/listbox";
import { renderHtml } from "~/widgets/test-fixture";
import { readViewerDate, readZoneNow } from "./zone-clock";
import { mountZoneClockList } from "./zone-clock-list";
import {
  dayDelta,
  dayShiftChip,
  dayShiftLabel,
  dstState,
} from "./zone-readout";

installJsdomShims();

const ZONES = [
  "Europe/London",
  "Asia/Tokyo",
  "America/New_York",
  "Australia/Sydney",
  "Africa/Cairo",
  "America/Sao_Paulo",
  /* Deliberately the two ends of the IANA offset range: Kiritimati (UTC+14)
     and Midway (UTC-11) are 25 hours apart, so they can never show the same
     calendar date as each other. Whatever zone the test machine is in, at least
     one of them is on a different day from the viewer, so the day-shift
     assertions run on every machine at every hour. */
  "Pacific/Kiritimati",
  "Pacific/Midway",
];

const mounted: Array<{ destroy(): void }> = [];
let counter = 0;

function mount(ids: readonly string[] = ZONES, sized = true) {
  counter += 1;
  const r = renderHtml(
    listbox({
      id: `test-clock-panel-${counter}`,
      label: "Pinned zones",
      items: [],
    }),
  );
  const panel = r.element<GmtListbox>("listbox");
  /* The virtualizer measures its scroll element synchronously while mounting, and it
     reads `offsetWidth`/`offsetHeight`, which jsdom reports as 0. */
  if (sized)
    for (const [property, value] of [
      ["offsetWidth", 300],
      ["offsetHeight", 400],
      ["clientWidth", 300],
      ["clientHeight", 400],
    ] as const)
      Object.defineProperty(panel, property, { value, configurable: true });
  const picked: string[] = [];
  const list = mountZoneClockList(panel, ids, (id) => picked.push(id));
  mounted.push(list);
  return { panel, list, picked, host: r.host };
}

afterEach(() => {
  for (const list of mounted.splice(0)) list.destroy();
});

const option = (zone: string): HTMLElement =>
  screen.getByRole("option", { name: new RegExp(zone) });

describe("mountZoneClockList", () => {
  it("mounts without throwing, and draws the zones in view", async () => {
    // The regression this file exists for: a ReferenceError from the first
    // synchronous render would surface right here.
    const { host } = mount();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    await expectNoAxeViolations(host);
  });

  it("is one tab stop: Tab reaches the list and the next Tab leaves it", async () => {
    const { panel } = mount();
    const user = userEvent.setup();
    await user.tab();
    expect(panel).toHaveFocus();
    for (const row of screen.getAllByRole("option"))
      expect(row).not.toHaveFocus();
    await user.tab();
    expect(panel).not.toHaveFocus();
  });

  it("ticks, selects and clears without throwing, repeatedly", () => {
    const { list } = mount();
    expect(() => {
      list.tick();
      list.tick();
      list.select("Asia/Tokyo");
      list.tick();
      list.select("Europe/London");
      list.select(null);
    }).not.toThrow();
  });

  it("is safe to destroy twice", () => {
    const { list } = mount();
    list.destroy();
    expect(() => list.destroy()).not.toThrow();
  });

  it("handles an empty zone list", () => {
    mount([]);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("writes a live time, offset and date into every row", () => {
    const { list } = mount();
    list.tick();
    const rows = screen.getAllByRole("option");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // `HH:MM:SS`, or the sentinel the design system shows for a lost signal.
      expect(
        within(row).getByText(/^(\d{2}:\d{2}:\d{2}|— — —)$/),
      ).toBeInTheDocument();
      expect(
        within(row).getByText(/^(UTC[+-]\d{2}:\d{2}|no signal)$/),
      ).toBeInTheDocument();
      expect(within(row).getByText(/^\d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
    }
  });

  it("states a day shift in words, and only when the day really differs", () => {
    /* The invariant, not a fixed expectation: which of these zones is on another day
       depends on the wall clock and the machine's own zone, so the test derives the
       answer the way the widget does and checks the two agree. */
    const { list } = mount();
    list.tick();
    const viewerDate = readViewerDate();
    let shifted = 0;
    for (const zone of ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Tokyo"]) {
      const reading = readZoneNow(zone);
      if (!reading.ok) throw new Error(`${zone} gave no reading`);
      const delta = dayDelta(reading.date, viewerDate);
      const row = within(option(zone));
      if (delta === 0) {
        expect(row.queryByText(dayShiftLabel(0))).not.toBeInTheDocument();
        continue;
      }
      shifted += 1;
      /* The direction is carried in text, never by the wash alone. */
      expect(row.getByText(dayShiftChip(delta))).toBeInTheDocument();
      expect(row.getByText(dayShiftLabel(delta))).toBeInTheDocument();
    }
    /* Guards the guard: the loop passes just as happily on a list where nothing
       is day-shifted at all. */
    expect(shifted, "at least one zone is on another day").toBeGreaterThan(0);
  });

  it("marks only a zone actually on summer time, in words", () => {
    const { list } = mount();
    list.tick();
    // Asia/Tokyo has had no DST since 1951: nothing to mark.
    expect(
      within(option("Asia/Tokyo")).queryByText("DST"),
    ).not.toBeInTheDocument();
    // Europe/London observes it, so it is marked on one side of the transition only.
    const london = readZoneNow("Europe/London");
    const london_ = within(option("Europe/London"));
    if (london.ok && dstState(london) === "dst") {
      expect(london_.getByText("DST")).toBeInTheDocument();
      expect(london_.getByText("in DST")).toBeInTheDocument();
    } else {
      expect(london_.queryByText("DST")).not.toBeInTheDocument();
    }
  });

  it("narrows to a filtered set, and restores the full one", () => {
    const { list } = mount();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(2);

    list.setIds(["Asia/Tokyo", "Europe/London"]);
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(2);
    // Rows are rebuilt, not reused in place: the first must now be Tokyo, with Tokyo's name.
    expect(
      within(rows[0] as HTMLElement).getByText("Asia/Tokyo"),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText("Europe/London"),
    ).toBeInTheDocument();

    list.setIds(ZONES);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(2);
  });

  it("keeps ticking after a filter change", () => {
    const { list } = mount();
    list.setIds(["Europe/London"]);
    list.tick();
    expect(
      within(option("Europe/London")).getByText(/^(\d{2}:\d{2}:\d{2}|— — —)$/),
    ).toBeInTheDocument();
  });

  it("marks the selected zone, and survives filtering it out of the list", () => {
    /* The globe keeps its selection and its tooltip when a filter hides that zone, so
       `select` has to cope with an id that is no longer listed. */
    const { list } = mount();
    list.select("Asia/Tokyo");
    expect(option("Asia/Tokyo")).toHaveAttribute("aria-selected", "true");
    list.setIds(["Europe/London"]);
    expect(
      screen.queryByRole("option", { selected: true }),
    ).not.toBeInTheDocument();
    expect(() => list.select("Asia/Tokyo")).not.toThrow();
    expect(() => list.tick()).not.toThrow();
  });

  it("handles being filtered down to nothing, and back", () => {
    const { list } = mount();
    list.setIds([]);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(() => list.tick()).not.toThrow();
    list.setIds(ZONES);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("picks a zone on a click and on Enter after the arrow keys", async () => {
    const { panel, picked } = mount();
    const user = userEvent.setup();
    await user.click(option("Asia/Tokyo"));
    expect(picked).toEqual(["Asia/Tokyo"]);

    await user.click(panel);
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    expect(picked.at(-1)).toBe("Asia/Tokyo");
    await user.keyboard("{End}{Enter}");
    expect(picked.at(-1)).toBe("Pacific/Midway");
  });

  it("points aria-activedescendant at a mounted row after End and after a filter", async () => {
    /* The active descendant has to name a real option; a missing one leaves a screen
       reader with no position, and nothing visible gives it away. A filter scrolls the
       list to the top, so browsing restarts there too. */
    const { panel, list } = mount();
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{End}");
    expect(panel).toHaveAttribute(
      "aria-activedescendant",
      option("Pacific/Midway").id,
    );

    list.setIds(ZONES.slice(0, 3));
    const rows = screen.getAllByRole("option");
    expect(panel).toHaveAttribute(
      "aria-activedescendant",
      (rows[0] as HTMLElement).id,
    );

    // And browsing carries on from there, not from the old position.
    await user.keyboard("{ArrowDown}");
    expect(panel).toHaveAttribute(
      "aria-activedescendant",
      (rows[1] as HTMLElement).id,
    );

    list.setIds([]);
    expect(panel).not.toHaveAttribute("aria-activedescendant");
  });

  it("never points aria-activedescendant at a row that is not in the DOM", async () => {
    /* The virtualizer mounts only the rows in view. A selection made while the list has
       no size yet, or one that has since scrolled out of view, has no element to name. */
    const many = Array.from({ length: 200 }, (_, i) => `Etc/Fake${i}`);
    const { panel, list } = mount(many);
    const resolves = (): boolean => {
      const id = panel.getAttribute("aria-activedescendant");
      return (
        id === null ||
        screen.queryAllByRole("option").some((row) => row.id === id)
      );
    };
    list.select(many[0] as string);
    expect(resolves()).toBe(true);

    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{End}");
    expect(resolves()).toBe(true);

    // Selecting a zone far from the rendered window: whatever the attribute says must resolve.
    list.select(many[120] as string);
    expect(resolves()).toBe(true);
  });

  it("mounts no rows in a panel with no size yet, and names no active descendant", () => {
    const many = Array.from({ length: 50 }, (_, i) => `Etc/Fake${i}`);
    const { panel, list } = mount(many, false);
    list.select(many[0] as string);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(panel).not.toHaveAttribute("aria-activedescendant");
  });
});
