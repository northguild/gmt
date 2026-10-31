import { captureSharedState, describeLeaks } from "./sharedState";

describe("describeLeaks", () => {
  it("reports nothing when nothing changed", () => {
    expect(describeLeaks(captureSharedState())).toEqual([]);
  });

  it("names an Intl constructor that was assigned and not restored", () => {
    const before = captureSharedState();
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function replaced() {
      return new original();
    } as unknown as typeof Intl.DateTimeFormat;
    try {
      expect(describeLeaks(before)).toEqual([
        "Intl.DateTimeFormat was replaced",
      ]);
    } finally {
      Intl.DateTimeFormat = original;
    }
    expect(describeLeaks(before)).toEqual([]);
  });

  it("names a replaced clock reader", () => {
    const before = captureSharedState();
    const original = Date.now; // date-ban: replaced and restored to test the check
    Date.now = () => 0; // date-ban: replaced and restored to test the check
    try {
      expect(describeLeaks(before)).toEqual(["Date.now was replaced"]); // date-ban: the leak message names Date.now
    } finally {
      Date.now = original; // date-ban: restores the real clock
    }
  });

  it("names a global and an environment variable that were added", () => {
    const before = captureSharedState();
    Reflect.set(globalThis, "leakedByTest", 1);
    process.env.LEAKED_BY_TEST = "1";
    try {
      expect(describeLeaks(before)).toEqual([
        "globalThis.leakedByTest was added",
        "process.env.LEAKED_BY_TEST was added",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, "leakedByTest");
      delete process.env.LEAKED_BY_TEST;
    }
  });
});
