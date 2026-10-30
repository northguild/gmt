// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { zoneTooltip } from "./zone-tooltip";

const CLOCK = {
  time: "12:04:25",
  date: "2026-09-30",
  offset: "+01:00",
  dst: "in DST",
  onDst: true,
};

describe("zoneTooltip", () => {
  it("shows the zone, the time, the date, the offset and the DST wording", async () => {
    const r = renderHtml(zoneTooltip({ zone: "Europe/London", clock: CLOCK }));
    expect(screen.getByText("Europe/London")).toBeInTheDocument();
    expect(screen.getByText("12:04:25")).toBeInTheDocument();
    expect(screen.getByText("2026-09-30")).toBeInTheDocument();
    expect(screen.getByText("UTC+01:00")).toBeInTheDocument();
    expect(screen.getByText("in DST")).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("names the day shift in words next to the date", () => {
    renderHtml(
      zoneTooltip({
        zone: "Asia/Tokyo",
        clock: { ...CLOCK, date: "2026-10-01", shift: "Tomorrow" },
      }),
    );
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText(/2026-10-01/)).toBeInTheDocument();
  });

  it("says nothing about a shift when there is none", () => {
    renderHtml(zoneTooltip({ zone: "Europe/London", clock: CLOCK }));
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
  });

  it("says whether the sun is up, hiding the icon from assistive technology", async () => {
    const r = renderHtml(
      zoneTooltip({
        zone: "Europe/London",
        clock: {
          ...CLOCK,
          sky: { label: "Daylight", icon: '<circle r="4"/>' },
        },
      }),
    );
    expect(screen.getByText("Daylight")).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("shows the signal-lost line, and no clock, when the reading failed", async () => {
    const r = renderHtml(zoneTooltip({ zone: "Mars/Olympus" }));
    expect(screen.getByText("Mars/Olympus")).toBeInTheDocument();
    expect(screen.getByText(/NO SIGNAL/)).toBeInTheDocument();
    expect(screen.queryByText(/^UTC/)).not.toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("escapes a zone name that carries markup", () => {
    renderHtml(zoneTooltip({ zone: "a<b>c", clock: CLOCK }));
    expect(screen.getByText("a<b>c")).toBeInTheDocument();
  });
});
