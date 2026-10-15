/**
 * The loaders of the ledger family's libraries: each is one `Promise.all` over
 * `GMT_MODULES` keys, hands back exactly its members, loads no module it does
 * not use, and rejects when any import fails.
 */
import { epcisLib } from "~/test/edi-lib";
import { blDateLib, demurrageLib, journeyLib } from "~/test/ledger-lib";
import { loadEdiLib, loadEpcisLib } from "./edi-lib";
import { GMT_MODULES } from "./gmt-modules";
import { loadBlDateLib, loadDemurrageLib } from "./ledger-lib";
import { loadJourneyLib, loadTransportLib } from "./transport-lib";

const originals = { ...GMT_MODULES };

afterEach(() => {
  Object.assign(GMT_MODULES, originals);
});

/** Counts which `GMT_MODULES` keys a loader reaches. */
function spyOnModules(): string[] {
  const seen: string[] = [];
  for (const key of Object.keys(GMT_MODULES)) {
    const real = originals[key]!;
    GMT_MODULES[key] = () => {
      seen.push(key);
      return real();
    };
  }
  return seen;
}

const names = (lib: object) => Object.keys(lib).sort();

describe("the ledger loaders", () => {
  it("loadBlDateLib hands back bolTimestamp, the two comparisons and the date check", async () => {
    const seen = spyOnModules();
    const lib = await loadBlDateLib();
    expect(names(lib)).toEqual(names(blDateLib));
    expect(seen.sort()).toEqual([
      "intermodal/format",
      "plain/compare",
      "plain/validate",
    ]);
    expect(
      lib.bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard", {
        timeZone: "America/New_York",
      }),
    ).toBe("2024-06-15");
    expect(lib.areDatesEqual("2024-06-15", "2024-06-15")).toBe(true);
    expect(lib.isAfterDate("2024-06-16", "2024-06-15")).toBe(true);
    expect(lib.isValidDate("2024-06-15")).toBe(true);
  });

  it("loadDemurrageLib hands back demurrageClock and the calls that measure its strings", async () => {
    const seen = spyOnModules();
    const lib = await loadDemurrageLib();
    expect(names(lib)).toEqual(names(demurrageLib));
    expect(seen.sort()).toEqual([
      "instant/convert",
      "intermodal/calculate",
      "precision/validate",
      "utc/calculate",
    ]);
    expect(
      lib.demurrageClock(
        [
          { type: "discharged", at: "2024-06-14T19:00:00Z" },
          { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
        ],
        "demurrage",
        { direction: "import" },
      ),
    ).toEqual({ start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" });
    expect(lib.isValidInstant("2024-06-14T19:00:00Z")).toBe(true);
    expect(
      lib.diffUtcAsDuration(
        "2024-06-14T19:00:00Z",
        "2024-06-20T14:30:00Z",
        "hours",
      ),
    ).toBe("PT139H30M");
  });

  it("loadJourneyLib is the transport library plus multimodalETA and diffUtcAsDuration", async () => {
    const transport = await loadTransportLib();
    const lib = await loadJourneyLib();
    expect(names(lib)).toEqual(names(journeyLib));
    expect(names(lib)).toEqual(
      [...names(transport), "diffUtcAsDuration", "multimodalETA"].sort(),
    );
  });

  it("loadJourneyLib reaches only the transport modules and the two it adds", async () => {
    const seen = spyOnModules();
    await loadJourneyLib();
    expect(new Set(seen)).toEqual(
      new Set([
        "transport/calculate",
        "transport/convert",
        "zoned/validate",
        "plain/validate",
        "instant/convert",
        "intermodal/calculate",
        "utc/calculate",
      ]),
    );
  });

  it("loadEpcisLib hands back the parser, the formatter, the validators and the date calls", async () => {
    const seen = spyOnModules();
    const lib = await loadEpcisLib();
    expect(names(lib)).toEqual(names(epcisLib));
    expect(seen.sort()).toEqual([
      "intermodal/format",
      "intermodal/parse",
      "intermodal/validate",
      "plain/chop",
      "plain/compare",
      "utc/convert",
    ]);
    expect(
      lib.parseEpcisEvent({
        eventTime: "2024-06-15T23:30:00Z",
        eventTimeZoneOffset: "+02:00",
      }),
    ).toEqual({
      instant: "2024-06-15T23:30:00Z",
      offset: "+02:00",
      local: "2024-06-16T01:30:00",
    });
  });

  it("leaves the existing loaders unchanged: loadEdiLib still loads five modules", async () => {
    const seen = spyOnModules();
    await loadEdiLib();
    expect(seen.sort()).toEqual([
      "instant/convert",
      "intermodal/format",
      "intermodal/parse",
      "utc/calculate",
      "zoned/validate",
    ]);
  });

  it.each([
    ["loadBlDateLib", loadBlDateLib],
    ["loadDemurrageLib", loadDemurrageLib],
    ["loadJourneyLib", loadJourneyLib],
    ["loadEpcisLib", loadEpcisLib],
  ])("%s rejects when an import fails", async (_name, load) => {
    const offline = new Error("Failed to fetch dynamically imported module");
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(offline);
    }
    await expect(load()).rejects.toBe(offline);
  });
});
