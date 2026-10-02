/**
 * @vitest-environment jsdom
 *
 * The ETA Drift Chart end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`. Every printed pick and report is an
 * appendix Z row (ED1 to ED4, ED1a to ED1c, ED2r, EDR1 to EDR3).
 */
/// <reference types="vitest/globals" />
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { ETA_PRESETS } from "./eta-drift";
import { CLASS_SERIES } from "./eta-drift";
import { mountEtaDrift, renderEtaDriftTemplate } from "./eta-drift-mount";
import { CHAT_STARTERS } from "./chat-constants";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "event-count",
  "event-1",
  "classifier-1",
  "at-1",
  "recorded-at-1",
  "callout-best",
  "callout-naive",
  "drift-plot",
  "plot-area",
  "y-ticks",
  "x-ticks",
  "band-label",
  "tolerance",
  "tolerance-slider",
  "tolerance-value",
  "drift-summary",
  "event-table",
  "reason-aside",
  "call-best",
  "best-output",
  "call-drift",
  "drift-output",
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderEtaDriftTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountEtaDrift(root, args, controller.signal);
  return { root, handle, controller };
}

function slide(root: HTMLElement, value: number) {
  const slider = q<HTMLInputElement>(root, "tolerance-slider");
  slider.value = String(value);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
}

function setText(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function pickClass(root: HTMLElement, n: number, code: string) {
  const radio = root.querySelector<HTMLInputElement>(
    `[data-role="classifier-${n}"][value="${code}"]`,
  )!;
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderEtaDriftTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is exactly one widget root, first in the template", () => {
    expect(
      renderEtaDriftTemplate().startsWith(
        '<div class="gmt-eta-drift gmt-widget not-content">',
      ),
    ).toBe(true);
  });

  it("builds the tolerance range from the shared dragger", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    const slider = q<HTMLInputElement>(root, "tolerance-slider");
    expect(slider.type).toBe("range");
    expect(slider.classList.contains("gmt-range")).toBe(true);
    expect(slider.step).toBe("15");
    expect(slider.value).toBe("480");
  });

  it("gives each class a real radio chip", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    const radios = root.querySelectorAll<HTMLInputElement>(
      '[data-role="classifier-1"]',
    );
    expect([...radios].map((r) => r.value)).toEqual([
      "PLN",
      "EST",
      "REQ",
      "ACT",
    ]);
    expect([...radios].every((r) => r.type === "radio")).toBe(true);
    expect(new Set([...radios].map((r) => r.name)).size).toBe(1);
  });

  it("keeps two widgets' radio groups apart", async () => {
    const a = await mount();
    const b = await mount();
    const nameA = a.root.querySelector<HTMLInputElement>(
      '[data-role="classifier-1"]',
    )!.name;
    const nameB = b.root.querySelector<HTMLInputElement>(
      '[data-role="classifier-1"]',
    )!.name;
    expect(nameA).not.toBe(nameB);
    pickClass(b.root, 1, "ACT");
    expect(
      a.root.querySelector<HTMLInputElement>(
        '[data-role="classifier-1"]:checked',
      )!.value,
    ).toBe("EST");
  });
});

describe("mountEtaDrift: every preset", () => {
  const EXPECTED: Record<
    string,
    {
      call: string;
      best: string;
      drift: string;
      bestCallout: string;
      naiveCallout: string | null;
      notes: string[];
    }
  > = {
    "vessel-slide": {
      call: 'estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }], { tolerance: "PT8H" })',
      best: '{ at: "2024-06-20T17:00:00Z", classifier: "EST" }',
      drift:
        '{ first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }',
      bestCallout:
        "Best available and the latest recorded are the same event: EST, Thu 20 Jun 17:00 (bestAvailable)",
      naiveCallout: null,
      notes: ["first EST", "", "best available, naive pick, last EST"],
    },
    "est-after-act": {
      call: 'estimateDrift([{ classifier: "PLN"',
      best: '{ at: "2024-06-15T12:52:00Z", classifier: "ACT" }',
      drift:
        '{ first: "2024-06-15T12:40:00Z", last: "2024-06-15T13:05:00Z", drift: "PT25M", revisions: 2, exceedsTolerance: null }',
      bestCallout: "Best available: ACT, Sat 15 Jun 12:52 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 13:05",
      notes: ["", "first EST", "best available", "naive pick, last EST"],
    },
    "req-beats-est": {
      call: '{ tolerance: "PT15M" })',
      best: '{ at: "2024-06-15T12:30:00Z", classifier: "REQ" }',
      drift:
        '{ first: "2024-06-15T12:40:00Z", last: "2024-06-15T12:45:00Z", drift: "PT5M", revisions: 2, exceedsTolerance: false }',
      bestCallout: "Best available: REQ, Sat 15 Jun 12:30 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 12:45",
      notes: ["first EST", "best available", "naive pick, last EST"],
    },
    "one-estimate": {
      call: '{ tolerance: "PT15M" })',
      best: '{ at: "2024-06-15T12:00:00Z", classifier: "PLN" }',
      drift: "null",
      bestCallout: "Best available: PLN, Sat 15 Jun 12:00 (bestAvailable)",
      naiveCallout: "Naive, latest recorded: EST, Sat 15 Jun 12:40",
      notes: ["best available", "naive pick"],
    },
  };

  it.each(ETA_PRESETS.map((p) => [p.id]))("prints %s", async (id) => {
    const { root } = await mount({ preset: id });
    const want = EXPECTED[id!]!;
    expect(text(root, "call-drift")).toContain(want.call);
    expect(
      text(root, "call-best").startsWith("bestAvailable([{ classifier: "),
    ).toBe(true);
    expect(text(root, "best-output")).toBe(want.best);
    expect(text(root, "drift-output")).toBe(want.drift);
    expect(text(root, "callout-best")).toBe(want.bestCallout);
    if (want.naiveCallout === null) {
      expect(q(root, "callout-naive").hidden).toBe(true);
    } else {
      expect(q(root, "callout-naive").hidden).toBe(false);
      expect(text(root, "callout-naive")).toBe(want.naiveCallout);
    }
    want.notes.forEach((note, i) => {
      expect(text(root, `note-${i + 1}`)).toBe(note);
    });
  });

  it("omits the options argument when the tolerance is blank", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    expect(text(root, "call-drift").endsWith("}])")).toBe(true);
    expect(text(root, "call-drift")).not.toContain("tolerance");
  });

  it("draws one mark per event, shaped by class", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    const cls = (n: number) => q(root, `mark-${n}`).className;
    expect(cls(1)).toContain("gmt-eta-mark--pln");
    expect(cls(2)).toContain("gmt-eta-mark--est");
    expect(cls(3)).toContain("gmt-eta-mark--act");
    expect(root.querySelectorAll(".gmt-eta-ring")).toHaveLength(2);
    expect(root.querySelectorAll(".gmt-eta-ring--dashed")).toHaveLength(1);
    expect(root.querySelectorAll(".gmt-eta-line")).toHaveLength(1);
  });

  it("draws a triangle for a request", async () => {
    const { root } = await mount({ preset: "req-beats-est" });
    expect(q(root, "mark-2").querySelector("svg")).not.toBeNull();
  });

  it("draws the tolerance band and says whether the drift exceeds it", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    expect(root.querySelector(".gmt-eta-band")).not.toBeNull();
    expect(text(root, "band-label")).toBe(
      "±8 h around the first estimate · exceeds the tolerance: true",
    );
  });

  it("draws no band without a tolerance", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    expect(root.querySelector(".gmt-eta-band")).toBeNull();
    expect(text(root, "band-label")).toBe("");
  });

  it("labels the drift with its sign", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    expect(text(root, "label-drift")).toBe("↑ +9 h");
  });

  it("makes the plot an image with a summary and nothing focusable inside", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    const plot = q(root, "drift-plot");
    expect(plot.getAttribute("role")).toBe("img");
    const id = plot.getAttribute("aria-labelledby")!;
    expect(root.querySelector(`#${id}`)!.textContent).toContain(
      "Estimate drift +25 min over 2 estimates",
    );
    expect(plot.querySelectorAll("[tabindex], a, button, input")).toHaveLength(
      0,
    );
    expect(text(root, "drift-summary")).toContain(
      "Recorded Sat 15 Jun 12:53: actual (ACT), naming Sat 15 Jun 12:52.",
    );
  });
});

describe("mountEtaDrift: the tolerance", () => {
  it("ED1a: the slider at 540 writes PT9H and exceedsTolerance is false", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    slide(root, 540);
    expect(q<HTMLInputElement>(root, "tolerance").value).toBe("PT9H");
    expect(text(root, "drift-output")).toContain("exceedsTolerance: false");
    expect(q(root, "tolerance-slider").getAttribute("aria-valuetext")).toBe(
      "Tolerance 9 hours, PT9H",
    );
    expect(text(root, "tolerance-value")).toBe("9 h");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("ED1b: the slider at 525 writes PT8H45M and exceedsTolerance is true", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    slide(root, 525);
    expect(q<HTMLInputElement>(root, "tolerance").value).toBe("PT8H45M");
    expect(text(root, "drift-output")).toContain("exceedsTolerance: true");
  });

  it("ED1c: clearing the tolerance gives null", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    setText(root, "tolerance", "");
    expect(text(root, "drift-output")).toContain("exceedsTolerance: null");
    expect(text(root, "tolerance-value")).toBe("none");
    expect(q(root, "tolerance-slider").getAttribute("aria-valuetext")).toBe(
      "No tolerance",
    );
  });

  it("moves the slider when a readable value is typed", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    setText(root, "tolerance", "PT10H");
    expect(q<HTMLInputElement>(root, "tolerance-slider").value).toBe("600");
    expect(
      q(root, "tolerance-slider").style.getPropertyValue("--gmt-range-pct"),
    ).not.toBe("");
  });

  it("widens the slider past 24 hours when the drift needs it", async () => {
    const { root } = await mount({
      events: [
        {
          classifier: "EST",
          at: "2024-06-20T00:00:00Z",
          recordedAt: "2024-06-01T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-25T00:00:00Z",
          recordedAt: "2024-06-02T00:00:00Z",
        },
      ],
    });
    expect(
      Number(q<HTMLInputElement>(root, "tolerance-slider").max),
    ).toBeGreaterThan(1440);
  });

  it("EDR3: a weeks tolerance shows NO SIGNAL for the drift and its reason", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    setText(root, "tolerance", "P1W");
    expect(text(root, "drift-output")).toBe("NO SIGNAL");
    expect(text(root, "best-output")).toContain("classifier");
    expect(text(root, "reason-aside")).toContain(
      "The tolerance is not an exact duration",
    );
  });
});

describe("mountEtaDrift: classes and events", () => {
  it("ED2r: choosing EST on event 3 makes the plan the best available", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    pickClass(root, 3, "EST");
    expect(text(root, "best-output")).toBe(
      '{ at: "2024-06-15T12:00:00Z", classifier: "PLN" }',
    );
    expect(text(root, "drift-output")).toContain("revisions: 3");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("one-estimate: a correct empty answer, in a neutral note, never NO SIGNAL", async () => {
    const { root } = await mount({ preset: "one-estimate" });
    const out = q(root, "drift-output");
    expect(out.textContent).toBe("null");
    expect(out.classList.contains("gmt-widget-output--empty")).toBe(true);
    expect(out.classList.contains("gmt-playground-sentinel")).toBe(false);
    const aside = q(root, "reason-aside");
    expect(aside.querySelector(".starlight-aside--note")).not.toBeNull();
    expect(aside.querySelector(".starlight-aside--caution")).toBeNull();
    expect(aside.textContent).toContain("Nothing to measure yet");
    expect(aside.textContent).toContain("no drift from one estimate");
    expect(aside.textContent).not.toContain("NO SIGNAL");
    expect(text(root, "drift-summary")).toContain(
      "No estimate drift to measure yet: fewer than two estimates.",
    );
    expect(text(root, "drift-summary")).not.toContain("NO SIGNAL");
    // The best pick is real, so nothing on the page is a sentinel.
    expect(root.querySelector(".gmt-playground-sentinel")).toBeNull();
  });

  it("invalid input is still NO SIGNAL in a caution aside, apart from the empty note", async () => {
    const { root } = await mount({ preset: "vessel-slide", tolerance: "P1W" });
    expect(text(root, "drift-output")).toBe("NO SIGNAL");
    expect(
      q(root, "reason-aside").querySelector(".starlight-aside--caution"),
    ).not.toBeNull();
  });

  it("copies the last event into a new one after a preset switch, not only after a seed", async () => {
    // Bug: the count the select last held was read once at mount, so a preset
    // that changed the count left it stale and the next event came up blank.
    const { root } = await mount({ preset: "vessel-slide" });
    const preset = q<HTMLSelectElement>(root, "preset");
    preset.value = "one-estimate";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "event-3").hidden).toBe(true);
    const count = q<HTMLSelectElement>(root, "event-count");
    count.value = "3";
    count.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "event-3").hidden).toBe(false);
    expect(q<HTMLInputElement>(root, "at-3").value).toBe(
      "2024-06-15T12:40:00Z",
    );
    expect(q<HTMLInputElement>(root, "recorded-at-3").value).toBe(
      "2024-06-14T00:00:00Z",
    );
    expect(
      root.querySelector<HTMLInputElement>('[data-role="classifier-3"]:checked')
        ?.value,
    ).toBe("EST");
    expect(text(root, "drift-output")).toContain("revisions: 2");
    expect(text(root, "drift-output")).not.toBe("NO SIGNAL");
    expect(text(root, "best-output")).not.toBe("NO SIGNAL");
  });

  it.each([
    "2024-02-30T08:00:00+00:00[Europe/London]",
    "2024-06-31T10:05:00+03:00[Europe/Helsinki]",
  ])(
    "an impossible date (%s) in a zoned event shows NO SIGNAL and does not throw",
    async (at) => {
      // Bug: the weekday label threw out of the mount for a date that does not exist.
      const { root } = await mount({
        events: [{ classifier: "EST", at, recordedAt: "2024-06-14T00:00:00Z" }],
      });
      expect(text(root, "best-output")).toBe("NO SIGNAL");
      expect(text(root, "drift-output")).toBe("NO SIGNAL");
      expect(text(root, "callout-best")).toContain("NO SIGNAL");
      expect(text(root, "reason-aside")).toContain(
        "Event 1 is not a timestamp",
      );
      // The table prints the text as typed.
      expect(text(root, "event-row-1")).toContain(at);
    },
  );

  it("and re-renders without throwing when a typed date is impossible", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    setText(root, "at-2", "2024-02-30T08:00:00+00:00[Europe/London]");
    expect(text(root, "best-output")).toBe("NO SIGNAL");
    setText(root, "at-2", "2024-06-20T12:00:00Z");
    expect(text(root, "best-output")).not.toBe("NO SIGNAL");
  });

  it("gives the results table table roles and a labelled, focusable scroll box", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    const table = q(root, "event-table");
    expect(table.getAttribute("role")).toBe("table");
    expect(table.getAttribute("tabindex")).toBe("0");
    expect(table.getAttribute("aria-label")).toBeTruthy();
    expect(table.querySelector("thead")!.getAttribute("role")).toBe("rowgroup");
    expect(table.querySelector("tbody")!.getAttribute("role")).toBe("rowgroup");
    expect(
      [...table.querySelectorAll("thead th")].every(
        (th) => th.getAttribute("role") === "columnheader",
      ),
    ).toBe(true);
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.getAttribute("role")).toBe("row");
      expect(row.querySelector("th")!.getAttribute("role")).toBe("rowheader");
      expect(
        [...row.querySelectorAll("td")].every(
          (td) => td.getAttribute("role") === "cell",
        ),
      ).toBe(true);
    }
  });

  it("releases its font listener when destroyed", async () => {
    const add = vi.fn();
    const remove = vi.fn();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        addEventListener: add,
        removeEventListener: remove,
      },
    });
    try {
      const { handle } = await mount({ preset: "vessel-slide" });
      expect(add).toHaveBeenCalledWith("loadingdone", expect.any(Function));
      handle.destroy();
      handle.destroy();
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledWith("loadingdone", add.mock.calls[0]![1]);
    } finally {
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("wraps the event fieldsets in one growing slot, so a count change eases", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    const slot = q(root, "events");
    expect(slot.getAttribute("data-grow")).toBe("slot");
    expect(slot.querySelectorAll("fieldset.gmt-transport-leg")).toHaveLength(6);
    expect(q(root, "reason-aside").getAttribute("data-grow")).toBe("slot");
    expect(q(root, "drift-heroes").getAttribute("data-grow")).toBe("slot");
  });

  it("EDR2: a chat seed with a zoneless at shows NO SIGNAL twice", async () => {
    const { root } = await mount({
      events: [
        {
          classifier: "EST",
          at: "2024-06-15T12:40:00",
          recordedAt: "2024-06-14T00:00:00Z",
        },
      ],
    });
    expect(text(root, "best-output")).toBe("NO SIGNAL");
    expect(text(root, "drift-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain("Event 1 is not a timestamp");
    expect(text(root, "callout-best")).toContain("NO SIGNAL");
    expect(text(root, "drift-plot")).toContain("NO SIGNAL");
  });

  it("shows and hides event fieldsets with the count", async () => {
    const { root } = await mount({ preset: "one-estimate" });
    expect(q(root, "event-2").hidden).toBe(false);
    expect(q(root, "event-3").hidden).toBe(true);
    const count = q<HTMLSelectElement>(root, "event-count");
    count.value = "3";
    count.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "event-3").hidden).toBe(false);
    // The new event starts as a copy of the last one, so it is a valid timestamp.
    expect(q<HTMLInputElement>(root, "at-3").value).toBe(
      "2024-06-15T12:40:00Z",
    );
    expect(text(root, "drift-output")).toContain("revisions: 2");
  });

  it("typing a time updates the result", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    setText(root, "at-4", "2024-06-15T13:30:00Z");
    expect(text(root, "drift-output")).toContain('drift: "PT50M"');
  });
});

describe("mountEtaDrift: chat seeds, permalinks and teardown", () => {
  it("ED1: the chat pill renders the vessel slide", async () => {
    const pill = CHAT_STARTERS.find((s) => s.widget === "showEtaDrift")!;
    const { root } = await mount(pill.args);
    expect(text(root, "drift-output")).toBe(
      '{ first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }',
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("vessel-slide");
  });

  it("PE2: the permalink seeds the tolerance on a template rendered without it", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    document.body.append(root);
    await mountEtaDrift(
      root,
      { preset: "vessel-slide", tolerance: "PT9H" },
      new AbortController().signal,
    );
    expect(text(root, "drift-output")).toContain("exceedsTolerance: false");
  });

  it("round-trips the preset form", async () => {
    const { root, handle } = await mount({ preset: "vessel-slide" });
    slide(root, 540);
    const state = handle.getPermalinkState!();
    expect(state).toEqual({ preset: "vessel-slide", tolerance: "PT9H" });
    const href = encodeWidgetPermalink("etadrift", state!);
    expect(seedFromLocation("etadrift", href.slice(href.indexOf("?")))).toEqual(
      state,
    );
  });

  it("round-trips the flat form of a chat seed", async () => {
    const { root, handle } = await mount({
      events: [
        {
          classifier: "PLN",
          at: "2024-06-15T12:00:00Z",
          recordedAt: "2024-06-01T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-15T12:40:00Z",
          recordedAt: "2024-06-14T00:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-15T12:50:00Z",
          recordedAt: "2024-06-14T05:00:00Z",
        },
      ],
      tolerance: "PT15M",
    });
    setText(root, "tolerance", "PT20M");
    const state = handle.getPermalinkState!()!;
    expect(state.eventCount).toBe("3");
    const seed = seedFromLocation(
      "etadrift",
      `?w=etadrift&wa=${encodeURIComponent(JSON.stringify(state))}`,
    );
    const again = await mount(seed);
    expect(text(again.root, "drift-output")).toContain('drift: "PT10M"');
    expect(q<HTMLInputElement>(again.root, "tolerance").value).toBe("PT20M");
  });

  it("stops responding once the signal aborts", async () => {
    const { root, controller } = await mount({ preset: "vessel-slide" });
    controller.abort();
    slide(root, 540);
    expect(text(root, "drift-output")).toContain("exceedsTolerance: true");
  });

  it("returns an inert handle when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderEtaDriftTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountEtaDrift(root, {}, controller.signal);
    expect(handle.getPermalinkState!()).toBeNull();
    expect(text(root, "best-output").trim()).toBe("");
  });

  it("destroys twice without throwing", async () => {
    const { handle } = await mount();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("the restyled plot: marks, legend, plates and focus", () => {
  const FOCUSABLE = "[tabindex], a, button, input, select, textarea";

  it("gives a mark, its table cell and its legend entry one series", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    const classes = ["PLN", "EST", "ACT", "EST"] as const;
    classes.forEach((code, i) => {
      const n = i + 1;
      const series = String(CLASS_SERIES[code]);
      expect(
        q(root, `mark-${n}`).getAttribute("data-series"),
        `mark-${n}`,
      ).toBe(series);
      expect(
        q(root, `event-row-${n}`)
          .querySelector("td")!
          .getAttribute("data-series"),
        `cell ${n}`,
      ).toBe(series);
      expect(
        q(root, "legend").querySelector(`li[data-series="${series}"]`)!
          .textContent,
        `legend ${code}`,
      ).toContain(code);
    });
  });

  it("lists only the classes present, in the dashboard's class order", async () => {
    const some = await mount({ preset: "est-after-act" });
    expect(
      [...q(some.root, "legend").querySelectorAll("li")].map(
        (li) => li.querySelector(".gmt-punct-chip")!.textContent,
      ),
    ).toEqual(["PLN", "EST", "ACT"]);
    const one = await mount({ preset: "vessel-slide" });
    expect(
      [...q(one.root, "legend").querySelectorAll("li")].map(
        (li) => li.querySelector(".gmt-punct-chip")!.textContent,
      ),
    ).toEqual(["EST"]);
    expect(q(one.root, "legend").textContent).toContain("estimated");
  });

  it("draws the legend and the table with glyphs, never marks or rings", async () => {
    const { root } = await mount({ preset: "req-beats-est" });
    expect(
      q(root, "legend").querySelector(".gmt-eta-glyph--req svg"),
    ).not.toBeNull();
    expect(
      q(root, "event-row-2").querySelector(".gmt-eta-glyph--req svg"),
    ).not.toBeNull();
    for (const region of [q(root, "legend"), q(root, "event-table")]) {
      expect(region.querySelector(".gmt-eta-mark, .gmt-eta-ring")).toBeNull();
    }
    // Only the plot holds marks: one per event, so the table adds none.
    expect(root.querySelectorAll(".gmt-eta-mark")).toHaveLength(3);
  });

  it("keeps the class chip's code as its text, with the series on it", async () => {
    const { root } = await mount({ preset: "est-after-act" });
    const chip = q(root, "label-3").querySelector(".gmt-punct-chip")!;
    expect(chip.textContent).toBe("ACT");
    expect(chip.getAttribute("data-series")).toBe("4");
    expect(q(root, "label-3").classList.contains("gmt-cutoff-chip")).toBe(true);
  });

  it("draws the chord's glow line apart from the one join line", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    expect(root.querySelectorAll(".gmt-eta-line")).toHaveLength(1);
    expect(root.querySelectorAll(".gmt-eta-line-glow")).toHaveLength(1);
    const est = await mount({ preset: "one-estimate" });
    expect(est.root.querySelectorAll(".gmt-eta-line-glow")).toHaveLength(0);
  });

  it("reads the drift on a plate: +9 h on the vessel slide", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    const hero = q(root, "drift-hero");
    expect(hero.querySelector(".gmt-punct-hero-cap")!.textContent).toBe(
      "estimate drift",
    );
    expect(hero.querySelector(".gmt-punct-hero-value")!.textContent).toBe(
      "+9 h",
    );
    expect(hero.querySelector(".gmt-punct-hero-sub")!.textContent).toBe(
      "PT9H · over 3 estimates · exceeds ±8 h: yes",
    );
  });

  it("leaves the exceeds clause out with no tolerance, and the plate out with no drift", async () => {
    const act = await mount({ preset: "est-after-act" });
    expect(
      q(act.root, "drift-hero").querySelector(".gmt-punct-hero-sub")!
        .textContent,
    ).toBe("PT25M · over 2 estimates");
    const one = await mount({ preset: "one-estimate" });
    expect(one.root.querySelector('[data-role="drift-hero"]')).toBeNull();
  });

  it.each(ETA_PRESETS.map((p) => [p.id]))(
    "draws the best pick's plate on %s, in its class's series",
    async (id) => {
      const { root } = await mount({ preset: id });
      const hero = q(root, "best-hero");
      expect(hero.classList.contains("gmt-punct-hero--quiet")).toBe(true);
      const code = /^(PLN|EST|REQ|ACT) · /.exec(
        hero.querySelector(".gmt-punct-hero-value")!.textContent!,
      )![1]! as keyof typeof CLASS_SERIES;
      expect(hero.getAttribute("data-series")).toBe(String(CLASS_SERIES[code]));
      expect(hero.querySelector(".gmt-eta-glyph")).not.toBeNull();
      expect(hero.querySelector(".gmt-punct-hero-cap")!.textContent).toBe(
        "best available",
      );
    },
  );

  it("keeps the plates and the legend out of the accessibility tree", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    const heroes = root.querySelectorAll(".gmt-punct-heroes");
    expect(heroes).toHaveLength(1);
    for (const h of heroes) expect(h.getAttribute("aria-hidden")).toBe("true");
    expect(q(root, "legend").getAttribute("aria-hidden")).toBe("true");
  });

  it("has nothing focusable in the plot", async () => {
    const { root } = await mount({ preset: "vessel-slide" });
    expect(q(root, "drift-plot").querySelectorAll(FOCUSABLE)).toHaveLength(0);
  });
});

describe("releasing observers", () => {
  it("destroy disconnects every ResizeObserver the mount created", async () => {
    const spy = spyOnResizeObservers();
    try {
      const { handle } = await mount();
      expect(spy.live.size).toBeGreaterThan(0);
      handle.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
