// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { switchField } from "./switch-field";

describe("switchField", () => {
  it("is a switch named by its label and starts as asked", () => {
    renderHtml(
      html`${switchField({ label: "Daylight saving", checked: true })}${switchField({ label: "Local day" })}`,
    );
    expect(
      screen.getByRole("switch", { name: "Daylight saving" }),
    ).toBeChecked();
    expect(screen.getByRole("switch", { name: "Local day" })).not.toBeChecked();
  });

  it("toggles with Space and with a click, and keeps the count in the name", async () => {
    const fx = renderHtml(switchField({ label: "Same day", detail: "12" }));
    const user = userEvent.setup();
    const sw = screen.getByRole("switch", { name: "Same day 12" });
    await user.tab();
    expect(sw).toHaveFocus();
    await user.keyboard(" ");
    expect(sw).toBeChecked();
    await user.click(sw);
    expect(sw).not.toBeChecked();
    await expectNoAxeViolations(fx.host);
  });

  it("does not toggle while disabled", async () => {
    renderHtml(switchField({ label: "Locked", disabled: true }));
    const sw = screen.getByRole("switch", { name: "Locked" });
    await userEvent.click(sw);
    expect(sw).not.toBeChecked();
    expect(sw).toBeDisabled();
  });

  it("escapes a label that carries markup", () => {
    renderHtml(switchField({ label: "<i>x</i>" }));
    expect(
      screen.getByRole("switch", { name: "<i>x</i>" }),
    ).toBeInTheDocument();
  });
});
