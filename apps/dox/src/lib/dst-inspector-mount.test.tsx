/**
 * @vitest-environment jsdom
 *
 * The DST transition inspector, driven end to end — the widget the story's
 * motivating example needs: *"what happens to 1:30am on November 3rd in New
 * York"*.
 *
 * Two things here are not covered by the other two widgets' tests:
 *
 *   - **Scrub state held outside `render()`.** A drag must survive the
 *     re-renders that happen while it is in progress; the whole point of
 *     keeping `tickerWindow` and `handleMinuteOfDay` in the closure is that an
 *     unrelated render cannot reset them.
 *   - **Pointer capture.** jsdom does not implement it, so the shims stub it;
 *     the teardown releases it, because a capture left set routes later pointer
 *     events at a node that is no longer in the document.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { mountDstInspector, renderDstTemplate } from "./dst-inspector-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "zone",
  "year",
  "value-preset",
  "unit",
  "disambiguation",
  "offset",
  "transition-body",
  "probe-result",
  "ticker",
  "ticker-empty",
  "ticker-track",
  "ticker-handle",
  "ticker-status",
  "ticker-ticks",
  "ticker-zone",
  "zone-label-start",
  "zone-label-end",
  "preset-description",
  "explanation",
  "call-getdst",
  "call-startof",
];

function stubTrackGeometry(root: HTMLElement) {
  const track = root.querySelector('[data-role="ticker-track"]') as HTMLElement;
  if (track) {
    track.getBoundingClientRect = () =>
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
  root.innerHTML = renderDstTemplate(args);
  document.body.append(root);
  stubTrackGeometry(root);
  const controller = new AbortController();
  const handle = await mountDstInspector(root, args, controller.signal);
  return { root, handle, controller };
}

const q = (root: HTMLElement, role: string) =>
  root.querySelector(`[data-role="${role}"]`);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderDstTemplate", () => {
  it("carries every role the mount reads", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(q(root, role), `missing [data-role="${role}"]`).not.toBeNull();
    }
  });

  it("starts the ticker and its empty note hidden", () => {
    // Both are revealed by the first render, based on the preset. Shipping
    // either visible would flash content the reader should not see.
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate();
    expect((q(root, "ticker") as HTMLElement).hasAttribute("hidden")).toBe(
      true,
    );
    expect(
      (q(root, "ticker-empty") as HTMLElement).hasAttribute("hidden"),
    ).toBe(true);
  });

  it("paints seeded arguments", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate({
      zone: "Europe/London",
      year: 2026,
      preset: "overlap",
      disambiguation: "earlier",
      offset: "reject",
    });
    expect((q(root, "zone") as HTMLSelectElement).value).toBe("Europe/London");
    expect((q(root, "year") as HTMLInputElement).value).toBe("2026");
    expect((q(root, "value-preset") as HTMLSelectElement).value).toBe(
      "overlap",
    );
    expect((q(root, "disambiguation") as HTMLSelectElement).value).toBe(
      "earlier",
    );
    expect((q(root, "offset") as HTMLSelectElement).value).toBe("reject");
  });

  it("appends a seeded zone the curated list does not contain", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate({ zone: "Pacific/Chatham" });
    expect((q(root, "zone") as HTMLSelectElement).value).toBe(
      "Pacific/Chatham",
    );
  });

  it("gives the ticker handle a slider role and a label", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate();
    const handle = q(root, "ticker-handle") as HTMLElement;
    expect(handle.getAttribute("role")).toBe("slider");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("mountDstInspector", () => {
  it("lists the year's real transitions", async () => {
    const { root } = await mount();
    const rows = (q(root, "transition-body") as HTMLElement).querySelectorAll(
      "tr",
    );
    // New York has two transitions in 2024.
    expect(rows.length).toBe(2);
  });

  it("answers the story's motivating question", async () => {
    // "What happens to 1:30am on November 3rd in New York" — the overlap.
    const { root } = await mount({
      zone: "America/New_York",
      year: 2024,
      preset: "overlap",
    });

    const table = (q(root, "transition-body") as HTMLElement).textContent ?? "";
    expect(table).toContain("2024-11-03");

    const out = q(root, "probe-result") as HTMLElement;
    expect(out.textContent?.trim()).not.toBe("");
    // The ticker is the scrubbable window around that transition.
    expect((q(root, "ticker") as HTMLElement).hasAttribute("hidden")).toBe(
      false,
    );
  });

  it("recomputes when the zone changes", async () => {
    const { root } = await mount();
    const before = (q(root, "transition-body") as HTMLElement).innerHTML;

    const zone = q(root, "zone") as HTMLSelectElement;
    zone.value = "Australia/Sydney";
    zone.dispatchEvent(new Event("change", { bubbles: true }));

    expect((q(root, "transition-body") as HTMLElement).innerHTML).not.toBe(
      before,
    );
  });

  it("shows a zone with no DST as having no transitions", async () => {
    const { root } = await mount({ zone: "UTC", year: 2024 });
    const rows = (q(root, "transition-body") as HTMLElement).querySelectorAll(
      "tr",
    );
    // Either no rows, or an explicit empty state — never a fabricated one.
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it("changes the answer when disambiguation changes", async () => {
    // The widget's teaching point: the same wall-clock time resolves
    // differently depending on how you ask.
    const { root } = await mount({ preset: "overlap" });
    const before = (q(root, "probe-result") as HTMLElement).textContent;

    const dis = q(root, "disambiguation") as HTMLSelectElement;
    dis.value = "later";
    dis.dispatchEvent(new Event("change", { bubbles: true }));

    expect((q(root, "probe-result") as HTMLElement).textContent).not.toBe(
      before,
    );
  });

  it("scrubs the ticker with the keyboard", async () => {
    const { root } = await mount({ preset: "gap" });
    const handle = q(root, "ticker-handle") as HTMLElement;
    const status = q(root, "ticker-status") as HTMLElement;
    const before = status.textContent;

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(status.textContent).not.toBe(before);
  });

  it("scrubs the ticker by dragging, through pointer capture", async () => {
    const { root } = await mount({ preset: "gap" });
    const handle = q(root, "ticker-handle") as HTMLElement;
    const track = q(root, "ticker-track") as HTMLElement;
    const status = q(root, "ticker-status") as HTMLElement;
    const before = status.textContent;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    /* 400/1000 lands inside the gap for New York 2024. Chosen deliberately:
       it asserts the widget's whole teaching point rather than merely that
       something moved. (An earlier draft used 750, which maps to exactly the
       03:00 the handle already starts at — a coordinate that would have made
       this test pass whether or not dragging worked at all.) */
    track.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 400,
      }),
    );
    expect(status.textContent).not.toBe(before);
    expect(status.textContent).toContain("never happens");

    track.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    const settled = status.textContent;
    // After pointerup the drag is over: further movement must not scrub.
    track.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 0 }),
    );
    expect(status.textContent).toBe(settled);
  });

  it("keeps scrub state across an unrelated re-render mid-drag", async () => {
    /* The reason `tickerWindow` and `handleMinuteOfDay` live outside `render()`.
       Changing `unit` re-renders; a drag in progress must survive it. */
    const { root } = await mount({ preset: "gap" });
    const handle = q(root, "ticker-handle") as HTMLElement;
    const track = q(root, "ticker-track") as HTMLElement;
    const status = q(root, "ticker-status") as HTMLElement;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    track.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 600,
      }),
    );

    const unit = q(root, "unit") as HTMLSelectElement;
    unit.value = "day";
    unit.dispatchEvent(new Event("change", { bubbles: true }));

    // Still dragging: a further move still scrubs.
    const midRender = status.textContent;
    track.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 300,
      }),
    );
    expect(status.textContent).not.toBe(midRender);
  });

  it("reports live state for a permalink", async () => {
    const { root, handle } = await mount();
    const zone = q(root, "zone") as HTMLSelectElement;
    zone.value = "Europe/Berlin";
    zone.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handle.getPermalinkState?.()).toMatchObject({
      zone: "Europe/Berlin",
      year: 2024,
    });
  });

  it("releases a pointer capture held mid-drag on destroy", async () => {
    // Otherwise the browser keeps routing pointer events at a detached node.
    const { root, handle } = await mount({ preset: "gap" });
    const tickerHandle = q(root, "ticker-handle") as HTMLElement;

    const released: number[] = [];
    tickerHandle.hasPointerCapture = () => true;
    tickerHandle.releasePointerCapture = (id: number) => {
      released.push(id);
    };

    tickerHandle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    handle.destroy();
    expect(released.length).toBeGreaterThan(0);
  });

  it("survives destroy twice and an aborted mount", async () => {
    const { handle } = await mount();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();

    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate();
    const controller = new AbortController();
    controller.abort();
    const inert = await mountDstInspector(root, {}, controller.signal);
    expect(() => inert.destroy()).not.toThrow();
  });
});

describe("template escaping", () => {
  it("neutralises a quote injected through a zone name", () => {
    // See converter-bench-mount.test.tsx for why this matters: Astro used to do
    // this escaping for us, and a template string does not.
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate({
      zone: `" autofocus onfocus="alert(1)`,
    });
    const select = root.querySelector(
      '[data-role="zone"]',
    ) as HTMLSelectElement;
    const injected = [...select.options].at(-1) as HTMLOptionElement;
    expect(injected.getAttribute("value")).toBe(
      `" autofocus onfocus="alert(1)`,
    );
    expect(injected.hasAttribute("onfocus")).toBe(false);
  });

  it("neutralises a tag injected through the year", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDstTemplate({
      year: `2024"><script>alert(1)</script>` as unknown as number,
    });
    expect(root.querySelector("script")).toBeNull();
  });
});
