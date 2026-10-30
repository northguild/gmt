// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { installJsdomShims } from "~/test/jsdom-shims";
import { html } from "~/widgets/builders/html";
import { widget } from "~/widgets/builders/layout";
import { clocks } from "~/widgets/families/clockcheck/clocks";
import { findWidget } from "~/widgets/root";
import { renderHtml } from "~/widgets/test-fixture";
import {
  wireClocks,
  type ClockLib,
  type ClockZone,
} from "./clock-change-clocks";

installJsdomShims();

const ZONES = ["America/Vancouver", "America/Winnipeg"];
const NOW = "2026-11-02T16:15:30.000Z";

/** A library that answers the wall time of each offset the test uses, and never reaches a next change. */
const WALLS: Record<string, string> = {
  "-08:00": "2026-11-02T08:15:30",
  "-06:00": "2026-11-02T10:15:30",
};
const LIB: ClockLib = {
  convertUtcToPlainDateTime: (_value, { timeZone }) => WALLS[timeZone] ?? "",
  isBeforeUtc: (a, b) => a < b,
};

const ROWS: readonly ClockZone[] = [
  { zone: "America/Vancouver", offset: "-08:00", next: null },
  { zone: "America/Winnipeg", offset: "-06:00", next: null },
];

function draw(read: () => readonly ClockZone[] | null = () => ROWS) {
  const fixture = renderHtml(
    html`${widget(
      { name: "canada", label: "Canada", scope: "canada" },
      clocks({ idPrefix: "canada", zones: ZONES, stopped: new Set() }),
    )}<ul aria-label="Zones">${ZONES.map(
      (zone) =>
        html`<li><button type="button" data-tz-id="${zone}" aria-pressed="false">${zone}</button></li>`,
    )}</ul>`,
  );
  const ac = new AbortController();
  const zoneList = screen.getByRole("list", { name: "Zones" });
  const handle = wireClocks(findWidget(fixture.host, "canada"), {
    zones: ZONES,
    zoneList,
    idPrefix: "canada",
    lib: LIB,
    now: () => NOW,
    signal: ac.signal,
    read,
  });
  return { fixture, handle, ac };
}

describe("wireClocks", () => {
  it("shows each zone's wall time and offset once the answer arrives", () => {
    const { handle, ac } = draw();
    handle.tick();
    const items = screen.getAllByRole("listitem").slice(0, 2);
    expect(items[0]).toHaveTextContent("08:15:30");
    expect(items[0]).toHaveTextContent("-08:00");
    expect(items[1]).toHaveTextContent("10:15:30");
    ac.abort();
  });

  it("keeps NO SIGNAL, with its explanation on hover, for a zone the answer lacks", () => {
    const { handle, ac } = draw(() => [ROWS[0]!]);
    handle.tick();
    const winnipeg = screen.getAllByRole("listitem")[1]!;
    expect(within(winnipeg).getByText("NO SIGNAL")).toBeVisible();
    expect(
      within(winnipeg).getByTitle("⟨ NO SIGNAL — invalid input ⟩"),
    ).toBeInTheDocument();
    ac.abort();
  });

  it("draws nothing before the answer arrives", () => {
    const { handle, ac } = draw(() => null);
    handle.tick();
    for (const item of screen.getAllByRole("listitem").slice(0, 2))
      expect(within(item).getByText("NO SIGNAL")).toBeVisible();
    ac.abort();
  });

  it("ticks again on the next second, and stops when aborted", () => {
    vi.useFakeTimers();
    try {
      const read = vi.fn(() => ROWS);
      const { handle, ac } = draw(read);
      handle.tick();
      expect(read).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1100);
      expect(read.mock.calls.length).toBeGreaterThan(1);
      ac.abort();
      const calls = read.mock.calls.length;
      vi.advanceTimersByTime(5000);
      expect(read).toHaveBeenCalledTimes(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it("has no accessibility violations after a tick or a pick", async () => {
    const { fixture, handle, ac } = draw();
    handle.tick();
    await expectNoAxeViolations(fixture.host);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "America/Winnipeg" }));
    await expectNoAxeViolations(fixture.host);
    ac.abort();
  });
});
