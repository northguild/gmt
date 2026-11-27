// @vitest-environment jsdom
/* The control stack's keys: one Tab stop, the arrow keys round the shown buttons. */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { html } from "~/widgets/builders/html";
import { renderHtml } from "~/widgets/test-fixture";
import { wireGlobeToolbar } from "./globe-toolbar";

function draw() {
  renderHtml(
    html`<p><button type="button">Before</button></p>
      <div role="toolbar" aria-label="Globe controls">
        <button type="button" aria-label="Zoom in">+</button>
        <button type="button" aria-label="Zoom out">−</button>
        <button type="button" aria-label="Go to my time zone" hidden>
          o
        </button>
        <div data-disclosure>
          <button type="button" aria-label="Look at">L</button>
          <div hidden><button type="button">Sun</button></div>
        </div>
        <button type="button" aria-label="About this sky">i</button>
      </div>
      <p><button type="button">After</button></p>`,
  );
  const ctl = new AbortController();
  const toolbar = screen.getByRole("toolbar", { name: "Globe controls" });
  wireGlobeToolbar(toolbar, false, ctl.signal);
  const at = (name: string) => screen.getByRole("button", { name });
  return { toolbar, at, ctl, user: userEvent.setup() };
}

describe("wireGlobeToolbar", () => {
  it("is one Tab stop: Tab enters at Zoom in and the next Tab leaves", async () => {
    const { at, user } = draw();
    await user.tab();
    await user.tab();
    expect(at("Zoom in")).toHaveFocus();
    await user.tab();
    expect(at("After")).toHaveFocus();
  });

  it("moves to the next shown button on ArrowDown and ArrowRight, and wraps", async () => {
    const { at, user } = draw();
    at("Zoom in").focus();
    await user.keyboard("{ArrowDown}");
    expect(at("Zoom out")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(at("Look at")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(at("About this sky")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(at("Zoom in")).toHaveFocus();
  });

  it("moves back on ArrowUp and ArrowLeft, and wraps from the first to the last", async () => {
    const { at, user } = draw();
    at("Zoom in").focus();
    await user.keyboard("{ArrowUp}");
    expect(at("About this sky")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(at("Look at")).toHaveFocus();
  });

  it("comes back by Tab to the button it was left on", async () => {
    const { at, user } = draw();
    at("Zoom in").focus();
    await user.keyboard("{End}");
    await user.tab({ shift: true });
    expect(at("Before")).toHaveFocus();
    await user.tab();
    expect(at("About this sky")).toHaveFocus();
  });

  it("keeps a button that shows after wiring out of the tab order", async () => {
    const { at, user } = draw();
    /* Hidden, it has no role name, so it is found by its label. */
    screen.getByLabelText("Go to my time zone").hidden = false;
    await Promise.resolve();
    at("Before").focus();
    await user.tab();
    expect(at("Zoom in")).toHaveFocus();
    await user.tab();
    expect(at("After")).toHaveFocus();
  });

  it("hands the stop to the first shown button when the stop is hidden", async () => {
    const { at, user } = draw();
    at("Zoom in").focus();
    await user.keyboard("{End}");
    at("About this sky").hidden = true;
    await Promise.resolve();
    at("Before").focus();
    await user.tab();
    expect(at("Zoom in")).toHaveFocus();
    await user.tab();
    expect(at("After")).toHaveFocus();
  });

  it("says it is vertical when the stack is a column", () => {
    const { toolbar } = draw();
    expect(toolbar).toHaveAttribute("aria-orientation", "vertical");
  });

  it("stops listening when its signal aborts", async () => {
    const { at, user, ctl } = draw();
    ctl.abort();
    at("Zoom in").focus();
    await user.keyboard("{ArrowDown}");
    expect(at("Zoom in")).toHaveFocus();
  });
});
