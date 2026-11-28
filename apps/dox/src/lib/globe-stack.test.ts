// @vitest-environment jsdom
/* The folded stack's tap rules. jsdom has no hover, so the mouse path (hover opens the stack, the
   click opens the credits) is the hero gate's; here a tap and a key are the input. What a reader
   sees is whether a press on the info button opens the credits: a press that only opens the
   folded stack is cancelled, so the popover stays shut. */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { html } from "~/widgets/builders/html";
import { renderHtml } from "~/widgets/test-fixture";
import { wireGlobeStack } from "./globe-stack";

function draw() {
  const fx = renderHtml(
    html`<div role="group" aria-label="Globe controls">
        <button type="button" aria-label="Zoom in">+</button>
        <button type="button" popovertarget="credits" aria-label="About this sky">
          i
        </button>
        <div id="credits" popover>Sources</div>
      </div>
      <p><button type="button">Outside</button></p>`,
  );
  const ctl = new AbortController();
  wireGlobeStack(fx.first(), ctl.signal);
  const info = screen.getByRole("button", { name: "About this sky" });
  /* Whether each press on the info button was left to open the credits. */
  const credits: boolean[] = [];
  info.addEventListener("click", (event) =>
    credits.push(!event.defaultPrevented),
  );
  const user = userEvent.setup();
  const tap = (target: Element) => user.pointer({ keys: "[TouchA]", target });
  return { info, credits, ctl, user, tap };
}

describe("wireGlobeStack", () => {
  it("opens the folded stack on the first tap and the credits on the next", async () => {
    const { info, credits, tap } = draw();
    await tap(info);
    await tap(info);
    await tap(info);
    expect(credits).toEqual([false, true, true]);
  });

  it("stays open for a tap inside and folds again on a tap outside", async () => {
    const { info, credits, tap } = draw();
    await tap(info);
    await tap(screen.getByRole("button", { name: "Zoom in" }));
    await tap(info);
    await tap(screen.getByRole("button", { name: "Outside" }));
    await tap(info);
    expect(credits).toEqual([false, true, false]);
  });

  it("folds again on Escape", async () => {
    const { info, credits, user, tap } = draw();
    await tap(info);
    await user.keyboard("{Escape}");
    await tap(info);
    expect(credits).toEqual([false, false]);
  });

  it("lets a key open the credits at once: focus already shows the stack", async () => {
    const { info, credits, user } = draw();
    await user.tab();
    await user.tab();
    expect(info).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(credits).toEqual([true]);
  });

  it("stops listening when its signal aborts", async () => {
    const { info, credits, ctl, tap } = draw();
    ctl.abort();
    await tap(info);
    expect(credits).toEqual([true]);
  });
});
