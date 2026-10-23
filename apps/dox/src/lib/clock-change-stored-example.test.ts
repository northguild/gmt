import { describe, expect, it } from "vitest";
import { savedExample } from "./clock-change-stored";

describe("savedExample", () => {
  it("states the saved value, the shifted time and the fix from one fact and one wall time", () => {
    expect(
      savedExample(
        { zone: "America/Vancouver", offset: "-07:00", savedShiftMinutes: -60 },
        "2026-11-15T09:00:00",
      ),
    ).toEqual({
      zone: "America/Vancouver",
      city: "Vancouver",
      wallHm: "09:00",
      dateText: "15 Nov",
      savedOffset: "-08:00",
      newOffset: "-07:00",
      shownHm: "10:00",
      shownDate: "2026-11-15",
      saved: "2026-11-15T09:00:00-08:00[America/Vancouver]",
      fixed: "2026-11-15T09:00:00-07:00[America/Vancouver]",
    });
  });

  it("moves the other way when the old offset was the later one", () => {
    const example = savedExample(
      { zone: "Africa/Casablanca", offset: "+00:00", savedShiftMinutes: 60 },
      "2026-11-16T09:00:00",
    );
    expect(example.savedOffset).toBe("+01:00");
    expect(example.shownHm).toBe("08:00");
    expect(example.saved).toBe("2026-11-16T09:00:00+01:00[Africa/Casablanca]");
  });

  it("wraps past midnight: 23:30 shifted an hour is 00:30 on the next date", () => {
    const example = savedExample(
      { zone: "America/Vancouver", offset: "-07:00", savedShiftMinutes: -60 },
      "2026-12-31T23:30:00",
    );
    expect(example.shownHm).toBe("00:30");
    expect(example.shownDate).toBe("2027-01-01");
    expect(example.wallHm).toBe("23:30");
    expect(example.dateText).toBe("31 Dec");
  });

  it("wraps before midnight: 00:30 shifted back an hour is 23:30 on the date before", () => {
    const example = savedExample(
      { zone: "Africa/Casablanca", offset: "+00:00", savedShiftMinutes: 60 },
      "2026-03-01T00:30:00",
    );
    expect(example.shownHm).toBe("23:30");
    expect(example.shownDate).toBe("2026-02-28");
  });
});
