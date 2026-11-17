/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims } from "../../test/jsdom-shims";
import {
  defaultSound,
  onSoundChange,
  readSound,
  SOUND_KEY,
  writeSound,
} from "./settings";

installJsdomShims();

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  }));
}

afterEach(() => {
  localStorage.clear();
});

/** Another tab's write: no user action in this page produces a `storage` event. */
function storageChanged(key: string) {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `storage` for a write in another tab; nothing here can press it
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

describe("the default", () => {
  it("is level 5, aura on and sound on", () => {
    reducedMotion(false);
    expect(readSound()).toEqual({
      level: 5,
      muted: false,
      aura: true,
      track: "ice",
    });
  });

  it("starts muted under reduced motion", () => {
    reducedMotion(true);
    expect(readSound()).toEqual({
      level: 5,
      muted: true,
      aura: true,
      track: "ice",
    });
  });
});

describe("a saved choice", () => {
  it("beats the media query", () => {
    reducedMotion(true);
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify({ level: 8, muted: false, aura: false, track: "deep" }),
    );
    expect(readSound()).toEqual({
      level: 8,
      muted: false,
      aura: false,
      track: "deep",
    });
  });

  it("reads a choice saved before the track existed with Ice cavern", () => {
    reducedMotion(false);
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify({ level: 8, muted: false, aura: true }),
    );
    expect(readSound().track).toBe("ice");
  });

  it("reads an unknown track as Ice cavern", () => {
    reducedMotion(false);
    localStorage.setItem(SOUND_KEY, JSON.stringify({ track: "jazz" }));
    expect(readSound().track).toBe("ice");
  });

  it("round trips through writeSound", () => {
    reducedMotion(false);
    writeSound({ level: 3, muted: true, track: "deep" });
    expect(readSound()).toEqual({
      level: 3,
      muted: true,
      aura: true,
      track: "deep",
    });
  });

  it("reads corrupt JSON as the default", () => {
    reducedMotion(false);
    localStorage.setItem(SOUND_KEY, "{not json");
    expect(readSound()).toEqual(defaultSound());
  });

  it("reads a field of the wrong type as that field's default", () => {
    reducedMotion(false);
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify({ level: "loud", muted: "yes", aura: false }),
    );
    expect(readSound()).toEqual({
      level: 5,
      muted: false,
      aura: false,
      track: "ice",
    });
  });

  it("clamps a level outside 1 to 11", () => {
    reducedMotion(false);
    localStorage.setItem(SOUND_KEY, JSON.stringify({ level: 99 }));
    expect(readSound().level).toBe(11);
    localStorage.setItem(SOUND_KEY, JSON.stringify({ level: -4 }));
    expect(readSound().level).toBe(1);
    expect(writeSound({ level: 0 }).level).toBe(1);
  });
});

describe("storage that throws", () => {
  it("reads the default and keeps a write on the page", () => {
    reducedMotion(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSound()).toEqual(defaultSound());
    expect(() => writeSound({ level: 2 })).not.toThrow();
  });
});

describe("a read", () => {
  it("writes nothing", () => {
    reducedMotion(true);
    readSound();
    expect(localStorage.getItem(SOUND_KEY)).toBeNull();
  });
});

describe("onSoundChange", () => {
  it("tells listeners of this document's write, then stops when unsubscribed", () => {
    reducedMotion(false);
    const fn = vi.fn();
    const stop = onSoundChange(fn);
    writeSound({ aura: false });
    expect(fn).toHaveBeenCalledWith(
      { level: 5, muted: false, aura: false, track: "ice" },
      "local",
    );
    stop();
    writeSound({ aura: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("follows another tab through the storage event", () => {
    reducedMotion(false);
    const fn = vi.fn();
    const stop = onSoundChange(fn);
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify({ level: 9, muted: true, aura: true }),
    );
    storageChanged(SOUND_KEY);
    expect(fn).toHaveBeenCalledWith(
      { level: 9, muted: true, aura: true, track: "ice" },
      "storage",
    );
    storageChanged("other");
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("the pre-paint script", () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "../../components/ThemeProvider.astro"),
    "utf8",
  );
  const script = source
    .replace(/^[\s\S]*?<script is:inline>/, "")
    .replace(/<\/script>[\s\S]*$/, "");

  function prepaint(): string | undefined {
    delete document.documentElement.dataset.sound;
    new Function(script)();
    return document.documentElement.dataset.sound;
  }

  it.each([
    ["nothing saved", null, false],
    ["nothing saved, reduced motion", null, true],
    ["saved unmuted, reduced motion", { muted: false }, true],
    ["saved muted", { muted: true }, false],
    ["corrupt", "{oops", true],
  ])("holds the same rule as readSound: %s", (_name, saved, reduce) => {
    reducedMotion(reduce);
    if (saved !== null) {
      localStorage.setItem(
        SOUND_KEY,
        typeof saved === "string" ? saved : JSON.stringify(saved),
      );
    }
    expect(prepaint()).toBe(readSound().muted ? "off" : "on");
  });
});
