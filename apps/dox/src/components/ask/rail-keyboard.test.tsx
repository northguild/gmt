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
import { act, render, within } from "@testing-library/react";
import type { WidgetHandle } from "~/lib/widget-mount";
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

/**
 * Render a widget through the panel and resolve once `mount()` has finished.
 *
 * `renderTemplate` writes the controls synchronously, but `mount` seeds values and
 * attaches listeners only after it has loaded gmt — a cold dynamic import that
 * can take well over a second when the whole workspace's suites run at once.
 * Polling the DOM for "looks ready" (`waitFor` / `findBy*`, 1s default) raced
 * that import and made this file flaky. `onHandle` fires exactly when the mount
 * resolves, so awaiting it removes the race instead of widening the timeout;
 * after it, every read below is synchronous.
 */
async function renderMounted(name: string, rawArgs: unknown, idPrefix: string) {
  const resolved = resolveWidget(name, rawArgs);
  expect(resolved.ok).toBe(true);
  if (!resolved.ok) throw new Error(`unknown widget ${name}`);

  let resolveHandle!: (handle: WidgetHandle) => void;
  const mounted = new Promise<WidgetHandle>((resolve) => {
    resolveHandle = resolve;
  });

  const { container } = render(
    <MountedWidget
      entry={resolved.entry}
      args={resolved.args}
      idPrefix={idPrefix}
      onHandle={(handle) => {
        if (handle) resolveHandle(handle);
      }}
    />,
  );

  await act(async () => {
    await mounted;
  });

  return { container, view: within(container) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a widget mounted in the panel", () => {
  it("is reachable and operable by keyboard, exactly as on its own page", async () => {
    const { container, view } = await renderMounted(
      "showIntervalVisualizer",
      {
        aStart: "2024-01-01T00:00:00+00:00[UTC]",
        aEnd: "2024-06-30T00:00:00+00:00[UTC]",
        bStart: "2024-04-01T00:00:00+00:00[UTC]",
        bEnd: "2024-12-31T00:00:00+00:00[UTC]",
      },
      "rail-1",
    );
    stubTrackGeometry(container);

    const input = view.getByLabelText("A start") as HTMLInputElement;
    expect(input.value).not.toBe("");

    // Reachable: a real slider, in the tab order, with a name.
    const handle = view.getByRole("slider", { name: "Interval A start" });
    expect(handle.getAttribute("tabindex")).toBe("0");

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
    const { container, view } = await renderMounted(
      "showConverterBench",
      {
        value: "2024-03-15T14:30:00.000-04:00[America/New_York]",
        from: "America/New_York",
        to: "Europe/London",
      },
      "rail-2",
    );

    const out = container.querySelector(
      '[data-role="convert-result"]',
    ) as HTMLElement;
    expect(out.textContent).toContain("[Europe/London]");

    const select = view.getByLabelText("To") as HTMLSelectElement;
    select.focus();
    expect(document.activeElement).toBe(select);

    // Changing a select by keyboard fires `change`, not `input` — the mount
    // listens for both, and this is the half a pointer test never covers.
    await act(async () => {
      select.value = "Asia/Tokyo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(out.textContent).toContain("Asia/Tokyo");
  });
});
