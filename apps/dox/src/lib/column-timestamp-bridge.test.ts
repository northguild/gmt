import {
  bigintOf,
  bytesOf,
  matchPreset,
  numberOf,
  permalinkOf,
  presetState,
  readArgs,
  readBridge,
} from "./column-timestamp-bridge";
import { showColumnTimestampBridgeInput } from "./dox-tools";
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

  it("uses the instant pair for a zone and the wall-time pair without one", () => {
    const zoned = readBridge(
      nullLib(),
      stateOf({ value: "2024-03-10T09:00:00Z", zone: "UTC", unit: "second" }),
    );
    const plain = readBridge(
      nullLib(),
      stateOf({ value: "2024-03-10T09:00:00", unit: "second" }),
    );
    const names = (r: ReturnType<typeof readBridge>) =>
      r.calls.map((c) => c.fn);
    expect(names(zoned)).toContain("toArrowTimestamp");
    expect(names(zoned)).not.toContain("toArrowLocalTimestamp");
    expect(names(plain)).toContain("toArrowLocalTimestamp");
    expect(names(plain)).not.toContain("toArrowTimestamp");
  });
});

describe("readArgs inference", () => {
  it("opens decode when a stored value comes without a mode", () => {
    expect(readArgs({ int64: "-1" }).mode).toBe("decode");
    expect(readArgs({ julianDay: "2440588", nanosOfDay: "0" }).mode).toBe(
      "decode",
    );
  });

  it("keeps encode when a value is given with no stored value", () => {
    expect(readArgs({ value: "2024-01-01T00:00:00Z" }).mode).toBe("encode");
  });

  it("reads bytes as the bytes form without int96Form", () => {
    const s = readArgs({ bytes: "00".repeat(12) });
    expect(s.mode).toBe("decode");
    expect(s.int96Form).toBe("bytes");
  });

  it("refuses an int96Form outside the enum", () => {
    expect(
      showColumnTimestampBridgeInput.safeParse({
        bytes: "00".repeat(12),
        int96Form: "xyz",
      }).success,
    ).toBe(false);
    expect(
      showColumnTimestampBridgeInput.safeParse({
        bytes: "00".repeat(12),
        int96Form: "bytes",
      }).success,
    ).toBe(true);
  });

  it("refuses a contradiction instead of dropping a field", () => {
    expect(
      showColumnTimestampBridgeInput.safeParse({ mode: "encode", int64: "0" })
        .success,
    ).toBe(false);
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
    fromArrowTimestamp: sentinel(""),
    toArrowLocalTimestamp: sentinel(0n),
    fromArrowLocalTimestamp: sentinel(""),
    isValidInt64NanosecondInstant: sentinel(true),
    isValidInt64NanosecondDateTime: sentinel(true),
    isValidTimeZone: sentinel(true),
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
