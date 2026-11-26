/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { installJsdomShims } from "../../test/jsdom-shims";
import {
  onSoundChange,
  readSound,
  SOUND_KEY,
  SOUND_VERSION,
  writeSound,
} from "./settings";

installJsdomShims();

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  }));
}

/** A record as this build saves it. */
function save(fields: Record<string, unknown>) {
  localStorage.setItem(
    SOUND_KEY,
    JSON.stringify({ v: SOUND_VERSION, ...fields }),
  );
}

/** Storage that throws on every write, as with blocked site data or a full quota. */
function blockWrites() {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // A write that lands clears any choice an earlier test's blocked storage left on the page.
  writeSound({});
  localStorage.clear();
});

/** Another tab's write: no user action in this page produces a `storage` event. */
function storageChanged(key: string) {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `storage` for a write in another tab; nothing here can press it
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/** A return from the back/forward cache, or a plain load when `persisted` is false. */
function pageShown(persisted: boolean) {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `pageshow` on a restore from the back/forward cache; nothing here can navigate
  window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted }));
}

const MUTED_DEFAULT = { level: 5, muted: true, aura: true, track: "ice" };

describe("the default", () => {
  it.each([false, true])(
    "is muted, level 5, aura on, whatever the system asks (reduced motion %s)",
    (reduce) => {
      reducedMotion(reduce);
      expect(readSound()).toEqual(MUTED_DEFAULT);
    },
  );
});

describe("a saved choice", () => {
  it("is read field by field", () => {
    save({ level: 8, muted: false, aura: false, track: "deep" });
    expect(readSound()).toEqual({
      level: 8,
      muted: false,
      aura: false,
      track: "deep",
    });
  });

  it("is saved with its version", () => {
    writeSound({ muted: false });
    expect(JSON.parse(localStorage.getItem(SOUND_KEY) ?? "null")).toEqual({
      v: SOUND_VERSION,
      level: 5,
      muted: false,
      aura: true,
      track: "ice",
    });
  });

  it.each([
    ["no version", { level: 8, muted: false, aura: false }],
    ["another version", { v: SOUND_VERSION + 1, level: 8, muted: false }],
    ["a version of the wrong type", { v: String(SOUND_VERSION), muted: false }],
  ])("reads a record with %s as the muted default", (_name, record) => {
    localStorage.setItem(SOUND_KEY, JSON.stringify(record));
    expect(readSound()).toEqual(MUTED_DEFAULT);
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["a number", "7"],
    ["null", "null"],
    ["an array", "[false]"],
  ])("reads %s as the muted default", (_name, raw) => {
    localStorage.setItem(SOUND_KEY, raw);
    expect(readSound()).toEqual(MUTED_DEFAULT);
  });

  it("reads an unknown track as Ice cavern", () => {
    save({ track: "jazz" });
    expect(readSound().track).toBe("ice");
  });

  it("reads a field of the wrong type as that field's default, so a bad mute stays muted", () => {
    save({ level: "loud", muted: "no", aura: false });
    expect(readSound()).toEqual({
      level: 5,
      muted: true,
      aura: false,
      track: "ice",
    });
  });

  it("clamps a level outside 1 to 11", () => {
    save({ level: 99 });
    expect(readSound().level).toBe(11);
    save({ level: -4 });
    expect(readSound().level).toBe(1);
    expect(writeSound({ level: 0 }).level).toBe(1);
  });
});

describe("storage that throws", () => {
  it("reads the muted default when reading throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSound()).toEqual(MUTED_DEFAULT);
  });

  it("keeps an unmute it could not save for the rest of the page", () => {
    blockWrites();
    expect(() => writeSound({ muted: false, level: 7 })).not.toThrow();
    expect(readSound()).toMatchObject({ muted: false, level: 7 });
    expect(localStorage.getItem(SOUND_KEY)).toBeNull();
  });

  it("keeps it over an older saved record when only writes fail (a full quota)", () => {
    save({ muted: true, level: 3 });
    blockWrites();
    writeSound({ muted: false });
    expect(readSound()).toMatchObject({ muted: false, level: 3 });
  });

  it("drops the unsaved choice once a write lands", () => {
    blockWrites();
    writeSound({ muted: false });
    vi.restoreAllMocks();
    writeSound({ level: 9 });
    expect(readSound()).toEqual({ ...MUTED_DEFAULT, muted: false, level: 9 });
    localStorage.removeItem(SOUND_KEY);
    expect(readSound()).toEqual(MUTED_DEFAULT);
  });

  it("drops the unsaved choice for another tab's write, which is newer", () => {
    const stop = onSoundChange(() => {});
    blockWrites();
    writeSound({ muted: false });
    vi.restoreAllMocks();
    save({ muted: true, level: 2 });
    storageChanged(SOUND_KEY);
    expect(readSound()).toMatchObject({ muted: true, level: 2 });
    stop();
  });
});

describe("a read", () => {
  it("writes nothing", () => {
    readSound();
    expect(localStorage.getItem(SOUND_KEY)).toBeNull();
  });
});

describe("onSoundChange", () => {
  it("tells listeners of this document's write, then stops when unsubscribed", () => {
    const fn = vi.fn();
    const stop = onSoundChange(fn);
    writeSound({ muted: false });
    expect(fn).toHaveBeenCalledWith(
      { ...MUTED_DEFAULT, muted: false },
      "local",
    );
    stop();
    writeSound({ aura: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("follows another tab through the storage event", () => {
    const fn = vi.fn();
    const stop = onSoundChange(fn);
    save({ level: 9, muted: false, aura: true });
    storageChanged(SOUND_KEY);
    expect(fn).toHaveBeenCalledWith(
      { level: 9, muted: false, aura: true, track: "ice" },
      "storage",
    );
    storageChanged("other");
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reads the key again on a return from the back/forward cache, not on a plain load", () => {
    const fn = vi.fn();
    const stop = onSoundChange(fn);
    save({ muted: false });
    pageShown(false);
    expect(fn).not.toHaveBeenCalled();
    pageShown(true);
    expect(fn).toHaveBeenCalledWith(
      { ...MUTED_DEFAULT, muted: false },
      "storage",
    );
    stop();
    pageShown(true);
    expect(fn).toHaveBeenCalledTimes(1);
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
    ["saved unmuted", { v: SOUND_VERSION, muted: false }, false],
    ["saved unmuted, reduced motion", { v: SOUND_VERSION, muted: false }, true],
    ["saved muted", { v: SOUND_VERSION, muted: true }, false],
    ["unmuted with no version", { muted: false }, false],
    [
      "unmuted with another version",
      { v: SOUND_VERSION + 1, muted: false },
      false,
    ],
    ["a mute of the wrong type", { v: SOUND_VERSION, muted: "no" }, false],
    ["corrupt", "{oops", false],
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
