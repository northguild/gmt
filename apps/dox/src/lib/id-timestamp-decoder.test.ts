import { describe, expect, it, vi } from "vitest";
import type { IdentifierLib } from "./identifier-lib";
import {
  BAD_LAYOUT_TEXT,
  CUSTOM_PRESET_ID,
  ID_PRESETS,
  NO_LAYOUT_TEXT,
  heroOf,
  isSeeded,
  layoutOf,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readIds,
  type IdDecoderState,
} from "./id-timestamp-decoder";

function fakeLib(): IdentifierLib {
  return {
    fromUuidTimestamp: vi.fn(() => ""),
    fromUlid: vi.fn(() => ""),
    fromObjectId: vi.fn(() => ""),
    fromKsuid: vi.fn(() => ""),
    fromSnowflake: vi.fn(() => ""),
  } as never;
}

/** The same fake, viewed as its mocks. */
const mocks = (lib: IdentifierLib) =>
  lib as unknown as Record<string, ReturnType<typeof vi.fn>>;

const state = (over: Partial<IdDecoderState> = {}): IdDecoderState => ({
  id: "x",
  epochMs: "",
  shift: "",
  timestampBits: "",
  ...over,
});

describe("readIds", () => {
  it("passes the id to every decoder exactly as typed", () => {
    const lib = fakeLib();
    readIds(lib, state({ id: "  AbC  ", epochMs: "1", shift: "2" }));
    expect(lib["fromUuidTimestamp"]).toHaveBeenCalledWith("  AbC  ");
    expect(lib["fromUlid"]).toHaveBeenCalledWith("  AbC  ");
    expect(lib["fromObjectId"]).toHaveBeenCalledWith("  AbC  ");
    expect(lib["fromKsuid"]).toHaveBeenCalledWith("  AbC  ");
    expect(lib["fromSnowflake"]).toHaveBeenCalledWith("  AbC  ", {
      epochMs: 1,
      shift: 2,
    });
  });

  it("makes no Snowflake call without a layout", () => {
    const lib = fakeLib();
    const rows = readIds(lib, state());
    expect(lib["fromSnowflake"]).not.toHaveBeenCalled();
    expect(rows[4]!.call).toBeNull();
    expect(rows[4]!.result).toEqual({
      kind: "not-called",
      why: NO_LAYOUT_TEXT,
    });
  });

  it("gives the bad-layout reason for a non-numeric field", () => {
    const rows = readIds(fakeLib(), state({ epochMs: "abc", shift: "22" }));
    expect(rows[4]!.result).toEqual({
      kind: "not-called",
      why: BAD_LAYOUT_TEXT,
    });
  });

  it("adds timestampBits to the layout when given", () => {
    expect(
      layoutOf(state({ epochMs: "5", shift: "22", timestampBits: "41" })),
    ).toEqual({
      kind: "layout",
      layout: { epochMs: 5, shift: 22, timestampBits: 41 },
    });
  });
});

describe("heroOf", () => {
  it("is empty for a blank id", () => {
    expect(
      heroOf(readIds(fakeLib(), state({ id: "" })), state({ id: "" })).kind,
    ).toBe("empty");
  });

  it("is none when every decoder returned its sentinel", () => {
    const s = state();
    expect(heroOf(readIds(fakeLib(), s), s).kind).toBe("none");
  });

  it("is one, with a version, for a UUID read", () => {
    const lib = fakeLib();
    mocks(lib)["fromUuidTimestamp"]!.mockReturnValue("2022-02-22T19:22:22Z");
    const s = state({ id: "017f22e2-79b0-7cc3-98c4-dc0c0c07398f" });
    expect(heroOf(readIds(lib, s), s)).toEqual({
      kind: "one",
      format: "UUID",
      instant: "2022-02-22T19:22:22Z",
      version: 7,
    });
  });

  it("is many when two decoders read", () => {
    const lib = fakeLib();
    mocks(lib)["fromUlid"]!.mockReturnValue("2020-01-01T00:00:00Z");
    mocks(lib)["fromKsuid"]!.mockReturnValue("2020-01-01T00:00:00Z");
    const s = state();
    expect(heroOf(readIds(lib, s), s)).toMatchObject({
      kind: "many",
      count: 2,
    });
  });
});

describe("presets and permalinks", () => {
  it("has the default first and each preset matches itself", () => {
    expect(ID_PRESETS[0]!.id).toBe("uuid-v7");
    for (const p of ID_PRESETS) expect(matchPreset(presetState(p))).toBe(p.id);
  });

  it("matches typed values to Your values", () => {
    expect(matchPreset(state({ id: "nope" }))).toBe(CUSTOM_PRESET_ID);
  });

  it("round trips through the permalink", () => {
    for (const p of ID_PRESETS) {
      const link = permalinkOf(presetState(p));
      expect(link).toEqual({ preset: p.id });
      expect(readArgs(link)).toEqual(presetState(p));
    }
    const custom = state({ id: "zz", epochMs: "1", shift: "2" });
    expect(readArgs(permalinkOf(custom))).toEqual(custom);
  });

  it("treats an empty args object as unseeded", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ id: "a" })).toBe(true);
    expect(isSeeded({ id: "" })).toBe(true);
  });
});

describe("a blank id in a link", () => {
  it("comes back blank, not as the default preset", () => {
    const blank = state({ id: "" });
    const link = permalinkOf(blank);
    expect(link["id"]).toBe("");
    expect(readArgs(link).id).toBe("");
  });
});
