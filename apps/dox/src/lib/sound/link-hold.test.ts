/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raw, setHtml } from "~/widgets/builders";
import { holdLink, LINK_HOLD_MS } from "./link-hold";

const go = vi.fn();
/** Whether each press was held, read after the hold has decided. */
let held: boolean[] = [];
let user: ReturnType<typeof userEvent.setup>;

/**
 * As the press cue does: every link press, once its ping is heard, is handed over in capture. A
 * listener added after the hold's reads its decision, then cancels whatever the hold left to the
 * browser, as jsdom cannot open another document.
 */
const onPress = (event: MouseEvent) => {
  const link = event.target;
  if (!(link instanceof HTMLAnchorElement)) return;
  holdLink(event, link, go);
  window.addEventListener(
    "click",
    () => {
      held.push(event.defaultPrevented);
      event.preventDefault();
    },
    { once: true },
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  go.mockClear();
  held = [];
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  document.addEventListener("click", onPress, { capture: true });
  setHtml(
    document.body,
    raw(`
      <a href="/guides/">Guides</a>
      <a href="/dox/?q=1">Dox</a>
      <a href="https://example.org/">Away</a>
      <a href="#top">Here</a>
      <a href="/new/" target="_blank" rel="noopener noreferrer">New tab</a>
      <a href="/file.txt" download>Download</a>
      <a href="/private/" rel="noreferrer">No referrer</a>
      <a href="mailto:hello@example.org">Mail</a>
    `),
  );
});

afterEach(() => {
  document.removeEventListener("click", onPress, { capture: true });
  document.body.replaceChildren();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("a link's press waits for its ping", () => {
  it.each([
    ["a page of this site", "Guides", "http://localhost:3000/guides/"],
    ["a page with a query", "Dox", "http://localhost:3000/dox/?q=1"],
    ["another site, in this tab", "Away", "https://example.org/"],
  ])("holds %s, then goes there", async (_name, text, url) => {
    await user.click(screen.getByRole("link", { name: text }));
    expect(held).toEqual([true]);
    vi.advanceTimersByTime(LINK_HOLD_MS - 1);
    expect(go).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(go).toHaveBeenCalledExactlyOnceWith(url);
  });

  it.each([
    ["a jump within this page", "Here"],
    ["a link that opens a new tab", "New tab"],
    ["a download", "Download"],
    ["a link that asks for no referrer", "No referrer"],
    ["a link that is not a web page", "Mail"],
  ])("leaves %s to the browser", async (_name, text) => {
    await user.click(screen.getByRole("link", { name: text }));
    expect(held).toEqual([false]);
    vi.runOnlyPendingTimers();
    expect(go).not.toHaveBeenCalled();
  });

  it("leaves a press with a modifier key, which the browser sends to a new tab or window", async () => {
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: "Guides" }));
    await user.keyboard("{/Meta}");
    expect(held).toEqual([false]);
    vi.runOnlyPendingTimers();
    expect(go).not.toHaveBeenCalled();
  });

  it("leaves a link another handler has taken", async () => {
    const link = screen.getByRole("link", { name: "Guides" });
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    vi.runOnlyPendingTimers();
    expect(go).not.toHaveBeenCalled();
  });

  it("goes only to the newest of two quick presses", async () => {
    await user.click(screen.getByRole("link", { name: "Guides" }));
    await user.click(screen.getByRole("link", { name: "Dox" }));
    vi.runOnlyPendingTimers();
    expect(go).toHaveBeenCalledExactlyOnceWith(
      "http://localhost:3000/dox/?q=1",
    );
  });
});
