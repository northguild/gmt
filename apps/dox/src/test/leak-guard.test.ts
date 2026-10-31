import { captureState, describeLeaks } from "./leak-guard";

describe("describeLeaks", () => {
  it("reports nothing when nothing changed", () => {
    expect(describeLeaks(captureState(), captureState())).toEqual([]);
  });

  it("names a global a test added, replaced and removed", () => {
    const g = globalThis as Record<string, unknown>;
    const before = captureState();
    const fetchBefore = g.fetch;
    try {
      g.leakedByTest = 1;
      g.fetch = () => Promise.reject(new Error("replaced"));
      expect(describeLeaks(before, captureState())).toEqual(
        expect.arrayContaining([
          "globalThis.leakedByTest was added",
          "globalThis.fetch was replaced",
        ]),
      );
    } finally {
      delete g.leakedByTest;
      g.fetch = fetchBefore;
    }
    expect(describeLeaks(before, captureState())).toEqual([]);
  });

  it("names an environment variable and an Intl member a test changed", () => {
    const before = captureState();
    const original = Intl.DateTimeFormat;
    try {
      process.env.LEAK_GUARD_PROBE = "1";
      Object.defineProperty(Intl, "DateTimeFormat", {
        value: function DateTimeFormat() {},
        configurable: true,
        writable: true,
      });
      expect(describeLeaks(before, captureState())).toEqual(
        expect.arrayContaining([
          "process.env.LEAK_GUARD_PROBE was added",
          "Intl.DateTimeFormat was replaced",
        ]),
      );
    } finally {
      delete process.env.LEAK_GUARD_PROBE;
      Object.defineProperty(Intl, "DateTimeFormat", {
        value: original,
        configurable: true,
        writable: true,
      });
    }
    expect(describeLeaks(before, captureState())).toEqual([]);
  });
});
