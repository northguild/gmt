// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { initScrubber } from "./multi-zone-scrubber";

describe("initScrubber slider", () => {
  it("keeps the chip, fill and aria-valuetext in step with the thumb", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const scrubber = await initScrubber(host);
    const slider = host.querySelector<HTMLInputElement>(
      '[data-role="slider"]',
    )!;
    const chip = host.querySelector<HTMLElement>(".gmt-range-chip")!;
    expect(slider.classList.contains("gmt-range")).toBe(true);
    expect(chip.textContent).toBe("0 min");
    expect(slider.style.getPropertyValue("--gmt-range-pct")).toBe("50");

    slider.value = "75";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(chip.textContent).toBe("+1 h 15 min");
    expect(slider.getAttribute("aria-valuetext")).toBe("+1 h 15 min");
    expect(
      Number(slider.style.getPropertyValue("--gmt-range-pct")),
    ).toBeGreaterThan(50);
    scrubber.destroy();
    host.remove();
  });
});
