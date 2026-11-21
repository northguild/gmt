/** @vitest-environment jsdom */
import {
  forgetUnlocked,
  isUnlockPhrase,
  readUnlocked,
  UNLOCK_STORAGE_KEY,
  writeUnlocked,
} from "./unlock";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the deck's lock", () => {
  it("takes the package name as the secret phrase, with spaces around it forgiven", () => {
    expect(isUnlockPhrase("@northguild/gmt")).toBe(true);
    expect(isUnlockPhrase("  @northguild/gmt \n")).toBe(true);
    expect(isUnlockPhrase("@northguild/GMT")).toBe(false);
    expect(isUnlockPhrase("northguild/gmt")).toBe(false);
    expect(isUnlockPhrase("")).toBe(false);
  });

  it("keeps the unlock in local storage, and forgets it on a lock", () => {
    expect(readUnlocked(window)).toBe(false);
    writeUnlocked(window);
    expect(window.localStorage.getItem(UNLOCK_STORAGE_KEY)).toBe("yes");
    expect(readUnlocked(window)).toBe(true);
    forgetUnlocked(window);
    expect(window.localStorage.getItem(UNLOCK_STORAGE_KEY)).toBeNull();
    expect(readUnlocked(window)).toBe(false);
  });

  it("counts storage that throws as locked, and writing to it or clearing it as a no-op", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readUnlocked(window)).toBe(false);
    expect(() => writeUnlocked(window)).not.toThrow();
    expect(() => forgetUnlocked(window)).not.toThrow();
  });
});
