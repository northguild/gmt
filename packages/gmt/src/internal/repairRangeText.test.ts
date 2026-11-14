import { repairRangeText } from "./repairRangeText";

/**
 * The D16 text repair (CORE-112 slice 3a): an engine cuts a requested `timeZoneName` width in a
 * range (ICU-20548) and keeps the `short` one, so the range text of a `short` carrier formatter has
 * each endpoint's short name in it, and GMT writes the requested name over it.
 *
 * Expected values follow the rule in the spec: a name printed for one endpoint only is that
 * endpoint's; when both endpoints print the same name, an interval pattern writes the start's
 * fields before the end's (UTS #35 Part 4 §2.6), so the first hit is the start's and the second the
 * end's; one hit is a shared part and takes the start's. The carrier strings are the text V8 returns
 * for en-GB Europe/London (recorded: `28/03/2026, 12:00 GMT – 30/03/2026, 13:00 BST`).
 */
describe("repairRangeText", () => {
  it("writes each requested name on its own endpoint when the carrier names differ", () => {
    expect(
      repairRangeText(
        "28/03/2026, 12:00 GMT – 30/03/2026, 13:00 BST",
        ["GMT", "BST"],
        ["Greenwich Mean Time", "British Summer Time"],
      ),
    ).toBe(
      "28/03/2026, 12:00 Greenwich Mean Time – 30/03/2026, 13:00 British Summer Time",
    );
  });

  it("writes the start's name on the first hit and the end's on the second when both print one name", () => {
    expect(
      repairRangeText(
        "15/01/2026, 12:00 GMT – 18/01/2026, 13:00 GMT",
        ["GMT", "GMT"],
        ["GMT+00:00", "GMT+00:00"],
      ),
    ).toBe("15/01/2026, 12:00 GMT+00:00 – 18/01/2026, 13:00 GMT+00:00");
  });

  it("writes the start's and the end's own name on two hits of one carrier name", () => {
    expect(
      repairRangeText(
        "10:00 EST – 11:00 EST",
        ["EST", "EST"],
        ["start-name", "end-name"],
      ),
    ).toBe("10:00 start-name – 11:00 end-name");
  });

  it("writes the start's name on a single shared hit", () => {
    expect(
      repairRangeText(
        "12:00–13:00 GMT",
        ["GMT", "GMT"],
        ["Greenwich Mean Time", "Greenwich Mean Time"],
      ),
    ).toBe("12:00–13:00 Greenwich Mean Time");
  });

  it("returns null when one carrier name has no hit", () => {
    expect(
      repairRangeText(
        "12:00–13:00",
        ["GMT", "GMT"],
        ["Greenwich Mean Time", "x"],
      ),
    ).toBeNull();
  });

  it("returns null when one carrier name has three hits", () => {
    expect(
      repairRangeText("GMT 12:00 GMT – 13:00 GMT", ["GMT", "GMT"], ["a", "b"]),
    ).toBeNull();
  });

  it("matches the longer name first when one carrier name contains the other", () => {
    expect(
      repairRangeText(
        "10:00 GMT – 11:00 GMT+1",
        ["GMT", "GMT+1"],
        ["Greenwich Mean Time", "Central European Time"],
      ),
    ).toBe("10:00 Greenwich Mean Time – 11:00 Central European Time");
  });

  it("matches the longer name first when it is the start's", () => {
    expect(
      repairRangeText(
        "10:00 GMT+1 – 11:00 GMT",
        ["GMT+1", "GMT"],
        ["Central European Time", "Greenwich Mean Time"],
      ),
    ).toBe("10:00 Central European Time – 11:00 Greenwich Mean Time");
  });

  it("returns null when the start's carrier name is undefined", () => {
    expect(
      repairRangeText("10:00 – 11:00 GMT", [undefined, "GMT"], ["a", "b"]),
    ).toBeNull();
  });

  it("returns null when the end's carrier name is undefined", () => {
    expect(
      repairRangeText("10:00 GMT – 11:00", ["GMT", undefined], ["a", "b"]),
    ).toBeNull();
  });

  it("leaves the text outside every hit untouched", () => {
    expect(repairRangeText("a GMT b BST c", ["GMT", "BST"], ["X", "Y"])).toBe(
      "a X b Y c",
    );
  });

  it("returns null when a requested name is undefined for a hit", () => {
    expect(
      repairRangeText(
        "10:00 GMT – 11:00 BST",
        ["GMT", "BST"],
        [undefined, "Y"],
      ),
    ).toBeNull();
  });
});
