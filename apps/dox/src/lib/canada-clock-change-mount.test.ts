/**
 * @vitest-environment jsdom
 *
 * The Canada 2026 clock-change checker end to end: template, mount, fetch, render, tick.
 * The Worker's answer is built by the real Worker handler in this test runtime, so no 2026e
 * offset is asserted as something the runtime computed (a test runtime can carry older tz data).
 */
import { screen, within } from "@testing-library/dom";
import { canadaTense } from "./clock-change-tense.fixture";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { installJsdomShims } from "~/test/jsdom-shims";
import { handleCanadaClockChange } from "../../worker/canada-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import {
  CLOCK_ZONES,
  PROBE_ZONES,
  TABLE_ZONES,
  TRANSITION_ZONES,
  type CanadaCheck,
} from "./canada-clock-change";
import {
  mountCanadaClockChange,
  renderCanadaClockChangeTemplate,
} from "./canada-clock-change-mount";
import { msToNextSecond } from "./clock-change-common";
import { placesHtml, verdictHtml } from "./clock-change-probe";
import { CANADA_VERDICT } from "./canada-clock-change";

installJsdomShims();

const NOW = "2026-10-22T12:00:00Z";

async function workerAnswer(): Promise<CanadaCheck> {
  const response = await handleCanadaClockChange(
    new Request("https://northguild.dev/gmt/api/canada-clock-change", {
      headers: { "cf-connecting-ip": "5.6.7.8" },
    }),
    {},
    () => NOW,
  );
  return (await response.json()) as CanadaCheck;
}

/** The probe rows as tzdb 2026e states them: the constants, not the runtime's tz data. */
function citedProbe(check: CanadaCheck): CanadaCheck {
  return {
    ...check,
    probe: PROBE_ZONES.map((fact) => ({
      zone: fact.zone,
      offset: fact.offset,
    })),
  };
}

function fetching(body: CanadaCheck): typeof fetch {
  return vi.fn(async () =>
    Response.json(body, { headers: { "cache-control": "no-store" } }),
  ) as unknown as typeof fetch;
}

function host(): HTMLElement {
  document.body.innerHTML = renderCanadaClockChangeTemplate({
    tense: canadaTense,
  });
  return document.querySelector<HTMLElement>(".gmt-canada")!;
}

const text = (el: Element | null) => el?.textContent?.trim() ?? "";

describe("the template", () => {
  it("server-renders the known rows, groups and clocks", () => {
    const root = host();
    expect(
      root.querySelectorAll(".gmt-clockcheck-table tbody tr"),
    ).toHaveLength(4);
    expect(root.querySelector('[data-zone="Africa/Casablanca"]')).toBeNull();
    expect(root.querySelectorAll(".gmt-clockcheck-group")).toHaveLength(
      TRANSITION_ZONES.length,
    );
    expect(root.querySelectorAll(".gmt-clockcheck-clock")).toHaveLength(
      CLOCK_ZONES.length,
    );
    expect(
      root.querySelector(
        'tr[data-zone="America/Vancouver"] [data-role="browser"]',
      )?.innerHTML,
    ).toContain("NO SIGNAL");
    expect(root.querySelector('[data-role="verdict"]')).not.toBeNull();
    expect(
      root.querySelector('[data-role="clocks-notice"]')?.hasAttribute("hidden"),
    ).toBe(true);
    expect(root.querySelector('[data-role="map-notice"]')).toBeNull();
    expect(root.querySelector('[data-role="legend-stale"]')).toBeNull();
  });

  it("puts the city first in the zone cell, with the zone id beneath", () => {
    const root = host();
    const cell = root.querySelector(
      'tr[data-zone="America/Vancouver"] th[scope="row"]',
    )!;
    expect(text(cell.querySelector(".gmt-clockcheck-city"))).toBe("Vancouver");
    expect(text(cell.querySelector(".gmt-clockcheck-zoneid"))).toBe(
      "America/Vancouver",
    );
    expect(
      [...root.querySelectorAll(".gmt-clockcheck-table thead th")].map((th) =>
        (th.firstChild?.textContent ?? "").trim(),
      ),
    ).toEqual(["Place", "Correct", "Yours"]);
  });

  it("server-renders the map section with its zone list and pin panel", () => {
    const root = host();
    expect(
      root.querySelector<HTMLElement>('[data-role="map-section"]')?.hidden,
    ).toBe(false);
    expect(root.querySelectorAll("[data-role=zone-list] button")).toHaveLength(
      23,
    );
    expect(root.querySelector('[data-role="pin"]')).not.toBeNull();
  });

  it("carries the Node probe and a copy button", () => {
    host();
    const frame = screen.getByRole("group", { name: "Node command" });
    expect(frame).toHaveTextContent("America/Winnipeg");
    expect(frame).toHaveTextContent("longOffset");
    expect(
      within(frame).getByRole("button", { name: "Copy the command" }),
    ).toBeInTheDocument();
  });
});

describe("msToNextSecond", () => {
  it("counts to the next whole second from the fraction", () => {
    expect(msToNextSecond("2026-10-22T12:00:00Z")).toBe(1000);
    expect(msToNextSecond("2026-10-22T12:00:45.500Z")).toBe(500);
    expect(msToNextSecond("2026-10-22T12:00:07.849527833Z")).toBe(151);
  });
});

describe("the words", () => {
  it("words the verdict by naming the places that are wrong", () => {
    expect(verdictHtml([], CANADA_VERDICT)).toContain(
      "Your browser has the new rules for all four places.",
    );
    expect(verdictHtml([], CANADA_VERDICT)).toContain("\u2713");
    const bad = verdictHtml(["Inuvik", "Winnipeg"], CANADA_VERDICT);
    expect(bad).toContain("\u2717");
    expect(bad).toContain(
      'Your browser has old time zone data for <span data-role="wrong-places"><code>Inuvik</code> and <code>Winnipeg</code></span>. From 1 November 2026 it shows their time an hour wrong.',
    );
    expect(bad).toContain(
      "update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.",
    );
    expect(bad).toContain("your users&rsquo; browsers can be the same.");
    expect(bad).toContain('href="#canada-developers"');
  });
  it("sets place names as code chips", () => {
    expect(placesHtml(["A", "B", "C"])).toBe(
      "<code>A</code>, <code>B</code> and <code>C</code>",
    );
  });
});

describe("the mount", () => {
  beforeEach(() => {
    resetRateLimitState();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(convertUtcToUnix(NOW)!);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const now = () => getUtcNow();

  it("fills the browser column and the verdict without waiting for the server", async () => {
    const root = host();
    const controller = new AbortController();
    const pending = mountCanadaClockChange(root, controller.signal, {
      fetch: vi.fn(() => new Promise(() => {})) as unknown as typeof fetch,
      now,
    });
    await vi.waitFor(() =>
      expect(
        text(
          root.querySelector(
            'tr[data-zone="America/Vancouver"] [data-role="browser"]',
          ),
        ),
      ).toMatch(/^[\u2713\u2717] [+\u2212]\d{2}:\d{2}$/),
    );
    const verdict = root.querySelector<HTMLElement>('[data-role="verdict"]')!;
    expect(["ok", "bad"]).toContain(verdict.dataset.state);
    expect(text(verdict)).toMatch(/^[\u2713\u2717] Your browser /);
    controller.abort();
    void pending;
  });

  it("shows the clocks notice only when the server's data still changes a stopped zone", async () => {
    const stale = host();
    const c1 = new AbortController();
    const check = await workerAnswer();
    const stopped = (kind: "stopped" | "changes-after") => ({
      ...check,
      zones: check.zones.map((z) =>
        TABLE_ZONES.some((f) => f.zone === z.zone) ? { ...z, kind } : z,
      ),
    });
    await mountCanadaClockChange(stale, c1.signal, {
      fetch: fetching(stopped("changes-after")),
      now,
    });
    expect(
      stale.querySelector<HTMLElement>('[data-role="clocks-notice"]')?.hidden,
    ).toBe(false);
    expect(text(stale.querySelector('[data-role="clocks-notice"]'))).toBe(
      "This browser has old rules for Vancouver, Edmonton, Inuvik and Winnipeg. From 1 November 2026 these clocks show them an hour off.",
    );
    c1.abort();
    const fresh = host();
    const c2 = new AbortController();
    await mountCanadaClockChange(fresh, c2.signal, {
      fetch: fetching(stopped("stopped")),
      now,
    });
    expect(
      fresh.querySelector<HTMLElement>('[data-role="clocks-notice"]')?.hidden,
    ).toBe(true);
    c2.abort();
  });

  it("groups the transitions per zone, with a line for a year with none", async () => {
    const root = host();
    const controller = new AbortController();
    const check = await workerAnswer();
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetching(check),
      now,
    });
    for (const zone of TRANSITION_ZONES) {
      const group = root.querySelector(
        `.gmt-clockcheck-group[data-zone="${zone}"]`,
      )!;
      for (const year of [2026, 2027] as const) {
        const rows = check.transitions.filter(
          (r) => r.zone === zone && r.year === year,
        );
        const none = [
          ...group.querySelectorAll(".gmt-clockcheck-change-none"),
        ].filter((el) => text(el).endsWith(String(year)));
        if (rows.length === 0) {
          expect(none.map(text)).toEqual([`No clock change in ${year}`]);
        } else {
          expect(none).toHaveLength(0);
        }
      }
      expect(group.querySelectorAll(".gmt-clockcheck-change")).toHaveLength(
        check.transitions.filter((r) => r.zone === zone).length,
      );
    }
    controller.abort();
  });

  it("draws five clocks and switches a zone at its next change", async () => {
    const root = host();
    const controller = new AbortController();
    const check = await workerAnswer();
    check.zones = check.zones.map((zone) =>
      zone.zone === "America/Vancouver"
        ? {
            ...zone,
            offset: "-08:00",
            next: {
              instant: "2026-10-22T12:02:00Z",
              offsetBefore: "-08:00",
              offsetAfter: "-07:00",
            },
          }
        : zone,
    );
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetching(check),
      now,
    });
    expect(
      root.querySelectorAll(".gmt-clockcheck-clock svg.gmt-crystal-clock"),
    ).toHaveLength(5);
    const item = root.querySelector(
      '.gmt-clockcheck-clock[data-zone="America/Vancouver"]',
    )!;
    const readout = () => text(item.querySelector('[data-role="clock-time"]'));
    const face = item.querySelector("svg.gmt-crystal-clock");
    expect(readout()).toBe("04:00:00 -08:00");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(readout()).toBe("04:00:01 -08:00");

    await vi.advanceTimersByTimeAsync(119_000);
    expect(readout()).toBe("05:02:00 -07:00");
    // The face is updated in place, so focus and the night light survive a tick.
    expect(item.querySelector("svg.gmt-crystal-clock")).toBe(face);
    controller.abort();
  });

  it("clears the one timer when the signal aborts", async () => {
    const root = host();
    const controller = new AbortController();
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetching(await workerAnswer()),
      now,
    });
    // The probe's clock timer, and the tense timer for the change 9 days ahead.
    expect(vi.getTimerCount()).toBe(2);
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prints the wait on a 429", async () => {
    const root = host();
    const controller = new AbortController();
    await mountCanadaClockChange(root, controller.signal, {
      fetch: vi.fn(async () =>
        Response.json(
          { error: "Too many requests.", retryable: true },
          { status: 429, headers: { "retry-after": "17" } },
        ),
      ) as unknown as typeof fetch,
      now,
    });
    expect(text(root.querySelector('[data-role="status"]'))).toBe(
      "Try again in 17 s",
    );
    expect(
      text(
        root.querySelector(
          'tr[data-zone="America/Vancouver"] [data-role="browser"]',
        ),
      ),
    ).not.toBe("");
    controller.abort();
  });

  it("announces Checking\u2026 in the status line while the check runs, then clears it", async () => {
    const root = host();
    const controller = new AbortController();
    const answer = await workerAnswer();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    let gets = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json({ rows: [], zone: "" });
      gets += 1;
      if (gets > 1) await held;
      return Response.json(citedProbe(answer));
    });
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetchFn as unknown as typeof fetch,
      now,
    });
    const status = root.querySelector('[data-role="status"]');
    root.querySelector<HTMLButtonElement>('[data-role="recheck"]')!.click();
    await vi.waitFor(() => expect(text(status)).toBe("Checking\u2026"));
    release();
    await vi.waitFor(() => expect(text(status)).toBe(""));
    controller.abort();
  });

  it("says the check could not finish on a network failure, and the button retries", async () => {
    const root = host();
    const controller = new AbortController();
    const answer = await workerAnswer();
    let gets = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json({ rows: [], zone: "" });
      gets += 1;
      if (gets === 1) throw new TypeError("network");
      return Response.json(citedProbe(answer));
    });
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetchFn as unknown as typeof fetch,
      now,
    });
    expect(text(root.querySelector('[data-role="status"]'))).toBe(
      "The check could not finish.",
    );
    root.querySelector<HTMLButtonElement>('[data-role="recheck"]')!.click();
    await vi.waitFor(() =>
      expect(text(root.querySelector('[data-role="status"]'))).toBe(""),
    );
    expect(gets).toBe(2);
    controller.abort();
  });
});
