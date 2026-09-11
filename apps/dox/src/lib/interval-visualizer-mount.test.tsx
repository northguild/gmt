/**
 * @vitest-environment jsdom
 *
 * The interval visualizer, driven end to end. Follows the pattern set by
 * `converter-bench-mount.test.tsx`, plus the two things this widget has and
 * that one does not: a drag path and keyboard scrubbing.
 *
 * The alignment assertions matter more here than anywhere else in DOX-C3b. Six
 * rows share one timeline and are positioned as percentages against it, so a
 * result bar that is subtly out of step with the intervals it describes still
 * renders, still looks plausible, and is wrong.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  mountIntervalVisualizer,
  renderIntervalTemplate,
} from "./interval-visualizer-mount";
import { INTERVAL_OPERATIONS } from "./interval-visualizer";

installJsdomShims();

/** Roles the mount reads. Every lookup is null-tolerant, so a missing one makes
 *  a control inert instead of throwing — which a test has to catch instead. */
const REQUIRED_ROLES = [
  "relationship-preset",
  "preset-description",
  "timeline",
  "track-a",
  "track-b",
  "bar-a",
  "bar-b",
  "handle-a-start",
  "handle-a-end",
  "handle-b-start",
  "handle-b-end",
  "a-start",
  "a-end",
  "b-start",
  "b-end",
  "relationship-aside",
];

/** jsdom gives every element a zero-sized rect, so the drag maths divides by
 *  zero. A fixed 1000px track makes clientX map to a percentage directly. */
function stubTrackGeometry(root: HTMLElement) {
  for (const track of root.querySelectorAll(".gmt-interval-track")) {
    (track as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 20,
        right: 1000,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderIntervalTemplate();
  document.body.append(root);
  stubTrackGeometry(root);
  const controller = new AbortController();
  const handle = await mountIntervalVisualizer(root, args, controller.signal);
  return { root, handle, controller };
}

const q = (root: HTMLElement, role: string) =>
  root.querySelector(`[data-role="${role}"]`);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderIntervalTemplate", () => {
  it("carries every role the mount reads", () => {
    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(q(root, role), `missing [data-role="${role}"]`).not.toBeNull();
    }
  });

  it("gives every operation both a result track and an output", () => {
    // The six-row alignment depends on there being exactly one track per
    // operation, in registry order.
    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    for (const op of INTERVAL_OPERATIONS) {
      expect(q(root, `op-track-${op.id}`), op.id).not.toBeNull();
      expect(q(root, `op-output-${op.id}`), op.id).not.toBeNull();
      expect(q(root, `call-${op.id}`), op.id).not.toBeNull();
    }
  });

  it("renders exactly six rows on the timeline", () => {
    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    const rows = root.querySelectorAll(".gmt-interval-row");
    expect(rows).toHaveLength(2 + INTERVAL_OPERATIONS.length);
  });

  it("orders the result rows to match the operations registry", () => {
    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    const trackOrder = [
      ...root.querySelectorAll("[data-role^='op-track-']"),
    ].map((el) => (el as HTMLElement).dataset.role?.replace("op-track-", ""));
    expect(trackOrder).toEqual(INTERVAL_OPERATIONS.map((op) => op.id));
  });

  it("gives each handle a slider role and a label", () => {
    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    const handles = root.querySelectorAll("[data-role^='handle-']");
    expect(handles).toHaveLength(4);
    for (const h of handles) {
      expect(h.getAttribute("role")).toBe("slider");
      expect(h.getAttribute("tabindex")).toBe("0");
      expect(h.getAttribute("aria-label")).toBeTruthy();
    }
  });
});

describe("mountIntervalVisualizer", () => {
  it("fills the typed inputs from the default preset", async () => {
    const { root } = await mount();
    for (const role of ["a-start", "a-end", "b-start", "b-end"]) {
      expect((q(root, role) as HTMLInputElement).value).not.toBe("");
    }
  });

  it("computes every operation on mount", async () => {
    const { root } = await mount();
    for (const op of INTERVAL_OPERATIONS) {
      const out = q(root, `op-output-${op.id}`) as HTMLElement;
      expect(out.textContent?.trim(), op.id).not.toBe("");
    }
  });

  it("recomputes when an interval is typed", async () => {
    const { root } = await mount();
    const before = (q(root, "op-output-intersection") as HTMLElement)
      .textContent;

    const aStart = q(root, "a-start") as HTMLInputElement;
    aStart.value = "2024-09-01T00:00:00+00:00[UTC]";
    aStart.dispatchEvent(new Event("input", { bubbles: true }));

    expect(
      (q(root, "op-output-intersection") as HTMLElement).textContent,
    ).not.toBe(before);
  });

  it("moves an interval when its handle is dragged", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-a-start") as HTMLElement;
    const before = (q(root, "a-start") as HTMLInputElement).value;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    root.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 250,
      }),
    );
    root.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );

    expect((q(root, "a-start") as HTMLInputElement).value).not.toBe(before);
  });

  it("ignores a pointermove that no handle started", async () => {
    const { root } = await mount();
    const before = (q(root, "a-start") as HTMLInputElement).value;
    root.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 900 }),
    );
    expect((q(root, "a-start") as HTMLInputElement).value).toBe(before);
  });

  it("scrubs a handle with the keyboard, which is the non-drag equivalent", async () => {
    // DOX-B2c requires a keyboard path for the drag, and DOX-C3b requires the
    // mounted widget to keep it.
    const { root } = await mount();
    const handle = q(root, "handle-a-start") as HTMLElement;
    const input = q(root, "a-start") as HTMLInputElement;
    const before = input.value;

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    const afterOneDay = input.value;
    expect(afterOneDay).not.toBe(before);

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(input.value).not.toBe(afterOneDay);
  });

  it("takes a bigger step with Shift held", async () => {
    const { root } = await mount();
    const handle = q(root, "handle-a-start") as HTMLElement;
    const input = q(root, "a-start") as HTMLInputElement;

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    const small = input.value;

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    handle.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(input.value).not.toBe(small);
  });

  it("switches the whole scenario when the preset changes", async () => {
    /* Asserted on `a-end` and `b-start`, not `a-start`: every preset in
       `buildRelationshipPreset` starts A on 2024-01-01, so `a-start` is the one
       field that never moves and a test watching it would pass forever. */
    const { root } = await mount();
    const aEndBefore = (q(root, "a-end") as HTMLInputElement).value;
    const bStartBefore = (q(root, "b-start") as HTMLInputElement).value;

    const preset = q(root, "relationship-preset") as HTMLSelectElement;
    preset.value = "disjoint";
    preset.dispatchEvent(new Event("change", { bubbles: true }));

    expect((q(root, "a-end") as HTMLInputElement).value).not.toBe(aEndBefore);
    expect((q(root, "b-start") as HTMLInputElement).value).not.toBe(
      bStartBefore,
    );
    expect((q(root, "preset-description") as HTMLElement).textContent).not.toBe(
      "",
    );
  });

  it("reports disjoint intervals as a real empty result, not as invalid input", async () => {
    /* The widget's whole reason for existing (see the component docstring): the
       library returns the same sentinel for "you gave me nonsense" and "these
       genuinely do not overlap", and conflating them teaches the reader the
       wrong thing. */
    const { root } = await mount();
    const preset = q(root, "relationship-preset") as HTMLSelectElement;
    preset.value = "disjoint";
    preset.dispatchEvent(new Event("change", { bubbles: true }));

    const out = q(root, "op-output-intersection") as HTMLElement;
    expect(out.textContent?.trim()).not.toBe("");
    expect(out.className).not.toContain("invalid");
  });

  it("seeds from arguments, overriding the preset", async () => {
    const seeded = "2024-05-05T00:00:00+00:00[UTC]";
    const { root } = await mount({ aStart: seeded });
    expect((q(root, "a-start") as HTMLInputElement).value).toBe(seeded);
    // And the answer was recomputed against it, not left stale.
    expect(
      (q(root, "op-output-intersection") as HTMLElement).textContent?.trim(),
    ).not.toBe("");
  });

  it("reports live state for a permalink", async () => {
    const { root, handle } = await mount();
    const aStart = q(root, "a-start") as HTMLInputElement;
    aStart.value = "2024-02-02T00:00:00+00:00[UTC]";
    aStart.dispatchEvent(new Event("input", { bubbles: true }));

    expect(handle.getPermalinkState?.()).toMatchObject({
      aStart: "2024-02-02T00:00:00+00:00[UTC]",
    });
  });

  it("survives destroy twice and an aborted mount", async () => {
    const { handle } = await mount();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();

    const root = document.createElement("div");
    root.innerHTML = renderIntervalTemplate();
    const controller = new AbortController();
    controller.abort();
    const inert = await mountIntervalVisualizer(root, {}, controller.signal);
    expect(() => inert.destroy()).not.toThrow();
  });
});

/**
 * Regression: the values Gemini actually sent.
 *
 * Asked "if one meeting runs 9am to 11am and another runs 10am to noon, how do
 * they overlap?", the model called the tool with plain date-times. This widget
 * is the zoned one, so every input failed `isValidZonedDateTime`, the timeline
 * drew nothing, and the panel said "Invalid input" — until the reader changed a
 * preset, which overwrote the inputs with the widget's own valid values and made
 * it work. A widget that only works after you touch it is worse than one that
 * visibly fails, which is why this is a test and not a prompt tweak.
 */
describe("seeding with unzoned values, as a model actually supplies them", () => {
  const PLAIN = {
    aStart: "2024-10-24T09:00:00",
    aEnd: "2024-10-24T11:00:00",
    bStart: "2024-10-24T10:00:00",
    bEnd: "2024-10-24T12:00:00",
  };

  it("does not show the Invalid input caution", async () => {
    /* Asserted on `relationship-aside`, which is where `render()` actually puts
       that message, and on the bars' invalid class. An earlier version of this
       test checked the op outputs for the word "invalid" — those are populated
       either way, so it passed with the bug present. */
    const { root } = await mount(PLAIN);

    const aside =
      (q(root, "relationship-aside") as HTMLElement).textContent ?? "";
    expect(aside).not.toContain("Invalid input");
    expect(
      root.querySelectorAll(".gmt-interval-bar--invalid"),
      "an interval bar is flagged invalid",
    ).toHaveLength(0);
  });

  it("computes a real result for every operation", async () => {
    const { root } = await mount(PLAIN);
    for (const op of INTERVAL_OPERATIONS) {
      const out = q(root, `op-output-${op.id}`) as HTMLElement;
      expect(out.textContent?.trim(), op.id).not.toBe("");
    }
  });

  it("draws the timeline bars, which is what the reader saw missing", async () => {
    const { root } = await mount(PLAIN);
    /* Asserted as a *readable* width, not merely a non-zero one. The earlier
       version checked `!== "0%"` and passed while the bug was present: a
       two-hour interval on the fixed calendar-2024 canvas is 0.02% wide and was
       floored to the 0.5% minimum, so it was technically drawn and visually a
       hairline. Anything under a few percent is the bug. */
    for (const role of ["bar-a", "bar-b"]) {
      const bar = q(root, role) as HTMLElement;
      const width = Number.parseFloat(bar.style.width);
      expect(width, `${role} width`).toBeGreaterThan(5);
    }
  });

  it("separates the two intervals instead of stacking them on one pixel", async () => {
    /* The reported symptom: every handle landed on the same spot, so A and B
       were indistinguishable even though the values behind them differed. */
    const { root } = await mount(PLAIN);
    const left = (role: string) =>
      Number.parseFloat((q(root, role) as HTMLElement).style.left);
    expect(left("bar-b") - left("bar-a")).toBeGreaterThan(5);
  });

  it("rescales the axis to the seeded span", async () => {
    const { root } = await mount(PLAIN);
    const labels = [
      ...(q(root, "axis") as HTMLElement).querySelectorAll("span"),
    ].map((s) => s.textContent);
    // A three-hour meeting has no business being labelled Jan / Jul / Dec.
    expect(labels).not.toContain("Jan 2024");
    for (const label of labels) expect(label).toMatch(/^\d{2}:\d{2}$/);
  });

  it("gives the seeded canvas a step a reader can scrub with", async () => {
    /* One arrow press moved a whole day, which on a three-hour canvas ran
       straight to the clamp and looked like the handle was stuck. */
    const { root } = await mount(PLAIN);
    const before = (q(root, "a-start") as HTMLInputElement).value;
    const handle = q(root, "handle-a-start") as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    const after = (q(root, "a-start") as HTMLInputElement).value;
    expect(after).not.toBe(before);
    expect(after).toContain("2024-10-24");
  });

  it("finds the one-hour overlap the reader asked about", async () => {
    // 09:00-11:00 against 10:00-12:00 intersects at 10:00-11:00.
    const { root } = await mount(PLAIN);
    const out =
      (q(root, "op-output-intersection") as HTMLElement).textContent ?? "";
    expect(out).toContain("10:00");
    expect(out).toContain("11:00");
  });

  it("keeps the reader's values visible, repaired rather than replaced", async () => {
    const { root } = await mount(PLAIN);
    // The date and time they meant survive; only the zone is added.
    expect((q(root, "a-start") as HTMLInputElement).value).toContain(
      "2024-10-24T09:00:00",
    );
  });

  it("still honours an explicit zone when the model supplies one", async () => {
    const { root } = await mount({
      ...PLAIN,
      aStart: "2024-10-24T09:00:00-04:00[America/New_York]",
    });
    expect((q(root, "a-start") as HTMLInputElement).value).toBe(
      "2024-10-24T09:00:00-04:00[America/New_York]",
    );
  });
});
