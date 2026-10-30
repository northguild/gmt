// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { idScope } from "../../builders/ids";
import {
  closedDaysFieldset,
  cutoffFieldset,
  rollChoices,
} from "./stack-fieldsets";

const id = idScope("t");

describe("cutoffFieldset", () => {
  it("is a group named by its number, holding three labelled fields", async () => {
    const { host } = renderHtml(
      cutoffFieldset({
        id,
        n: 2,
        values: { name: "documents", offset: "P3D", atLocalTime: "12:00" },
      }),
    );
    const group = screen.getByRole("group", { name: "Cut-off 2" });
    const view = within(group);
    expect(view.getByRole("textbox", { name: "Name" })).toHaveValue(
      "documents",
    );
    expect(view.getByRole("textbox", { name: "Offset" })).toHaveValue("P3D");
    expect(
      view.getByRole("textbox", { name: "At local time (optional)" }),
    ).toHaveValue("12:00");
    await expectNoAxeViolations(host);
  });
});

describe("closedDaysFieldset", () => {
  const render = (values = {}) =>
    renderHtml(
      closedDaysFieldset({
        id,
        values: {
          calendar: true,
          weekend: [6, 7],
          holidays: "2024-05-09",
          roll: "preceding",
          ...values,
        },
      }),
    );

  it("reads the calendar, the weekend, the holidays and the roll back", async () => {
    const { host } = render();
    const group = screen.getByRole("group", { name: "Closed days" });
    const view = within(group);
    expect(
      view.getByRole("switch", { name: "Use a business calendar" }),
    ).toBeChecked();
    const weekend = within(view.getByRole("group", { name: "Weekend" }));
    expect(weekend.getByRole("checkbox", { name: "Sat" })).toBeChecked();
    expect(weekend.getByRole("checkbox", { name: "Sun" })).toBeChecked();
    expect(weekend.getByRole("checkbox", { name: "Mon" })).not.toBeChecked();
    expect(view.getByRole("textbox", { name: "Holidays" })).toHaveValue(
      "2024-05-09",
    );
    expect(
      view.getByRole("combobox", { name: "Roll a closed-day cut-off" }),
    ).toHaveValue("preceding");
    await expectNoAxeViolations(host);
  });

  it("describes the holidays and the roll by their hints", () => {
    render();
    expect(
      screen.getByRole("textbox", { name: "Holidays" }),
    ).toHaveAccessibleDescription("ISO dates, separated by commas");
    expect(
      screen.getByRole("combobox", { name: "Roll a closed-day cut-off" }),
    ).toHaveAccessibleDescription(/There is no default/);
  });

  it("leaves a roll the library does not know in the list", () => {
    expect(rollChoices("sideways").map((r) => r.value)).toContain("sideways");
    expect(rollChoices("")[0]).toEqual({ value: "", label: "(not given)" });
  });
});
