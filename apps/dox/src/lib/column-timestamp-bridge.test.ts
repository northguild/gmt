import {
  arrowOptions,
  bigintOf,
  bytesOf,
  matchPreset,
  numberOf,
  permalinkOf,
  presetState,
  readArgs,
  readBridge,
} from "./column-timestamp-bridge";
import type { ColumnBridgeLib } from "./column-bridge-lib";
import { BRIDGE_PRESETS, stateOf } from "./column-timestamp-bridge-presets";

describe("grammar", () => {
  it("reads whole numbers only, and never -0", () => {
    expect(numberOf("12")).toBe(12);
    expect(numberOf("-5")).toBe(-5);
    expect(Object.is(numberOf("-0"), 0)).toBe(true);
    for (const bad of ["", "1.5", "1e3", " 1", "0x1", "123456789012"]) {
      expect(numberOf(bad), bad).toBeNull();
    }
  });

  it("reads an int64 as a bigint, past the safe integer range", () => {
    expect(bigintOf("9223372036854775807")).toBe(9223372036854775807n);
    expect(bigintOf("-1")).toBe(-1n);
    expect(bigintOf("1.5")).toBeNull();
    expect(bigintOf("")).toBeNull();
  });

  it("reads 24 hex digits into 12 bytes in typed order", () => {
    const b = bytesOf("000102030405060708090a0b");
    expect(b).toBeInstanceOf(Uint8Array);
    expect([...b!]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(bytesOf("00")).toBeNull();
    expect(bytesOf("zz0102030405060708090a0b")).toBeNull();
  });

  it("leaves timeZone out when the zone is blank", () => {
    expect(arrowOptions(stateOf({ unit: "second" }))).not.toHaveProperty(
      "timeZone",
    );
    expect(
      arrowOptions(stateOf({ unit: "second", zone: "UTC" })),
    ).toHaveProperty("timeZone", "UTC");
  });
});

describe("presets and permalinks", () => {
  it("round trips every preset as the preset alone", () => {
    for (const p of BRIDGE_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(permalinkOf(presetState(p))).toEqual({ preset: p.id });
      expect(readArgs({ preset: p.id })).toEqual(presetState(p));
    }
  });

  it("overlays named keys on a preset", () => {
    const s = readArgs({ preset: "tokyo-seconds", unit: "nanosecond" });
    expect(s.unit).toBe("nanosecond");
    expect(s.value).toBe(presetState(BRIDGE_PRESETS[0]!).value);
    expect(permalinkOf(s)).not.toHaveProperty("preset");
  });
});

/** A library whose every function returns the sentinel, to check the pure layer alone. */
function nullLib(): ColumnBridgeLib {
  const sentinel = (v: unknown) => vi.fn(() => v) as ReturnType<typeof vi.fn>;
  return {
    toNanoseconds: sentinel(0n),
    fromNanoseconds: sentinel(""),
    toParquetInt96: sentinel(null),
    fromParquetInt96: sentinel(""),
    toArrowTimestamp: sentinel(0n),
    fromArrowTimestamp: sentinel(null),
    toProtoTimestamp: sentinel(null),
    fromProtoTimestamp: sentinel(""),
    toProtoDuration: sentinel(null),
    fromProtoDuration: sentinel(""),
    isValidInstant: sentinel(false),
    isValidDateTime: sentinel(false),
  } as unknown as ColumnBridgeLib;
}

describe("readBridge", () => {
  it("makes no conversion call when nothing is typed", () => {
    const lib = nullLib();
    const r = readBridge(lib, stateOf({}));
    expect(r.calls).toEqual([]);
    expect(r.failed).toBe(false);
  });

  it("does not convert an input the validator refuses", () => {
    const lib = nullLib();
    const r = readBridge(lib, stateOf({ value: "nope", zone: "UTC" }));
    expect(lib.toNanoseconds).not.toHaveBeenCalled();
    expect(r.failed).toBe(true);
    expect(r.hero?.kind).toBe("not-instant");
  });

  it("calls each library function once per reading", () => {
    const lib = nullLib();
    const r = readBridge(lib, stateOf({ value: "nope", zone: "UTC" }));
    const names = r.calls.map((c) => c.fn);
    expect(new Set(names).size).toBe(names.length);
  });
});
