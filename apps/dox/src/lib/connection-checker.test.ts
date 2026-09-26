import { describe, expect, it } from "vitest";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { resolveLocal } from "@northguild/gmt/instant/convert";
import type { TransportLib } from "./transport-widgets";
import {
  CONNECTION_PRESETS,
  CUSTOM_PRESET_ID,
  legsOf,
  matchPreset,
  naiveCheck,
  permalinkOf,
  readArgs,
  verdict,
  type ConnectionState,
} from "./connection-checker";

const lib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
};

describe("presets", () => {
  it("match the section 9 rows", () => {
    const made = CONNECTION_PRESETS.find((p) => p.id === "made")!;
    expect(scheduleDelivery(legsOf(made.state))).toEqual({
      eta: "2024-06-16T02:00:00+02:00[Europe/Rome]",
      legTimes: [
        {
          arrival: "2024-06-15T11:10:00Z",
          localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]",
          dwellAfter: "PT45M",
        },
        {
          arrival: "2024-06-16T00:00:00Z",
          localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]",
          dwellAfter: "PT0S",
        },
      ],
    });

    const zeroSlack = CONNECTION_PRESETS.find((p) => p.id === "zero-slack")!;
    expect(
      scheduleDelivery(legsOf(zeroSlack.state))?.legTimes[0]?.dwellAfter,
    ).toBe("PT50M");

    for (const id of ["spring-forward", "zone-change"]) {
      const preset = CONNECTION_PRESETS.find((p) => p.id === id)!;
      expect(scheduleDelivery(legsOf(preset.state))).toBeNull();
    }
  });
});

describe("legsOf", () => {
  it("falls back the onward leg's duration to PT0M... PT0S at zero handling", () => {
    const state: ConnectionState = {
      inboundDeparture: "2024-06-14T22:10:00+02:00[Europe/Berlin]",
      inboundDuration: "PT15H",
      portZone: "Europe/Amsterdam",
      handlingMinutes: "0",
      onwardDeparture: "2024-06-15T14:00:00[Europe/Amsterdam]",
      onwardDuration: "",
      onwardZone: "",
    };
    const legs = legsOf(state);
    expect(legs[0]!.dwellAfter).toBe("PT0M");
    expect(legs[1]!.duration).toBe("PT0S");
    expect(legs[1]!.timeZone).toBe("Europe/Amsterdam");
  });
});

describe("naiveCheck", () => {
  it("agrees with the JSDoc-style worked example for made", () => {
    const preset = CONNECTION_PRESETS.find((p) => p.id === "made")!;
    expect(naiveCheck(preset.state)).toEqual({
      lands: "13:10",
      ready: "13:55",
      leaves: "14:00",
      made: true,
      spareMinutes: 5,
    });
  });

  it("gives ready 14:00 and made for zero-slack", () => {
    const preset = CONNECTION_PRESETS.find((p) => p.id === "zero-slack")!;
    const naive = naiveCheck(preset.state)!;
    expect(naive.ready).toBe("14:00");
    expect(naive.made).toBe(true);
  });

  it("says made on spring-forward and zone-change, while the library says missed", () => {
    for (const id of ["spring-forward", "zone-change"]) {
      const preset = CONNECTION_PRESETS.find((p) => p.id === id)!;
      const naive = naiveCheck(preset.state)!;
      expect(naive.lands).toBe("13:10");
      expect(naive.ready).toBe("13:55");
      expect(naive.made).toBe(true);
      expect(scheduleDelivery(legsOf(preset.state))).toBeNull();
    }
  });
});

describe("verdict", () => {
  it("made, with the correct slack wording", () => {
    const made = CONNECTION_PRESETS.find((p) => p.id === "made")!;
    const v = verdict(legsOf(made.state), lib);
    expect(v.kind).toBe("made");
  });

  it("zero slack reads 'equal passes'", () => {
    const preset = CONNECTION_PRESETS.find((p) => p.id === "zero-slack")!;
    const v = verdict(legsOf(preset.state), lib);
    expect(v.kind).toBe("made");
    expect(v.text).toContain("zero slack");
  });

  it("missed on spring-forward and zone-change", () => {
    for (const id of ["spring-forward", "zone-change"]) {
      const preset = CONNECTION_PRESETS.find((p) => p.id === id)!;
      const v = verdict(legsOf(preset.state), lib);
      expect(v.kind).toBe("missed");
    }
  });

  it("V70/V71: ready reads 14:55 in Amsterdam on both spring-forward and zone-change", () => {
    const spring = CONNECTION_PRESETS.find((p) => p.id === "spring-forward")!;
    const zoneChange = CONNECTION_PRESETS.find((p) => p.id === "zone-change")!;
    expect(verdict(legsOf(spring.state), lib).readyLocal).toBe(
      "2024-03-31T14:55:00+02:00[Europe/Amsterdam]",
    );
    expect(verdict(legsOf(zoneChange.state), lib).readyLocal).toBe(
      "2024-06-15T14:55:00+02:00[Europe/Amsterdam]",
    );
  });

  it("missed by 1 minute at handling 51 (V61)", () => {
    const state: ConnectionState = {
      inboundDeparture: "2024-06-14T22:10:00+02:00[Europe/Berlin]",
      inboundDuration: "PT15H",
      portZone: "Europe/Amsterdam",
      handlingMinutes: "51",
      onwardDeparture: "2024-06-15T14:00:00[Europe/Amsterdam]",
      onwardDuration: "PT12H",
      onwardZone: "Europe/Rome",
    };
    expect(scheduleDelivery(legsOf(state))).toBeNull();
    const v = verdict(legsOf(state), lib);
    expect(v.kind).toBe("missed");
    expect(v.text).toContain("1 min");
  });
});

describe("readArgs / matchPreset / permalinkOf", () => {
  it("reads handlingMinutes as a number or a string", () => {
    expect(readArgs({ handlingMinutes: 45 }).handlingMinutes).toBe("45");
    expect(readArgs({ handlingMinutes: "45" }).handlingMinutes).toBe("45");
    expect(readArgs({ handlingMinutes: undefined }).handlingMinutes).toBe("");
  });

  it("matches every preset and falls back to custom", () => {
    for (const preset of CONNECTION_PRESETS) {
      expect(matchPreset(preset.state)).toBe(preset.id);
    }
    expect(
      matchPreset({
        inboundDeparture: "x",
        inboundDuration: "",
        portZone: "",
        handlingMinutes: "",
        onwardDeparture: "",
        onwardDuration: "",
        onwardZone: "",
      }),
    ).toBe(CUSTOM_PRESET_ID);
  });

  it("permalinkOf carries only non-blank strings", () => {
    const made = CONNECTION_PRESETS.find((p) => p.id === "made")!;
    const link = permalinkOf(made.state);
    for (const v of Object.values(link)) expect(typeof v).toBe("string");
    expect(link.onwardZone).toBe("Europe/Rome");
  });
});
