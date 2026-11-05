// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { drawer, wireDrawer, type DrawerHandle } from "./drawer";

let ctl: AbortController;
afterEach(() => ctl.abort());

function draw(extra = "") {
  const fx = renderHtml(
    html`<button type="button" id="opener">Find a zone</button
      >${drawer({
        id: "zones",
        label: "Zone finder",
        closeLabel: "Close zone list",
        children: html`<input aria-label="Search" /><button type="button">Inside</button>${extra}`,
      })}`,
  );
  ctl = new AbortController();
  const toggle = screen.getByRole("button", {
    name: "Find a zone",
  }) as HTMLButtonElement;
  const handle: DrawerHandle = wireDrawer(zones(), {
    signal: ctl.signal,
    toggle,
  });
  return { fx, toggle, handle };
}

const zones = (): HTMLElement =>
  screen.getByRole("region", { name: "Zone finder", hidden: true });

describe("drawer", () => {
  it("starts shut: the toggle says so and the region is out of the tree", () => {
    const { toggle } = draw();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "zones");
    expect(zones()).toHaveAttribute("inert");
  });

  it("opens as a named region and the toggle follows", () => {
    const { toggle, handle } = draw();
    handle.open();
    expect(handle.expanded).toBe(true);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Zone finder" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it("moves focus only when asked", () => {
    const { toggle, handle } = draw();
    toggle.focus();
    handle.open();
    expect(toggle).toHaveFocus();
    handle.close();
    handle.open(screen.getByRole("textbox", { name: "Search", hidden: true }));
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("puts the close before the region and names what it controls", () => {
    const { handle } = draw();
    handle.open();
    const close = screen.getByRole("button", { name: "Close zone list" });
    const region = screen.getByRole("region", { name: "Zone finder" });
    expect(close).toHaveAttribute("aria-controls", "zones");
    expect(
      close.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("closes on the close button and returns focus to the toggle", async () => {
    const { toggle, handle } = draw();
    const user = userEvent.setup();
    handle.open();
    await user.click(screen.getByRole("button", { name: "Close zone list" }));
    expect(handle.expanded).toBe(false);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    expect(zones()).toHaveAttribute("inert");
  });

  it("closes on Escape from inside and returns focus to the toggle", async () => {
    const { toggle, handle } = draw();
    const user = userEvent.setup();
    handle.open(screen.getByRole("textbox", { name: "Search", hidden: true }));
    await user.keyboard("{Escape}");
    expect(handle.expanded).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it("closes on Escape from the toggle without stealing focus elsewhere", async () => {
    const { toggle, handle } = draw();
    const user = userEvent.setup();
    handle.open();
    toggle.focus();
    await user.keyboard("{Escape}");
    expect(handle.expanded).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it("leaves an Escape that an inner control handled alone", async () => {
    const { handle } = draw();
    const user = userEvent.setup();
    handle.open(screen.getByRole("textbox", { name: "Search", hidden: true }));
    screen
      .getByRole("textbox", { name: "Search" })
      .addEventListener("keydown", (event) => {
        if (event.key === "Escape") event.preventDefault();
      });
    await user.keyboard("{Escape}");
    expect(handle.expanded).toBe(true);
  });

  it("does not move focus when it closes from outside", () => {
    const { toggle, handle } = draw();
    const outside = document.createElement("button");
    document.body.append(outside);
    handle.open();
    outside.focus();
    handle.close();
    expect(outside).toHaveFocus();
    expect(toggle).not.toHaveFocus();
    outside.remove();
  });

  it("reports each change once", () => {
    const calls: boolean[] = [];
    const { toggle } = draw();
    ctl.abort();
    ctl = new AbortController();
    const handle = wireDrawer(zones(), {
      signal: ctl.signal,
      toggle,
      onToggle: (open) => calls.push(open),
    });
    handle.open();
    handle.open();
    handle.close();
    expect(calls).toEqual([true, false]);
  });

  it("makes a control group inert while open and returns it on close", () => {
    const { toggle } = draw();
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Globe controls");
    document.body.append(group);
    ctl.abort();
    ctl = new AbortController();
    const handle = wireDrawer(zones(), {
      signal: ctl.signal,
      toggle,
      inertWhenOpen: group,
    });

    expect(group).not.toHaveAttribute("inert");
    handle.open();
    expect(group).toHaveAttribute("inert");
    handle.close();
    expect(group).not.toHaveAttribute("inert");
    group.remove();
  });

  it("passes axe closed and open", async () => {
    const { fx, handle } = draw();
    await expectNoAxeViolations(fx.host);
    handle.open();
    await expectNoAxeViolations(fx.host);
  });
});
