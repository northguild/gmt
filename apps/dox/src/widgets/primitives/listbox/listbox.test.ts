// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { listbox, nextIndex, type GmtListbox } from "./listbox";

const items = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

function draw(value?: string) {
  return renderHtml(
    listbox({
      id: "pick",
      label: "Pick one",
      items,
      ...(value ? { value } : {}),
    }),
  );
}

function active(name: string): string {
  return screen.getByRole("option", { name }).id;
}

describe("nextIndex", () => {
  it("moves by one, by a page, and to the ends, and stops at them", () => {
    expect(nextIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextIndex("PageDown", 0, 30)).toBe(10);
    expect(nextIndex("PageUp", 5, 30)).toBe(0);
    expect(nextIndex("Home", 7, 30)).toBe(0);
    expect(nextIndex("End", 7, 30)).toBe(29);
    expect(nextIndex("x", 4, 30)).toBe(4);
    expect(nextIndex("End", 4, 0)).toBe(4);
  });
});

describe("the listbox element", () => {
  it("is one tab stop with a name, and names the first option as active", async () => {
    draw();
    await userEvent.setup().tab();
    const list = screen.getByRole("listbox", { name: "Pick one" });
    expect(list).toHaveFocus();
    expect(list).toHaveAttribute("aria-activedescendant", active("Alpha"));
  });

  it("moves the active option with the arrow, Home and End keys", async () => {
    draw();
    const user = userEvent.setup();
    await user.tab();
    const list = screen.getByRole("listbox", { name: "Pick one" });
    await user.keyboard("{ArrowDown}");
    expect(list).toHaveAttribute("aria-activedescendant", active("Beta"));
    await user.keyboard("{End}");
    expect(list).toHaveAttribute("aria-activedescendant", active("Gamma"));
    await user.keyboard("{ArrowDown}{Home}");
    expect(list).toHaveAttribute("aria-activedescendant", active("Alpha"));
  });

  it("chooses the active option on Enter and on Space, and tells the page", async () => {
    const fx = draw();
    const seen: string[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent<{ value: string }>).detail.value),
    );
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowDown} ");
    expect(seen).toEqual(["b", "c"]);
    await expectNoAxeViolations(fx.host);
  });

  it("chooses the option a click lands on", async () => {
    const fx = draw();
    await userEvent.click(screen.getByRole("option", { name: "Gamma" }));
    expect(fx.element<GmtListbox>("listbox").value).toBe("c");
    expect(screen.getByRole("option", { name: "Gamma" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectNoAxeViolations(fx.host);
  });

  it("marks the value it starts with, and takes one from code", () => {
    const fx = draw("b");
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fx.element<GmtListbox>("listbox").value = "a";
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("in virtual mode keys over the full count and leaves no activedescendant for an undrawn row", async () => {
    const fx = draw();
    const list = fx.element<GmtListbox>("listbox");
    list.count = 100;
    list.valueAt = (i) => `v${i}`;
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{End}");
    expect(list.activeIndex).toBe(99);
    expect(list).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(list.value).toBe("v99");
  });

  it("wires once after disconnect and connect", async () => {
    const fx = draw();
    const seen: string[] = [];
    fx.host.addEventListener("change", (e) =>
      seen.push((e as CustomEvent<{ value: string }>).detail.value),
    );
    fx.reconnect(fx.element("listbox"));
    await userEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(seen).toEqual(["b"]);
  });
});
