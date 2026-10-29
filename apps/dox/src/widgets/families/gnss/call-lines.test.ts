import { callLines, outputOf } from "./call-lines";

const ok = { fn: "taiMinusUtc", args: ["2024-01-01T00:00:00Z"], result: 37 };
const lost = { fn: "toTAI", args: ["nope"], result: "" };

describe("callLines", () => {
  it("writes the plain text a copy button copies, one call to a line", () => {
    expect(callLines([ok, lost]).plain).toBe(
      'taiMinusUtc("2024-01-01T00:00:00Z")\ntoTAI("nope")',
    );
  });

  it("is empty for no calls", () => {
    expect(callLines([]).plain).toBe("");
  });
});

describe("outputOf", () => {
  it("is empty before any call has run", () => {
    expect(outputOf("empty", [])).toEqual({ state: "empty", lines: [] });
  });

  it("gives one live line for each call of an answered reading", () => {
    const out = outputOf("ok", [ok, ok]);
    expect(out.state).toBe("live");
    expect(out.lines.map((l) => l.lost)).toEqual([false, false]);
  });

  it("is one whole-pane NO SIGNAL when a failed reading has no refused call", () => {
    expect(outputOf("sentinel", [ok])).toEqual({
      state: "sentinel",
      lines: [{ text: "NO SIGNAL", lost: true }],
    });
  });

  it("replaces only the refused calls of a partly failed reading", () => {
    const out = outputOf("sentinel", [ok, lost]);
    expect(out.state).toBe("live");
    expect(out.lines.map((l) => l.lost)).toEqual([false, true]);
  });

  it("is a sentinel when every call was refused", () => {
    expect(outputOf("sentinel", [lost, lost]).state).toBe("sentinel");
  });
});
