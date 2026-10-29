// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations, setRange } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { GmtRange, range, rangePct } from "./range";

const markup = () =>
  range({
    id: "offset",
    label: "Offset",
    min: 0,
    max: 10,
    step: 1,
    value: 3,
    valueText: "3 h",
    ends: ["0 h", "10 h"],
  });

describe("the range element", () => {
  it("is a named slider with its server-rendered value", () => {
    renderHtml(markup());
    const slider = screen.getByRole("slider", { name: "Offset" });
    expect(slider).toHaveValue("3");
    expect(slider).toHaveAttribute("aria-valuetext", "3 h");
  });

  it("computes the fill share of the track, clamped to 0–100", () => {
    expect(rangePct(5, 0, 10)).toBe(50);
    expect(rangePct(5, 5, 5)).toBe(0);
    expect(rangePct(99, 0, 10)).toBe(100);
  });

  it("follows the input: valuetext from formatValue, one bubbled event with detail.value", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    el.formatValue = (n) => `${n} hours`;
    const seen: unknown[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    setRange(screen.getByRole("slider", { name: "Offset" }), 7);
    expect(el.value).toBe(7);
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "7 hours",
    );
    expect(seen).toEqual([{ value: 7 }]);
  });

  it("takes a value from code without emitting", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    const seen: Event[] = [];
    fx.host.addEventListener("input", (e) => seen.push(e));
    el.value = 9;
    expect(screen.getByRole("slider")).toHaveValue("9");
    expect(seen).toHaveLength(0);
  });

  it("wires once after connect, disconnect, connect", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    fx.reconnect(el);
    fx.reconnect(el);
    let calls = 0;
    fx.host.addEventListener("input", () => calls++);
    setRange(screen.getByRole("slider"), 4);
    expect(calls).toBe(1);
  });

  it("takes new bounds from code: the slider accepts a value past the old max", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    el.formatValue = (n) => `${n} h`;
    expect([el.min, el.max, el.step]).toEqual([0, 10, 1]);
    el.max = 20;
    expect(el.max).toBe(20);
    const slider = screen.getByRole("slider", { name: "Offset" });
    setRange(slider, 15);
    expect(slider).toHaveValue("15");
    expect(slider).toHaveAttribute("aria-valuetext", "15 h");
  });

  it("keeps the value and the valuetext right when a bound changes under the value", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    el.formatValue = (n) => `${n} h`;
    el.min = 2;
    expect(screen.getByRole("slider")).toHaveAttribute("min", "2");
    el.max = 4;
    // The input clamps 3 into [2, 4] and keeps it.
    expect(screen.getByRole("slider")).toHaveValue("3");
    el.max = 2;
    expect(screen.getByRole("slider")).toHaveValue("2");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "2 h");
  });

  it("takes a new step", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    el.step = 5;
    expect(el.step).toBe(5);
    expect(screen.getByRole("slider")).toHaveAttribute("step", "5");
  });

  it("rewrites its visible end labels", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtRange>("range");
    expect(screen.getByText("10 h")).toBeInTheDocument();
    el.ends = ["0 weeks", "20 weeks"];
    expect(screen.getByText("20 weeks")).toBeInTheDocument();
    expect(screen.queryByText("10 h")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
