// @vitest-environment jsdom
import { sendBrowserEvent } from "~/test/deck-events";
import { mountDeckFullscreen } from "./deck-fullscreen";

const controllers: AbortController[] = [];
const restore: (() => void)[] = [];

afterEach(() => {
  for (const c of controllers.splice(0)) c.abort();
  for (const r of restore.splice(0).reverse()) r();
});

function stub(target: object, key: string, value: unknown): void {
  const before = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
  restore.push(() => {
    if (before) Object.defineProperty(target, key, before);
    else Reflect.deleteProperty(target, key);
  });
}

function setup(wakeLock?: { request: (type: string) => Promise<unknown> }) {
  stub(navigator, "wakeLock", wakeLock);
  stub(document, "fullscreenElement", null);
  const root = document.createElement("div");
  const live = document.createElement("p");
  const ctl = new AbortController();
  controllers.push(ctl);
  const fs = mountDeckFullscreen({
    root,
    doc: document,
    signal: ctl.signal,
    button: null,
    live,
  });
  const setFullscreen = (on: boolean): void => {
    stub(document, "fullscreenElement", on ? root : null);
    sendBrowserEvent(document, "fullscreenchange");
  };
  return { ctl, fs, setFullscreen };
}

/** A wake lock whose sentinels count their releases. */
function fakeLock() {
  const sentinels: { release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(async () => {
    const sentinel = { release: vi.fn(async () => {}) };
    sentinels.push(sentinel);
    return sentinel;
  });
  return { request, sentinels };
}

/** Lets the promises the module started finish. */
const settle = () => vi.waitFor(() => undefined);

describe("deck fullscreen wake lock", () => {
  it("requests a screen lock on entering fullscreen, once", async () => {
    const lock = fakeLock();
    const { setFullscreen } = setup(lock);
    setFullscreen(true);
    await settle();
    expect(lock.request).toHaveBeenCalledExactlyOnceWith("screen");
  });

  it("requests again when the page becomes visible while fullscreen", async () => {
    const lock = fakeLock();
    const { setFullscreen } = setup(lock);
    setFullscreen(true);
    await settle();
    stub(document, "visibilityState", "visible");
    sendBrowserEvent(document, "visibilitychange");
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.sentinels[0]?.release).toHaveBeenCalledOnce();
  });

  it("does not request on becoming visible when not fullscreen", async () => {
    const lock = fakeLock();
    setup(lock);
    stub(document, "visibilityState", "visible");
    sendBrowserEvent(document, "visibilitychange");
    await settle();
    expect(lock.request).not.toHaveBeenCalled();
  });

  it("releases on leaving fullscreen", async () => {
    const lock = fakeLock();
    const { setFullscreen } = setup(lock);
    setFullscreen(true);
    await settle();
    setFullscreen(false);
    await settle();
    expect(lock.sentinels[0]?.release).toHaveBeenCalledOnce();
  });

  it("releases when the signal aborts", async () => {
    const lock = fakeLock();
    const { ctl, setFullscreen } = setup(lock);
    setFullscreen(true);
    await settle();
    ctl.abort();
    await settle();
    expect(lock.sentinels[0]?.release).toHaveBeenCalledOnce();
  });

  it("releases a lock that arrives after fullscreen ended", async () => {
    let grant: (sentinel: unknown) => void = () => {};
    const sentinel = { release: vi.fn(async () => {}) };
    const request = vi.fn(() => new Promise((resolve) => (grant = resolve)));
    const { setFullscreen } = setup({ request });
    setFullscreen(true);
    setFullscreen(false);
    grant(sentinel);
    await vi.waitFor(() => expect(sentinel.release).toHaveBeenCalledOnce());
  });

  it("releases every sentinel when two requests overlap and fullscreen then ends", async () => {
    const grants: ((sentinel: unknown) => void)[] = [];
    const sentinels = [0, 1].map(() => ({ release: vi.fn(async () => {}) }));
    const request = vi.fn(() => new Promise((resolve) => grants.push(resolve)));
    const { setFullscreen } = setup({ request });
    setFullscreen(true);
    stub(document, "visibilityState", "visible");
    sendBrowserEvent(document, "visibilitychange");
    expect(request).toHaveBeenCalledTimes(2);
    grants[0]?.(sentinels[0]);
    grants[1]?.(sentinels[1]);
    await settle();
    setFullscreen(false);
    await settle();
    for (const s of sentinels) expect(s.release).toHaveBeenCalledOnce();
  });

  it("throws nothing when the request is refused", async () => {
    const request = vi.fn(async () => {
      throw new DOMException("refused", "NotAllowedError");
    });
    const { setFullscreen } = setup({ request });
    setFullscreen(true);
    await settle();
    expect(request).toHaveBeenCalledOnce();
  });

  it("starts and stops without the API", async () => {
    const { ctl, setFullscreen } = setup(undefined);
    setFullscreen(true);
    setFullscreen(false);
    await settle();
    expect(() => ctl.abort()).not.toThrow();
  });
});
