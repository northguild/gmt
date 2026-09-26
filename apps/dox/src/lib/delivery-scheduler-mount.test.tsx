/**
 * @vitest-environment jsdom
 *
 * The Delivery Scheduler widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed call and
 * result are section 9 rows, verified against a build of the final library.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { DELIVERY_PRESETS } from "./delivery-scheduler";
import {
  mountDeliveryScheduler,
  renderDeliverySchedulerTemplate,
} from "./delivery-scheduler-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "leg-count",
  "start-zone",
  "leg-1",
  "leg-2",
  "leg-3",
  "leg-4",
  "mode-1",
  "departure-1",
  "duration-1",
  "zone-1",
  "dwell-1",
  "mode-2",
  "departure-2",
  "duration-2",
  "zone-2",
  "dwell-2",
  "mode-3",
  "departure-3",
  "duration-3",
  "zone-3",
  "dwell-3",
  "mode-4",
  "departure-4",
  "duration-4",
  "zone-4",
  "dwell-4",
  "eta-summary",
  "eta-headline",
  "eta",
  "eta-duration",
  "eta-flags",
  "chart-toggle",
  "view-route",
  "view-scale",
  "timeline",
  "chart-route",
  "chart-scale",
  "timeline-summary",
  "legend",
  "journey",
  "reason-aside",
  "call-delivery",
  "copy-delivery",
  "delivery-output",
];

/** [call, result], collapsed. `dwell-handoff` is the `scheduleDelivery.ts`
 *  JSDoc example V2, verbatim; the rest are section 9 rows. */
const EXPECTED: Record<string, [string, string | null]> = {
  "truck-ship-rail": [
    '[{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" }, { duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    '{ eta: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-10T12:00:00Z", localArrival: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT2H", mode: "truck" }, { arrival: "2024-03-21T14:00:00Z", localArrival: "2024-03-21T23:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-03-22T16:30:00Z", localArrival: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }',
  ],
  "ship-scheduled": [
    '[{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" }, { departure: "2024-03-10T07:30:00[America/Los_Angeles]", duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    '{ eta: "2024-03-23T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-10T12:00:00Z", localArrival: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT2H", mode: "truck" }, { arrival: "2024-03-21T14:30:00Z", localArrival: "2024-03-21T23:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-03-22T17:00:00Z", localArrival: "2024-03-23T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }',
  ],
  "missed-connection": [
    '[{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" }, { departure: "2024-03-10T06:30:00[America/Los_Angeles]", duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }, { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }]',
    null,
  ],
  "trans-pacific": [
    '[{ departure: "2024-06-17T17:00:00+09:00[Asia/Tokyo]", duration: "PT10H", timeZone: "America/Los_Angeles", dwellAfter: "PT3H", mode: "air" }, { duration: "PT44H", timeZone: "America/Chicago", mode: "truck" }]',
    '{ eta: "2024-06-19T12:00:00-05:00[America/Chicago]", legTimes: [{ arrival: "2024-06-17T18:00:00Z", localArrival: "2024-06-17T11:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT3H", mode: "air" }, { arrival: "2024-06-19T17:00:00Z", localArrival: "2024-06-19T12:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "truck" }] }',
  ],
  "fall-back-night": [
    '[{ departure: "2024-11-02T22:00:00-04:00[America/New_York]", duration: "PT6H", timeZone: "America/New_York", dwellAfter: "PT1H", mode: "rail" }, { duration: "PT2H", timeZone: "America/New_York", mode: "truck" }]',
    '{ eta: "2024-11-03T06:00:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T08:00:00Z", localArrival: "2024-11-03T03:00:00-05:00[America/New_York]", dwellAfter: "PT1H", mode: "rail" }, { arrival: "2024-11-03T11:00:00Z", localArrival: "2024-11-03T06:00:00-05:00[America/New_York]", dwellAfter: "PT0S", mode: "truck" }] }',
  ],
  "dwell-handoff": [
    '[{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]',
    '{ eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }',
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderDeliverySchedulerTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountDeliveryScheduler(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const input = q<HTMLInputElement>(root, role);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderDeliverySchedulerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("has the exact root the html-diff gate matches on", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate();
    expect(
      root.firstElementChild!.outerHTML.startsWith(
        '<div class="gmt-delivery gmt-widget">',
      ),
    ).toBe(true);
  });

  it("uses text inputs with no placeholder", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate();
    for (const role of ["departure-1", "duration-1", "dwell-1"]) {
      const input = q<HTMLInputElement>(root, role);
      expect(input.type).toBe("text");
      expect(input.hasAttribute("placeholder")).toBe(false);
    }
  });

  it("offers mode as a dropdown of (none) plus the known modes", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate();
    const select = q<HTMLSelectElement>(root, "mode-1");
    expect(select.tagName).toBe("SELECT");
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(["", "truck", "rail", "ship", "barge", "air"]);
    expect(select.value).toBe("truck");
  });

  it("appends a custom seeded mode as an extra option rather than dropping it", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate({
      legs: [{ duration: "PT1H", timeZone: "UTC", mode: "barge-express" }],
    });
    const select = q<HTMLSelectElement>(root, "mode-1");
    expect(select.value).toBe("barge-express");
    expect([...select.options].some((o) => o.value === "barge-express")).toBe(
      true,
    );
  });

  it("hides fieldsets past the leg count and keeps their values", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate({
      legs: [
        {
          departure: "2024-01-01T00:00:00Z",
          duration: "PT1H",
          timeZone: "UTC",
        },
      ],
    });
    expect(q<HTMLElement>(root, "leg-2").hidden).toBe(true);
  });
});

describe("mountDeliveryScheduler", () => {
  it.each(DELIVERY_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;

      expect(q(root, "copy-delivery").dataset.copyText).toBe(
        `scheduleDelivery(${call})`,
      );
      if (result === null) {
        expect(q(root, "delivery-output").textContent).toBe("NO SIGNAL");
        expect(q(root, "delivery-output").classList).toContain(
          "gmt-playground-sentinel",
        );
      } else {
        expect(
          q(root, "delivery-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
        expect(q(root, "delivery-output").classList).toContain(
          "gmt-playground-live",
        );
      }
    },
  );

  it("names leg 2, 06:30, 05:00 and 07:00 in Los Angeles for the missed connection", async () => {
    const { root } = await mount();
    choosePreset(root, "missed-connection");
    const text = q(root, "reason-aside").textContent!;
    expect(text).toContain("leg 2");
    expect(text).toContain("06:30");
    expect(text).toContain("05:00");
    expect(text).toContain("07:00");
  });

  it("shows the ETA line from the real result", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    expect(q(root, "eta").textContent).toContain(
      "2024-03-23T01:30:00+09:00[Asia/Tokyo]",
    );
  });

  it("leads with the ETA summary card: headline, door-to-door and flags", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    expect(q(root, "eta-headline").textContent).toBe(
      "Sat 23 Mar 2024 · 01:30 Tokyo (+09:00)",
    );
    expect(q(root, "eta-duration").textContent).toBe(
      "14 d 2 h 30 min door to door",
    );
    const flagsText = q(root, "eta-flags").textContent!;
    expect(flagsText).toContain("DST ×2");
    expect(flagsText).toContain("1 h offset-table error");
    expect(q<HTMLElement>(root, "eta-summary").dataset.state).toBe("ok");
  });

  it("turns the ETA summary card into a failure state naming the leg on a missed connection", async () => {
    const { root } = await mount();
    choosePreset(root, "missed-connection");
    expect(q<HTMLElement>(root, "eta-summary").dataset.state).toBe("failed");
    expect(q(root, "eta-headline").textContent).toContain("Leg 2");
    expect(q(root, "eta-headline").textContent).toContain("Missed connection");
  });

  it("draws the Route chart as one link and one dot per station, with the leg's own numeral", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    const svg = q(root, "chart-route").querySelector<SVGSVGElement>("svg")!;
    // 3 legs -> 3 links (segments), 4 stations -> 4 dots.
    expect(svg.querySelectorAll(".ts-chart__link line")).toHaveLength(3);
    expect(svg.querySelectorAll(".ts-chart__dot circle")).toHaveLength(4);
    // Colour is never the only cue: each segment's own numeral is real text.
    const texts = [...svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts.some((t) => t?.startsWith("① "))).toBe(true);
    expect(texts.some((t) => t?.startsWith("② "))).toBe(true);
    expect(texts.some((t) => t?.startsWith("③ "))).toBe(true);
  });

  it("draws a broken (dashed) link on the Route chart for a missed connection", async () => {
    const { root } = await mount();
    choosePreset(root, "missed-connection");
    const svg = q(root, "chart-route").querySelector<SVGSVGElement>("svg")!;
    const dashed = [...svg.querySelectorAll(".ts-chart__link line")].some(
      (line) => line.getAttribute("stroke-dasharray") !== "none",
    );
    expect(dashed).toBe(true);
  });

  it("draws the To-scale chart with one bar per reached leg and a conflict marker for a missed connection", async () => {
    const { root } = await mount();
    choosePreset(root, "missed-connection");
    root.querySelector<HTMLButtonElement>('[data-role="view-scale"]')!.click();
    const svg = q(root, "chart-scale").querySelector<SVGSVGElement>("svg")!;
    // Only the truck (reached) leg gets a real bar; the ship's missed
    // connection is a conflict link, not a bar.
    expect(svg.querySelectorAll(".ts-chart__bar-x rect")).toHaveLength(1);
    const texts = [...svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toContain("missed");
  });

  it("reads an offset-table badge of 1 h early on leg 1 of truck-ship-rail", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    const journeyText = q(root, "journey").textContent!;
    expect(journeyText).toContain("1 h early");
  });

  it("reads an offset-table badge of 1 h late on both legs of fall-back-night", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back-night");
    // Scoped to the itinerary: the route map shows the same disagreement as
    // its own station badge, a second, independent appearance of the value.
    const badges = [
      ...q(root, "journey").querySelectorAll(".gmt-transport-badge--disagrees"),
    ].map((el) => el.textContent);
    expect(badges).toEqual(["1 h late", "1 h late"]);
  });

  it("disagrees with no badge on trans-pacific", async () => {
    const { root } = await mount();
    choosePreset(root, "trans-pacific");
    expect(
      q(root, "journey").querySelectorAll(".gmt-transport-badge--disagrees"),
    ).toHaveLength(0);
  });

  it("groups the itinerary by date, with the final arrival tagged ETA and a spring-forward DST note", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    const journeyText = q(root, "journey").textContent!;
    expect(journeyText).toContain("Fri 8 Mar 2024");
    expect(journeyText).toContain("ETA");
    expect(journeyText).toContain("Los Angeles clocks spring forward");
    expect(
      root.querySelectorAll('[data-role="journey"] .gmt-delivery-day'),
    ).not.toHaveLength(0);
  });

  it("annotates the Date Line crossing in the itinerary for trans-pacific", async () => {
    const { root } = await mount();
    choosePreset(root, "trans-pacific");
    expect(q(root, "journey").textContent).toContain("Date Line");
  });

  it("marks the missed handoff in the itinerary for missed-connection", async () => {
    const { root } = await mount();
    choosePreset(root, "missed-connection");
    expect(q(root, "journey").textContent).toContain("Missed connection");
    expect(root.querySelector(".gmt-delivery-event--missed")).not.toBeNull();
  });

  it("seeds the chat starter V38 and sets the leg count to 2", async () => {
    const seed = {
      legs: [
        {
          departure: "2024-03-08T08:00:00-06:00[America/Chicago]",
          duration: "PT46H",
          timeZone: "America/Los_Angeles",
          mode: "truck",
        },
        { duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" },
      ],
    };
    const { root } = await mount(seed);
    expect(q<HTMLSelectElement>(root, "leg-count").value).toBe("2");
    expect(
      q(root, "delivery-output").textContent!.replace(/\n\s+/g, " "),
    ).toContain("2024-03-21T21:00:00+09:00[Asia/Tokyo]");
  });

  it("gives NO SIGNAL and zoneless-later for a zoneless leg 2 departure", async () => {
    const { root } = await mount();
    choosePreset(root, "truck-ship-rail");
    type(root, "departure-2", "2024-03-10T07:30:00");
    expect(q(root, "delivery-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(
      "Only the first leg is read in the start zone",
    );
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of DELIVERY_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("delivery", state);
      const seeded = seedFromLocation("delivery", url.slice(url.indexOf("?")));
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(q(again.root, "delivery-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(again.root, "delivery-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDeliverySchedulerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountDeliveryScheduler(root, {}, controller.signal);
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});
