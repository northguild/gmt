/**
 * @vitest-environment jsdom
 *
 * The globe's data-credits button is the fourth of its control stack (CORE-88), on every mount.
 * The same file reads the template's other chrome by role and name: the region, the search box,
 * the zone list and the heading and caption an embedded globe drops.
 */
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "~/widgets/test-fixture";
import { renderGlobeTemplate } from "./globe-mount";

function draw(options?: Parameters<typeof renderGlobeTemplate>[0]) {
  return renderHtml(renderGlobeTemplate(options));
}

function stack(idPrefix?: string): HTMLElement {
  draw({ idPrefix });
  return screen.getByRole("group", { name: "Globe controls" });
}

describe("the globe's control stack", () => {
  it("is one group named Globe controls", async () => {
    const r = draw();
    expect(
      screen.getByRole("group", { name: "Globe controls" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("holds +, −, ⊙ and the data-credits button, in that tab order", () => {
    const buttons = within(stack()).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Zoom in",
      "Zoom out",
      "Reset zoom",
      "Data credits",
    ]);
    expect(buttons.every((b) => b.tabIndex === 0)).toBe(true);
  });

  it("credits both data sets in a popover the Data credits button opens", () => {
    const group = stack("rail-3");
    const button = within(group).getByRole("button", { name: "Data credits" });
    expect(button).toHaveAttribute("popovertarget");
    expect(screen.getByText("Time zone boundaries")).toBeInTheDocument();
    expect(screen.getByText("Earth imagery")).toBeInTheDocument();
  });

  it("starts with its credits closed", () => {
    expect(
      within(stack("rail-4")).getByRole("button", { name: "Data credits" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the globe's template", () => {
  it("is a region with a title, a search box, a zone list and a caption", async () => {
    const r = draw();
    expect(
      screen.getByRole("region", { name: "Zoned Earth" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Every zone, computed live by @northguild/gmt",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Find a zone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listbox", {
        name: "Pinned zones — select one to focus the globe",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No hardcoded offset tables/)).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("drops the heading and the caption when embedded, and says so in its name", async () => {
    const r = draw({ embedded: true });
    expect(
      screen.getByRole("region", { name: "Zoned Earth overview" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No hardcoded offset tables/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Find a zone" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });
});
