// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { button, buttonRow } from "./button";
import { html } from "./html";

describe("button", () => {
  it("is a button named by its label, with no form submit", async () => {
    renderHtml(button({ id: "check", label: "Check" }));
    const b = screen.getByRole("button", { name: "Check" });
    expect(b).toHaveAttribute("type", "button");
    await expectNoAxeViolations(document.body);
  });

  it("is described by the text it points at", () => {
    renderHtml(
      html`<p id="what">Runs the probe again</p>${button({ id: "again", label: "Check again", describedBy: "what" })}`,
    );
    expect(
      screen.getByRole("button", { name: "Check again" }),
    ).toHaveAccessibleDescription("Runs the probe again");
  });

  it("shows a hostile label as text", () => {
    renderHtml(button({ id: "x", label: "<img src=x>" }));
    expect(
      screen.getByRole("button", { name: "<img src=x>" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("fires its click from the keyboard", async () => {
    renderHtml(buttonRow(html`${button({ id: "a", label: "Reset example" })}`));
    const b = screen.getByRole("button", { name: "Reset example" });
    let clicks = 0;
    b.addEventListener("click", () => (clicks += 1));
    const user = userEvent.setup();
    b.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(clicks).toBe(2);
  });
});
