// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { workerTextMatchesPage } from "./text-parity";

/** A 2D context that records its pixels as the text it was asked to draw. */
function fakeContext(ink: number) {
  const calls: string[] = [];
  return {
    font: "",
    lineJoin: "",
    lineWidth: 0,
    strokeStyle: "",
    fillStyle: "",
    strokeText: (text: string) => calls.push(`stroke ${text}`),
    fillText: (text: string) => calls.push(`fill ${text}`),
    getImageData: () => ({ data: new Uint8ClampedArray([ink, ink, ink, 255]) }),
    calls,
  };
}

function stub(pageInk: number, workerInk: number) {
  const page = fakeContext(pageInk);
  const worker = fakeContext(workerInk);
  // Typed as one plain signature: getContext's overloads would make the spy expect the WebGPU
  // context.
  vi.spyOn(
    HTMLCanvasElement.prototype as { getContext(id: string): unknown },
    "getContext",
  ).mockReturnValue(page);
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      getContext() {
        return worker;
      }
    },
  );
  return { page, worker };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("workerTextMatchesPage", () => {
  it("is true when the worker's pixels equal the page's, and draws the same label on both", () => {
    const host = document.createElement("div");
    const { page, worker } = stub(200, 200);
    expect(workerTextMatchesPage(host, "600 12px x")).toBe(true);
    expect(worker.calls).toEqual(page.calls);
    expect(page.calls).toHaveLength(2);
  });

  it("is false when one pixel differs, as the halo does where the page smooths its text", () => {
    stub(200, 190);
    expect(workerTextMatchesPage(document.createElement("div"), "x")).toBe(
      false,
    );
  });

  it("is false when either context is missing, and leaves no probe canvas behind", () => {
    const host = document.createElement("div");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return null;
        }
      },
    );
    expect(workerTextMatchesPage(host, "x")).toBe(false);
    expect(host.querySelector("canvas")).toBeNull();
  });
});
