/**
 * @vitest-environment jsdom
 *
 * The Timetable Reader widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's row 1 call and
 * result are section 9 rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { SKIPPED_OFFSET_TEXT, TIMETABLE_PRESETS } from "./timetable-reader";
import {
  mountTimetableReader,
  renderTimetableReaderTemplate,
} from "./timetable-reader-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "start-zone",
  "duration",
  "zone",
  "departure-1",
  "offset-1",
  "departure-2",
  "offset-2",
  "departure-3",
  "offset-3",
  "departure-4",
  "offset-4",
  "rows",
  "reason-aside",
  "row-pick",
  "call-timetable",
  "copy-timetable",
  "timetable-output",
];

const EXPECTED: Record<string, [string, string]> = {
  "fall-back": [
    '[{ departure: "2024-11-03T00:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-11-03T01:30:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T05:30:00Z", localArrival: "2024-11-03T01:30:00-04:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "offset-picks": [
    '[{ departure: "2024-11-03T01:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-11-03T01:30:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T06:30:00Z", localArrival: "2024-11-03T01:30:00-05:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "spring-forward": [
    '[{ departure: "2024-03-10T01:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-03-10T03:30:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-03-10T07:30:00Z", localArrival: "2024-03-10T03:30:00-04:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "published-local": [
    '[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-06-15T15:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T15:00:00Z", localArrival: "2024-06-15T15:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }',
  ],
  "berlin-fall-back": [
    '[{ departure: "2024-10-27T02:30:00", duration: "PT1H", timeZone: "Europe/Amsterdam" }], { startTimeZone: "Europe/Berlin" }',
    '{ eta: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]", legTimes: [{ arrival: "2024-10-27T01:30:00Z", localArrival: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]", dwellAfter: "PT0S" }] }',
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderTimetableReaderTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountTimetableReader(root, args, controller.signal);
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

describe("renderTimetableReaderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("has no placeholder on any printed-departure field", () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    for (let i = 1; i <= 4; i++) {
      expect(q(root, `departure-${i}`).hasAttribute("placeholder")).toBe(false);
    }
  });
});

describe("mountTimetableReader", () => {
  it.each(TIMETABLE_PRESETS.map((p) => [p.id]))(
    "prints row 1's documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;
      expect(q(root, "copy-timetable").dataset.copyText).toBe(
        `scheduleDelivery(${call})`,
      );
      expect(
        q(root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(result);
    },
  );

  it("shows the same Leaves text on rows 2 and 3 of spring-forward", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    const row3 = root.querySelector('[data-role="row-3-display"]')!;
    const leaves2 = row2.querySelectorAll("td")[1]!.textContent;
    const leaves3 = row3.querySelectorAll("td")[1]!.textContent;
    expect(leaves2).toBe(leaves3);
    expect(leaves2).toContain("2024-03-10T03:30:00-04:00");
  });

  it("badges row 2 of spring-forward as skipped", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    expect(row2.textContent).toContain("Never shows on the clock");
  });

  it("badges row 2 of fall-back as twice", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    expect(row2.textContent).toContain("Occurs twice");
  });

  it("gives NO SIGNAL and the skipped-offset reason for -05:00 typed into the skipped row (V83)", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    type(root, "offset-2", "-05:00");
    const rowPick = q<HTMLSelectElement>(root, "row-pick");
    rowPick.value = "1";
    rowPick.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "timetable-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(SKIPPED_OFFSET_TEXT);
  });

  it("renders the chat seed (V84) with the Occurs-twice badge", async () => {
    const seed = {
      startTimeZone: "Europe/Berlin",
      departures: ["2024-10-27T02:30:00"],
      duration: "PT1H",
      timeZone: "Europe/Amsterdam",
    };
    const { root } = await mount(seed);
    expect(
      q(root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
    ).toBe(EXPECTED["berlin-fall-back"]![1]);
    const row1 = root.querySelector('[data-role="row-1-display"]')!;
    expect(row1.textContent).toContain("Occurs twice");
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of TIMETABLE_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("timetable", state);
      const seeded = seedFromLocation("timetable", url.slice(url.indexOf("?")));
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      expect(
        q(again.root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(result);
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountTimetableReader(root, {}, controller.signal);
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
