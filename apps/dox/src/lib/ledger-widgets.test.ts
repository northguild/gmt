/**
 * @vitest-environment jsdom
 */
import { Temporal } from "@js-temporal/polyfill";
import { dwellTime } from "@northguild/gmt/transport/calculate";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import { DWELL_PRESETS, toEpochMs } from "./dwell-ledger";
import {
  dateText,
  hourDurationText,
  localText,
  zoneWithOffsets,
} from "./ledger-widgets";
import { FIXED_OFFSET_ZONES, TRANSPORT_ZONES } from "./transport-widgets";

describe("hourDurationText", () => {
  it("shows days, hours and minutes with a day as 24 hours", () => {
    expect(hourDurationText("PT400H")).toBe("16 d 16 h");
    expect(hourDurationText("PT139H30M")).toBe("5 d 19 h 30 min");
    expect(hourDurationText("PT0S")).toBe("0 h");
    expect(hourDurationText("PT2H")).toBe("2 h");
    expect(hourDurationText("PT24H")).toBe("1 d");
    expect(hourDurationText("PT30M")).toBe("30 min");
    expect(hourDurationText("PT0H")).toBe("0 h");
  });

  it("returns an empty string for text that is not such a duration", () => {
    for (const bad of [
      "",
      "PT",
      "P1D",
      "P1DT2H",
      "-PT2H",
      "PT1H30S",
      "PT0.5H",
      "2 hours",
      "pt2h",
      "PT2H ",
    ]) {
      expect(hourDurationText(bad), bad).toBe("");
    }
  });

  it("reads zero seconds, which carry no time", () => {
    expect(hourDurationText("PT1H0S")).toBe("1 h");
  });

  it("agrees with the library for every duration the Dwell Ledger presets produce", () => {
    for (const p of DWELL_PRESETS) {
      const zone = p.zone === "" ? undefined : p.zone;
      const result = dwellTime(p.entry, p.exit, zone);
      if (result === null) continue;
      const text = hourDurationText(result.duration);
      expect(text, `${p.id} ${result.duration}`).not.toBe("");
      // The text and the library's own hour count say the same thing.
      const hours = Number(
        diffUtcAsDuration(
          Temporal.Instant.fromEpochMilliseconds(toEpochMs(p.entry)).toString(),
          Temporal.Instant.fromEpochMilliseconds(toEpochMs(p.exit)).toString(),
          "hours",
        ).match(/(\d+)H/)?.[1] ?? 0,
      );
      const days = Number(/(\d+) d/.exec(text)?.[1] ?? 0);
      const rest = Number(/(\d+) h/.exec(text)?.[1] ?? 0);
      expect(days * 24 + rest, p.id).toBe(hours);
    }
  });
});

describe("dateText", () => {
  it("writes a date with its weekday", () => {
    expect(dateText("2024-06-15")).toBe("Sat 15 Jun 2024");
    expect(dateText("2011-12-31")).toBe("Sat 31 Dec 2011");
  });

  it("returns an empty string for anything but a real YYYY-MM-DD date", () => {
    for (const bad of [
      "",
      "2024-02-30",
      "2024-6-15",
      "2024-06-15T10:00:00",
      "15 Jun 2024",
    ]) {
      expect(dateText(bad), bad).toBe("");
    }
  });
});

describe("localText", () => {
  it("writes an instant on a zone's clock", () => {
    expect(localText("2024-06-14T07:00:00Z", "Asia/Shanghai")).toBe(
      "Fri 14 Jun 15:00",
    );
    expect(localText("2024-06-14T07:00:00Z", "America/New_York")).toBe(
      "Fri 14 Jun 03:00",
    );
  });

  it("reads an offset and a bracketed instant, and an offset as the zone", () => {
    expect(localText("2024-06-14T15:00:00+08:00", "UTC")).toBe(
      "Fri 14 Jun 07:00",
    );
    expect(
      localText("2024-06-10T08:00:00+08:00[Asia/Shanghai]", "+02:00"),
    ).toBe("Mon 10 Jun 02:00");
  });

  it("returns an empty string when the zone or the instant cannot be read", () => {
    expect(localText("2024-06-14T07:00:00Z", "Mars/Olympus")).toBe("");
    expect(localText("2024-06-14T07:00:00Z", "")).toBe("");
    expect(localText("not an instant", "UTC")).toBe("");
    expect(localText("2024-06-14T07:00:00", "UTC")).toBe("");
  });
});

describe("zoneWithOffsets", () => {
  it("holds the transport zones, +08:00 and the fixed offsets, each once", () => {
    expect(new Set(zoneWithOffsets).size).toBe(zoneWithOffsets.length);
    for (const zone of [...TRANSPORT_ZONES, "+08:00", ...FIXED_OFFSET_ZONES]) {
      expect(zoneWithOffsets).toContain(zone);
    }
  });

  it("puts +08:00 after the named zones and before the other offsets", () => {
    const at = zoneWithOffsets.indexOf("+08:00");
    expect(at).toBe(TRANSPORT_ZONES.length);
    expect(zoneWithOffsets.slice(at + 1)).toEqual([...FIXED_OFFSET_ZONES]);
  });
});
