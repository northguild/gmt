/** @vitest-environment jsdom */
import {
  DECK_BRAIN_KEY,
  getDeckBrain,
  setDeckBrain,
  subscribeDeckBrain,
} from "./deck-brain";

afterEach(() => setDeckBrain(null));

describe("the deck's brain pick", () => {
  it("starts with no pick, so whichever brain has budget answers", () => {
    expect(getDeckBrain()).toBeNull();
  });

  it("tells every listener once per change, and not for the same pick again", () => {
    const heard = vi.fn();
    const stop = subscribeDeckBrain(heard);
    setDeckBrain("cf-a");
    setDeckBrain("cf-a");
    expect(getDeckBrain()).toBe("cf-a");
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    setDeckBrain("gemini-a");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps the pick for the tab, and forgets it when set back to none", () => {
    setDeckBrain("cf-a");
    expect(sessionStorage.getItem(DECK_BRAIN_KEY)).toBe("cf-a");
    setDeckBrain(null);
    expect(sessionStorage.getItem(DECK_BRAIN_KEY)).toBeNull();
  });

  it("still shares the pick within the page when storage is refused", () => {
    const refuse = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("refused", "SecurityError");
      });
    setDeckBrain("cf-a");
    expect(getDeckBrain()).toBe("cf-a");
    refuse.mockRestore();
  });
});
