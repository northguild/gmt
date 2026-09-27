/**
 * @vitest-environment jsdom
 *
 * The Connection Checker widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed call
 * and result are section 9 rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { CONNECTION_PRESETS } from "./connection-checker";
import {
  mountConnectionChecker,
  renderConnectionCheckerTemplate,
} from "./connection-checker-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "inbound-departure",
  "inbound-duration",
  "port-zone",
  "handling",
  "handling-value",
  "onward-departure",
  "onward-duration",
  "onward-zone",
  "verdict",
  "naive-verdict",
  "handoff-strip",
  "handoff-summary",
  "reason-aside",
  "call-connection",
  "copy-connection",
  "connection-output",
];

const EXPECTED: Record<string, [string, string | null]> = {
  made: [
    '[{ departure: "2024-06-14T22:10:00+02:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    '{ eta: "2024-06-16T02:00:00+02:00[Europe/Rome]", legTimes: [{ arrival: "2024-06-15T11:10:00Z", localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]", dwellAfter: "PT45M" }, { arrival: "2024-06-16T00:00:00Z", localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]", dwellAfter: "PT0S" }] }',
  ],
  "zero-slack": [
    '[{ departure: "2024-06-14T22:10:00+02:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT50M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    '{ eta: "2024-06-16T02:00:00+02:00[Europe/Rome]", legTimes: [{ arrival: "2024-06-15T11:10:00Z", localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]", dwellAfter: "PT50M" }, { arrival: "2024-06-16T00:00:00Z", localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]", dwellAfter: "PT0S" }] }',
  ],
  "spring-forward": [
    '[{ departure: "2024-03-30T22:10:00+01:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-03-31T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    null,
  ],
  "zone-change": [
    '[{ departure: "2024-06-15T12:10:00+01:00[Europe/London]", duration: "PT1H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-06-15T14:00:00[Europe/Amsterdam]", duration: "PT12H", timeZone: "Europe/Rome" }]',
    null,
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderConnectionCheckerTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountConnectionChecker(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

function slide(root: HTMLElement, value: string) {
  const input = q<HTMLInputElement>(root, "handling");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderConnectionCheckerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConnectionCheckerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("uses a real range input for handling", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConnectionCheckerTemplate();
    const input = q<HTMLInputElement>(root, "handling");
    expect(input.type).toBe("range");
    expect(input.min).toBe("0");
    expect(input.max).toBe("240");
    expect(input.step).toBe("1");
  });

  it("puts the departure field first in each three-field row, for the CSS :first-child rule that gives it a double share of the width", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConnectionCheckerTemplate();
    const rows = [
      ...root.querySelectorAll(".gmt-connection-fields"),
    ] as HTMLElement[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const firstInput = row.querySelector(
        "label:first-child input, label:first-child select",
      );
      expect(firstInput?.getAttribute("data-role")).toMatch(/departure$/);
    }
  });
});

describe("mountConnectionChecker", () => {
  it.each(CONNECTION_PRESETS.map((p) => [p.id]))(
    "prints the documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;
      expect(q(root, "copy-connection").dataset.copyText).toBe(
        `scheduleDelivery(${call})`,
      );
      if (result === null) {
        expect(q(root, "connection-output").textContent).toBe("NO SIGNAL");
      } else {
        expect(
          q(root, "connection-output").textContent!.replace(/\n\s+/g, " "),
        ).toBe(result);
      }
    },
  );

  it("shows both verdict texts and the disagrees badge only on spring-forward and zone-change", async () => {
    for (const id of ["made", "zero-slack"]) {
      const { root } = await mount();
      choosePreset(root, id);
      expect(q(root, "verdict").textContent).toBeTruthy();
      expect(q(root, "naive-detail").textContent).toContain("made");
      expect(root.querySelector('[data-role="disagrees"]')).toBeNull();
    }
    for (const id of ["spring-forward", "zone-change"]) {
      const { root } = await mount();
      choosePreset(root, id);
      expect(q(root, "verdict").textContent).toContain("Missed");
      expect(root.querySelector('[data-role="disagrees"]')).not.toBeNull();
    }
  });

  it("gives zero slack at 50 and misses by 1 min at 51", async () => {
    const { root } = await mount();
    choosePreset(root, "made");
    slide(root, "50");
    expect(q(root, "verdict").textContent).toContain("zero slack");
    slide(root, "51");
    expect(q(root, "verdict").textContent).toContain("Missed");
    expect(q(root, "verdict").textContent).toContain("1 min");
  });

  it("carries dwellAfter PT0M at zero handling (V64)", async () => {
    const { root } = await mount();
    choosePreset(root, "made");
    slide(root, "0");
    expect(q(root, "copy-connection").dataset.copyText).toContain(
      'dwellAfter: "PT0M"',
    );
  });

  it("renders the chat seed as NO SIGNAL, a missed verdict, and a naive made", async () => {
    const seed = {
      inboundDeparture: "2024-03-30T22:10:00+01:00[Europe/Berlin]",
      inboundDuration: "PT15H",
      portZone: "Europe/Amsterdam",
      handlingMinutes: 45,
      onwardDeparture: "2024-03-31T14:00:00[Europe/Amsterdam]",
    };
    const { root } = await mount(seed);
    expect(q(root, "connection-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "verdict").textContent).toContain("Missed");
    expect(q(root, "naive-detail").textContent).toContain("made");
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of CONNECTION_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("connection", state);
      const seeded = seedFromLocation(
        "connection",
        url.slice(url.indexOf("?")),
      );
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      if (result === null) {
        expect(q(again.root, "connection-output").textContent).toBe(
          "NO SIGNAL",
        );
      } else {
        expect(
          q(again.root, "connection-output").textContent!.replace(
            /\n\s+/g,
            " ",
          ),
        ).toBe(result);
      }
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderConnectionCheckerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountConnectionChecker(root, {}, controller.signal);
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
