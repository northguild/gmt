// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { widget } from "../../builders/layout";
import { renderHtml } from "../../test-fixture";
import { featureListParts, viewSwitch, zoneListParts } from "./zone-map";

const draw = (checked?: "today" | "proposals") =>
  renderHtml(
    widget(
      { name: "view", label: "View switch", scope: "view" },
      viewSwitch({
        id: "view",
        legend: "Map view",
        options: [
          {
            value: "today",
            label: "Today",
            ...(checked === "today" ? { checked: true } : {}),
          },
          {
            value: "proposals",
            label: "Proposals",
            ...(checked === "proposals" ? { checked: true } : {}),
          },
        ],
      }),
    ),
  );

describe("viewSwitch", () => {
  it("is a named radio group of native radios with the first checked", () => {
    draw();
    expect(screen.getByRole("group", { name: "Map view" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Proposals" })).not.toBeChecked();
  });

  it("checks the option that says so", () => {
    draw("proposals");
    expect(screen.getByRole("radio", { name: "Proposals" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Today" })).not.toBeChecked();
  });

  it("moves with the arrow keys and is one tab stop", async () => {
    draw();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Today" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Proposals" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Proposals" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
  });

  it("has no accessibility violations", async () => {
    draw();
    await expectNoAxeViolations(document.body);
  });
});

describe("featureListParts", () => {
  it("names a row's fields, and the checkers' form keeps the zone stem", () => {
    expect(featureListParts(3)).toEqual({
      swatch: "feature-3-swatch",
      kind: "feature-3-kind",
      offset: "feature-3-offset",
    });
    expect(zoneListParts(3).kind).toBe("zone-3-kind");
  });
});
