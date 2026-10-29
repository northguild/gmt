// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { field, hint } from "./layout";
import { select } from "./select";

const OPTIONS = [
  { value: "gps", label: "GPS" },
  { value: "gal", label: "Galileo" },
  { value: "x", label: "<b>odd</b>" },
];

const markup = (value?: string, gate?: string) => {
  const h = hint("sys-hint", "Pick the constellation");
  return field({
    id: "sys",
    label: "System",
    hint: h,
    control: ({ id, describedBy }) =>
      select({
        id,
        options: OPTIONS,
        ...(value === undefined ? {} : { value }),
        describedBy,
        ...(gate === undefined ? {} : { gate }),
      }),
  });
};

describe("select", () => {
  it("is a combobox named by its field, described by the hint", () => {
    renderHtml(markup());
    const box = screen.getByRole("combobox", { name: "System" });
    expect(box).toHaveAccessibleDescription("Pick the constellation");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selects the value it was given", () => {
    renderHtml(markup("gal"));
    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue("gal");
  });

  it("leaves the first option selected for a value it does not list", () => {
    renderHtml(markup("nope"));
    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue("gps");
  });

  it("escapes an option label", () => {
    renderHtml(markup());
    expect(
      screen.getByRole("option", { name: "<b>odd</b>" }),
    ).toBeInTheDocument();
  });

  it("changes with the keyboard like any native select", async () => {
    renderHtml(markup());
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "System" }),
      "Galileo",
    );
    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue("gal");
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup("gps"));
    await expectNoAxeViolations(fx.host);
  });
});
