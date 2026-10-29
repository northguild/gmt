// @vitest-environment jsdom
import { defineElements, ELEMENTS } from "./define";
import { expectNoAxeViolations } from "~/test/render-widget";

describe("defineElements", () => {
  it("defines every element once, however often it is called", () => {
    defineElements();
    defineElements();
    for (const tag of Object.keys(ELEMENTS)) {
      expect(customElements.get(tag)).toBeDefined();
    }
  });

  it("does nothing where there is no customElements registry", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "customElements",
    )!;
    Object.defineProperty(globalThis, "customElements", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => defineElements()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "customElements", original);
    }
  });

  it("leaves a clean document", async () => {
    await expectNoAxeViolations(document.body);
  });
});
