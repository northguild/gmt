/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raw, setHtml } from "~/widgets/builders";

const cue = vi.fn();
vi.mock("~/lib/sound/cue", () => ({ cue: (name: string) => cue(name) }));
const holdLink = vi.fn();
vi.mock("~/lib/sound/link-hold", () => ({
  holdLink: (event: MouseEvent, link: HTMLAnchorElement) =>
    holdLink(event, link),
}));

// Importing the module adds its delegated listeners to `document`, as it does on the page. The
// import is static so it runs before the leak guard records its baseline; the isolated project
// gives this file a jsdom of its own.
import "./sonar";

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  cue.mockReset();
  holdLink.mockClear();
  user = userEvent.setup();
  setHtml(
    document.body,
    raw(`
      <button type="button">Press</button>
      <div role="tablist"><button role="tab" type="button">Tab</button></div>
      <details><summary>Group</summary></details>
      <a href="/guides/">Away</a>
      <a href="#top">Here</a>
      <button type="button" data-cue="open">Own cue</button>
      <button type="button" data-quiet-focus>Handed over</button>
      <div class="expressive-code"><div class="copy"><button type="button" title="Copy to clipboard">Copy code</button></div></div>
      <button type="button" popovertarget="p" data-cue>Open panel</button>
      <button type="button" class="sl-link-button"><span>Inner</span></button>
      <span role="link" tabindex="0">Scripted link</span>
      <button type="button" data-ping="sonar">Among links</button>
      <a class="sl-link-button" aria-current="page">Current page</a>
      <p>Plain text</p>
    `),
  );
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("the press cue", () => {
  it.each([
    ["a button", () => screen.getByRole("button", { name: "Press" })],
    ["a tab", () => screen.getByRole("tab", { name: "Tab" })],
    ["a summary", () => screen.getByText("Group")],
    ["the inside of a pinged control", () => screen.getByText("Inner")],
  ])("plays the Deep sonar for %s", async (_name, find) => {
    await user.click(find());
    expect(cue).toHaveBeenCalledExactlyOnceWith("press");
  });

  it.each([
    ["a same-page link", () => screen.getByRole("link", { name: "Here" })],
    [
      "a scripted link",
      () => screen.getByRole("link", { name: "Scripted link" }),
    ],
    [
      "a button marked to sound like the links around it",
      () => screen.getByRole("button", { name: "Among links" }),
    ],
  ])("plays the Sonar ping for %s", async (_name, find) => {
    await user.click(find());
    expect(cue).toHaveBeenCalledExactlyOnceWith("click");
  });

  it("plays nothing and re-pings nothing for an <a> with no href, which is not a control", async () => {
    const restart = vi.spyOn(CSSStyleDeclaration.prototype, "removeProperty");
    try {
      const current = screen.getByText("Current page");
      current.tabIndex = -1;
      current.focus();
      await user.click(current);
      expect(cue).not.toHaveBeenCalled();
      expect(restart).not.toHaveBeenCalledWith("animation");
    } finally {
      restart.mockRestore();
    }
  });

  it("plays the Sonar ping for a link that goes to another page", async () => {
    const link = screen.getByRole("link", { name: "Away" });
    // jsdom cannot navigate; cancelling keeps the test on this page and leaves the press as it was.
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(cue).toHaveBeenCalledExactlyOnceWith("click");
  });

  it("leaves a control that has its own cue to it", async () => {
    await user.click(screen.getByRole("button", { name: "Own cue" }));
    expect(cue).not.toHaveBeenCalled();
  });

  it("leaves a code block's copy button and a panel's opener to their own cues", async () => {
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    await user.click(screen.getByRole("button", { name: "Open panel" }));
    expect(cue).not.toHaveBeenCalled();
  });

  it("counts a quiet focus hand-over as focus, not a press", async () => {
    await user.click(screen.getByRole("button", { name: "Handed over" }));
    expect(cue).not.toHaveBeenCalled();
  });

  it("still plays when the control swaps its own icon in its handler", async () => {
    const swap = document.createElement("button");
    swap.type = "button";
    const icon = document.createElement("span");
    icon.textContent = "Old";
    swap.append(icon);
    swap.addEventListener("click", () => {
      const next = document.createElement("span");
      next.textContent = "New";
      swap.replaceChildren(next);
    });
    document.body.append(swap);
    await user.click(screen.getByText("Old"));
    expect(cue).toHaveBeenCalledOnce();
  });

  it("plays for a control that stops its click from bubbling, as Starlight's Search does", async () => {
    const search = document.createElement("button");
    search.type = "button";
    search.textContent = "Search";
    search.addEventListener("click", (event) => event.stopPropagation());
    document.body.append(search);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(cue).toHaveBeenCalledOnce();
  });

  it("is silent for a click on plain text", async () => {
    await user.click(screen.getByText("Plain text"));
    expect(cue).not.toHaveBeenCalled();
  });

  it("keeps the focus re-ping: a press on a focused control restarts the animation and plays its kind's cue", async () => {
    // The restart removes the inline `animation` it set; no role or state shows that.
    const restart = vi.spyOn(CSSStyleDeclaration.prototype, "removeProperty");
    try {
      await user.click(screen.getByText("Inner"));
      expect(restart).toHaveBeenCalledWith("animation");
      expect(cue).toHaveBeenCalledWith("press");
    } finally {
      restart.mockRestore();
    }
  });
});

describe("a link's press waits for its ping", () => {
  it("hands a link's press to the hold once its ping is heard", async () => {
    cue.mockReturnValue(true);
    const link = screen.getByRole("link", { name: "Away" });
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(holdLink).toHaveBeenCalledExactlyOnceWith(
      expect.any(MouseEvent),
      link,
    );
  });

  it("holds nothing when the ping was not heard, or the press was not a link", async () => {
    cue.mockReturnValue(false);
    const link = screen.getByRole("link", { name: "Away" });
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    cue.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Press" }));
    expect(holdLink).not.toHaveBeenCalled();
  });
});
