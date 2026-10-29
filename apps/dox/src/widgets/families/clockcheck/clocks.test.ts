// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { widget } from "../../builders/layout";
import { findWidget } from "../../root";
import { renderHtml } from "../../test-fixture";
import { clockSlug, clockTime, clocks } from "./clocks";

const ZONES = ["America/Vancouver", "America/Winnipeg"];

function draw() {
  const fixture = renderHtml(
    widget(
      { name: "canada", label: "Canada", scope: "canada" },
      clocks({
        idPrefix: "canada",
        zones: ZONES,
        stopped: new Set(["America/Vancouver"]),
      }),
    ),
  );
  return { fixture, found: findWidget(fixture.host, "canada") };
}

describe("clocks", () => {
  it("lists one clock per zone, each naming its zone", () => {
    draw();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("America/Vancouver");
    expect(items[1]).toHaveTextContent("America/Winnipeg");
  });

  it("says NO SIGNAL in every clock until the answer arrives", () => {
    draw();
    for (const item of screen.getAllByRole("listitem"))
      expect(within(item).getByText("NO SIGNAL")).toBeVisible();
  });

  it("draws a time and its offset as two separate pieces of text", () => {
    renderHtml(html`<p>${clockTime("08:15:30", "-08:00")}</p>`);
    expect(screen.getByText("08:15:30")).toBeVisible();
    expect(screen.getByText("-08:00")).toBeVisible();
  });

  it("turns a zone id into an id-safe word", () => {
    expect(clockSlug("Africa/El_Aaiun")).toBe("Africa-El-Aaiun");
  });

  it("has no accessibility violations", async () => {
    const { fixture } = draw();
    await expectNoAxeViolations(fixture.host);
  });
});
