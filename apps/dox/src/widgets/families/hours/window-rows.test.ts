// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { markRefused, windowRows, type WindowRowsOptions } from "./window-rows";

const draw = (over: Partial<WindowRowsOptions> = {}) =>
  renderHtml(
    windowRows({
      id: "mon",
      label: "Monday",
      windows: [
        { from: "09:00", to: "12:00" },
        { from: "13:00", to: "18:00" },
      ],
      ...over,
    }),
  );

describe("windowRows", () => {
  it("is a group named by its label with a pair of named inputs per window", () => {
    draw();
    const group = screen.getByRole("group", { name: "Monday" });
    const from = within(group).getByRole("textbox", {
      name: "Monday window 2 from",
    });
    expect(from).toHaveValue("13:00");
    expect(
      within(group).getByRole("textbox", { name: "Monday window 2 to" }),
    ).toHaveValue("18:00");
    expect(
      within(group).getByRole("button", { name: "Remove Monday window 1" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Add Monday window" }),
    ).toBeInTheDocument();
  });

  it("writes the text as typed, with no repair", () => {
    draw({ windows: [{ from: " 9am", to: "" }] });
    expect(
      screen.getByRole("textbox", { name: "Monday window 1 from" }),
    ).toHaveValue(" 9am");
    expect(
      screen.getByRole("textbox", { name: "Monday window 1 to" }),
    ).toHaveValue("");
  });

  it("with no windows has only the Add button", () => {
    draw({ windows: [] });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Monday window" }),
    ).toBeInTheDocument();
  });

  it("says in words which part the library refused", () => {
    draw({ refusedWindows: [1] });
    expect(
      screen.getAllByText("Refused on its own").filter((e) => !e.hidden),
    ).toHaveLength(1);
  });

  it("marks and clears refused parts without redrawing the inputs", () => {
    const f = draw();
    const group = screen.getByRole("group", { name: "Monday" });
    const box = screen.getByRole("textbox", { name: "Monday window 1 from" });
    markRefused(group, true, [0]);
    expect(
      screen.getAllByText("Refused on its own").filter((e) => !e.hidden),
    ).toHaveLength(2);
    markRefused(group, false);
    expect(
      screen.getAllByText("Refused on its own").filter((e) => !e.hidden),
    ).toHaveLength(0);
    expect(screen.getByRole("textbox", { name: "Monday window 1 from" })).toBe(
      box,
    );
    expect(f.host).toBeTruthy();
  });

  it("has no axe violations, refused or not", async () => {
    const f = draw({ refused: true, refusedWindows: [0] });
    await expectNoAxeViolations(f.host);
  });
});
