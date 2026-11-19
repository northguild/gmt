// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/dom";
import { html } from "~/widgets/builders";
import { renderHtml } from "~/widgets/test-fixture";
import { KEY_TABLE, mountKeys, type DeckKeyActions } from "./keys";

const controllers: AbortController[] = [];
afterEach(() => {
  for (const c of controllers.splice(0)) c.abort();
});

function setup() {
  const ctl = new AbortController();
  controllers.push(ctl);
  const actions = {
    step: vi.fn(),
    slide: vi.fn(),
    first: vi.fn(),
    last: vi.fn(),
    goTo: vi.fn(),
    overview: vi.fn(),
    help: vi.fn(),
    blank: vi.fn(),
    fullscreen: vi.fn(),
    present: vi.fn(),
    presenter: vi.fn(),
    fly: vi.fn(),
    home: vi.fn(),
  } satisfies DeckKeyActions;
  mountKeys(document, { signal: ctl.signal, actions });
  return { ctl, actions, user: userEvent.setup() };
}

describe("deck keys", () => {
  it.each([
    ["{ArrowRight}", "step", [1]],
    ["{ArrowDown}", "step", [1]],
    ["{PageDown}", "step", [1]],
    [" ", "step", [1]],
    ["{Enter}", "step", [1]],
    ["n", "step", [1]],
    ["N", "step", [1]],
    ["{ArrowLeft}", "step", [-1]],
    ["{ArrowUp}", "step", [-1]],
    ["{PageUp}", "step", [-1]],
    ["{Backspace}", "step", [-1]],
    ["p", "step", [-1]],
    ["{Shift>}{ArrowRight}{/Shift}", "slide", [1]],
    ["{Shift>}{ArrowLeft}{/Shift}", "slide", [-1]],
    ["{Shift>} {/Shift}", "step", [-1]],
    ["{Home}", "first", []],
    ["{End}", "last", []],
    ["o", "overview", []],
    ["?", "help", []],
    ["b", "blank", []],
    [".", "blank", []],
    ["f", "fullscreen", []],
    ["{F5}", "present", []],
    ["{Shift>}{F5}{/Shift}", "present", []],
    ["r", "home", []],
    ["R", "home", []],
    ["t", "presenter", []],
    ["T", "presenter", []],
  ] as const)("%s calls %s", async (keys, action, args) => {
    const { actions, user } = setup();
    await user.keyboard(keys);
    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(actions[action]).toHaveBeenCalledWith(...args);
  });

  it("prevents the browser's own action for F5, Space and the arrows", async () => {
    const { user } = setup();
    const seen: boolean[] = [];
    // Registered after the deck's, so it runs after the deck's own listener.
    const ctl = new AbortController();
    controllers.push(ctl);
    document.addEventListener("keydown", (e) => seen.push(e.defaultPrevented), {
      signal: ctl.signal,
    });
    await user.keyboard("{F5} {ArrowRight}");
    expect(seen).toEqual([true, true, true]);
  });

  it("does nothing for a key the table does not list, and leaves it to the browser", async () => {
    const { actions, user } = setup();
    await user.keyboard("z");
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  describe("free flight", () => {
    it.each([
      ["w", { lng: 0, lat: 60, zoom: 0 }],
      ["s", { lng: 0, lat: -60, zoom: 0 }],
      ["a", { lng: -60, lat: 0, zoom: 0 }],
      ["d", { lng: 60, lat: 0, zoom: 0 }],
      ["q", { lng: 0, lat: 0, zoom: -1 }],
      ["e", { lng: 0, lat: 0, zoom: 1 }],
    ] as const)(
      "holding %s flies, and letting go stops",
      async (key, vector) => {
        const { actions, user } = setup();
        await user.keyboard(`{${key}>}`);
        expect(actions.fly).toHaveBeenLastCalledWith(vector);
        await user.keyboard(`{/${key}}`);
        expect(actions.fly).toHaveBeenLastCalledWith({
          lng: 0,
          lat: 0,
          zoom: 0,
        });
        expect(actions.fly).toHaveBeenCalledTimes(2);
      },
    );

    it("adds keys held together and cancels opposites", async () => {
      const { actions, user } = setup();
      await user.keyboard("{w>}{d>}");
      expect(actions.fly).toHaveBeenLastCalledWith({
        lng: 60,
        lat: 60,
        zoom: 0,
      });
      await user.keyboard("{s>}");
      expect(actions.fly).toHaveBeenLastCalledWith({
        lng: 60,
        lat: 0,
        zoom: 0,
      });
    });

    it("doubles the rate with Shift, pressed before or after", async () => {
      const { actions, user } = setup();
      await user.keyboard("{Shift>}{w>}");
      expect(actions.fly).toHaveBeenLastCalledWith({
        lng: 0,
        lat: 120,
        zoom: 0,
      });
      await user.keyboard("{/Shift}");
      expect(actions.fly).toHaveBeenLastCalledWith({
        lng: 0,
        lat: 60,
        zoom: 0,
      });
      await user.keyboard("{Shift>}");
      expect(actions.fly).toHaveBeenLastCalledWith({
        lng: 0,
        lat: 120,
        zoom: 0,
      });
    });

    it("says nothing for a Shift press with no key held", async () => {
      const { actions, user } = setup();
      await user.keyboard("{Shift}");
      expect(actions.fly).not.toHaveBeenCalled();
    });

    it("lets go when the window loses focus", async () => {
      const { actions, user } = setup();
      await user.keyboard("{d>}");
      // A window losing focus has no userEvent equivalent.
      // oxlint-disable-next-line dox-test/no-dispatch-event
      window.dispatchEvent(new Event("blur"));
      expect(actions.fly).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    });

    it("lets go when the signal aborts", async () => {
      const { ctl, actions, user } = setup();
      await user.keyboard("{d>}");
      ctl.abort();
      expect(actions.fly).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    });

    it("reads the release of a held key even while a dialog is open", async () => {
      const { actions, user } = setup();
      await user.keyboard("{d>}");
      renderHtml(
        html`<dialog open aria-label="Help"><a href="#x">Inside</a></dialog>`,
      );
      screen.getByRole("link", { name: "Inside" }).focus();
      await user.keyboard("{/d}");
      expect(actions.fly).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    });

    it("does not start a flight while a field has the keys", async () => {
      const { actions, user } = setup();
      renderHtml(html`<input aria-label="Name" />`);
      await user.type(screen.getByRole("textbox", { name: "Name" }), "wasd");
      expect(actions.fly).not.toHaveBeenCalled();
    });
  });

  it("leaves Escape alone: a dialog or the browser closes itself", async () => {
    const { actions, user } = setup();
    await user.keyboard("{Escape}");
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("jumps to a slide by digits then Enter", async () => {
    const { actions, user } = setup();
    await user.keyboard("12{Enter}");
    expect(actions.goTo).toHaveBeenCalledExactlyOnceWith(12);
    expect(actions.step).not.toHaveBeenCalled();
  });

  it("forgets the digits after 1.5 seconds, so Enter is a plain step", async () => {
    vi.useFakeTimers();
    const ctl = new AbortController();
    controllers.push(ctl);
    const actions = setup().actions;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.keyboard("1");
    await vi.advanceTimersByTimeAsync(1499);
    await user.keyboard("2");
    await vi.advanceTimersByTimeAsync(1500);
    await user.keyboard("{Enter}");
    expect(actions.goTo).not.toHaveBeenCalled();
    expect(actions.step).toHaveBeenCalledExactlyOnceWith(1);
    ctl.abort();
  });

  it("drops the digits when another key comes between", async () => {
    const { actions, user } = setup();
    await user.keyboard("3{Home}{Enter}");
    expect(actions.goTo).not.toHaveBeenCalled();
    expect(actions.first).toHaveBeenCalledTimes(1);
  });

  it("keeps only the last three digits", async () => {
    const { actions, user } = setup();
    await user.keyboard("12345{Enter}");
    expect(actions.goTo).toHaveBeenCalledExactlyOnceWith(345);
  });

  it.each([
    "{Control>}{ArrowRight}{/Control}",
    "{Meta>}f{/Meta}",
    "{Alt>}{ArrowLeft}{/Alt}",
  ])("ignores the chord %s", async (keys) => {
    const { actions, user } = setup();
    await user.keyboard(keys);
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("ignores a press that something else already handled", async () => {
    const { actions, user } = setup();
    const ctl = new AbortController();
    controllers.push(ctl);
    document.body.addEventListener("keydown", (e) => e.preventDefault(), {
      signal: ctl.signal,
    });
    await user.keyboard("{ArrowRight}");
    expect(actions.step).not.toHaveBeenCalled();
  });

  it("leaves typing and adjusting to the field", async () => {
    const { actions, user } = setup();
    renderHtml(
      html`<div>
        <label>Name <input type="text" /></label>
        <label>Notes <textarea></textarea></label>
        <label>Pick <select><option>a</option></select></label>
        <div role="slider" tabindex="0" aria-label="Volume" aria-valuenow="1"></div>
        <div role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize" aria-valuenow="1"></div>
      </div>`,
    );
    for (const el of [
      screen.getByRole("textbox", { name: "Name" }),
      screen.getByRole("textbox", { name: "Notes" }),
      screen.getByRole("combobox", { name: "Pick" }),
      screen.getByRole("slider", { name: "Volume" }),
      screen.getByRole("separator", { name: "Resize" }),
    ]) {
      await user.click(el);
      await user.keyboard("n{ArrowRight}f");
    }
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("leaves Space and Enter on a button or a link to its click", async () => {
    const { actions, user } = setup();
    renderHtml(
      html`<div><button type="button">Press</button><a href="#x">Link</a></div>`,
    );
    screen.getByRole("button", { name: "Press" }).focus();
    await user.keyboard(" {Enter}");
    screen.getByRole("link", { name: "Link" }).focus();
    await user.keyboard("{Enter}");
    expect(actions.step).not.toHaveBeenCalled();
    // Other keys still reach the deck from a button.
    screen.getByRole("button", { name: "Press" }).focus();
    await user.keyboard("{PageDown}");
    expect(actions.step).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("ignores every key while a dialog is open", async () => {
    const { actions, user } = setup();
    renderHtml(
      html`<dialog open aria-label="Help"><a href="#x">Inside</a></dialog>`,
    );
    screen.getByRole("link", { name: "Inside" }).focus();
    await user.keyboard("{ArrowRight}f");
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("stops listening when the signal aborts", async () => {
    const { ctl, actions, user } = setup();
    ctl.abort();
    await user.keyboard("{ArrowRight}");
    expect(actions.step).not.toHaveBeenCalled();
  });

  it("lists each action once in the table the help dialog renders", () => {
    const actions = KEY_TABLE.map((r) => r.action);
    expect(new Set(actions).size).toBe(actions.length);
    for (const row of KEY_TABLE) {
      expect(row.keys.length).toBeGreaterThan(0);
      expect(row.label).not.toBe("");
    }
  });
});
