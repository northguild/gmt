/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { convertZonedToUnix } from "@northguild/gmt/zoned/convert";
import { subsolarPoint } from "./globe/sun";
import {
  skyAt,
  skyFilterLabel,
  skyLabel,
  skyStateFor,
  solarElevation,
} from "./zone-sky";

/* Epoch milliseconds for a UTC instant, through gmt rather than `Date.parse`,
   which this repo bans everywhere including its own tests. `subsolarPoint`
   takes a plain number, so this is the one conversion the fixtures need. */
const at = (iso: string): number => {
  const ms = convertZonedToUnix(`${iso.replace("Z", "")}+00:00[UTC]`);
  // Sentinel, not an exception, so a mistyped fixture has to be caught here.
  if (ms === null) throw new Error(`unparseable fixture instant: ${iso}`);
  return ms;
};

describe("solarElevation", () => {
  it("puts the sun overhead at the subsolar point", () => {
    const ms = at("2026-06-21T12:00:00Z");
    const sun = subsolarPoint(ms);
    expect(solarElevation(sun.lat, sun.lng, sun)).toBeCloseTo(90, 5);
  });

  it("puts it underfoot at the antipode", () => {
    const ms = at("2026-06-21T12:00:00Z");
    const sun = subsolarPoint(ms);
    expect(solarElevation(-sun.lat, sun.lng + 180, sun)).toBeCloseTo(-90, 5);
  });

  it("is on the horizon a quarter turn away", () => {
    const sun = { lat: 0, lng: 0 };
    expect(solarElevation(0, 90, sun)).toBeCloseTo(0, 6);
    expect(solarElevation(90, 0, sun)).toBeCloseTo(0, 6);
  });
});

describe("skyStateFor", () => {
  it("splits at the conventional horizon, not at zero", () => {
    /* Sunrise is the upper limb touching the horizon: refraction and the sun's
       radius put that at -0.833 degrees of geometric elevation. */
    expect(skyStateFor(0.5)).toBe("day");
    expect(skyStateFor(-0.5)).toBe("day");
    expect(skyStateFor(-1)).toBe("twilight");
  });

  it("ends twilight where the globe ends its night wash", () => {
    expect(skyStateFor(-17.9)).toBe("twilight");
    expect(skyStateFor(-18.1)).toBe("night");
  });
});

describe("skyAt", () => {
  it("gives Tromso a midnight sun in June and none in December", () => {
    // 69.65N is inside the Arctic Circle, so both are months-long, not daily.
    expect(skyAt(69.65, 18.96, at("2026-06-21T00:00:00Z"))).toBe("day");
    expect(skyAt(69.65, 18.96, at("2026-06-21T12:00:00Z"))).toBe("day");
    expect(skyAt(69.65, 18.96, at("2026-12-21T00:00:00Z"))).toBe("night");
  });

  it("gives Antarctica polar night in June", () => {
    expect(skyAt(-77.85, 166.67, at("2026-06-21T12:00:00Z"))).toBe("night");
  });

  it("tracks a London equinox day", () => {
    /* Sunrise in London on 2026-03-20 is a little after 06:00 UTC and sunset a
       little after 18:00, which is what an equinox means. */
    const london = (t: string) => skyAt(51.5, -0.13, at(`2026-03-20T${t}:00Z`));
    expect(london("05:00")).toBe("twilight");
    expect(london("07:00")).toBe("day");
    expect(london("12:00")).toBe("day");
    expect(london("17:00")).toBe("day");
    expect(london("19:00")).toBe("twilight");
    expect(london("23:00")).toBe("night");
  });

  it("has the equator near enough twelve hours of daylight at the equinox", () => {
    const equator = (t: string) => skyAt(0, 0, at(`2026-03-20T${t}:00:00Z`));
    expect(equator("12")).toBe("day");
    expect(equator("00")).toBe("night");
  });
});

describe("labels", () => {
  it("words each band for prose and for a control", () => {
    expect(skyLabel("day")).toBe("daylight");
    expect(skyLabel("twilight")).toBe("twilight");
    expect(skyLabel("night")).toBe("night");
    expect(skyFilterLabel("day")).toBe("Daylight");
    expect(skyFilterLabel("night")).toBe("Night");
  });
});
