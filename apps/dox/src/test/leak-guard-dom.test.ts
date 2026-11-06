// @vitest-environment jsdom
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { onceDestroy } from "~/lib/widget-mount";
import { html } from "~/widgets/builders";
import { captureState, describeLeaks } from "./leak-guard";
import { renderWidget } from "./render-widget";

describe("describeLeaks in a document", () => {
  it("names a listener left on window or document, and ignores one that was removed", () => {
    const before = captureState();
    const left = () => {};
    const removed = () => {};
    window.addEventListener("resize", left);
    document.addEventListener("keydown", removed);
    document.removeEventListener("keydown", removed);
    try {
      expect(describeLeaks(before, captureState())).toEqual([
        'window "resize" listener was never removed',
      ]);
    } finally {
      window.removeEventListener("resize", left);
    }
    expect(describeLeaks(before, captureState())).toEqual([]);
  });

  it("names a listener method left replaced", () => {
    const before = captureState();
    const real = window.addEventListener;
    window.addEventListener = function (
      this: Window,
      ...args: Parameters<typeof real>
    ) {
      return real.apply(this, args);
    } as typeof real;
    try {
      expect(describeLeaks(before, captureState())).toEqual([
        "window.addEventListener was replaced",
      ]);
    } finally {
      window.addEventListener = real;
    }
    expect(describeLeaks(before, captureState())).toEqual([]);
  });

  it("does not count jsdom's own listeners when the widget recorder passes them through", async () => {
    const before = captureState();
    /* A parsed document's first query starts a selector engine, which listens on window. */
    const parsing: LoadedWidget<never> = {
      renderTemplate: () => html`<p>x</p>`,
      mount: async () => {
        new DOMParser()
          .parseFromString(
            '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
            "image/svg+xml",
          )
          .querySelector("rect");
        return onceDestroy(() => {});
      },
    };
    await renderWidget(parsing);
    const leaks = describeLeaks(before, captureState());
    expect(leaks.filter((line) => line.includes("listener was"))).toEqual([]);
  });

  it("does not count a listener that removes itself", () => {
    const before = captureState();
    window.addEventListener("resize", () => {}, { once: true });
    window.addEventListener("resize", () => {}, {
      signal: AbortSignal.abort(),
    });
    expect(describeLeaks(before, captureState())).toEqual([]);
  });
});
