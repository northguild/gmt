import { convertZonedToUnix } from "@northguild/gmt/zoned/convert";
import {
  MOROCCO_CHANGES,
  MOROCCO_EXPECTED,
  MOROCCO_PROBE,
  MOROCCO_STORED_ZONES,
  MOROCCO_ZONES,
} from "./morocco-clock-change";

/* Epoch milliseconds of a UTC instant, through gmt: this repo bans `Date.parse`, tests included. */
const at = (iso: string): number => {
  const ms = convertZonedToUnix(`${iso.replace("Z", "")}+00:00[UTC]`);
  if (ms === null) throw new Error(`unparseable fixture instant: ${iso}`);
  return ms;
};

describe("Morocco checker facts", () => {
  it("states each probe instant's epoch milliseconds correctly", () => {
    for (const { iso, epochMs } of MOROCCO_PROBE) {
      expect(epochMs).toBe(at(iso));
    }
  });

  it("has one verdict instant and one blind instant, in that order", () => {
    expect(MOROCCO_PROBE.map((p) => p.role)).toEqual(["verdict", "blind"]);
  });

  it("states the verdict instant as Canada's and the blind one inside the old Ramadan window", () => {
    expect(MOROCCO_PROBE[0]!.iso).toBe("2026-11-02T12:00:00Z");
    const blind = at(MOROCCO_PROBE[1]!.iso);
    expect(blind).toBeGreaterThan(at("2027-02-07T02:00:00Z"));
    expect(blind).toBeLessThan(at("2027-03-14T02:00:00Z"));
    expect(MOROCCO_EXPECTED).toBe("+00:00");
  });

  it("states three changes, each ending at the offset it starts the next one from", () => {
    expect(MOROCCO_CHANGES.map((c) => c.recordedBy)).toEqual([
      "2026c",
      "2026b",
      "2026b",
    ]);
    const instants = MOROCCO_CHANGES.map((c) => c.at);
    expect(instants).toEqual([...instants].sort());
    expect(MOROCCO_CHANGES[1]!.to).toBe(MOROCCO_CHANGES[2]!.from);
  });

  it("offers the two Moroccan zones in the picker", () => {
    expect(MOROCCO_STORED_ZONES).toEqual(MOROCCO_ZONES);
  });
});
