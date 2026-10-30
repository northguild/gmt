// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { field, hint } from "./layout";
import { textInput, type TextInputOptions } from "./text-input";

const markup = (extra: Omit<TextInputOptions, "id" | "describedBy"> = {}) => {
  const h = hint("wk-hint", "A whole number");
  return field({
    id: "wk",
    label: "Week",
    hint: h,
    control: ({ id, describedBy }) => textInput({ id, describedBy, ...extra }),
  });
};

describe("textInput", () => {
  it("is a textbox named by its field, described by the hint", () => {
    renderHtml(markup({ value: "2300" }));
    const box = screen.getByRole("textbox", { name: "Week" });
    expect(box).toHaveValue("2300");
    expect(box).toHaveAccessibleDescription("A whole number");
  });

  it("writes the typed-value attributes it is given and nothing else", () => {
    renderHtml(
      markup({
        inputMode: "numeric",
        autocomplete: "off",
        spellcheck: false,
        placeholder: "e.g. 2300",
      }),
    );
    const box = screen.getByRole("textbox", { name: "Week" });
    expect(box).toHaveAttribute("inputmode", "numeric");
    expect(box).toHaveAttribute("autocomplete", "off");
    expect(box).toHaveAttribute("spellcheck", "false");
    expect(box).toHaveAttribute("autocapitalize", "off");
    expect(box).toHaveAttribute("placeholder", "e.g. 2300");
  });

  it("takes no more characters than its maxLength", async () => {
    renderHtml(markup({ maxLength: 4 }));
    const box = screen.getByRole("textbox", { name: "Week" });
    await userEvent.setup().type(box, "230045");
    expect(box).toHaveValue("2300");
  });

  it("refuses a maxLength that is not a whole number from 1", () => {
    for (const maxLength of [0, -1, 2.5, Number.NaN]) {
      expect(() => markup({ maxLength })).toThrow(RangeError);
    }
  });

  it("leaves the browser's defaults when asked for none", () => {
    renderHtml(markup());
    const box = screen.getByRole("textbox", { name: "Week" });
    for (const name of [
      "inputmode",
      "autocomplete",
      "spellcheck",
      "autocapitalize",
      "maxlength",
      "value",
    ]) {
      expect(box).not.toHaveAttribute(name);
    }
  });

  it("escapes its value so it cannot end the attribute", () => {
    renderHtml(markup({ value: '"><b>x</b>' }));
    expect(screen.getByRole("textbox", { name: "Week" })).toHaveValue(
      '"><b>x</b>',
    );
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });

  it("takes typing", async () => {
    renderHtml(markup());
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Week" }), "12");
    expect(screen.getByRole("textbox", { name: "Week" })).toHaveValue("12");
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup({ value: "1" }));
    await expectNoAxeViolations(fx.host);
  });
});
