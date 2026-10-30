// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { preset, type GmtPreset } from "./preset";

const markup = () =>
  preset({
    id: "zone",
    label: "Zone",
    options: [
      { value: "a", label: "Alpha", description: "The first zone" },
      { value: "b", label: "Beta", description: "The second zone" },
    ],
  });

describe("the preset element", () => {
  it("is a labelled select with the first description", () => {
    renderHtml(markup());
    const select = screen.getByRole("combobox", { name: "Zone" });
    expect(select).toHaveValue("a");
    expect(select).toHaveAccessibleDescription("The first zone");
  });

  it("changes the description with the selection", async () => {
    renderHtml(markup());
    const select = screen.getByRole("combobox", { name: "Zone" });
    await userEvent.selectOptions(select, "Beta");
    expect(select).toHaveAccessibleDescription("The second zone");
  });

  it("takes a value from code and ignores an unknown one", () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtPreset>("preset");
    el.value = "b";
    expect(screen.getByRole("combobox")).toHaveAccessibleDescription(
      "The second zone",
    );
    el.value = "nope";
    expect(el.value).toBe("b");
  });

  it("emits one change per selection after connect, disconnect, connect", async () => {
    const fx = renderHtml(markup());
    const el = fx.element<GmtPreset>("preset");
    fx.reconnect(el);
    fx.reconnect(el);
    const seen: unknown[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "Beta");
    expect(seen).toHaveLength(1);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
