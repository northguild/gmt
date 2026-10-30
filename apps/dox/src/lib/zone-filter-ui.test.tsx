/**
 * @vitest-environment jsdom
 *
 * The filter panel's behaviour: which switches are on screen, what a click reports, and that
 * refreshing never disturbs a control the reader is using. The globe cannot mount under jsdom
 * (no canvas, no WebGPU), so this is the only place any of it runs.
 */

import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { defineElements } from "~/widgets/define";
import type { BucketCounts } from "./zone-filter";
import { mountZoneFilters } from "./zone-filter-ui";

function counts(over: Partial<BucketCounts> = {}): BucketCounts {
  return {
    days: { prev: 2, same: 400, next: 16 },
    dst: { dst: 60, standard: 12, none: 346 },
    sky: { day: 210, twilight: 30, night: 178 },
    ...over,
  };
}

const mounted: Array<{ destroy(): void }> = [];
const hosts: HTMLElement[] = [];

function mount(onToggleOpen?: () => void) {
  defineElements();
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  const changes: unknown[] = [];
  const ui = mountZoneFilters(host, (f) => changes.push(f), onToggleOpen);
  mounted.push(ui);
  return { host, ui, changes };
}

const gear = () => screen.getByRole("button", { name: "Filters" });
const open = (user: ReturnType<typeof userEvent.setup>) => user.click(gear());
const toggleNamed = (name: RegExp) => screen.getByRole("switch", { name });

afterEach(() => {
  for (const ui of mounted.splice(0)) ui.destroy();
  for (const el of hosts.splice(0)) el.remove();
});

describe("mountZoneFilters", () => {
  it("builds one switch per bucket in three named groups", async () => {
    const { host } = mount();
    await userEvent.setup().click(gear());
    expect(screen.getAllByRole("switch")).toHaveLength(9);
    for (const name of ["Local day", "Daylight saving", "Local sky"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    await expectNoAxeViolations(host);
  });

  it("opens from a gear that still carries a name, and mirrors the state", async () => {
    mount();
    const user = userEvent.setup();
    expect(gear()).toHaveAttribute("aria-expanded", "false");
    await open(user);
    expect(gear()).toHaveAttribute("aria-expanded", "true");
    await open(user);
    expect(gear()).toHaveAttribute("aria-expanded", "false");
  });

  it("starts with everything on", async () => {
    const { ui } = mount();
    await open(userEvent.setup());
    expect(ui.get().days).toEqual({ prev: true, same: true, next: true });
    expect(ui.get().dst).toEqual({ dst: true, standard: true, none: true });
    for (const box of screen.getAllByRole("switch")) expect(box).toBeChecked();
  });

  it("reports the new filter when a switch is cleared, leaving other axes alone", async () => {
    const { ui, changes, host } = mount();
    const user = userEvent.setup();
    await open(user);
    await user.click(toggleNamed(/Tomorrow/));
    expect(changes).toHaveLength(1);
    expect(ui.get().days.next).toBe(false);
    expect(ui.get().dst.dst).toBe(true);
    await expectNoAxeViolations(host);
  });

  it("hands out a copy, so a caller cannot reach in and mutate it", () => {
    const { ui } = mount();
    ui.get().days.same = false;
    expect(ui.get().days.same).toBe(true);
  });

  it("hides an empty bucket but keeps an unchecked one reachable", async () => {
    const { ui } = mount();
    const user = userEvent.setup();
    await open(user);
    const empty = { days: { prev: 0, same: 400, next: 16 } };
    ui.update(counts(empty), 416, 416);
    expect(screen.getAllByRole("switch")).toHaveLength(8);
    // Switch another off, empty it, and it must stay so it can be undone.
    const next = toggleNamed(/Tomorrow/);
    await user.click(next);
    ui.update(counts({ days: { prev: 0, same: 400, next: 0 } }), 400, 416);
    expect(screen.getAllByRole("switch")).toHaveLength(8);
  });

  it("keeps checked state and focus across a refresh", async () => {
    const { ui } = mount();
    const user = userEvent.setup();
    await open(user);
    const box = toggleNamed(/Standard time/i);
    await user.click(box);
    box.focus();
    ui.update(counts(), 404, 416);
    expect(box).toHaveFocus();
    expect(box).not.toBeChecked();
    expect(ui.get().dst.standard).toBe(false);
  });

  it("says how much is showing, and says so plainly when nothing is hidden", () => {
    const { ui } = mount();
    ui.update(counts(), 416, 416);
    expect(screen.getByLabelText("Zones showing")).toHaveTextContent(
      "Showing all 416 zones",
    );
    ui.update(counts(), 60, 416);
    expect(screen.getByLabelText("Zones showing")).toHaveTextContent(
      "Showing 60 of 416 zones",
    );
  });

  it("carries each bucket's count in its switch's name", async () => {
    const { ui } = mount();
    await open(userEvent.setup());
    ui.update(counts(), 416, 416);
    expect(toggleNamed(/In DST/i)).toHaveAccessibleName(/60/);
  });

  it("tracks whether the panel is open and calls back only on opening", async () => {
    const opened = vi.fn();
    const { ui } = mount(opened);
    const user = userEvent.setup();
    expect(ui.isOpen()).toBe(false);
    await open(user);
    expect(ui.isOpen()).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    await open(user);
    // Closing must not re-fire it: the globe answers by rescanning ~420 zones.
    expect(opened).toHaveBeenCalledTimes(1);
  });

  describe("as a popup", () => {
    it("closes on a press outside, and stays open on one inside", async () => {
      mount();
      const user = userEvent.setup();
      const outside = document.createElement("button");
      outside.textContent = "Elsewhere";
      document.body.appendChild(outside);
      await open(user);
      await user.click(
        within(screen.getByRole("group", { name: "Local day" })).getAllByRole(
          "switch",
        )[0]!,
      );
      expect(gear()).toHaveAttribute("aria-expanded", "true");
      await user.click(outside);
      expect(gear()).toHaveAttribute("aria-expanded", "false");
    });

    it("closes on Escape and puts focus back on the gear", async () => {
      mount();
      const user = userEvent.setup();
      await open(user);
      screen.getAllByRole("switch")[0]?.focus();
      await user.keyboard("{Escape}");
      expect(gear()).toHaveAttribute("aria-expanded", "false");
      expect(gear()).toHaveFocus();
    });

    it("ignores Escape while shut, so it cannot steal focus", async () => {
      mount();
      const outside = document.createElement("button");
      outside.textContent = "Elsewhere";
      document.body.appendChild(outside);
      outside.focus();
      await userEvent.setup().keyboard("{Escape}");
      expect(outside).toHaveFocus();
    });

    it("closes when focus tabs out of the panel", async () => {
      mount();
      const user = userEvent.setup();
      const outside = document.createElement("button");
      outside.textContent = "Elsewhere";
      document.body.appendChild(outside);
      await open(user);
      screen.getAllByRole("switch").at(-1)?.focus();
      await user.tab();
      expect(outside).toHaveFocus();
      expect(gear()).toHaveAttribute("aria-expanded", "false");
    });

    it("moves focus to the gear rather than dropping it when a switch hides", async () => {
      const { ui } = mount();
      await open(userEvent.setup());
      const prev = screen.getAllByRole("switch")[0]!;
      prev.focus();
      ui.update(counts({ days: { prev: 0, same: 400, next: 16 } }), 416, 416);
      expect(gear()).toHaveFocus();
    });

    it("stops listening once destroyed", async () => {
      const { ui, host } = mount();
      await open(userEvent.setup());
      ui.destroy();
      mounted.length = 0;
      expect(host).toBeEmptyDOMElement();
      await userEvent.setup().click(document.body);
    });
  });
});
