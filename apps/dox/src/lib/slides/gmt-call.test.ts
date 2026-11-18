import { describe, expect, it } from "vitest";
import { callGmt, callText, isSentinel, valueText } from "./gmt-call";

describe("callGmt", () => {
  it("returns the value gmt computes", async () => {
    expect(
      await callGmt("plain/calculate", "addDate", [
        "2024-01-31",
        { months: 1 },
      ]),
    ).toBe("2024-02-29");
  });

  it("returns the sentinel for a wall time that never happened, when asked to reject it", async () => {
    const value = await callGmt("instant/convert", "resolveLocal", [
      "2027-03-28T03:30:00",
      "Europe/Helsinki",
      { disambiguation: "reject" },
    ]);
    expect(value).toBe("");
    expect(isSentinel(value)).toBe(true);
  });

  it("throws for an unknown module or function", async () => {
    await expect(callGmt("nowhere/none", "addDate", [])).rejects.toThrow(
      /Unknown gmt module/,
    );
    await expect(callGmt("plain/calculate", "noSuchFn", [])).rejects.toThrow(
      /no function/,
    );
    await expect(
      callGmt("plain/calculate", "constructor", []),
    ).rejects.toThrow();
  });
});

describe("isSentinel", () => {
  it("is true for gmt's four invalid values and false for a real answer", () => {
    for (const v of ["", null, false, []]) expect(isSentinel(v)).toBe(true);
    for (const v of ["2024-02-29", 0, true, ["x"]])
      expect(isSentinel(v)).toBe(false);
  });
});

describe("callText", () => {
  it("shows the call with its arguments, as written", () => {
    expect(callText("addDate", ["2024-01-31", { months: 1 }])).toBe(
      'addDate("2024-01-31", { months: 1 })',
    );
    expect(
      callText("resolveLocal", [
        "2027-03-28T03:30:00",
        "Europe/Helsinki",
        { disambiguation: "reject" },
      ]),
    ).toBe(
      'resolveLocal("2027-03-28T03:30:00", "Europe/Helsinki", { disambiguation: "reject" })',
    );
  });
});

describe("valueText", () => {
  it("prints a string as itself and anything else as JSON", () => {
    expect(valueText("2024-02-29")).toBe("2024-02-29");
    expect(valueText(["a"])).toBe('["a"]');
  });
});
