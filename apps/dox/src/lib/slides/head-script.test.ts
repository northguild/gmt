// @vitest-environment jsdom
import { DECK_HEAD_SCRIPT } from "./head-script.ts";

afterEach(() => {
  document.documentElement.removeAttribute("data-deck");
  history.replaceState(null, "", "/");
});

function run(hash: string): string | null {
  history.replaceState(null, "", `/${hash}`);
  // The script is the page's own inline text; running it is the point of the test.
  new Function(DECK_HEAD_SCRIPT)();
  return document.documentElement.getAttribute("data-deck");
}

describe("the deck head script", () => {
  it("waits with the first slide when the address names no slide", () => {
    expect(run("")).toBe("wait");
    expect(run("#")).toBe("wait");
  });

  it("holds the stage back when the address names a slide or a build", () => {
    expect(run("#one-clock")).toBe("wait-hash");
    expect(run("#one-clock/1")).toBe("wait-hash");
  });
});
