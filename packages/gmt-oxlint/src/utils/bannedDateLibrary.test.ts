import {
  BANNED_DATE_LIBRARIES,
  bannedDateLibraryOf,
} from "./bannedDateLibrary";

describe("bannedDateLibraryOf", () => {
  it.each([...BANNED_DATE_LIBRARIES])("returns %s for itself", (lib) => {
    expect(bannedDateLibraryOf(lib)).toBe(lib);
  });

  it.each`
    specifier                         | lib
    ${"date-fns/format"}              | ${"date-fns"}
    ${"luxon/src/datetime"}           | ${"luxon"}
    ${"date-fns-tz/formatInTimeZone"} | ${"date-fns-tz"}
    ${"@date-fns/tz/date"}            | ${"@date-fns/tz"}
    ${"moment-timezone/builds"}       | ${"moment-timezone"}
  `("returns $lib for the subpath $specifier", ({ specifier, lib }) => {
    expect(bannedDateLibraryOf(specifier)).toBe(lib);
  });

  it("returns undefined for a relative path that merely contains a banned name", () => {
    expect(bannedDateLibraryOf("./my-moment-helper")).toBeUndefined();
    expect(bannedDateLibraryOf("../luxon-adapter")).toBeUndefined();
  });

  it("returns undefined for a package that merely starts with a banned name", () => {
    expect(bannedDateLibraryOf("momentjs")).toBeUndefined();
    expect(bannedDateLibraryOf("date-fns-extra")).toBeUndefined();
  });

  // js-joda has its own value types and touches Date only at the boundary, so
  // it is deliberately allowed. Asserted so an over-eager future edit trips.
  it("returns undefined for @js-joda/core", () => {
    expect(bannedDateLibraryOf("@js-joda/core")).toBeUndefined();
    expect(bannedDateLibraryOf("@js-joda/timezone")).toBeUndefined();
  });

  it("returns undefined for @northguild/gmt", () => {
    expect(bannedDateLibraryOf("@northguild/gmt")).toBeUndefined();
  });

  it("returns undefined for non-string specifiers", () => {
    expect(bannedDateLibraryOf(undefined)).toBeUndefined();
    expect(bannedDateLibraryOf(null)).toBeUndefined();
    expect(bannedDateLibraryOf(42)).toBeUndefined();
  });
});
