// @vitest-environment jsdom
import { captureState, describeLeaks } from "./leak-guard";

describe("describeLeaks in a document", () => {
  it("names a listener left on window or document, and ignores one that was removed", () => {
    const before = captureState();
    const left = () => {};
    const removed = () => {};
    window.addEventListener("resize", left);
    document.addEventListener("keydown", removed);
    document.removeEventListener("keydown", removed);
    try {
      expect(describeLeaks(before, captureState())).toEqual([
        'window "resize" listener was never removed',
      ]);
    } finally {
      window.removeEventListener("resize", left);
    }
    expect(describeLeaks(before, captureState())).toEqual([]);
  });

  it("does not count a listener that removes itself", () => {
    const before = captureState();
    window.addEventListener("resize", () => {}, { once: true });
    window.addEventListener("resize", () => {}, {
      signal: AbortSignal.abort(),
    });
    expect(describeLeaks(before, captureState())).toEqual([]);
  });
});
