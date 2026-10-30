// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { field } from "../../builders";
import { renderHtml } from "../../test-fixture";
import { dateInput } from "./date-input";

const draw = (value?: string) =>
  renderHtml(
    field({
      id: "d",
      label: "Latest date",
      control: ({ id, describedBy }) =>
        dateInput({
          id,
          describedBy,
          ...(value === undefined ? {} : { value }),
        }),
    }),
  );

describe("dateInput", () => {
  it("is a native date field named by its label", () => {
    draw();
    expect(screen.getByLabelText("Latest date")).toHaveAttribute(
      "type",
      "date",
    );
  });

  it("holds the date it is given", () => {
    draw("2026-09-30");
    expect(screen.getByLabelText("Latest date")).toHaveValue("2026-09-30");
  });

  it("leaves a date the control refuses empty", () => {
    draw("2024-02-30");
    expect(screen.getByLabelText("Latest date")).toHaveValue("");
  });

  it("has no axe violations", async () => {
    const { host } = draw("2026-09-30");
    await expectNoAxeViolations(host);
  });
});
