// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  chipToggleHtml,
  labelTextHtml,
  rangeFieldHtml,
  rangePct,
  syncRange,
} from "./widget-ui";

const base = {
  role: "handling",
  min: 0,
  max: 240,
  step: 5,
  value: 60,
  valueText: "60 minutes",
};

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("labelTextHtml", () => {
  it("escapes text", () => {
    const html = labelTextHtml('a "b" <i>');
    expect(html).toContain('a "b" &lt;i&gt;');
    expect(html).not.toContain("<i>");
  });
  it("adds the hint chip only when optional", () => {
    expect(labelTextHtml("Onward")).not.toContain("gmt-hint-chip");
    expect(labelTextHtml("Onward", { optional: true })).toContain(
      '<span class="gmt-hint-chip">optional</span>',
    );
  });
});

describe("rangePct", () => {
  it("maps min, mid and max", () => {
    expect(rangePct(0, 0, 240)).toBe(0);
    expect(rangePct(120, 0, 240)).toBe(50);
    expect(rangePct(240, 0, 240)).toBe(100);
  });
  it("clamps out-of-range values", () => {
    expect(rangePct(-5, 0, 10)).toBe(0);
    expect(rangePct(50, 0, 10)).toBe(100);
  });
  it("is 0 when max <= min", () => {
    expect(rangePct(5, 5, 5)).toBe(0);
    expect(rangePct(5, 10, 0)).toBe(0);
  });
});

describe("rangeFieldHtml", () => {
  it("writes the SSR fill matching rangePct", () => {
    const host = mount(rangeFieldHtml({ ...base, value: 60 }));
    const field = host.querySelector<HTMLElement>(".gmt-range-field")!;
    expect(field.style.getPropertyValue("--gmt-range-pct")).toBe(
      String(rangePct(60, 0, 240)),
    );
    expect(
      host
        .querySelector<HTMLElement>("input")!
        .style.getPropertyValue("--gmt-range-pct"),
    ).toBe("25");
  });
  it("defaults the chip role and renders ends, label, disabled on request", () => {
    const plain = mount(rangeFieldHtml(base));
    expect(
      plain.querySelector('[data-role="handling-value"]')?.textContent,
    ).toBe("60 minutes");
    expect(plain.querySelector(".gmt-range-ends")).toBeNull();
    expect(plain.querySelector("input")!.hasAttribute("aria-label")).toBe(
      false,
    );
    expect(plain.querySelector("input")!.disabled).toBe(false);

    const full = mount(
      rangeFieldHtml({
        ...base,
        chipRole: "c",
        ends: ["0 min", "240 min"],
        label: "Handling",
        disabled: true,
      }),
    );
    expect(full.querySelector('[data-role="c"]')).not.toBeNull();
    expect(full.querySelectorAll(".gmt-range-ends span")).toHaveLength(2);
    expect(full.querySelector("input")!.getAttribute("aria-label")).toBe(
      "Handling",
    );
    expect(full.querySelector("input")!.disabled).toBe(true);
  });
  it("escapes role, label, valueText and ends", () => {
    const html = rangeFieldHtml({
      ...base,
      role: 'r"<x>',
      label: 'l"<x>',
      valueText: 'v"<x>',
      ends: ['e"<x>', "b"],
    });
    expect(html).not.toContain("<x>");
    const host = mount(html);
    expect(host.querySelector("input")!.dataset.role).toBe('r"<x>');
    expect(host.querySelector("input")!.getAttribute("aria-label")).toBe(
      'l"<x>',
    );
    expect(host.querySelector(".gmt-range-chip")!.textContent).toBe('v"<x>');
  });
});

describe("syncRange", () => {
  it("sets the fill on the input and its field, plus aria-valuetext and chip", () => {
    const host = mount(rangeFieldHtml(base));
    const input = host.querySelector("input")!;
    input.value = "120";
    syncRange(input, "2 h");
    const field = host.querySelector<HTMLElement>(".gmt-range-field")!;
    expect(input.style.getPropertyValue("--gmt-range-pct")).toBe("50");
    expect(field.style.getPropertyValue("--gmt-range-pct")).toBe("50");
    expect(input.getAttribute("aria-valuetext")).toBe("2 h");
    expect(host.querySelector(".gmt-range-chip")!.textContent).toBe("2 h");
  });
  it("leaves text alone when valueText is omitted", () => {
    const host = mount(rangeFieldHtml(base));
    const input = host.querySelector("input")!;
    input.value = "240";
    syncRange(input);
    expect(input.style.getPropertyValue("--gmt-range-pct")).toBe("100");
    expect(input.getAttribute("aria-valuetext")).toBe("60 minutes");
    expect(host.querySelector(".gmt-range-chip")!.textContent).toBe(
      "60 minutes",
    );
  });
  it("works on an input outside a field", () => {
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.value = "5";
    syncRange(input, "five");
    expect(input.style.getPropertyValue("--gmt-range-pct")).toBe("50");
    expect(input.getAttribute("aria-valuetext")).toBe("five");
  });
});

describe("chipToggleHtml", () => {
  const o = {
    type: "checkbox",
    role: "weekday-6",
    value: "6",
    label: "Sat",
  } as const;
  it("omits checked, name and the switch track by default", () => {
    const html = chipToggleHtml(o);
    expect(html).not.toContain("checked");
    expect(html).not.toContain("name=");
    expect(html).not.toContain("gmt-chip-toggle-track");
    expect(html).not.toContain("--switch");
  });
  it("emits checked, name and the switch track when asked", () => {
    const html = chipToggleHtml({
      ...o,
      type: "radio",
      checked: true,
      name: "mode",
      switch: true,
    });
    const host = mount(html);
    const input = host.querySelector("input")!;
    expect(input.type).toBe("radio");
    expect(input.checked).toBe(true);
    expect(input.name).toBe("mode");
    expect(host.querySelector(".gmt-chip-toggle--switch")).not.toBeNull();
    expect(host.querySelector(".gmt-chip-toggle-track")).not.toBeNull();
  });
  it("escapes label, role, value and name", () => {
    const html = chipToggleHtml({
      ...o,
      role: 'r"<x>',
      value: 'v"<x>',
      label: 'l"<x>',
      name: 'n"<x>',
    });
    expect(html).not.toContain("<x>");
    const input = mount(html).querySelector("input")!;
    expect(input.dataset.role).toBe('r"<x>');
    expect(input.value).toBe('v"<x>');
    expect(input.name).toBe('n"<x>');
  });
});

describe("the field grid and a hidden label", () => {
  it("keeps `hidden` working on a grid and on a label inside it", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(
      resolve(import.meta.dirname, "../styles/gmt-form-controls.css"),
      "utf8",
    );
    // An author `display` beats the user-agent `[hidden]` rule, so the sheet
    // restates it. The Departure Board hides one form's fields this way.
    expect(css).toMatch(
      /\.gmt-field-grid\[hidden\],\s*\.gmt-field-grid > \.gmt-label\[hidden\]\s*\{\s*display: none;/,
    );
  });
});
