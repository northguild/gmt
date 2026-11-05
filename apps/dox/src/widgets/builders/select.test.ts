// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { setHtml } from "./html";
import { field, hint } from "./layout";
import { select, selectOptions } from "./select";

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

  // jsdom applies no CSS modules, so the sheet is read as text. A user agent dims a disabled
  // control with opacity, which fades its border and its text below the contrast floors; the
  // kit dims by a dashed border and `--gmt-ice-dim` ink.
  it("keeps a disabled select at full opacity", () => {
    const css = readFileSync(
      join(import.meta.dirname, "select.module.css"),
      "utf8",
    );
    const block = css.match(/&:disabled \{([^}]*)\}/)?.[1] ?? "";
    expect(block).toMatch(/opacity:\s*1;/);
  });

  it("writes the options of a live select, keeping the one that is chosen", () => {
    renderHtml(markup("gps"));
    const box = screen.getByRole("combobox", { name: "System" });
    setHtml(box, selectOptions(OPTIONS.slice(0, 2), "gal"));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(box).toHaveValue("gal");
  });

  it("writes the same options select() writes", () => {
    renderHtml(
      select({ id: "sys", options: OPTIONS, value: "x", describedBy: "h" }),
    );
    const box = screen.getByRole("combobox");
    // What a reader gets from each option: its label, its value and whether it is chosen.
    const options = (): unknown[] =>
      within(box)
        .getAllByRole("option")
        .map((o) => [
          o.textContent,
          (o as HTMLOptionElement).value,
          (o as HTMLOptionElement).selected,
        ]);
    const before = options();
    setHtml(box, selectOptions(OPTIONS, "x"));
    expect(options()).toEqual(before);
  });

  it("escapes an option label it writes", () => {
    renderHtml(select({ id: "sys", options: [], describedBy: "h" }));
    const box = screen.getByRole("combobox");
    setHtml(box, selectOptions(OPTIONS, undefined));
    expect(
      screen.getByRole("option", { name: "<b>odd</b>" }),
    ).toBeInTheDocument();
  });
});
