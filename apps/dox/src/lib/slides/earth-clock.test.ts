/**
 * @vitest-environment jsdom
 *
 * The 24-hour clock that stands where the Earth would be. Reading the venue's time is its own
 * module's test (`title-clock.test.ts`) and is faked here at 18:43:20.
 */
/*
 * The clock lives in the aria-hidden space layer and is decoration: the slides carry every word.
 * Its contract is the size and place it takes over the Earth's disc, the turn of its hands and the
 * phase it publishes on the layer for the stylesheet, so those hooks are what is asserted.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import { installJsdomShims } from "~/test/jsdom-shims";
import { formatZonedToParts } from "@northguild/gmt/zoned/format";
import { dialDate, handAngles } from "./earth-clock-face";
import { mountEarthClock } from "./earth-clock";
import { SHARD_COUNT } from "./clock-shatter";

installJsdomShims();

type WallTime = {
  hour: number;
  minute: number;
  second: number;
  zoned: string;
};

const venue = vi.hoisted(() => ({
  zones: [] as string[],
  time: null as WallTime | null,
  held: {} as Record<string, WallTime>,
}));
vi.mock("./title-clock", () => ({
  loadClock: async (zone: string) => {
    venue.zones.push(zone);
    return {
      read: () => venue.time,
      at: (utc: string) => venue.held[utc] ?? null,
      untilNextSecond: () => 1000,
    };
  },
}));

let abort: AbortController;
let host: HTMLElement;

beforeEach(() => {
  venue.zones.length = 0;
  venue.time = {
    hour: 18,
    minute: 43,
    second: 20,
    zoned: "2026-12-15T18:43:20+02:00[Europe/Helsinki]",
  };
  abort = new AbortController();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  abort.abort();
  host.remove();
});

const mount = () =>
  mountEarthClock(host, {
    signal: abort.signal,
    zone: "Europe/Helsinki",
    city: "Helsinki",
  });

const face = (): HTMLElement | null =>
  host.querySelector<HTMLElement>("[data-earth-clock-face]");
const hand = (name: string): Element | null =>
  host.querySelector(`[data-hand="${name}"]`);

describe("the Earth's clock", () => {
  it("reads the zone's time and turns the hands to it, the hour hand once a day", async () => {
    mount();
    await vi.waitFor(() => expect(hand("second")).toHaveAttribute("transform"));
    expect(venue.zones).toEqual(["Europe/Helsinki"]);
    // 18:43:20 is 1123⅓ minutes into the day, at a quarter of a degree a minute.
    expect(hand("hour")).toHaveAttribute("transform", "rotate(280.833 50 50)");
    expect(hand("minute")).toHaveAttribute("transform", "rotate(260 50 50)");
    expect(hand("second")).toHaveAttribute("transform", "rotate(120 50 50)");
  });

  describe("the first time", () => {
    it("shows no hands and no date until gmt has the time", () => {
      mount();
      // The stylesheet hides the hands, the date and the offset on a face that is not timed.
      expect(face()).not.toHaveAttribute("data-timed");
      expect(hand("hour")).not.toHaveAttribute("transform");
      expect(host.querySelector("[data-calendar-day]")).toHaveTextContent("");
    });

    it("marks the face timed with the hands already in place and the date written, so they fade in there", async () => {
      mount();
      await vi.waitFor(() => expect(face()).toHaveAttribute("data-timed"));
      expect(hand("hour")).toHaveAttribute(
        "transform",
        "rotate(280.833 50 50)",
      );
      expect(hand("minute")).toHaveAttribute("transform", "rotate(260 50 50)");
      expect(hand("second")).toHaveAttribute("transform", "rotate(120 50 50)");
      expect(face()).toHaveTextContent("UTC+02:00");
    });

    it("fades in at a held instant when the hold comes first", async () => {
      venue.held["2027-03-28T01:00:00Z"] = {
        hour: 4,
        minute: 0,
        second: 0,
        zoned: "2027-03-28T04:00:00+03:00[Europe/Helsinki]",
      };
      mount().hold("2027-03-28T01:00:00Z");
      await vi.waitFor(() => expect(face()).toHaveAttribute("data-timed"));
      expect(hand("hour")).toHaveAttribute("transform", "rotate(60 50 50)");
    });
  });

  it("leaves the dial without hands for a zone gmt has no time for", async () => {
    venue.time = null;
    mount();
    await vi.waitFor(() => expect(venue.zones).toHaveLength(1));
    await Promise.resolve();
    expect(hand("hour")).not.toHaveAttribute("transform");
    expect(face()).not.toHaveAttribute("data-timed");
  });

  it("puts midnight straight up and noon straight down", () => {
    expect(handAngles({ hour: 0, minute: 0, second: 0 }).hour).toBe(0);
    expect(handAngles({ hour: 12, minute: 0, second: 0 }).hour).toBe(180);
    expect(handAngles({ hour: 6, minute: 30, second: 30 })).toEqual({
      hour: 97.625,
      minute: 183,
      second: 180,
    });
  });

  it("holds the hands and the date at an instant, and ticks the zone's time again when let go", async () => {
    venue.held["2027-03-28T01:00:00Z"] = {
      hour: 4,
      minute: 0,
      second: 0,
      zoned: "2027-03-28T04:00:00+03:00[Europe/Helsinki]",
    };
    const clock = mount();
    clock.hold("2027-03-28T01:00:00Z");
    await vi.waitFor(() => expect(face()).toHaveTextContent("UTC+03:00"));
    expect(hand("hour")).toHaveAttribute("transform", "rotate(60 50 50)");
    expect(hand("second")).toHaveAttribute("transform", "rotate(0 50 50)");
    expect(host.querySelector("[data-calendar-day]")).toHaveTextContent("28");
    clock.hold(null);
    expect(hand("hour")).toHaveAttribute("transform", "rotate(280.833 50 50)");
    expect(face()).toHaveTextContent("UTC+02:00");
  });

  it("writes the city on the dial", () => {
    mount();
    expect(face()).toHaveTextContent("HELSINKI");
  });

  it("writes the zone's date in the calendar window and its offset under the city", async () => {
    mount();
    await vi.waitFor(() => expect(face()).toHaveTextContent("UTC+02:00"));
    const text = (hook: string) => host.querySelector(`[${hook}]`);
    expect(text("data-calendar-day")).toHaveTextContent("15");
    expect(text("data-calendar-month")).toHaveTextContent("DEC");
    expect(text("data-calendar-weekday")).toHaveTextContent("TUE");
  });

  it("reads the date from the zoned string, not from UTC", () => {
    // 01:30 in Helsinki on 1 January is still 31 December in UTC.
    expect(
      dialDate(
        "2027-01-01T01:30:00+02:00[Europe/Helsinki]",
        formatZonedToParts,
      ),
    ).toEqual({ month: "JAN", day: "1", weekday: "FRI", offset: "UTC+02:00" });
    expect(
      dialDate("2027-02-06T23:56:00+08:00[Asia/Shanghai]", formatZonedToParts),
    ).toEqual({ month: "FEB", day: "6", weekday: "SAT", offset: "UTC+08:00" });
    expect(dialDate("not a date", formatZonedToParts)).toBeNull();
  });

  it("stops the hour hand short of the numerals, so the hour it points at stays legible", () => {
    mount();
    const tip = Math.min(
      ...hand("hour")!
        .querySelector("polygon")!
        .getAttribute("points")!
        .split(" ")
        .map((p) => Number(p.split(",")[1])),
    );
    const numeral = host.querySelector("[data-numeral]")!;
    // The 00 numeral is centred at y = 50 - 21.4 and is 3.3 units tall.
    const numeralFoot =
      Number(numeral.getAttribute("y")) +
      Number(numeral.getAttribute("font-size")) / 2;
    expect(tip).toBeGreaterThan(numeralFoot);
  });

  it("lays its rim on the Earth's rim: the rim is 40 of the face's 100 units", () => {
    const clock = mount();
    clock.fit({ x: 500, y: 300, radius: 160 });
    expect(face()).toHaveStyle({
      width: "400px",
      height: "400px",
      transform: "translate(300px, 100px)",
    });
  });

  it("publishes its phase on the layer, and none when off", () => {
    const clock = mount();
    expect(host).not.toHaveAttribute("data-earth-clock");
    clock.set("on");
    expect(host).toHaveAttribute("data-earth-clock", "on");
    clock.set("shatter");
    expect(host).toHaveAttribute("data-earth-clock", "shatter");
    clock.set("off");
    expect(host).not.toHaveAttribute("data-earth-clock");
  });

  it("publishes the disc's centre on the layer, for the Earth to grow from", () => {
    const clock = mount();
    clock.fit({ x: 500, y: 300, radius: 160 });
    // The two properties are the contract with the Earth's `transform-origin`, which jsdom does not run.
    /* oxlint-disable dox-test/no-house-class */
    expect(host.style.getPropertyValue("--gmt-earth-x")).toBe("500px");
    expect(host.style.getPropertyValue("--gmt-earth-y")).toBe("300px");
    /* oxlint-enable dox-test/no-house-class */
  });

  it("breaks into copies of the dial on shatter, and sweeps them away when it ends", () => {
    const clock = mount();
    clock.set("on");
    clock.set("shatter");
    const shards = host.querySelectorAll("[data-shard]");
    expect(shards).toHaveLength(SHARD_COUNT);
    for (const shard of shards) {
      // Each copy drops its gradients, which stay with the dial the copies point at.
      expect(shard.querySelector("[data-hands]")).not.toBeNull();
      expect(shard.querySelector("defs")).toBeNull();
    }
    clock.set("shatter");
    expect(host.querySelectorAll("[data-shard]")).toHaveLength(SHARD_COUNT);
    clock.set("off");
    expect(host.querySelectorAll("[data-shard]")).toHaveLength(0);
    clock.set("shatter");
    abort.abort();
    expect(host.querySelectorAll("[data-shard]")).toHaveLength(0);
  });

  it("leaves the mark, the city and the offset off a plain dial, keeps the calendar, and puts them back", async () => {
    const clock = mount();
    await vi.waitFor(() => expect(face()).toHaveTextContent("UTC+02:00"));
    clock.plain(true);
    expect(face()).toHaveAttribute("data-plain");
    expect(host.querySelector("[data-legend]")).toHaveTextContent("HELSINKI");
    expect(host.querySelector("[data-calendar-day]")).toHaveTextContent("15");
    clock.set("on");
    clock.set("shatter");
    // The shards are copies inside the plain clock, so they break plain too.
    expect(
      host.querySelector("[data-plain] [data-shard] [data-legend]"),
    ).not.toBeNull();
    clock.plain(false);
    expect(face()).not.toHaveAttribute("data-plain");
  });

  it("takes itself and its phase away when the signal aborts", () => {
    const clock = mount();
    clock.set("on");
    abort.abort();
    expect(face()).toBeNull();
    expect(host).not.toHaveAttribute("data-earth-clock");
  });
});
