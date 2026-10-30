// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { field, hint } from "../../builders/layout";
import { utcDatetimeInput } from "./utc-datetime-input";

const markup = (value?: string) =>
  field({
    id: "anchor",
    label: "Reference time (UTC)",
    hint: hint("anchor-hint", "Written in UTC"),
    control: ({ id, describedBy }) =>
      utcDatetimeInput({
        id,
        describedBy,
        step: 300,
        ...(value === undefined ? {} : { value }),
      }),
  });

describe("utcDatetimeInput", () => {
  it("is a native date and time input named by its field, described by the hint", () => {
    renderHtml(markup("2026-03-08T06:45"));
    const input = screen.getByLabelText("Reference time (UTC)");
    expect(input).toHaveValue("2026-03-08T06:45");
    expect(input).toHaveAccessibleDescription("Written in UTC");
  });

  it("takes a typed value from the keyboard", async () => {
    renderHtml(markup());
    const input = screen.getByLabelText("Reference time (UTC)");
    await userEvent.setup().type(input, "2026-03-08T07:00");
    expect(input).toHaveValue("2026-03-08T07:00");
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup("2026-03-08T06:45"));
    await expectNoAxeViolations(fx.host);
  });
});
