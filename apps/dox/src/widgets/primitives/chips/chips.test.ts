// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { chips, type GmtChips } from "./chips";

const items = [
  { value: "a", label: "Alpha", checked: true },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("the chips element", () => {
  it("radio: one group, one tab stop, arrows move the selection", async () => {
    const fx = renderHtml(
      chips({ legend: "Pick", kind: "radio", name: "pick", items }),
    );
    const user = userEvent.setup();
    expect(screen.getByRole("group", { name: "Pick" })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    expect(fx.element<GmtChips>("chips").value).toBe("b");
    await user.tab();
    expect(screen.getByRole("radio", { name: "Beta" })).not.toHaveFocus();
  });

  it("checkbox: values is a list", async () => {
    const fx = renderHtml(
      chips({ legend: "Days", kind: "checkbox", name: "days", items }),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Gamma" }));
    expect(fx.element<GmtChips>("chips").value).toEqual(["a", "c"]);
  });

  it("switch: exposes role switch", async () => {
    renderHtml(
      chips({ legend: "Flags", kind: "switch", name: "flags", items }),
    );
    const sw = screen.getByRole("switch", { name: "Beta" });
    await userEvent.click(sw);
    expect(sw).toBeChecked();
  });

  it("takes a value from code", () => {
    const fx = renderHtml(
      chips({ legend: "Pick", kind: "radio", name: "pick", items }),
    );
    fx.element<GmtChips>("chips").value = "c";
    expect(screen.getByRole("radio", { name: "Gamma" })).toBeChecked();
  });

  it("emits one change per click after connect, disconnect, connect", async () => {
    const fx = renderHtml(
      chips({ legend: "Pick", kind: "radio", name: "pick", items }),
    );
    const el = fx.element<GmtChips>("chips");
    fx.reconnect(el);
    fx.reconnect(el);
    const seen: unknown[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    await userEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(seen).toEqual([{ value: "b" }]);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(
      chips({ legend: "Pick", kind: "radio", name: "pick", items }),
    );
    await expectNoAxeViolations(fx.host);
  });
});
