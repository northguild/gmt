/**
 * @vitest-environment jsdom
 *
 * The Canada 2026 clock-change checker end to end: template, mount, fetch, render, tick.
 * The Worker's answer is built by the real Worker handler in this test runtime, so no 2026e
 * offset is asserted as something the runtime computed (a test runtime can carry older tz data).
 *
 * Only `Date` is faked, so a clock is moved by setting the system time and waiting for the next
 * real second's tick.
 */
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { canadaTense } from "./clock-change-tense.fixture";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  linkTarget,
} from "~/test/render-widget";
import { setHtml, type SafeHtml } from "~/widgets/builders";
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
  renderCanadaClockChangeWidgetTemplate,
} from "./canada-clock-change-mount";
import { msToNextSecond } from "./clock-change-common";

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

const roots: HTMLElement[] = [];

/** The page, with the Key points. */
function host(markup?: SafeHtml): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  setHtml(
    root,
    markup ??
      renderCanadaClockChangeTemplate({
        tense: canadaTense,
        keyPoints: true,
      }),
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) root.remove();
});

const yoursCells = (root: HTMLElement) =>
  cellsInColumn(
    within(root).getByRole("table", { name: /offsets by place/ }),
    /^Yours/,
  );

const flat = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("the template", () => {
  it("server-renders the known rows, groups and clocks, each with NO SIGNAL where the answer goes", () => {
    const root = host();
    const card = within(root).getByRole("region", { name: "Your browser" });
    const table = within(card).getByRole("table");
    expect(cellsInColumn(table, "Place")).toHaveLength(TABLE_ZONES.length);
    for (const cell of cellsInColumn(table, /^Yours/))
      expect(cell).toHaveTextContent("NO SIGNAL");
    const changes = within(root).getByRole("region", {
      name: "Clock changes in 2026 and 2027",
    });
    expect(within(changes).getAllByRole("heading", { level: 5 })).toHaveLength(
      TRANSITION_ZONES.length,
    );
    const clocks = within(root).getByRole("region", { name: "Live clocks" });
    expect(within(clocks).getAllByRole("listitem")).toHaveLength(
      CLOCK_ZONES.length,
    );
    expect(within(clocks).getAllByText("NO SIGNAL")).toHaveLength(
      CLOCK_ZONES.length,
    );
    expect(within(root).queryByText(/Casablanca/)).not.toBeInTheDocument();
  });

  it("puts the city first in the place cell, with the zone id beneath", () => {
    const root = host();
    const table = within(root).getByRole("table", { name: /offsets by place/ });
    const vancouver = cellsInColumn(table, "Place")[0]!;
    expect(vancouver).toHaveTextContent("Vancouver");
    expect(vancouver).toHaveTextContent("America/Vancouver");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent?.trim().replace(/\s*\(.*$/, "")),
    ).toEqual(["Place", "Correct", "Yours"]);
  });

  it("server-renders the map section with its zone list and pin panel", () => {
    const root = host();
    const list = within(root).getByRole("list", { name: "Zones" });
    expect(within(list).getAllByRole("button")).toHaveLength(23);
    expect(within(root).getByText("Local time")).toBeInTheDocument();
  });

  it("carries the Node probe and a copy button", () => {
    const root = host();
    const frame = within(root).getByRole("group", { name: "Node command" });
    expect(frame).toHaveTextContent("America/Winnipeg");
    expect(frame).toHaveTextContent("longOffset");
    expect(
      within(frame).getByRole("button", { name: "Copy the command" }),
    ).toBeInTheDocument();
  });

  it("puts the cards in reading order", () => {
    const root = host();
    const order = within(root)
      .getAllByRole("heading")
      .map((h) => h.textContent?.trim());
    const wanted = [
      "Key points",
      "Your browser",
      "Live clocks",
      "Clock changes in 2026 and 2027",
      "How gmt helps",
      "Did your saved events move?",
    ];
    const at = wanted.map((name) =>
      order.findIndex((h) => h?.startsWith(name)),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("draws the Key points on the page and leaves them out of the chat copy", () => {
    const page = host();
    expect(
      within(page).getByRole("region", { name: "Key points" }),
    ).toBeInTheDocument();
    const chat = host(
      renderCanadaClockChangeWidgetTemplate("rail-1", canadaTense),
    );
    expect(
      within(chat).queryByRole("region", { name: "Key points" }),
    ).not.toBeInTheDocument();
  });

  it("links For developers to the Key points card: in place on the page, at the page from the chat", () => {
    const page = host();
    const here = within(page).getByRole("link", {
      name: "For developers",
      hidden: true,
    });
    expect(linkTarget(here)).toHaveTextContent("For developers: three checks");
    const chat = host(
      renderCanadaClockChangeWidgetTemplate("rail-1", canadaTense),
    );
    expect(
      within(chat).getByRole("link", { name: "For developers", hidden: true }),
    ).toHaveAttribute(
      "href",
      "/gmt/check/canada-2026-clock-change/#canada-developers",
    );
  });

  it("leaves no dead in-page link on the page", () => {
    const page = host();
    const local = within(page)
      .getAllByRole("link", { hidden: true })
      .filter((link) => link.getAttribute("href")?.startsWith("#"));
    expect(local.length).toBeGreaterThan(0);
    for (const link of local) expect(linkTarget(link)).not.toBeNull();
  });

  it("says the library uses the device's rules, and what to do once the runtime is updated", () => {
    const root = host();
    expect(
      within(root).getByText(
        /gmt uses the time-zone rules of the device it runs on\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(root).getAllByText(/Once your runtime is updated/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(root).getAllByRole("link", { name: "classifyStoredZoned" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("words every link to the saved-events section with the heading's own text", () => {
    const root = host();
    const heading = within(root).getByRole("heading", {
      name: "Did your saved events move?",
    });
    const links = within(root)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "#canada-stored-heading");
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links)
      expect(flat(link).replace(/\s*↓$/, "")).toBe(flat(heading));
  });

  it("has no accessibility violations", async () => {
    const root = host();
    await expectNoAxeViolations(root);
  });
});

describe("msToNextSecond", () => {
  it("counts to the next whole second from the fraction", () => {
    expect(msToNextSecond("2026-10-22T12:00:00Z")).toBe(1000);
    expect(msToNextSecond("2026-10-22T12:00:45.500Z")).toBe(500);
    expect(msToNextSecond("2026-10-22T12:00:07.849527833Z")).toBe(151);
  });
});

describe("the mount", () => {
  beforeEach(() => {
    resetRateLimitState();
    vi.useFakeTimers({ toFake: ["Date"] });
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
    await vi.waitFor(() => {
      for (const cell of yoursCells(root))
        expect(flat(cell)).toMatch(/^[✓✗] [+−-]\d{2}:\d{2}$/);
    });
    const verdict = within(root).getByRole("status", { name: "Verdict" });
    const shown = within(verdict)
      .getAllByRole("paragraph")
      .filter((line) =>
        /Your browser (has|cannot)/.test(line.textContent ?? ""),
      );
    expect(shown).toHaveLength(1);
    expect(flat(shown[0]!)).toMatch(/^[✓✗] Your browser /);
    controller.abort();
    void pending;
  });

  it("names the places that are wrong in the verdict, in words", async () => {
    const root = host();
    const controller = new AbortController();
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: function (
        _locale: string,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return {
          formatToParts: () => [
            {
              type: "timeZoneName",
              value:
                options?.timeZone === "America/Winnipeg" ||
                options?.timeZone === "America/Inuvik"
                  ? "GMT-06:00"
                  : `GMT${PROBE_ZONES.find((f) => f.zone === options?.timeZone)?.offset ?? "+00:00"}`,
            },
          ],
        };
      } as unknown as typeof Intl.DateTimeFormat,
    });
    try {
      void mountCanadaClockChange(root, controller.signal, {
        fetch: vi.fn(() => new Promise(() => {})) as unknown as typeof fetch,
        now,
      });
      const verdict = within(root).getByRole("status", { name: "Verdict" });
      await vi.waitFor(() =>
        expect(
          within(verdict).getByText(/old time zone data for/),
        ).toBeVisible(),
      );
      expect(
        within(verdict).getByRole("link", { name: "For developers" }),
      ).toHaveAttribute("href", "#canada-developers");
    } finally {
      vi.unstubAllGlobals();
      controller.abort();
    }
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
    const notice = within(stale).getByText(/This browser has old rules for/);
    expect(notice).toBeVisible();
    expect(flat(notice)).toBe(
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
      within(fresh).getByText(/This browser has old rules for/),
    ).not.toBeVisible();
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
    const changes = within(root).getByRole("region", {
      name: "Clock changes in 2026 and 2027",
    });
    for (const zone of TRANSITION_ZONES) {
      const group = within(changes)
        .getAllByRole("listitem")
        .find(
          (item) =>
            within(item).queryByRole("heading", { level: 5, name: zone }) !==
            null,
        )!;
      for (const year of [2026, 2027] as const) {
        const rows = check.transitions.filter(
          (r) => r.zone === zone && r.year === year,
        );
        if (rows.length === 0) {
          expect(
            within(group).getByText(`No clock change in ${year}`),
          ).toBeVisible();
        } else {
          expect(
            within(group).queryByText(`No clock change in ${year}`),
          ).not.toBeInTheDocument();
          for (const row of rows)
            expect(within(group).getByText(row.instant)).toBeVisible();
        }
      }
      expect(within(group).queryByText("NO SIGNAL")).not.toBeInTheDocument();
    }
    await expectNoAxeViolations(root);
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
    const card = within(root).getByRole("region", { name: "Live clocks" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(5);
    const item = within(card)
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("America/Vancouver"))!;
    expect(item).toHaveTextContent("04:00:00 -08:00");

    vi.setSystemTime(convertUtcToUnix("2026-10-22T12:00:01Z")!);
    await vi.waitFor(() => expect(item).toHaveTextContent("04:00:01 -08:00"), {
      timeout: 3000,
    });

    vi.setSystemTime(convertUtcToUnix("2026-10-22T12:02:00Z")!);
    await vi.waitFor(() => expect(item).toHaveTextContent("05:02:00 -07:00"), {
      timeout: 3000,
    });
    controller.abort();
  });

  it("stops the clocks when the signal aborts", async () => {
    const root = host();
    const controller = new AbortController();
    await mountCanadaClockChange(root, controller.signal, {
      fetch: fetching(await workerAnswer()),
      now,
    });
    const card = within(root).getByRole("region", { name: "Live clocks" });
    const item = within(card).getAllByRole("listitem")[0]!;
    controller.abort();
    const before = flat(item);
    vi.setSystemTime(convertUtcToUnix("2026-10-22T12:00:30Z")!);
    await new Promise((done) => setTimeout(done, 1200));
    expect(flat(item)).toBe(before);
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
    expect(
      within(root).getByRole("status", { name: "Check status" }),
    ).toHaveTextContent("Try again in 17 s");
    for (const cell of yoursCells(root)) expect(flat(cell)).not.toBe("");
    controller.abort();
  });

  it("announces Checking… in the status line while the check runs, then clears it", async () => {
    const user = userEvent.setup();
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
    const status = within(root).getByRole("status", { name: "Check status" });
    await user.click(within(root).getByRole("button", { name: "Check again" }));
    await vi.waitFor(() => expect(status).toHaveTextContent("Checking…"));
    release();
    await vi.waitFor(() => expect(status).toHaveTextContent(/^$/));
    await expectNoAxeViolations(root);
    controller.abort();
  });

  it("says the check could not finish on a network failure, and the button retries", async () => {
    const user = userEvent.setup();
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
    const status = within(root).getByRole("status", { name: "Check status" });
    expect(status).toHaveTextContent("The check could not finish.");
    await user.click(within(root).getByRole("button", { name: "Check again" }));
    await vi.waitFor(() => expect(status).toHaveTextContent(/^$/));
    expect(gets).toBe(2);
    controller.abort();
  });
});
