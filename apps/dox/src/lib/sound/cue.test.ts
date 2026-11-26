/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import {
  FakeAudioContext,
  installFakeAudio,
  installMemoryStorage,
} from "../../test/fake-audio";
import { installJsdomShims } from "../../test/jsdom-shims";
import { cue, loop, startCue } from "./cue";
import { saveSound } from "~/test/sound-storage";
import { SOUND_KEY, writeSound } from "./settings";

const engine = { attach: vi.fn(), destroy: vi.fn() };
const createEngine = vi.fn(() => engine);
vi.mock("./engine", () => ({ createEngine: () => createEngine() }));

installJsdomShims();

let teardown: (() => void) | undefined;

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  }));
}

function start() {
  teardown = startCue();
}

beforeEach(() => {
  vi.useFakeTimers();
  installFakeAudio();
  installMemoryStorage();
  // Sound is opt-in: these tests stand for a reader who turned it on; "muted" clears it.
  saveSound();
  reducedMotion(false);
  engine.attach.mockClear();
  engine.destroy.mockClear();
  createEngine.mockClear();
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
  localStorage.clear();
  expect(vi.getTimerCount()).toBe(0);
});

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

/** A mouse press on the page (`pointerdown`, then `pointerup`), or a key press. */
async function press(kind: "pointer" | "keydown" = "pointer") {
  if (kind === "keydown") await user.keyboard("a");
  else await user.pointer({ keys: "[MouseLeft]", target: document.body });
}

/** Another tab's write: no user action in this page produces a `storage` event. */
function storageChanged() {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `storage` for a write in another tab; nothing here can press it
  window.dispatchEvent(new StorageEvent("storage", { key: SOUND_KEY }));
}

describe("before a gesture", () => {
  it("makes no audio context", async () => {
    start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.dynamicImportSettled();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("drops a cue, and a loop, with nobody listening", async () => {
    start();
    const heard = vi.fn();
    document.addEventListener("gmt:cue", heard);
    cue("click");
    loop("aura")();
    expect(FakeAudioContext.instances).toHaveLength(0);
    document.removeEventListener("gmt:cue", heard);
  });

  it("loads the engine on idle when not muted", async () => {
    start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.dynamicImportSettled();
    expect(createEngine).toHaveBeenCalledTimes(1);
  });
});

describe("the first gesture", () => {
  it("creates and resumes the context inside the event, before anything awaits", async () => {
    start();
    await press();
    const [ctx] = FakeAudioContext.instances;
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(ctx.calls).toEqual(["resume"]);
    expect(ctx.options).toEqual({ latencyHint: "interactive" });
  });

  it("unlocks on a key press too", async () => {
    start();
    await press("keydown");
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("unlocks on the release of a press that began before it listened", async () => {
    await user.pointer({ keys: "[MouseLeft>]", target: document.body });
    start();
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("unlocks on a touch ending", () => {
    start();
    // oxlint-disable-next-line dox-test/no-dispatch-event -- user-event has no touch-end; the unlock listens for exactly this event
    window.dispatchEvent(new Event("touchend"));
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("hands the context to the engine once it has loaded", async () => {
    start();
    await press();
    await vi.dynamicImportSettled();
    expect(engine.attach).toHaveBeenCalledWith(FakeAudioContext.instances[0]);
  });

  it("removes its listeners once the context is running", async () => {
    start();
    await press();
    await press();
    await press("keydown");
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].calls).toEqual(["resume"]);
  });

  it("keeps waiting when the browser refuses, with no error", async () => {
    FakeAudioContext.refuse = true;
    start();
    await press();
    await press("keydown");
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].state).toBe("suspended");
    // The mouse press is a pointerdown and a pointerup; the key press is a keydown.
    expect(FakeAudioContext.instances[0].calls).toEqual([
      "resume",
      "resume",
      "resume",
    ]);
  });
});

describe("muted", () => {
  it.each([
    ["a visitor who never chose", () => localStorage.clear()],
    ["a saved mute", () => saveSound({ muted: true })],
  ])(
    "makes no context and loads no engine, gesture or not: %s",
    async (_name, set) => {
      set();
      start();
      await press();
      await vi.advanceTimersByTimeAsync(10);
      await vi.dynamicImportSettled();
      expect(FakeAudioContext.instances).toHaveLength(0);
      expect(createEngine).not.toHaveBeenCalled();
    },
  );

  it("unlocks the moment the reader unmutes, which is itself a gesture", async () => {
    saveSound({ muted: true });
    start();
    writeSound({ muted: false });
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].calls).toEqual(["resume"]);
    await vi.dynamicImportSettled();
    expect(createEngine).toHaveBeenCalledTimes(1);
  });

  it("waits for a gesture when another tab unmutes", async () => {
    saveSound({ muted: true });
    start();
    saveSound({ muted: false });
    storageChanged();
    expect(FakeAudioContext.instances).toHaveLength(0);
    await press();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });
});

describe("an in-site arrival", () => {
  function arrival(from: string | null, policy?: string) {
    vi.stubGlobal("navigation", {
      activation: { from: from ? { url: from } : null },
    });
    if (policy) {
      Object.defineProperty(navigator, "getAutoplayPolicy", {
        value: () => policy,
        configurable: true,
      });
    }
  }
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).getAutoplayPolicy;
  });

  it("unlocks at load where autoplay is allowed", async () => {
    arrival(`${location.origin}/guides/`, "allowed");
    start();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("unlocks at load where the API is absent, as Chrome has none", async () => {
    arrival(`${location.origin}/guides/`);
    start();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("waits for a gesture where the browser disallows autoplay", async () => {
    arrival(`${location.origin}/guides/`, "disallowed");
    start();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("stays silent and logs nothing where the context stays suspended", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    FakeAudioContext.refuse = true;
    arrival(`${location.origin}/guides/`);
    start();
    await vi.dynamicImportSettled();
    expect(FakeAudioContext.instances[0].state).toBe("suspended");
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
  });

  it("waits for a gesture when the page came from elsewhere", async () => {
    arrival("https://example.org/", "allowed");
    start();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe("the sidebar's arrival cue", () => {
  const heard: string[] = [];
  const onCue = (e: Event) => heard.push((e as CustomEvent).detail.name);

  /** jsdom has no layout: the pane gets a box where it is "shown". */
  function page(shown: boolean) {
    const pane = document.createElement("nav");
    pane.ariaLabel = "Docs sidebar";
    // oxlint-disable-next-line dox-test/no-class-query -- the code under test finds Starlight's pane by its class
    pane.className = "sidebar-pane";
    document.body.append(pane);
    pane.getBoundingClientRect = () =>
      ({
        width: shown ? 280 : 0,
        left: 0,
        right: shown ? 280 : 0,
      }) as DOMRect;
  }
  function from(url: string | null) {
    vi.stubGlobal("navigation", {
      activation: { from: url ? { url } : null },
    });
  }
  const site = () => `${location.origin}/guides/`;

  beforeEach(() => {
    heard.length = 0;
    document.addEventListener("gmt:cue", onCue);
  });
  afterEach(() => {
    document.removeEventListener("gmt:cue", onCue);
    screen.queryByRole("navigation")?.remove();
  });

  async function arriveAfter(before: "1" | "0" | null, shown: boolean) {
    if (before) sessionStorage.setItem("dox:sidebar", before);
    page(shown);
    from(site());
    start();
    await vi.dynamicImportSettled();
  }

  it("opens on a page with the sidebar after one without", async () => {
    await arriveAfter("0", true);
    expect(heard).toEqual(["open"]);
  });

  it("closes on a page without the sidebar after one with", async () => {
    await arriveAfter("1", false);
    expect(heard).toEqual(["close"]);
  });

  it("is silent when the sidebar stays", async () => {
    await arriveAfter("1", true);
    expect(heard).toEqual([]);
  });

  it("is silent on a tab's first page, which has no page before it", async () => {
    await arriveAfter(null, true);
    expect(heard).toEqual([]);
  });

  it("is silent after a visit to another site", async () => {
    sessionStorage.setItem("dox:sidebar", "0");
    page(true);
    from("https://example.org/");
    start();
    await vi.dynamicImportSettled();
    expect(heard).toEqual([]);
  });

  it("is silent when the sidebar is the closed mobile menu", async () => {
    await arriveAfter("0", false);
    expect(heard).toEqual([]);
  });

  it("is silent under reduced motion, which removes the transition", async () => {
    reducedMotion(true);
    await arriveAfter("0", true);
    expect(heard).toEqual([]);
  });

  it("is silent when muted", async () => {
    saveSound({ muted: true });
    await arriveAfter("0", true);
    expect(heard).toEqual([]);
  });

  it("is dropped, not played late, when audio starts after the wait", async () => {
    FakeAudioContext.refuse = true;
    await arriveAfter("0", true);
    expect(heard).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    FakeAudioContext.instances[0].become("running");
    expect(heard).toEqual([]);
  });

  it("plays once a context that was slow to start is running", async () => {
    FakeAudioContext.refuse = true;
    await arriveAfter("0", true);
    expect(heard).toEqual([]);
    FakeAudioContext.instances[0].become("running");
    expect(heard).toEqual(["open"]);
  });

  it("counts a page restored from the back/forward cache as an arrival", async () => {
    await arriveAfter("1", true);
    expect(heard).toEqual([]);
    sessionStorage.setItem("dox:sidebar", "0");
    // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `pageshow` on a restore from the back/forward cache; nothing here can navigate
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    expect(heard).toEqual(["open"]);
  });
});

describe("teardown", () => {
  it("closes the context, destroys the engine and leaves no listener", async () => {
    FakeAudioContext.refuse = true;
    start();
    await press();
    await vi.dynamicImportSettled();
    teardown?.();
    teardown = undefined;
    expect(FakeAudioContext.instances[0].state).toBe("closed");
    expect(engine.destroy).toHaveBeenCalled();
    await press("keydown");
    expect(FakeAudioContext.instances).toHaveLength(1);
  });
});
