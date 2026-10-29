// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { disclosure, wireDisclosure } from "./disclosure";

function draw(light = false) {
  const fx = renderHtml(
    html`${disclosure({
      id: "filters",
      label: "Filters",
      children: html`<p>Panel text</p><button type="button">Inside</button>`,
    })}<p><button type="button">Outside</button></p>`,
  );
  const ctl = new AbortController();
  const handle = wireDisclosure(fx.first(), {
    signal: ctl.signal,
    light,
  });
  return { fx, handle, ctl };
}

describe("disclosure", () => {
  it("starts shut, names its panel, and the panel is out of the tree", () => {
    draw();
    const button = screen.getByRole("button", { name: "Filters" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls");
    expect(screen.queryByText("Panel text")).not.toBeVisible();
  });

  it("opens and shuts with Enter and with Space", async () => {
    const { fx } = draw();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Filters" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Panel text")).toBeVisible();
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await expectNoAxeViolations(fx.host);
  });

  it("closes on Escape and returns focus to the button", async () => {
    draw();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Filters" });
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Inside" }));
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("with light dismiss, closes on a press outside but not one inside", async () => {
    draw(true);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Filters" });
    await user.click(button);
    await user.click(screen.getByText("Panel text"));
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("stops listening when its signal aborts", async () => {
    const { ctl } = draw();
    ctl.abort();
    const button = screen.getByRole("button", { name: "Filters" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("an icon-only button keeps its name for assistive technology", () => {
    renderHtml(
      disclosure({
        id: "g",
        label: "Filters",
        icon: html`<svg viewBox="0 0 1 1"></svg>`,
        children: html`<p>x</p>`,
      }),
    );
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });
});
