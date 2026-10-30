// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { widget } from "../../builders/layout";
import { renderHtml } from "../../test-fixture";
import { clocksCard } from "./clocks-card";

function draw() {
  return renderHtml(
    widget(
      { name: "x", label: "X", scope: "x" },
      clocksCard({
        idPrefix: "x",
        zones: ["America/Vancouver", "America/Winnipeg"],
        stopped: new Set(["America/Vancouver"]),
        notice: html`This browser has old rules.`,
      }),
    ),
  );
}

describe("clocksCard", () => {
  it("is a region named Live clocks, with a clock for each zone and a hint", () => {
    draw();
    const card = screen.getByRole("region", { name: "Live clocks" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(card).getByText("Your time, and the time in each zone."),
    ).toBeVisible();
  });

  it("holds its stale-data notice out of sight until the mount shows it", () => {
    draw();
    expect(screen.getByText("This browser has old rules.")).not.toBeVisible();
  });

  it("has no accessibility violations", async () => {
    const fixture = draw();
    await expectNoAxeViolations(fixture.host);
  });
});
