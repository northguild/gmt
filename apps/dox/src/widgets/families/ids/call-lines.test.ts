import type { EdiCall } from "~/lib/edi-widgets";
import { callLines, outputOf } from "./call-lines";

const call = (fn: string, args: unknown[], result: unknown): EdiCall =>
  ({ fn, args, result }) as EdiCall;

describe("callLines", () => {
  it("prints each call on its own line, in code and in plain text", () => {
    const { code, plain } = callLines([
      call("fromUlid", ["01ARZ"], "2016-07-30T23:54:10.259Z"),
      call("fromKsuid", ["x"], ""),
    ]);
    expect(plain).toBe('fromUlid("01ARZ")\nfromKsuid("x")');
    expect(code.toString()).toContain("fromUlid");
  });
});

describe("outputOf", () => {
  const read = call("fromUlid", ["a"], "2016-07-30T23:54:10.259Z");
  const refusedCall = call("fromKsuid", ["a"], "");

  it("is empty when nothing was asked", () => {
    expect(outputOf("empty", [])).toEqual({ state: "empty", lines: [] });
  });

  it("lists every result when the reading was fine", () => {
    const out = outputOf("ok", [read]);
    expect(out.state).toBe("live");
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]?.lost).toBe(false);
  });

  it("marks only the refused calls when some read", () => {
    const out = outputOf("sentinel", [read, refusedCall]);
    expect(out.state).toBe("live");
    expect(out.lines.map((l) => l.lost)).toEqual([false, true]);
  });

  it("is lost when every call was refused", () => {
    const out = outputOf("sentinel", [refusedCall, refusedCall]);
    expect(out.state).toBe("sentinel");
    expect(out.lines.every((l) => l.lost)).toBe(true);
  });

  it("is one NO SIGNAL line when no call was refused but the reading failed", () => {
    const out = outputOf("sentinel", [read]);
    expect(out.state).toBe("sentinel");
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]?.lost).toBe(true);
  });
});
