/// <reference types="vitest/globals" />

import { referenceRoutes } from "~/generated/reference/route-manifest";
import {
  DEFAULT_RESET_FORMAT_ID,
  RESET_FORMATS,
  findResetFormat,
  isResetFormatId,
  liveClockFormat,
  type ResetFormatContext,
  type ResetFormatId,
} from "./reset-formats";

/** Midnight Pacific on 2026-06-16 — the instant `/api/brains` would send as
 * Gemini's reset — viewed from four hours earlier. Both are UTC ISO strings,
 * the one value type every preset takes. */
const RESETS_AT = "2026-06-16T07:00:00.000Z";
const NOW = "2026-06-16T03:00:00Z";

const ctx = (timeZone: string): ResetFormatContext => ({
  timeZone,
  locale: "en-US",
  now: NOW,
});

const render = (id: ResetFormatId, timeZone: string) =>
  findResetFormat(id).format(RESETS_AT, ctx(timeZone));

describe("RESET_FORMATS", () => {
  it("renders the calendar preset in the reader's zone", () => {
    // The same instant is tomorrow's midnight in Los Angeles and this
    // afternoon in Tokyo — the whole reason the zone picker exists.
    expect(render("calendar", "America/Los_Angeles")).toBe(
      "tomorrow at 12:00 AM",
    );
    expect(render("calendar", "Asia/Tokyo")).toBe("today at 4:00 PM");
  });

  it("names the zone in the local date-time preset", () => {
    expect(render("local", "America/Los_Angeles")).toBe(
      "6/16/2026, 12:00:00 AM PDT",
    );
    expect(render("local", "Asia/Tokyo")).toBe("6/16/2026, 4:00:00 PM GMT+9");
  });

  it("renders the three relative styles", () => {
    expect(render("relative-long", "UTC")).toBe("in 4 hours");
    expect(render("relative-short", "UTC")).toBe("in 4 hr.");
    expect(render("relative-narrow", "UTC")).toBe("in 4h");
  });

  it("carries the zone's offset and bracketed id in the ISO zoned preset", () => {
    expect(render("iso-zoned", "America/Los_Angeles")).toBe(
      "2026-06-16T00:00:00-07:00[America/Los_Angeles]",
    );
    expect(render("iso-zoned", "Asia/Tokyo")).toBe(
      "2026-06-16T16:00:00+09:00[Asia/Tokyo]",
    );
  });

  it("renders the zone-free presets", () => {
    expect(render("utc", "UTC")).toBe("6/16/2026, 7:00:00 AM UTC");
    expect(render("http", "UTC")).toBe("Tue, 16 Jun 2026 07:00:00 GMT");
    expect(render("unix-ms", "UTC")).toBe(String(Date.UTC(2026, 5, 16, 7)));
    expect(render("unix-s", "UTC")).toBe(
      String(Date.UTC(2026, 5, 16, 7) / 1000),
    );
  });

  it("gives identical output in every zone for a preset that is not zoned, and says so", () => {
    for (const preset of RESET_FORMATS) {
      const outputs = ["UTC", "Asia/Tokyo", "America/Los_Angeles"].map((zone) =>
        preset.format(RESETS_AT, ctx(zone)),
      );
      const allSame = outputs.every((output) => output === outputs[0]);
      expect({ id: preset.id, allSame }).toEqual({
        id: preset.id,
        allSame: !preset.zoned,
      });
    }
  });

  it("returns gmt's empty sentinel for an instant that is not one", () => {
    for (const preset of RESET_FORMATS) {
      expect(preset.format("not-a-date", ctx("UTC"))).toBe("");
    }
  });

  it("shows each call the way a reader would write it, on the UTC string itself", () => {
    const tokyo = ctx("Asia/Tokyo");
    expect(findResetFormat("calendar").call(tokyo)).toBe(
      'formatCalendarUtc(resetsAt, "en-US", { timeZone: "Asia/Tokyo" })',
    );
    expect(findResetFormat("relative-short").call(tokyo)).toBe(
      'formatRelativeUtc(resetsAt, "en-US", { style: "short" })',
    );
    expect(findResetFormat("iso-zoned").call(tokyo)).toBe(
      'convertUtcToZoned(resetsAt, "Asia/Tokyo")',
    );
    expect(findResetFormat("unix-s").call(tokyo)).toBe(
      'convertUtcToUnix(resetsAt, "seconds")',
    );
  });

  it("names a real function, and links to a page that exists", () => {
    // A renamed function or a moved reference page must break here, not as a
    // dead link in the chat.
    const routes = new Set<string>(referenceRoutes);
    for (const preset of RESET_FORMATS) {
      expect(routes.has(preset.route)).toBe(true);
      expect(preset.route.endsWith(`/${preset.fnName}`)).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = RESET_FORMATS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findResetFormat / isResetFormatId", () => {
  it("falls back to the default preset for an unknown id", () => {
    expect(findResetFormat("medium").id).toBe(DEFAULT_RESET_FORMAT_ID);
    expect(DEFAULT_RESET_FORMAT_ID).toBe("calendar");
  });

  it("recognises only real preset ids", () => {
    expect(isResetFormatId("iso-zoned")).toBe(true);
    expect(isResetFormatId("relative-medium")).toBe(false);
    expect(isResetFormatId(42)).toBe(false);
  });
});

describe("liveClockFormat", () => {
  it("swaps every relative preset for the calendar one, since now-to-now is always 'now'", () => {
    for (const id of [
      "relative-long",
      "relative-short",
      "relative-narrow",
    ] as const) {
      expect(liveClockFormat(id).id).toBe("calendar");
    }
  });

  it("keeps every other preset as picked", () => {
    expect(liveClockFormat("iso-zoned").id).toBe("iso-zoned");
    expect(liveClockFormat("unix-ms").id).toBe("unix-ms");
  });
});
