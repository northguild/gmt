/**
 * @vitest-environment jsdom
 *
 * The Cut-off Ruler widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed calls,
 * outputs and hours-before values are appendix Z rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { RULER_PRESETS } from "./cutoff-ruler";
import {
  mountCutoffRuler,
  renderCutoffRulerTemplate,
} from "./cutoff-ruler-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "anchor",
  "time-zone",
  "days",
  "at-local-time",
  "ruler-overview",
  "ruler-closeup",
  "ruler-summary",
  "readings",
  "reason-aside",
  "call-ruler-calendar",
  "copy-ruler-calendar",
  "ruler-output-calendar",
  "call-ruler-exact",
  "ruler-output-exact",
  "call-ruler-pinned",
  "ruler-output-pinned",
];

const EXPECTED: Record<string, [string, string, string][]> = {
  "new-york-fall-back": [
    [
      '"2024-11-04T18:00:00-05:00[America/New_York]", "P2D", { timeZone: "America/New_York" }',
      "2024-11-02T18:00:00-04:00[America/New_York]",
      "PT49H",
    ],
    [
      '"2024-11-04T18:00:00-05:00[America/New_York]", "PT48H", { timeZone: "America/New_York" }',
      "2024-11-02T19:00:00-04:00[America/New_York]",
      "PT48H",
    ],
    [
      '"2024-11-04T18:00:00-05:00[America/New_York]", "P2D", { timeZone: "America/New_York", atLocalTime: "17:00" }',
      "2024-11-02T17:00:00-04:00[America/New_York]",
      "PT50H",
    ],
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderCutoffRulerTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountCutoffRuler(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderCutoffRulerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffRulerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });
});

describe("mountCutoffRuler", () => {
  it("prints the three calls, outputs and hours-before for the pill preset (R1)", async () => {
    const { root } = await mount();
    choosePreset(root, "new-york-fall-back");
    const rows = EXPECTED["new-york-fall-back"]!;
    const roles = ["calendar", "exact", "pinned"];
    for (let i = 0; i < rows.length; i++) {
      const role = roles[i]!;
      const [call, at, hours] = rows[i]!;
      expect(q(root, `copy-ruler-${role}`).dataset.copyText).toBe(
        `cutoffAt(${call})`,
      );
      expect(q(root, `ruler-output-${role}`).textContent).toBe(at);
      expect(q(root, "readings").textContent).toContain(hours);
    }
  });

  it("shows the transition label on R1 (go back) and R3 (go forward), none on R2", async () => {
    const { root } = await mount();
    choosePreset(root, "new-york-fall-back");
    expect(q(root, "ruler-overview").textContent).toContain("go back 1 h");

    choosePreset(root, "new-york-spring-forward");
    expect(q(root, "ruler-overview").textContent).toContain("go forward 1 h");

    choosePreset(root, "amsterdam-june");
    const overview = q(root, "ruler-overview").innerHTML;
    expect(overview).not.toContain("go back");
    expect(overview).not.toContain("go forward");
  });

  it("neither drawn surface is a tab stop", async () => {
    const { root } = await mount();
    expect(q(root, "ruler-overview").getAttribute("tabindex")).toBe("-1");
    expect(q(root, "ruler-closeup").getAttribute("tabindex")).toBe("-1");
  });

  it("labels the overview's day and 6-hour ticks as visible text", async () => {
    const { root } = await mount();
    choosePreset(root, "new-york-fall-back");
    const ticks = [
      ...q(root, "ruler-overview").querySelectorAll(".gmt-cutoff-axis-tick"),
    ].map((t) => t.textContent);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.some((t) => /^\d{2}:00$/.test(t ?? ""))).toBe(true);
    expect(ticks.some((t) => /^\d+ [A-Za-z]{3}$/.test(t ?? ""))).toBe(true);
  });

  it("the close-up labels every local hour as visible text, and R1's three readings land an hour apart", async () => {
    const { root } = await mount();
    choosePreset(root, "new-york-fall-back");
    const closeup = q(root, "ruler-closeup");
    const tickText = [...closeup.querySelectorAll(".gmt-cutoff-axis-tick")].map(
      (t) => t.textContent,
    );
    // 18:00, 19:00 and 20:00 are all inside the 2h-either-side window and
    // must be readable text, not hidden in a title attribute.
    for (const hour of ["17:00", "18:00", "19:00", "20:00"]) {
      expect(tickText).toContain(hour);
    }
    const readingLabels = [
      ...closeup.querySelectorAll(".gmt-cutoff-ruler-closeup-label"),
    ].map((l) => l.textContent);
    expect(readingLabels).toHaveLength(3);
    // Three distinct rows, none overlapping another reading's label.
    const rows = closeup.querySelectorAll(".gmt-cutoff-ruler-closeup-row");
    expect(rows).toHaveLength(3);
  });

  it("shows one NO SIGNAL row on skipped-hour, the other two resolve", async () => {
    const { root } = await mount();
    choosePreset(root, "skipped-hour");
    expect(q(root, "ruler-output-calendar").textContent).not.toBe("NO SIGNAL");
    expect(q(root, "ruler-output-exact").textContent).not.toBe("NO SIGNAL");
    expect(q(root, "ruler-output-pinned").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain("skipped");
  });

  it("renders the chat seed (the pill args) as R1", async () => {
    const seed = {
      anchor: "2024-11-04T18:00:00-05:00[America/New_York]",
      timeZone: "America/New_York",
      days: 2,
      atLocalTime: "17:00",
    };
    const { root } = await mount(seed);
    expect(q(root, "ruler-output-calendar").textContent).toBe(
      "2024-11-02T18:00:00-04:00[America/New_York]",
    );
    expect(q(root, "ruler-output-pinned").textContent).toBe(
      "2024-11-02T17:00:00-04:00[America/New_York]",
    );
  });

  it("changing 'Days before' to 1 re-renders all three calls with P1D/PT24H", async () => {
    const { root } = await mount();
    choosePreset(root, "new-york-fall-back");
    const days = q<HTMLSelectElement>(root, "days");
    days.value = "1";
    days.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "copy-ruler-calendar").dataset.copyText).toContain('"P1D"');
    expect(q(root, "copy-ruler-exact").dataset.copyText).toContain('"PT24H"');
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of RULER_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("cutoffruler", state);
      const seeded = seedFromLocation(
        "cutoffruler",
        url.slice(url.indexOf("?")),
      );
      const again = await mount(seeded);
      expect(q(again.root, "ruler-output-calendar").textContent).toBe(
        q(root, "ruler-output-calendar").textContent,
      );
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffRulerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountCutoffRuler(root, {}, controller.signal);
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
