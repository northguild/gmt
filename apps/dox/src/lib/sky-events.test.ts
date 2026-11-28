import {
  faintReason,
  groupTag,
  lookLine,
  rowNote,
  nextEdge,
  readerLocale,
  rowText,
  skyEventRows,
  type EventsKit,
  type SkyEvent,
} from "./sky-events";
import { at, kitOf } from "~/test/events-kit";

/* A small body's spell (to the day), a pass (to the minute) and a planet's, as the generator writes them. */
const VESTA: SkyEvent = {
  id: "vesta",
  rare: true,
  startMs: at("2029-07-08T12:00:00Z"),
  endMs: at("2029-08-02T12:00:00Z"),
  unit: "day",
};
const APOPHIS: SkyEvent = {
  id: "apophis",
  rare: true,
  startMs: at("2029-04-13T13:03:00Z"),
  endMs: at("2029-04-13T21:00:00Z"),
  closestMs: at("2029-04-13T17:46:00Z"),
  unit: "minute",
};
const URANUS: SkyEvent = {
  id: "uranus",
  rare: false,
  startMs: at("2033-12-11T06:00:00Z"),
  endMs: at("2034-03-01T00:00:00Z"),
  unit: "day",
};
const lines = (kit: EventsKit, now: string) =>
  skyEventRows(kit, at(now)).rows.map(rowText);

describe("the popover's rows", () => {
  const kit = kitOf([APOPHIS, VESTA, URANUS]);

  it("tell a spell ahead to the day, or to the minute for a pass, in the reader's zone", () => {
    expect(lines(kit, "2027-01-01T00:00:00Z")).toEqual([
      "Apophis · Asteroid · 13 April 2029, 15:03 – 23:00 · closest 19:46",
      "Vesta · Asteroid · 8 July – 2 August 2029",
    ]);
  });

  it("print the date once for a pass inside one day, and both for one that crosses midnight", () => {
    expect(
      lines(kitOf([APOPHIS], "Asia/Kolkata"), "2027-01-01T00:00:00Z"),
    ).toEqual([
      "Apophis · Asteroid · 13 April 2029, 18:33 – 14 April 2029, 02:30 · closest 23:16",
    ]);
  });

  it("say a spell under way is in view now, and until when", () => {
    expect(lines(kit, "2029-04-13T16:00:00Z")).toEqual([
      "Apophis · Asteroid · In view now, until 23:00 · closest 19:46",
      "Vesta · Asteroid · 8 July – 2 August 2029",
    ]);
    expect(lines(kit, "2029-07-20T00:00:00Z")).toEqual([
      "Vesta · Asteroid · In view now, until 2 August 2029",
    ]);
  });

  it("drop a spell that is over, and a planet's spell is never a row", () => {
    expect(lines(kit, "2029-08-03T00:00:00Z")).toEqual([]);
  });

  it("name the zone in the note, or when the data ends if nothing is left", () => {
    expect(skyEventRows(kit, at("2027-01-01T00:00:00Z")).note).toBe(
      "Times in your time zone (Europe/Stockholm).",
    );
    expect(
      skyEventRows(kitOf([], "Asia/Kolkata"), at("2027-01-01T00:00:00Z")).note,
    ).toBe("Nothing rare in the sky through 23 November 2036.");
    expect(skyEventRows(kit, at("2029-08-03T00:00:00Z")).note).toBe(
      "Nothing rare in the sky through 23 November 2036.",
    );
  });

  it("hand each moment on as a segment, so a time element can carry its datetime", () => {
    const [row] = skyEventRows(kit, at("2027-01-01T00:00:00Z")).rows;
    const moments = row!.segments.filter((s) => typeof s !== "string");
    expect(moments.map((m) => m.ms)).toEqual([
      APOPHIS.startMs,
      APOPHIS.endMs,
      APOPHIS.closestMs,
    ]);
  });
});

describe("the next edge", () => {
  const { data } = kitOf([APOPHIS, VESTA, URANUS]);

  it("is the next start or end of a rare spell, never a planet's", () => {
    expect(nextEdge(data, at("2027-01-01T00:00:00Z"))).toBe(APOPHIS.startMs);
    expect(nextEdge(data, APOPHIS.startMs)).toBe(APOPHIS.endMs);
    expect(nextEdge(data, APOPHIS.endMs)).toBe(VESTA.startMs);
    expect(nextEdge(data, VESTA.endMs)).toBeNull();
  });
});

describe("the reader's locale", () => {
  it("is the first English one, else en-GB", () => {
    expect(readerLocale(["sv-SE", "en-US", "en"])).toBe("en-US");
    expect(readerLocale(["sv-SE", "de"])).toBe("en-GB");
    expect(readerLocale([])).toBe("en-GB");
  });
});

describe("a Look at row's second line", () => {
  const kit = kitOf([VESTA, APOPHIS, URANUS]);
  const now = at("2027-01-01T00:00:00Z");

  it("is none for a body bright enough to draw", () => {
    expect(lookLine(kit, "venus", -4, now)).toBeNull();
    expect(lookLine(null, "venus", 5.5, now)).toBeNull();
  });

  it("gives a placed faint body its magnitude to a decimal", () => {
    expect(lookLine(kit, "uranus", 5.6, now)).toBe("Too faint · 5.6");
    expect(lookLine(null, "vesta", 7.24, now)).toBe("Too faint · 7.2");
  });

  it("gives a placed faint body no pass date, so its row stays two lines", () => {
    expect(lookLine(kit, "apophis", 20.7, now)).toBe("Too faint · 20.7");
    expect(lookLine(null, "apophis", 20.7, now)).toBe("Too faint · 20.7");
  });

  it("names the group of a body that is not a planet, and none for a planet", () => {
    expect(groupTag("vesta")).toBe("Asteroid");
    expect(groupTag("apophis")).toBe("Asteroid");
    expect(groupTag("pluto")).toBe("Dwarf planet");
    expect(groupTag("uranus")).toBeNull();
    expect(groupTag("moon")).toBeNull();
  });

  it("dates the next spell of a body with no place, a pass as a close pass", () => {
    expect(lookLine(kit, "vesta", null, now)).toBe(
      "Too faint until 8 Jul 2029",
    );
    expect(lookLine(kit, "apophis", null, now)).toBe("Close pass 13 Apr 2029");
    expect(lookLine(kit, "uranus", null, now)).toBe(
      "Too faint until 11 Dec 2033",
    );
  });

  it("says when nothing is ahead through the data's end", () => {
    expect(lookLine(kitOf([]), "vesta", null, now)).toBe(
      "Too faint through Nov 2036",
    );
    expect(lookLine(kit, "vesta", null, at("2029-08-03T00:00:00Z"))).toBe(
      "Too faint through Nov 2036",
    );
  });

  it("stops short before the data has loaded", () => {
    expect(lookLine(null, "vesta", null, now)).toBe("Too faint");
  });
});

describe("a row's note", () => {
  it("is Pluto's years as the ninth planet, and none for another body", () => {
    expect(rowNote("pluto")).toBe("The ninth planet from 1930 to 2006");
    expect(rowNote("uranus")).toBeNull();
  });
});

describe("a faint body's ring label", () => {
  const kit = kitOf([VESTA]);
  const now = at("2027-01-01T00:00:00Z");
  const first = "Too faint to draw: magnitude 7.2; the sky draws to 5.5.";

  it("gives the first sentence alone until the data has loaded", () => {
    expect(faintReason(null, "vesta", 7.24, now)).toBe(first);
  });

  it("adds when it is bright enough", () => {
    expect(faintReason(kit, "vesta", 7.24, now)).toBe(
      `${first} Bright enough from 8 Jul 2029.`,
    );
  });

  it("says a pass makes a body bright enough on its day", () => {
    expect(faintReason(kitOf([APOPHIS]), "apophis", 20.7, now)).toBe(
      "Too faint to draw: magnitude 20.7; the sky draws to 5.5. Bright enough in a close pass on 13 Apr 2029.",
    );
  });

  it("adds that nothing is ahead", () => {
    expect(faintReason(kitOf([]), "vesta", 7.24, now)).toBe(
      `${first} Not brighter before Nov 2036.`,
    );
  });

  it("stops at the first sentence while a spell is under way", () => {
    expect(faintReason(kit, "vesta", 5.6, at("2029-07-20T00:00:00Z"))).toBe(
      "Too faint to draw: magnitude 5.6; the sky draws to 5.5.",
    );
  });
});
