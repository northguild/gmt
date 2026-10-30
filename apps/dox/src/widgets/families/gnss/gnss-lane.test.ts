// @vitest-environment jsdom
import { isInaccessible, screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { blankGnssLane, gnssLane, type GnssLaneOptions } from "./gnss-lane";

const base: GnssLaneOptions = {
  form: "ring",
  label: "era 2",
  value: "2024-01-01T00:00:00Z",
  sentence: "era 2: 2024-01-01T00:00:00Z, your reading",
  pin: 24.1,
  today: null,
  chosen: true,
  gap: false,
  flags: ["your reading", "nearest today"],
};

describe("gnssLane", () => {
  it("is a group named by its sentence, holding the era, the instant and the flags", () => {
    renderHtml(gnssLane(base));
    const group = screen.getByRole("group", { name: base.sentence });
    expect(within(group).getByText("era 2")).toBeVisible();
    expect(within(group).getByText("2024-01-01T00:00:00Z")).toBeVisible();
    expect(within(group).getByText("your reading")).toBeVisible();
    expect(within(group).getByText("nearest today")).toBeVisible();
  });

  it("draws the pin and today's mark on a track in the track form, and no track in the ring form", () => {
    renderHtml(
      gnssLane({ ...base, form: "track", label: "GPS-LNAV", today: 50 }),
    );
    expect(
      screen.getByRole("img", { name: "GPS-LNAV reading" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "GPS-LNAV holds today" }),
    ).toBeInTheDocument();
    renderHtml(gnssLane(base));
    expect(
      screen.queryByRole("img", { name: "era 2 reading" }),
    ).not.toBeInTheDocument();
  });

  it("draws no pin when the library gave no instant", () => {
    renderHtml(
      gnssLane({ ...base, form: "track", pin: null, value: "no result" }),
    );
    expect(
      screen.queryByRole("img", { name: /reading/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("no result")).toBeVisible();
  });

  it("keeps a blank slot's box and hides it from assistive technology", () => {
    const fx = renderHtml(blankGnssLane("ring"));
    expect(isInaccessible(fx.first())).toBe(true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("escapes its text", () => {
    renderHtml(gnssLane({ ...base, label: "<b>x</b>", sentence: "s" }));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const a = renderHtml(gnssLane(base));
    const b = renderHtml(gnssLane({ ...base, form: "track", today: 10 }));
    const c = renderHtml(blankGnssLane("track"));
    await expectNoAxeViolations(a.host);
    await expectNoAxeViolations(b.host);
    await expectNoAxeViolations(c.host);
  });
});
