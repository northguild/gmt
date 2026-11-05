// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { pickLayer, registerEscLayer, type EscLayer } from "./esc-layers";

let ctl: AbortController;
beforeEach(() => {
  ctl = new AbortController();
});
afterEach(() => {
  ctl.abort();
  document.body.replaceChildren();
});

interface Fixture {
  name: string;
  root: HTMLElement;
  panel: HTMLElement;
  opener: HTMLButtonElement;
  inner: HTMLButtonElement;
  open(): Promise<void>;
  isOpen(): boolean;
  closed: string[];
}

const closedLog: string[] = [];

/** A layer: an opener button, and a panel holding one button that shows while it is open. */
function layer(
  name: string,
  into: HTMLElement = document.body,
  extra: Partial<EscLayer> = {},
): Fixture {
  const root = document.createElement("div");
  const opener = document.createElement("button");
  opener.textContent = `open ${name}`;
  const panel = document.createElement("div");
  panel.hidden = true;
  const inner = document.createElement("button");
  inner.textContent = `inside ${name}`;
  panel.append(inner);
  root.append(opener, panel);
  into.append(root);
  const reg = registerEscLayer(
    {
      el: panel,
      isOpen: () => !panel.hidden,
      close: () => {
        panel.hidden = true;
        closedLog.push(name);
      },
      opener: () => opener,
      ...extra,
    },
    ctl.signal,
  );
  return {
    name,
    root,
    panel,
    opener,
    inner,
    closed: closedLog,
    isOpen: () => !panel.hidden,
    async open() {
      panel.hidden = false;
      reg.changed();
      await Promise.resolve();
    },
  };
}

beforeEach(() => {
  closedLog.length = 0;
});

describe("the Escape order", () => {
  it("closes the layer opened last, one per press, then does nothing", async () => {
    const user = userEvent.setup();
    const a = layer("a");
    const b = layer("b");
    const c = layer("c");
    await a.open();
    await b.open();
    await c.open();
    await user.keyboard("{Escape}");
    expect([a.isOpen(), b.isOpen(), c.isOpen()]).toEqual([true, true, false]);
    await user.keyboard("{Escape}");
    expect([a.isOpen(), b.isOpen(), c.isOpen()]).toEqual([true, false, false]);
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["c", "b", "a"]);
  });

  it("prefers the layer that holds focus over one opened later elsewhere", async () => {
    const user = userEvent.setup();
    const a = layer("a");
    const b = layer("b");
    await a.open();
    await b.open();
    a.inner.focus();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["a"]);
    expect(b.isOpen()).toBe(true);
  });

  it("closes a layer inside another before the one around it", async () => {
    const user = userEvent.setup();
    const outer = layer("outer");
    const innerLayer = layer("inner", outer.panel);
    await innerLayer.open();
    await outer.open();
    outer.inner.focus();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["inner"]);
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["inner", "outer"]);
  });

  it("closes a layer drawn over another first, though it opened earlier", async () => {
    const user = userEvent.setup();
    const under = layer("under");
    const card = layer("card", document.body, {
      over: under.panel,
    });
    await card.open();
    await under.open();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["card"]);
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["card", "under"]);
  });

  it("closes a base layer only when nothing else is open", async () => {
    const user = userEvent.setup();
    const base = layer("base", document.body, { base: true });
    const top = layer("top");
    await top.open();
    await base.open();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["top"]);
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["top", "base"]);
  });

  it("counts a focus-only layer only while focus is inside it", async () => {
    const user = userEvent.setup();
    const reading = layer("reading", document.body, { focusOnly: true });
    await reading.open();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual([]);
    reading.inner.focus();
    await user.keyboard("{Escape}");
    expect(closedLog).toEqual(["reading"]);
  });

  it("sends focus to the opener, never to the page", async () => {
    const user = userEvent.setup();
    const a = layer("a");
    await a.open();
    a.inner.focus();
    await user.keyboard("{Escape}");
    expect(a.opener).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("leaves focus to a layer that returns it itself", async () => {
    const user = userEvent.setup();
    const a = layer("a", document.body, { returnsFocus: true });
    await a.open();
    a.inner.focus();
    await user.keyboard("{Escape}");
    expect(a.opener).not.toHaveFocus();
  });

  it("consumes the press so nothing underneath closes with it", async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    const a = layer("a");
    await a.open();
    window.addEventListener("keydown", (e) => seen.push(e.defaultPrevented), {
      signal: ctl.signal,
    });
    await user.keyboard("{Escape}");
    expect(seen).toEqual([]);
    await user.keyboard("{Escape}");
    expect(seen).toEqual([false]);
  });

  it("leaves an Escape that a control handled itself", async () => {
    const user = userEvent.setup();
    const a = layer("a");
    await a.open();
    a.inner.focus();
    a.inner.addEventListener("keydown", (e) => e.preventDefault(), {
      signal: ctl.signal,
    });
    await user.keyboard("{Escape}");
    expect(a.isOpen()).toBe(true);
  });

  it("stops listening once its signal aborts", async () => {
    const user = userEvent.setup();
    const a = layer("a");
    await a.open();
    ctl.abort();
    await user.keyboard("{Escape}");
    expect(a.isOpen()).toBe(true);
  });

  it("ranks by opening order for state the document does not show", async () => {
    const user = userEvent.setup();
    let one = false;
    let two = false;
    const first = registerEscLayer(
      { isOpen: () => one, close: () => (one = false) },
      ctl.signal,
    );
    const second = registerEscLayer(
      { isOpen: () => two, close: () => (two = false) },
      ctl.signal,
    );
    two = true;
    second.changed();
    one = true;
    first.changed();
    await user.keyboard("{Escape}");
    expect([one, two]).toEqual([false, true]);
  });
});

describe("pickLayer", () => {
  const at = (seq: number, extra: Partial<EscLayer> = {}) => ({
    seq,
    layer: { isOpen: () => true, close: () => {}, ...extra },
  });

  it("returns null with nothing open", () => {
    expect(pickLayer([], null)).toBeNull();
  });

  it("takes the highest sequence when no layer holds focus", () => {
    const entries = [at(1), at(3), at(2)];
    expect(pickLayer(entries, null)).toBe(entries[1]!.layer);
  });
});
