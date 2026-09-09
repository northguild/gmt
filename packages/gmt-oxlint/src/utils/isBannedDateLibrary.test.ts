import {
  BANNED_DATE_LIBRARIES,
  isBannedDateLibrary,
} from "./isBannedDateLibrary";

describe("isBannedDateLibrary", () => {
  it.each([...BANNED_DATE_LIBRARIES])("returns true for %s", (lib) => {
    expect(isBannedDateLibrary(lib)).toBe(true);
  });

  it("returns true for a subpath of a banned library", () => {
    expect(isBannedDateLibrary("date-fns/format")).toBe(true);
    expect(isBannedDateLibrary("luxon/src/datetime")).toBe(true);
  });

  it("returns false for a relative path that merely contains a banned name", () => {
    expect(isBannedDateLibrary("./my-moment-helper")).toBe(false);
    expect(isBannedDateLibrary("../luxon-adapter")).toBe(false);
  });

  it("returns false for a package that merely starts with a banned name", () => {
    expect(isBannedDateLibrary("momentjs")).toBe(false);
    expect(isBannedDateLibrary("date-fns-extra")).toBe(false);
  });

  // js-joda has its own value types and touches Date only at the boundary, so
  // it is deliberately allowed. Asserted so an over-eager future edit trips.
  it("returns false for @js-joda/core", () => {
    expect(isBannedDateLibrary("@js-joda/core")).toBe(false);
    expect(isBannedDateLibrary("@js-joda/timezone")).toBe(false);
  });

  it("returns false for @northguild/gmt", () => {
    expect(isBannedDateLibrary("@northguild/gmt")).toBe(false);
  });

  it("returns false for non-string specifiers", () => {
    expect(isBannedDateLibrary(undefined)).toBe(false);
    expect(isBannedDateLibrary(null)).toBe(false);
    expect(isBannedDateLibrary(42)).toBe(false);
  });
});
