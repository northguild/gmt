/// <reference types="vitest/globals" />

import {
  DEFAULT_DATE_DISPLAY,
  dateDisplayStore,
  hydrateDateDisplay,
  resetDateDisplay,
  setDateFormat,
  setDateZone,
  type DateDisplayStorage,
} from "./date-display-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: DateDisplayStorage & { data: Map<string, string> } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return storage;
}

beforeEach(() => resetDateDisplay());

describe("dateDisplayStore", () => {
  it("starts on the calendar format in the reader's own zone", () => {
    expect(dateDisplayStore.state).toEqual({
      formatId: "calendar",
      zone: null,
    });
    expect(DEFAULT_DATE_DISPLAY.formatId).toBe("calendar");
  });

  it("applies the reader's stored picks on hydration", () => {
    hydrateDateDisplay(
      memoryStorage({
        "dox:date-format": "iso-zoned",
        "dox:date-zone": "Asia/Tokyo",
      }),
    );
    expect(dateDisplayStore.state).toEqual({
      formatId: "iso-zoned",
      zone: "Asia/Tokyo",
    });
  });

  it("ignores a stored format this build does not know", () => {
    hydrateDateDisplay(memoryStorage({ "dox:date-format": "relative-medium" }));
    expect(dateDisplayStore.state.formatId).toBe("calendar");
  });

  it("saves changes once hydrated, and forgets a zone set back to the reader's own", () => {
    const storage = memoryStorage();
    hydrateDateDisplay(storage);

    setDateFormat("http");
    setDateZone("Europe/London");
    expect(storage.data.get("dox:date-format")).toBe("http");
    expect(storage.data.get("dox:date-zone")).toBe("Europe/London");

    setDateZone(null);
    expect(storage.data.has("dox:date-zone")).toBe(false);
  });

  it("hydrates once, so a second consumer mounting cannot reset the picks", () => {
    hydrateDateDisplay(memoryStorage({ "dox:date-format": "utc" }));
    setDateFormat("unix-s");
    hydrateDateDisplay(memoryStorage({ "dox:date-format": "http" }));
    expect(dateDisplayStore.state.formatId).toBe("unix-s");
  });

  it("falls back to the defaults when storage throws", () => {
    const broken: DateDisplayStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    hydrateDateDisplay(broken);
    expect(dateDisplayStore.state).toEqual(DEFAULT_DATE_DISPLAY);
    // ...and a pick still holds for the session.
    expect(() => setDateFormat("http")).not.toThrow();
    expect(dateDisplayStore.state.formatId).toBe("http");
  });
});
