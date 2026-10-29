// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { roving } from "./roving";

function item(name: string): HTMLLIElement {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = name;
  li.append(button);
  return li;
}

function list(): HTMLElement {
  const ul = document.createElement("ul");
  ul.setAttribute("aria-label", "Zones");
  for (const name of ["Atlantic", "Eastern", "Pacific"]) ul.append(item(name));
  document.body.replaceChildren(ul);
  return ul;
}

const buttons = (): HTMLElement[] => screen.getAllByRole("button");

describe("roving", () => {
  let controller: AbortController;
  beforeEach(() => {
    controller = new AbortController();
  });
  afterEach(() => {
    controller.abort();
    document.body.replaceChildren();
  });

  it("puts the first item, and only it, in the tab order", () => {
    roving(list(), { items: buttons, signal: controller.signal });
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1]);
  });

  it("moves with the arrows, wraps, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    roving(list(), { items: buttons, signal: controller.signal });
    buttons()[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Eastern" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Pacific" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Atlantic" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Pacific" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Atlantic" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Pacific" })).toHaveFocus();
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("follows a click and leaves Enter to the button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const root = list();
    root.addEventListener("click", onClick);
    roving(root, { items: buttons, signal: controller.signal });
    await user.click(screen.getByRole("button", { name: "Eastern" }));
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("reads the items again at each key press, so a redraw needs no rewiring", async () => {
    const user = userEvent.setup();
    const root = list();
    roving(root, { items: buttons, signal: controller.signal });
    root.append(item("Mountain"));
    buttons()[2]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Mountain" })).toHaveFocus();
  });

  it("stops listening when the signal aborts", async () => {
    const user = userEvent.setup();
    roving(list(), { items: buttons, signal: controller.signal });
    controller.abort();
    buttons()[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Atlantic" })).toHaveFocus();
  });
});
