/**
 * @vitest-environment jsdom
 *
 * The Crossing Clock widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed call
 * and result are section 9 rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { CROSSING_PRESETS } from "./crossing-clock";
import {
  mountCrossingClock,
  renderCrossingClockTemplate,
} from "./crossing-clock-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "entry",
  "exit",
  "target-zone",
  "entry-clock",
  "entry-time",
  "entry-meta",
  "entry-date",
  "exit-clock",
  "exit-time",
  "exit-meta",
  "exit-date",
  "elapsed",
  "naive",
  "ruler",
  "ruler-summary",
  "legend",
  "reason-aside",
  "call-crossing",
  "copy-crossing",
  "crossing-output",
];

const EXPECTED: Record<string, [string, string | null]> = {
  canal: [
    '"2024-06-15T08:00:00Z", "2024-06-15T17:30:00Z", "Europe/Berlin"',
    '{ duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]" }',
  ],
  "spring-forward": [
    '"2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "America/New_York"',
    '{ duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" }',
  ],
  "fall-back": [
    '"2024-11-03T05:30:00Z", "2024-11-03T06:30:00Z", "America/New_York"',
    '{ duration: "PT1H", enter: "2024-11-03T01:30:00-04:00[America/New_York]", exit: "2024-11-03T01:30:00-05:00[America/New_York]" }',
  ],
  "fixed-offset": [
    '"2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "-05:00"',
    '{ duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[-05:00]", exit: "2024-03-10T07:00:00-05:00[-05:00]" }',
  ],
  "read-elsewhere": [
    '"2024-06-15T08:00:00+02:00[Europe/Berlin]", "2024-06-15T17:30:00+02:00[Europe/Berlin]", "America/Panama"',
    '{ duration: "PT9H30M", enter: "2024-06-15T01:00:00-05:00[America/Panama]", exit: "2024-06-15T10:30:00-05:00[America/Panama]" }',
  ],
  inverted: [
    '"2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London"',
    null,
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderCrossingClockTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountCrossingClock(root, args, controller.signal);
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

describe("renderCrossingClockTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrossingClockTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("has no placeholder on entry or exit", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrossingClockTemplate();
    expect(q(root, "entry").hasAttribute("placeholder")).toBe(false);
    expect(q(root, "exit").hasAttribute("placeholder")).toBe(false);
  });

  it("gives entry and exit a double share of the row, target-zone a single one", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrossingClockTemplate();
    const row = root.querySelector(".gmt-crossing-fields")!;
    const labels = [...row.querySelectorAll(":scope > label")];
    expect(labels).toHaveLength(3);
    expect(labels[0]!.querySelector("input")?.dataset.role).toBe("entry");
    expect(labels[1]!.querySelector("input")?.dataset.role).toBe("exit");
    expect(labels[2]!.querySelector("select")?.dataset.role).toBe(
      "target-zone",
    );
  });
});

describe("mountCrossingClock", () => {
  it.each(CROSSING_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;
      expect(q(root, "copy-crossing").dataset.copyText).toBe(
        `crossingTime(${call})`,
      );
      if (result === null) {
        expect(q(root, "crossing-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(root, "crossing-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
    },
  );

  it("shows the elapsed and naive readings, agreeing on the fixed-offset preset", async () => {
    const { root } = await mount();
    choosePreset(root, "fixed-offset");
    expect(q(root, "elapsed").textContent).toContain("PT7H");
    expect(q(root, "naive").textContent).toContain("agrees");
  });

  it("shows the naive reading disagreeing on spring-forward", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    expect(q(root, "elapsed").textContent).toContain("PT7H");
    expect(q(root, "naive").textContent).toContain("more than elapsed");
  });

  it("shows the null reason for the inverted preset", async () => {
    const { root } = await mount();
    choosePreset(root, "inverted");
    expect(q(root, "reason-aside").textContent).toContain(
      "data error, not a negative transit",
    );
  });

  it("names the skip and the repeat in the strip's hidden summary and its change list", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    expect(q(root, "ruler-summary").textContent).toContain("never shown");
    expect(q(root, "strip-changes").textContent).toContain(
      "02:00–03:00 never shown",
    );
    expect(
      q(root, "strip-changes").querySelector(
        ".gmt-crossing-strip-change--skip",
      ),
    ).not.toBeNull();

    choosePreset(root, "fall-back");
    expect(q(root, "ruler-summary").textContent).toContain("shown twice");
    expect(q(root, "strip-changes").textContent).toContain(
      "01:00–02:00 shown twice",
    );
    expect(
      q(root, "strip-changes").querySelector(
        ".gmt-crossing-strip-change--repeat",
      ),
    ).not.toBeNull();

    choosePreset(root, "fixed-offset");
    expect(q(root, "strip-changes").textContent).toContain(
      "No clock change during the crossing",
    );
  });

  it("draws the entry and exit crystal clocks from the real result, not arithmetic", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");

    expect(q(root, "entry-time").textContent).toBe("00:00");
    expect(q(root, "entry-meta").textContent).toBe("-05:00 · New York");
    expect(q(root, "entry-date").textContent).toBe("10 Mar 2024");
    expect(q(root, "exit-time").textContent).toBe("08:00");
    expect(q(root, "exit-meta").textContent).toBe("-04:00 · New York");

    // The face is a night-light toggle button (crystal-clock.ts): the
    // accessible name and role live there, and the svg inside is
    // decorative.
    const entryButton = q(root, "entry-clock").querySelector("button")!;
    expect(entryButton.getAttribute("aria-pressed")).toBe("false");
    expect(entryButton.getAttribute("aria-label")).toBe(
      "Entry clock, 00:00, minus 05:00, New York. 02:00–03:00 never shown. Light up the face.",
    );
    const entrySvg = entryButton.querySelector("svg")!;
    expect(entrySvg.getAttribute("aria-hidden")).toBe("true");
    expect(entrySvg.dataset.state).toBe("normal");

    const exitButton = q(root, "exit-clock").querySelector("button")!;
    expect(exitButton.getAttribute("aria-label")).toBe(
      "Exit clock, 08:00, minus 04:00, New York. 02:00–03:00 never shown. Light up the face.",
    );
  });

  it("draws the skipped hour as a dashed sector on both clocks, and the repeated hour as a doubled one", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    for (const prefix of ["entry-clock", "exit-clock"]) {
      const highlights = q(root, prefix).querySelectorAll(
        ".gmt-crystal-clock-highlight--skipped",
      );
      expect(highlights, prefix).toHaveLength(1);
      expect(highlights[0]!.querySelector("title")!.textContent).toBe(
        "02:00–03:00 never shown",
      );
    }

    choosePreset(root, "fall-back");
    for (const prefix of ["entry-clock", "exit-clock"]) {
      const highlights = q(root, prefix).querySelectorAll(
        ".gmt-crystal-clock-highlight--repeated",
      );
      expect(highlights, prefix).toHaveLength(2);
      expect(highlights[0]!.querySelector("title")!.textContent).toBe(
        "01:00–02:00 shown twice",
      );
    }

    choosePreset(root, "fixed-offset");
    for (const prefix of ["entry-clock", "exit-clock"]) {
      expect(
        q(root, prefix).querySelector(".gmt-crystal-clock-highlight"),
      ).toBeNull();
    }
  });

  it("toggles a clock's night-light glow independently, and it never touches a value or the permalink", async () => {
    const { root, handle } = await mount();
    choosePreset(root, "spring-forward");

    const entryButton = q(root, "entry-clock").querySelector("button")!;
    const exitButton = q(root, "exit-clock").querySelector("button")!;
    const before = handle.getPermalinkState?.();

    entryButton.click();
    expect(entryButton.getAttribute("aria-pressed")).toBe("true");
    expect(
      entryButton
        .querySelector("svg")!
        .classList.contains("gmt-crystal-clock--glow"),
    ).toBe(true);
    expect(exitButton.getAttribute("aria-pressed")).toBe("false");
    expect(handle.getPermalinkState?.()).toEqual(before);

    entryButton.click();
    expect(entryButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("marks both clocks repeated when entry and exit read the same wall clock", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");

    expect(q(root, "entry-time").textContent).toBe("01:30");
    expect(q(root, "exit-time").textContent).toBe("01:30");
    expect(q(root, "entry-meta").textContent).toBe("-04:00 · New York");
    expect(q(root, "exit-meta").textContent).toBe("-05:00 · New York");
    expect(q(root, "entry-clock").querySelector("svg")!.dataset.state).toBe(
      "repeated",
    );
    expect(q(root, "exit-clock").querySelector("svg")!.dataset.state).toBe(
      "repeated",
    );
  });

  it("shows the disagrees badge only when the naive reading is wrong", async () => {
    const { root } = await mount();
    choosePreset(root, "fixed-offset");
    expect(q(root, "naive").querySelector(".gmt-transport-badge")).toBeNull();

    choosePreset(root, "spring-forward");
    expect(
      q(root, "naive").querySelector('[data-role="naive-disagrees"]'),
    ).not.toBeNull();
  });

  it("clears both clock faces on a null result", async () => {
    const { root } = await mount();
    choosePreset(root, "inverted");
    expect(q(root, "entry-clock").innerHTML).toBe("");
    expect(q(root, "exit-clock").innerHTML).toBe("");
    expect(q(root, "entry-time").textContent).toBe("");
    expect(q(root, "exit-date").textContent).toBe("");
  });

  it("renders the chat seed (V94)", async () => {
    const seed = {
      entry: "2024-03-10T00:00",
      exit: "2024-03-10T08:00",
      targetZone: "America/New_York",
    };
    const { root } = await mount(seed);
    expect(q(root, "crossing-output").textContent!.replace(/\n\s+/g, " ")).toBe(
      '{ duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" }',
    );
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of CROSSING_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("crossing", state);
      const seeded = seedFromLocation("crossing", url.slice(url.indexOf("?")));
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(q(again.root, "crossing-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(again.root, "crossing-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrossingClockTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountCrossingClock(root, {}, controller.signal);
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
