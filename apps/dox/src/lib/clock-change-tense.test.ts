/**
 * @vitest-environment jsdom
 *
 * The tense of the dated clock-change checkers (CORE-89): which form is true on a given day, the
 * date and time each region states, and the guard that no checker string names a tense of its own.
 * The library is the real one, passed in as the parameter.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/dom";
import { html } from "~/widgets/builders";
import { tensedSlot } from "~/widgets/families/clockcheck/tense-slot";
import { renderHtml } from "~/widgets/test-fixture";
import { installJsdomShims } from "~/test/jsdom-shims";
import { CANADA_MOMENTS } from "./canada-clock-change";
import { loadClockLib } from "./clock-change-mount";
import {
  REGION_KEY,
  bindTense,
  changeTense,
  classPhrase,
  momentWords,
  tenseView,
} from "./clock-change-tense";
import { MOROCCO_CHANGES, MOROCCO_MOMENTS } from "./morocco-clock-change";

installJsdomShims();

const lib = await loadClockLib();
const ms = (utc: string) => lib.convertUtcToUnix(utc)!;

describe("changeTense", () => {
  const at = ms("2026-09-20T01:00:00Z");
  it("is before 1 ms ahead of the moment, and after at it and past it", () => {
    expect(changeTense(lib, at - 1, at)).toBe("before");
    expect(changeTense(lib, at, at)).toBe("after");
    expect(changeTense(lib, at + 1, at)).toBe("after");
  });
});

describe("the stated moments, pinned with the library", () => {
  it("writes Morocco's change as 02:00 local, 01:00 UTC", () => {
    expect(momentWords(lib, MOROCCO_MOMENTS[REGION_KEY]!)).toEqual({
      local: "20 September 2026 at 02:00",
      utc: "01:00",
    });
  });

  it("keeps Morocco's change equal to the stated change it duplicates", () => {
    const first = MOROCCO_CHANGES[0]!;
    for (const moment of Object.values(MOROCCO_MOMENTS)) {
      expect(moment).toEqual({ at: first.at, from: first.from });
    }
  });

  it("writes each Canadian zone at 02:00 on its own clock", () => {
    for (const [key, moment] of Object.entries(CANADA_MOMENTS)) {
      expect(momentWords(lib, moment)?.local, key).toBe(
        "1 November 2026 at 02:00",
      );
    }
  });

  it("makes the Canadian region's moment the latest zone's", () => {
    const latest = Math.max(
      ...Object.entries(CANADA_MOMENTS)
        .filter(([key]) => key !== REGION_KEY)
        .map(([, m]) => ms(m.at)),
    );
    expect(ms(CANADA_MOMENTS[REGION_KEY]!.at)).toBe(latest);
  });
});

describe("the checkers read true on the day they are read", () => {
  it("Morocco: states the change in the past tense only, with one form", () => {
    const view = tenseView(lib, MOROCCO_MOMENTS, "2026-10-23T12:00:00Z");
    const phrase = classPhrase("stopped", null, view, true, true);
    renderHtml(html`<h3>${tensedSlot(phrase, view)}</h3>`);
    expect(
      screen.getByRole("heading", {
        name: "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Stops changing/)).not.toBeInTheDocument();
  });

  it("Canada: before shows the future form, after the past form", () => {
    for (const [now, stem] of [
      ["2026-10-31T12:00:00Z", "Stops changing clocks on"],
      ["2026-11-02T12:00:00Z", "Stopped changing clocks on"],
    ] as const) {
      document.body.replaceChildren();
      const view = tenseView(lib, CANADA_MOMENTS, now);
      renderHtml(
        html`<h3>${tensedSlot(classPhrase("stopped", "America/Vancouver", view, false), view)}</h3>`,
      );
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${stem}`) }),
      ).toBeInTheDocument();
    }
  });
});

describe("bindTense", () => {
  afterEach(() => vi.useRealTimers());

  it("flips the phrase when the moment passes while the page is open", async () => {
    vi.useFakeTimers();
    let nowIso = "2026-11-01T08:59:58Z";
    const moments = { region: { at: "2026-11-01T09:00:00Z", from: "-07:00" } };
    const view = tenseView(lib, moments, "2026-11-01T08:59:58Z");
    renderHtml(
      html`<h3>${tensedSlot({ key: "region", before: "Stops", after: "Stopped" }, view)}</h3>`,
    );
    const controller = new AbortController();
    bindTense(document.body, {
      lib,
      moments,
      now: () => nowIso,
      signal: controller.signal,
    });
    expect(screen.getByRole("heading", { name: "Stops" })).toBeInTheDocument();
    nowIso = "2026-11-01T09:00:00Z";
    await vi.advanceTimersByTimeAsync(2000);
    expect(
      screen.getByRole("heading", { name: "Stopped" }),
    ).toBeInTheDocument();
    controller.abort();
  });
});

describe("no checker string names a tense of its own", () => {
  it("keeps the class verbs in the tense module", () => {
    const src = join(import.meta.dirname, "..");
    const hits = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(?:ts|tsx|astro)$/.test(f))
      .filter((f) => !/\.test\.|\.fixture\.|clock-change-tense\.ts$/.test(f))
      .filter((f) =>
        /Stops changing clocks|Stopped changing clocks/.test(
          readFileSync(join(src, f), "utf8"),
        ),
      );
    expect(hits).toEqual([]);
  });
});
