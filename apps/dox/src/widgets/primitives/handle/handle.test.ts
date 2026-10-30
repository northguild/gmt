// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { handle, handleTrack, valueAt, type GmtHandle } from "./handle";
import { html } from "../../builders/html";
import { renderHtml, valueNow } from "../../test-fixture";

const single = () =>
  handleTrack(
    handle({
      label: "Cut-off",
      min: 0,
      max: 100,
      step: 5,
      largeStep: 20,
      value: 50,
      valueText: "50 min",
    }),
  );

const pair = () =>
  handleTrack(
    html`${handle({ label: "Start", min: 0, max: 100, step: 10, value: 30, valueText: "30", pair: "start" })}${handle({ label: "End", min: 0, max: 100, step: 10, value: 60, valueText: "60", pair: "end" })}`,
  );

describe("valueAt", () => {
  const rect = { left: 100, width: 200 };
  it("maps the track to the scale and snaps to the step", () => {
    expect(valueAt(100, rect, 0, 100, 5)).toBe(0);
    expect(valueAt(300, rect, 0, 100, 5)).toBe(100);
    expect(valueAt(200, rect, 0, 100, 5)).toBe(50);
    expect(valueAt(212, rect, 0, 100, 5)).toBe(55);
  });
  it("clamps beyond the edges", () => {
    expect(valueAt(-500, rect, 0, 100, 1)).toBe(0);
    expect(valueAt(9000, rect, 0, 100, 1)).toBe(100);
  });
  it("gives min for a zero-width track, a bad pointer or an empty scale", () => {
    expect(valueAt(150, { left: 100, width: 0 }, 10, 90, 1)).toBe(10);
    expect(valueAt(Number.NaN, rect, 10, 90, 1)).toBe(10);
    expect(valueAt(150, rect, 10, 10, 1)).toBe(10);
  });
  it("snaps from min, not from zero, and drops float noise", () => {
    expect(valueAt(200, rect, 1, 2, 0.1)).toBe(1.5);
    expect(valueAt(260, rect, 0, 1, 0.1)).toBe(0.8);
  });
  it("mirrors in a right-to-left track", () => {
    expect(valueAt(100, rect, 0, 100, 1, true)).toBe(100);
  });
});

describe("the handle element", () => {
  it("is a named slider with the APG attributes", () => {
    renderHtml(single());
    const slider = screen.getByRole("slider", { name: "Cut-off" });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(valueNow(slider)).toBe(50);
    expect(slider).toHaveAttribute("aria-valuetext", "50 min");
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("moves with the APG keys and updates aria-valuetext after each", async () => {
    const fx = renderHtml(single());
    const el = fx.element<GmtHandle>("handle");
    el.formatValue = (n) => `${n} min`;
    const user = userEvent.setup();
    const slider = screen.getByRole("slider", { name: "Cut-off" });
    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(valueNow(slider)).toBe(55);
    expect(slider).toHaveAttribute("aria-valuetext", "55 min");
    await user.keyboard("{ArrowDown}");
    expect(slider).toHaveAttribute("aria-valuetext", "50 min");
    await user.keyboard("{PageUp}");
    expect(valueNow(slider)).toBe(70);
    await user.keyboard("{PageDown}{PageDown}");
    expect(valueNow(slider)).toBe(30);
    await user.keyboard("{Home}");
    expect(valueNow(slider)).toBe(0);
    await user.keyboard("{End}");
    expect(valueNow(slider)).toBe(100);
  });

  it("clamps at the bounds and emits nothing when it cannot move", async () => {
    const fx = renderHtml(single());
    const user = userEvent.setup();
    const slider = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{End}");
    const seen: unknown[] = [];
    fx.host.addEventListener("input", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    await user.keyboard("{ArrowRight}{PageUp}{End}");
    expect(valueNow(slider)).toBe(100);
    expect(seen).toHaveLength(0);
    await user.keyboard("{ArrowLeft}");
    expect(seen).toEqual([{ value: 95 }]);
  });

  it("emits input and change with detail.value for a key press", async () => {
    const fx = renderHtml(single());
    const user = userEvent.setup();
    const types: string[] = [];
    for (const type of ["input", "change"]) {
      fx.host.addEventListener(type, (e) =>
        types.push(`${type}:${(e as CustomEvent).detail.value}`),
      );
    }
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(types).toEqual(["input:55", "change:55"]);
  });

  it("takes a typed value from code, bounded", () => {
    const fx = renderHtml(single());
    const el = fx.element<GmtHandle>("handle");
    el.value = 999;
    expect(valueNow(screen.getByRole("slider"))).toBe(100);
  });

  it("keeps two thumbs from crossing, and each says so in its bounds", async () => {
    renderHtml(pair());
    const user = userEvent.setup();
    const start = screen.getByRole("slider", { name: "Start" });
    const end = screen.getByRole("slider", { name: "End" });
    expect(start).toHaveAttribute("aria-valuemax", "60");
    expect(end).toHaveAttribute("aria-valuemin", "30");
    start.focus();
    await user.keyboard("{End}");
    expect(valueNow(start)).toBe(60);
    expect(end).toHaveAttribute("aria-valuemin", "60");
    end.focus();
    await user.keyboard("{Home}");
    expect(valueNow(end)).toBe(60);
    await user.keyboard("{ArrowRight}");
    expect(valueNow(end)).toBe(70);
    expect(start).toHaveAttribute("aria-valuemax", "70");
  });

  it("wires once after connect, disconnect, connect", async () => {
    const fx = renderHtml(single());
    const el = fx.element<GmtHandle>("handle");
    fx.reconnect(el);
    fx.reconnect(el);
    let inputs = 0;
    fx.host.addEventListener("input", () => inputs++);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(inputs).toBe(1);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(pair());
    await expectNoAxeViolations(fx.host);
  });
});
