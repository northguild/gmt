/**
 * @vitest-environment jsdom
 *
 * `DOX-C3b`'s DoD: *"A mounted widget is keyboard-operable inside the panel,
 * matching its standalone page."*
 *
 * The mount modules' own tests prove the keyboard path works when the widget is
 * wired directly. This proves it survives the trip through the panel — the
 * registry's dispatch, the type-erased entry, `MountedWidget`'s effect, and the
 * template being written into a host React owns. Those are exactly the layers
 * that could swallow a `keydown` (a stray `preventDefault`, a re-render that
 * replaces the node between focus and key, a template rendered without
 * `tabindex`), and none of them are exercised by a direct mount.
 *
 * Driven through `resolveWidget` rather than by importing the mount directly,
 * so the test enters by the same door a streamed tool call does.
 */
/// <reference types="vitest/globals" />
import { act, render, waitFor } from "@testing-library/react";
import { installJsdomShims } from "~/test/jsdom-shims";
import { MountedWidget } from "./MountedWidget";
import { resolveWidget } from "./widget-registry";

installJsdomShims();

/** jsdom gives every element a zero-sized rect; the drag maths needs a real one. */
function stubTrackGeometry(root: ParentNode) {
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

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a widget mounted in the panel", () => {
  it("is reachable and operable by keyboard, exactly as on its own page", async () => {
    const resolved = resolveWidget("showIntervalVisualizer", {
      aStart: "2024-01-01T00:00:00+00:00[UTC]",
      aEnd: "2024-06-30T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "2024-12-31T00:00:00+00:00[UTC]",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const { container } = render(
      <MountedWidget
        entry={resolved.entry}
        args={resolved.args}
        idPrefix="rail-1"
      />,
    );

    const input = await waitFor(() => {
      const el = container.querySelector('[data-role="a-start"]');
      if (!el) throw new Error("widget not mounted yet");
      return el as HTMLInputElement;
    });
    await waitFor(() => expect(input.value).not.toBe(""));
    stubTrackGeometry(container);

    const handle = container.querySelector(
      '[data-role="handle-a-start"]',
    ) as HTMLElement;

    // Reachable: a real slider, in the tab order, with a name.
    expect(handle.getAttribute("role")).toBe("slider");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("aria-label")).toBeTruthy();

    handle.focus();
    expect(document.activeElement).toBe(handle);

    // Operable: the key actually moves the interval, through the panel.
    const before = input.value;
    await act(async () => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(input.value).not.toBe(before);

    // And the answer recomputed, so the keyboard drives the whole widget and
    // not just the control it touched.
    const output = container.querySelector(
      '[data-role="op-output-intersection"]',
    ) as HTMLElement;
    expect(output.textContent?.trim()).not.toBe("");
  });

  it("keeps the converter's controls keyboard-operable in the panel", async () => {
    const resolved = resolveWidget("showConverterBench", {
      value: "2024-03-15T14:30:00.000-04:00[America/New_York]",
      from: "America/New_York",
      to: "Europe/London",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const { container } = render(
      <MountedWidget
        entry={resolved.entry}
        args={resolved.args}
        idPrefix="rail-2"
      />,
    );

    /* Waiting for the *element* is not enough: `renderTemplate` writes it
       synchronously, but `mount` attaches the listeners only after two awaits.
       Dispatching in that window is lost silently and the test then fails on a
       timeout that looks like a broken widget. Wait for the first computed
       result, which is the signal that mounting finished. */
    const out = await waitFor(() => {
      const el = container.querySelector('[data-role="convert-result"]');
      if (!el?.textContent?.includes("[")) {
        throw new Error("widget has not produced a result yet");
      }
      return el as HTMLElement;
    });
    const select = container.querySelector(
      '[data-role="convert-target"]',
    ) as HTMLSelectElement;

    select.focus();
    expect(document.activeElement).toBe(select);

    // Changing a select by keyboard fires `change`, not `input` — the mount
    // listens for both, and this is the half a pointer test never covers.
    await act(async () => {
      select.value = "Asia/Tokyo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => expect(out.textContent).toContain("Asia/Tokyo"));
  });
});
