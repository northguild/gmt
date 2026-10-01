/**
 * @vitest-environment jsdom
 *
 * The Departure Board end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`. Every printed departure is an appendix Z
 * row (DB1 to DB4, DBR1 to DBR5).
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { CHAT_STARTERS } from "./chat-constants";
import { DEPARTURE_PRESETS } from "./departure-board";
import {
  mountDepartureBoard,
  renderDepartureBoardTemplate,
} from "./departure-board-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "form",
  "after",
  "minimum-connection",
  "list-fields",
  "departure-count",
  "departure-1",
  "headway-fields",
  "headway",
  "from",
  "to",
  "verdict",
  "naive-line",
  "departure-rail",
  "rail-stage",
  "handle-after",
  "rail-ticks",
  "rail-summary",
  "reason-aside",
  "call-made",
  "made-output",
  "call-naive",
  "naive-output",
  "onward-duration",
  "onward-zone",
  "onward-mode",
  "handoff",
  "handoff-hint",
];

const AMS = (t: string) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const HEL = (t: string) => `2024-06-15T${t}+03:00[Europe/Helsinki]`;

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderDepartureBoardTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountDepartureBoard(root, args, controller.signal);
  return { root, handle, controller };
}

function key(root: HTMLElement, k: string, shift = false) {
  q(root, "handle-after").dispatchEvent(
    new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }),
  );
}

function setText(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function commit(root: HTMLElement, role: string) {
  q(root, role).dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderDepartureBoardTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is exactly one widget root, first in the template", () => {
    expect(
      renderDepartureBoardTemplate().startsWith(
        '<div class="gmt-departure-board gmt-widget not-content">',
      ),
    ).toBe(true);
  });

  it("makes the arrival handle a real slider, outside the rail's image", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate();
    const handle = q(root, "handle-after");
    expect(handle.getAttribute("role")).toBe("slider");
    expect(handle.getAttribute("aria-label")).toBe("Arrival");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.classList.contains("gmt-handle")).toBe(true);
    expect(q(root, "departure-rail").contains(handle)).toBe(false);
    expect(q(root, "departure-rail").getAttribute("role")).toBe("img");
  });

  it("gives the two timetable forms real radio chips", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate();
    const radios =
      root.querySelectorAll<HTMLInputElement>('[data-role="form"]');
    expect([...radios].map((r) => r.value)).toEqual(["list", "headway"]);
    expect([...radios].every((r) => r.type === "radio")).toBe(true);
  });

  it("keeps two widgets' radio groups apart", async () => {
    const a = await mount({ preset: "ferry-list" });
    const b = await mount({ preset: "shuttle-headway" });
    const checked = (root: HTMLElement) =>
      root.querySelector<HTMLInputElement>('[data-role="form"]:checked')!.value;
    expect(checked(a.root)).toBe("list");
    expect(checked(b.root)).toBe("headway");
  });

  it("builds the destination clock from the shared zone options", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate({ preset: "ferry-list" });
    const zone = q<HTMLSelectElement>(root, "onward-zone");
    expect(zone.classList.contains("gmt-select")).toBe(true);
    expect(zone.options[0]!.textContent).toBe("(not given)");
    expect(zone.value).toBe("Europe/Tallinn");
  });
});

describe("mountDepartureBoard: every preset", () => {
  const EXPECTED: Record<
    string,
    {
      verdict: string;
      naive: string;
      made: string;
      naiveOut: string;
      href: Record<string, string> | null;
    }
  > = {
    "shuttle-headway": {
      verdict: "You make the 06:40.",
      naive: "Naive, with no connection time: the 06:20.",
      made: JSON.stringify(AMS("06:40:00")),
      naiveOut: JSON.stringify(AMS("06:20:00")),
      href: {
        legCount: "1",
        departure1: AMS("06:40:00"),
        duration1: "PT35M",
        timeZone1: "Europe/Amsterdam",
        mode1: "shuttle",
      },
    },
    "ferry-list": {
      verdict: "You make the 13:00.",
      naive: "Naive, with no connection time: the 10:30.",
      made: JSON.stringify(HEL("13:00:00")),
      naiveOut: JSON.stringify(HEL("10:30:00")),
      href: {
        legCount: "1",
        departure1: HEL("13:00:00"),
        duration1: "PT2H",
        timeZone1: "Europe/Tallinn",
        mode1: "ferry",
      },
    },
    "arrival-at-to": {
      verdict: "No departure you can make.",
      naive: "",
      made: '""',
      naiveOut: '""',
      href: null,
    },
    "fall-back-hourly": {
      verdict: "You make the 01:00.",
      naive: "The connection time changes nothing here.",
      made: JSON.stringify("2024-11-03T01:00:00-05:00[America/New_York]"),
      naiveOut: JSON.stringify("2024-11-03T01:00:00-05:00[America/New_York]"),
      href: null,
    },
  };

  it.each(DEPARTURE_PRESETS.map((p) => [p.id]))("prints %s", async (id) => {
    const { root } = await mount({ preset: id });
    const want = EXPECTED[id!]!;
    expect(text(root, "verdict")).toBe(want.verdict);
    expect(text(root, "naive-line")).toBe(want.naive);
    expect(q(root, "naive-line").hidden).toBe(want.naive === "");
    expect(text(root, "made-output")).toBe(want.made);
    expect(text(root, "naive-output")).toBe(want.naiveOut);
    expect(text(root, "call-made").startsWith("nextDeparture(")).toBe(true);
    const link = q<HTMLAnchorElement>(root, "handoff");
    if (want.href === null) {
      expect(link.hasAttribute("href")).toBe(false);
      expect(link.getAttribute("aria-disabled")).toBe("true");
    } else {
      const href = link.getAttribute("href")!;
      expect(href.startsWith("/tools/delivery-scheduler/?w=delivery&wa=")).toBe(
        true,
      );
      const decoded = JSON.parse(
        new URL(href, "http://x").searchParams.get("wa")!,
      );
      expect(decoded).toEqual(want.href);
      expect(link.hasAttribute("aria-disabled")).toBe(false);
      // The Delivery Scheduler's own reader takes these keys.
      expect(
        seedFromLocation("delivery", href.slice(href.indexOf("?"))),
      ).toEqual(want.href);
    }
  });

  it("prints the real calls", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    expect(text(root, "call-made")).toBe(
      `nextDeparture("${AMS("06:12:00")}", { headway: "PT20M", from: "${AMS("06:00:00")}", to: "${AMS("09:00:00")}" }, { minimumConnection: "PT10M" })`,
    );
    expect(text(root, "call-naive")).toBe(
      `nextDeparture("${AMS("06:12:00")}", { headway: "PT20M", from: "${AMS("06:00:00")}", to: "${AMS("09:00:00")}" })`,
    );
  });

  it("prints a list as an array in the order given", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    expect(text(root, "call-made")).toContain(
      `["${HEL("16:30:00")}", "${HEL("07:30:00")}", "${HEL("10:30:00")}"`,
    );
  });

  it("hides the idle form's fields", async () => {
    const list = await mount({ preset: "ferry-list" });
    expect(q(list.root, "list-fields").hidden).toBe(false);
    expect(q(list.root, "headway-fields").hidden).toBe(true);
    const row = await mount({ preset: "shuttle-headway" });
    expect(q(row.root, "list-fields").hidden).toBe(true);
    expect(q(row.root, "headway-fields").hidden).toBe(false);
  });

  it("draws the rail: ticks, the made departure, the naive one and the connection bar", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const rail = q(root, "departure-rail");
    expect(
      rail.querySelectorAll(".gmt-dep-tick:not(.gmt-dep-tick--made)"),
    ).toHaveLength(9);
    expect(rail.querySelector(".gmt-dep-tick--made")).not.toBeNull();
    expect(rail.querySelector(".gmt-dep-naive")).not.toBeNull();
    expect(rail.querySelector(".gmt-dep-conn.gmt-punct-hatch")).not.toBeNull();
    expect(rail.querySelector(".gmt-dep-bracket--from")).not.toBeNull();
    expect(rail.querySelector(".gmt-dep-bracket--to")).not.toBeNull();
    expect(text(root, "rail-label-made")).toBe("made: 06:40");
    expect(text(root, "rail-label-naive")).toBe("naive");
    expect(text(root, "rail-label-conn")).toBe("10 min to connect");
    expect(text(root, "rail-label-to")).toBe("to, excluded");
    expect(text(root, "rail-label-from")).toBe("from");
    expect(rail.querySelectorAll("[tabindex], a, button, input")).toHaveLength(
      0,
    );
    expect(text(root, "rail-summary")).toContain("Made: Sat 15 Jun 06:40.");
  });

  it("draws a list with no brackets", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    expect(
      q(root, "departure-rail").querySelector(".gmt-dep-bracket"),
    ).toBeNull();
    expect(
      q(root, "departure-rail").querySelectorAll(".gmt-dep-tick"),
    ).toHaveLength(6);
  });

  it("combines the made and naive labels when they are one departure", async () => {
    const { root } = await mount({
      preset: "ferry-list",
      minimumConnection: "none",
    });
    expect(text(root, "rail-label-made")).toBe("made: 10:30, naive");
    expect(text(root, "naive-line")).toBe(
      "The connection time changes nothing here.",
    );
  });
});

describe("mountDepartureBoard: the empty answer is not a sentinel", () => {
  it("DB3: arriving at to prints an empty output and a note, no amber", async () => {
    const { root } = await mount({ preset: "arrival-at-to" });
    const out = q(root, "made-output");
    expect(out.textContent).toBe('""');
    expect(out.classList.contains("gmt-widget-output--empty")).toBe(true);
    expect(out.classList.contains("gmt-playground-sentinel")).toBe(false);
    const aside = q(root, "reason-aside");
    expect(aside.textContent).toContain("the window ends at Sat 15 Jun 09:00");
    expect(aside.querySelector(".starlight-aside--note")).not.toBeNull();
    expect(aside.querySelector(".starlight-aside--caution")).toBeNull();
    expect(text(root, "handoff-hint")).toBe("No departure to send.");
  });

  it("DB3: ArrowLeft 20 times writes 08:40 and the verdict reads You make the 08:40.", async () => {
    const { root } = await mount({ preset: "arrival-at-to" });
    for (let i = 0; i < 20; i++) key(root, "ArrowLeft");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("08:40:00"));
    expect(text(root, "verdict")).toBe("You make the 08:40.");
    expect(text(root, "made-output")).toBe(JSON.stringify(AMS("08:40:00")));
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("DB2l: End moves the arrival past the last ferry: empty, none-left", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    key(root, "End");
    expect(text(root, "made-output")).toBe('""');
    expect(
      q(root, "made-output").classList.contains("gmt-widget-output--empty"),
    ).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      "the last one leaves before it",
    );
  });

  it("clearing the connection on the ferry preset makes the 10:30", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    setText(root, "minimum-connection", "");
    expect(text(root, "verdict")).toBe("You make the 10:30.");
    expect(text(root, "naive-line")).toBe(
      "The connection time changes nothing here.",
    );
  });
});

describe("mountDepartureBoard: NO SIGNAL", () => {
  it("DBR1: a zoneless arrival shows NO SIGNAL and the arrival reason", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    setText(root, "after", "2024-06-15T10:05:00");
    expect(text(root, "made-output")).toBe("NO SIGNAL");
    expect(
      q(root, "made-output").classList.contains("gmt-playground-sentinel"),
    ).toBe(true);
    expect(text(root, "reason-aside")).toContain("The arrival has no offset");
    expect(
      q(root, "reason-aside").querySelector(".starlight-aside--caution"),
    ).not.toBeNull();
    expect(text(root, "verdict")).toBe("");
    expect(q(root, "naive-line").hidden).toBe(true);
  });

  it("DBR4: a calendar connection is invalid-connection, and the naive call still answers", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    setText(root, "minimum-connection", "P1W");
    expect(text(root, "made-output")).toBe("NO SIGNAL");
    expect(text(root, "naive-output")).toBe(JSON.stringify(HEL("10:30:00")));
    expect(text(root, "reason-aside")).toContain(
      "The minimum connection is not an exact duration",
    );
  });

  it("DBR5: a zero headway is invalid-headway", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    setText(root, "headway", "PT0S");
    expect(text(root, "made-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      "The headway is not an exact duration",
    );
  });

  it("an entry with no offset names its departure", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    setText(root, "departure-2", "2024-06-15T07:30:00");
    expect(text(root, "made-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain("Departure 2 has no offset");
  });
});

describe("mountDepartureBoard: the form chips and the list", () => {
  it("switching the form chip to headway shows the headway fields", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    const radio = root.querySelector<HTMLInputElement>(
      '[data-role="form"][value="headway"]',
    )!;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "headway-fields").hidden).toBe(false);
    expect(q(root, "list-fields").hidden).toBe(true);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("the departure count shows and hides list fields", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    const count = q<HTMLSelectElement>(root, "departure-count");
    count.value = "3";
    count.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "departure-field-3").hidden).toBe(false);
    expect(q(root, "departure-field-4").hidden).toBe(true);
    expect(text(root, "call-made")).not.toContain(HEL("19:30:00"));
  });

  it("choosing a preset replaces the timetable and the fields", async () => {
    const { root } = await mount({ preset: "ferry-list" });
    const select = q<HTMLSelectElement>(root, "preset");
    select.value = "arrival-at-to";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("09:00:00"));
    expect(q(root, "headway-fields").hidden).toBe(false);
    expect(text(root, "preset-description")).toContain("half-open");
  });
});

describe("mountDepartureBoard: the arrival handle", () => {
  it("keeps the arrival in its own notation: a bracketed zone, an offset, Z", async () => {
    const zoned = await mount({ preset: "shuttle-headway" });
    key(zoned.root, "ArrowRight");
    expect(q<HTMLInputElement>(zoned.root, "after").value).toBe(
      AMS("06:13:00"),
    );
    const offset = await mount({
      after: "2024-06-15T06:12:00+02:00",
      headway: "PT20M",
      from: "2024-06-15T06:00:00+02:00",
      to: "2024-06-15T09:00:00+02:00",
    });
    key(offset.root, "ArrowRight");
    expect(q<HTMLInputElement>(offset.root, "after").value).toBe(
      "2024-06-15T06:13:00+02:00",
    );
    const utc = await mount({
      after: "2024-06-15T04:12:00Z",
      headway: "PT20M",
      from: "2024-06-15T04:00:00Z",
      to: "2024-06-15T07:00:00Z",
    });
    key(utc.root, "ArrowRight");
    expect(q<HTMLInputElement>(utc.root, "after").value).toBe(
      "2024-06-15T04:13:00Z",
    );
  });

  it("Shift+Arrow, PageUp and PageDown move ten minutes", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    key(root, "ArrowRight", true);
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:22:00"));
    key(root, "PageDown");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:12:00"));
    key(root, "PageUp");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:22:00"));
  });

  it("Home goes to the start of the rail and End to its end", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    key(root, "Home");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("05:45:00"));
    key(root, "End");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("09:15:00"));
  });

  it("moves the made departure live", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    expect(text(root, "verdict")).toBe("You make the 06:40.");
    for (let i = 0; i < 9; i++) key(root, "ArrowRight");
    // 06:21 plus 10 minutes is 06:31, so the 06:40 is still next.
    expect(text(root, "verdict")).toBe("You make the 06:40.");
    for (let i = 0; i < 10; i++) key(root, "ArrowRight");
    expect(text(root, "verdict")).toBe("You make the 07:00.");
  });

  it("does not rescale the rail while keys move the handle", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const before = text(root, "rail-ticks");
    key(root, "End");
    expect(text(root, "rail-ticks")).toBe(before);
  });

  it("keeps aria on the handle in step", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const h = q(root, "handle-after");
    expect(h.getAttribute("aria-valuemin")).toBe("0");
    expect(Number(h.getAttribute("aria-valuemax"))).toBe(210);
    expect(h.getAttribute("aria-valuenow")).toBe("27");
    expect(h.getAttribute("aria-valuetext")).toBe("Arrival Sat 15 Jun 06:12");
  });

  it("writes a minute-snapped arrival on a pointer drag", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    q(root, "rail-stage").getBoundingClientRect = () =>
      ({
        left: 0,
        right: 420,
        width: 420,
        top: 0,
        bottom: 100,
        height: 100,
      }) as DOMRect;
    const handle = q(root, "handle-after");
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    // The rail is 05:45 to 09:15: 210 minutes over 420 px, so 2 px is a minute.
    // 90 px is minute 45, which is 06:30.
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 90,
      }),
    );
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:30:00"));
    handle.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 300,
      }),
    );
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:30:00"));
  });

  it("a typed arrival moves the handle and refits on change", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    setText(root, "after", AMS("08:00:00"));
    expect(q(root, "handle-after").getAttribute("aria-valuenow")).toBe("135");
    commit(root, "after");
    // 08:00 plus the 10-minute connection is 08:10: the 08:20 is next.
    expect(text(root, "verdict")).toBe("You make the 08:20.");
  });

  it("hides the handle when the arrival is not a moment", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    setText(root, "after", "soon");
    expect(q(root, "handle-after").hidden).toBe(true);
    expect(text(root, "rail-summary")).toContain("No signal.");
  });
});

describe("mountDepartureBoard: chat seeds, permalinks and teardown", () => {
  it("DB2: the chat pill renders the ferry", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showDepartureBoard")!;
    const { root } = await mount(pill.args);
    expect(text(root, "verdict")).toBe("You make the 13:00.");
    expect(text(root, "naive-line")).toBe(
      "Naive, with no connection time: the 10:30.",
    );
  });

  it("PD2: the permalink seeds a template rendered without it", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate();
    document.body.append(root);
    await mountDepartureBoard(
      root,
      { preset: "arrival-at-to" },
      new AbortController().signal,
    );
    expect(text(root, "made-output")).toBe('""');
  });

  it("PD3: the permalink with the connection cleared", async () => {
    const { root } = await mount({
      preset: "ferry-list",
      minimumConnection: "none",
    });
    expect(text(root, "verdict")).toBe("You make the 10:30.");
  });

  it("round-trips the preset form", async () => {
    const { root, handle } = await mount({ preset: "arrival-at-to" });
    for (let i = 0; i < 20; i++) key(root, "ArrowLeft");
    const state = handle.getPermalinkState!();
    expect(state).toEqual({ preset: "arrival-at-to", after: AMS("08:40:00") });
    const href = encodeWidgetPermalink("departure", state!);
    expect(
      seedFromLocation("departure", href.slice(href.indexOf("?"))),
    ).toEqual(state);
  });

  it("round-trips the flat list form of a chat seed", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showDepartureBoard")!;
    const { handle } = await mount(pill.args);
    const state = handle.getPermalinkState!()!;
    expect(state.form).toBe("list");
    const seed = seedFromLocation(
      "departure",
      `?w=departure&wa=${encodeURIComponent(JSON.stringify(state))}`,
    );
    const again = await mount(seed);
    expect(text(again.root, "verdict")).toBe("You make the 13:00.");
  });

  it("stops responding once the signal aborts", async () => {
    const { root, controller } = await mount({ preset: "shuttle-headway" });
    controller.abort();
    key(root, "ArrowRight");
    expect(q<HTMLInputElement>(root, "after").value).toBe(AMS("06:12:00"));
  });

  it("returns an inert handle when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDepartureBoardTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountDepartureBoard(root, {}, controller.signal);
    expect(handle.getPermalinkState!()).toBeNull();
  });

  it("destroys twice without throwing", async () => {
    const { handle } = await mount();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("the restyled rail: result plate, window and focus", () => {
  const FOCUSABLE = "[tabindex], a, button, input, select, textarea";

  it("shows the departure made, large, with the wait from the library", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const hero = q(root, "rail-hero");
    expect(hero.hidden).toBe(false);
    expect(hero.querySelector(".gmt-punct-hero-value")!.textContent).toBe(
      "06:40",
    );
    expect(hero.querySelector(".gmt-punct-hero-sub")!.textContent).toBe(
      "wait 28 min after arrival · PT28M",
    );
    // The shuttle's mode is a rail word, so the plate carries the rail icon.
    expect(hero.querySelector("svg.gmt-cutoff-icon")).not.toBeNull();
    expect(hero.getAttribute("data-series")).toBe("1");
  });

  it("counts the wait in exact time across the repeated hour", async () => {
    const { root } = await mount({ preset: "fall-back-hourly" });
    expect(
      q(root, "rail-hero").querySelector(".gmt-punct-hero-sub")!.textContent,
    ).toBe("wait 30 min after arrival · PT30M");
    // No mode on this preset: no icon.
    expect(q(root, "rail-hero").querySelector("svg")).toBeNull();
  });

  it("reads none, with no wait, when no departure is left", async () => {
    const { root } = await mount({ preset: "arrival-at-to" });
    const hero = q(root, "rail-hero");
    expect(hero.hidden).toBe(false);
    expect(hero.querySelector(".gmt-punct-hero-value")!.textContent).toBe(
      "none",
    );
    expect(hero.querySelector(".gmt-punct-hero-sub")!.textContent).toBe(
      "no departure left",
    );
  });

  it("hides the plate on an invalid arrival: the outputs carry NO SIGNAL", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    setText(root, "after", "not a time");
    expect(q(root, "rail-hero").hidden).toBe(true);
    expect(q(root, "rail-heroes").hidden).toBe(true);
    expect(text(root, "made-output")).toContain("NO SIGNAL");
  });

  it("draws the service window and the closed stretch past it only for a headway", async () => {
    const shuttle = await mount({ preset: "shuttle-headway" });
    expect(shuttle.root.querySelectorAll(".gmt-dep-window")).toHaveLength(1);
    expect(shuttle.root.querySelectorAll(".gmt-dep-beyond")).toHaveLength(1);
    expect(
      shuttle.root
        .querySelector(".gmt-dep-beyond")!
        .classList.contains("gmt-cutoff-closed"),
    ).toBe(true);
    const ferry = await mount({ preset: "ferry-list" });
    expect(ferry.root.querySelectorAll(".gmt-dep-window")).toHaveLength(0);
    expect(ferry.root.querySelectorAll(".gmt-dep-beyond")).toHaveLength(0);
  });

  it("puts every rail label on a chip", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const labels = [...root.querySelectorAll(".gmt-dep-label")];
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect(l.classList.contains("gmt-cutoff-chip"), l.textContent!).toBe(
        true,
      );
    }
    expect(
      q(root, "rail-label-naive").classList.contains("gmt-cutoff-chip--dim"),
    ).toBe(true);
  });

  it("keeps the plates out of the accessibility tree", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    const heroes = root.querySelectorAll(".gmt-punct-heroes");
    expect(heroes).toHaveLength(1);
    for (const h of heroes) expect(h.getAttribute("aria-hidden")).toBe("true");
  });

  it("has no focusable element in the rail but the arrival handle", async () => {
    const { root } = await mount({ preset: "shuttle-headway" });
    expect(q(root, "departure-rail").querySelectorAll(FOCUSABLE)).toHaveLength(
      0,
    );
    expect(
      [...q(root, "rail-stage").querySelectorAll(FOCUSABLE)].map(
        (e) => (e as HTMLElement).dataset.role,
      ),
    ).toEqual(["handle-after"]);
  });
});

describe("readouts that hold still", () => {
  it("draws the plate's sub line as two fixed lines, with or without a wait", async () => {
    for (const preset of ["shuttle-headway", "arrival-at-to"]) {
      const { root } = await mount({ preset });
      expect(
        q(root, "rail-hero").querySelectorAll(".gmt-punct-hero-line"),
      ).toHaveLength(2);
    }
  });
});
