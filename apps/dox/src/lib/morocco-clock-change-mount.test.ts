/**
 * @vitest-environment jsdom
 *
 * The Morocco 2026 clock-change checker end to end: template, mount, fetch, render. The Worker's
 * answer is built by the real Worker code at three fixed instants, so no offset is asserted as
 * something this runtime computed.
 */
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { canadaTense, moroccoTense } from "./clock-change-tense.fixture";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  linkTarget,
} from "~/test/render-widget";
import { setHtml, type SafeHtml } from "~/widgets/builders";
import { handleCanadaClockChange } from "../../worker/canada-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import { computeMoroccoCheck } from "../../worker/morocco-clock-change";
import {
  MOROCCO_PROBE,
  MOROCCO_STOP_YEAR,
  presentText,
  type MoroccoCheck,
} from "./morocco-clock-change";
import {
  mountMoroccoClockChange,
  renderMoroccoClockChangeTemplate,
  renderMoroccoClockChangeWidgetTemplate,
} from "./morocco-clock-change-mount";
import {
  mountCanadaClockChange,
  renderCanadaClockChangeTemplate,
  renderCanadaClockChangeWidgetTemplate,
} from "./canada-clock-change-mount";

installJsdomShims();

const INSTANTS = [
  "2026-10-25T12:00:00Z",
  "2027-02-20T12:00:00Z",
  "2027-06-01T12:00:00Z",
];

function fetching(body: MoroccoCheck): typeof fetch {
  return vi.fn(async () =>
    Response.json(body, { headers: { "cache-control": "no-store" } }),
  ) as unknown as typeof fetch;
}

const roots: HTMLElement[] = [];

function place(markup: SafeHtml): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  setHtml(root, markup);
  return root;
}

/** The page, with the Key points. */
const host = (): HTMLElement =>
  place(
    renderMoroccoClockChangeTemplate({ keyPoints: true, tense: moroccoTense }),
  );

afterEach(() => {
  for (const root of roots.splice(0)) root.remove();
});

const flat = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

const FORBIDDEN = /\bwill\b|\bis due\b|\bupcoming\b/i;

/** What a reader sees before the Worker answers: the own text of every element that is shown. */
function visibleText(root: HTMLElement): string {
  return within(root)
    .queryAllByText(/\S/, { ignore: "script,style,svg" })
    .filter((el) => {
      try {
        expect(el).toBeVisible();
        return true;
      } catch {
        return false;
      }
    })
    .map((el) => el.textContent)
    .join(" ");
}

/** Fails when two ids in the container are the same: the page's and the chat's copy must not share one. */
async function expectUniqueIds(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: "rule", values: ["duplicate-id", "duplicate-id-aria"] },
  });
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

const wrongSection = (root: HTMLElement) =>
  within(root).getByRole("region", {
    name: "Clock changes your data gets wrong",
  });

describe("the template", () => {
  it("renders the verdict row and the blind row for each zone", () => {
    const root = host();
    const card = within(root).getByRole("region", { name: "Your browser" });
    const table = within(card).getByRole("table");
    expect(cellsInColumn(table, "Place")).toHaveLength(4);
    expect(
      within(card).getByText(/Old and new data agree here/),
    ).toBeInTheDocument();
  });

  it("never mentions Canada", () => {
    expect(host()).not.toHaveTextContent(/canada/i);
    expect(
      place(renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense)),
    ).not.toHaveTextContent(/canada/i);
  });

  it("links What to do to the Key points card: in place on the page, at the page from the chat", () => {
    const page = host();
    const here = within(page).getByRole("link", {
      name: "What to do",
      hidden: true,
    });
    expect(linkTarget(here)).toHaveTextContent("What to do");
    const chat = place(
      renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense),
    );
    expect(
      within(chat).getByRole("link", { name: "What to do", hidden: true }),
    ).toHaveAttribute(
      "href",
      "/gmt/check/morocco-2026-clock-change/#morocco-developers",
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

  it("puts the cards in reading order: servers, minimums, changes", () => {
    const root = host();
    const headings = within(root)
      .getAllByRole("heading")
      .map((h) => h.textContent?.trim());
    const wanted = [
      "Key points",
      "Your browser",
      "Live clocks",
      "Clock changes your data gets wrong",
      "How gmt helps",
      "Clock changes in 2026 and 2027",
      "Did your saved events move?",
    ];
    const at = wanted.map((name) =>
      headings.findIndex((h) => h?.startsWith(name)),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("has no accessibility violations", async () => {
    await expectNoAxeViolations(host());
  });
});

describe("the mount", () => {
  it.each(INSTANTS)(
    "holds static text that is true before and after any date (%s)",
    async (now) => {
      const root = host();
      const controller = new AbortController();
      await mountMoroccoClockChange(root, controller.signal, {
        fetch: fetching(computeMoroccoCheck(now, MOROCCO_STOP_YEAR)),
        now: () => now,
      });
      await vi.waitFor(() =>
        expect(
          within(wrongSection(root)).getAllByText(/This server/).length,
        ).toBeGreaterThan(0),
      );
      expect(visibleText(root)).not.toMatch(FORBIDDEN);
      controller.abort();
    },
  );

  it("shows the Worker's present flags for each stated change", async () => {
    const root = host();
    const controller = new AbortController();
    const check = computeMoroccoCheck(INSTANTS[0]!, MOROCCO_STOP_YEAR);
    await mountMoroccoClockChange(root, controller.signal, {
      fetch: fetching(check),
      now: () => INSTANTS[0]!,
    });
    const rows = within(wrongSection(root)).getAllByRole("listitem");
    expect(rows).toHaveLength(check.changes.length);
    // Each row says it in the words of its own change: "still" only for a 2026b one.
    await vi.waitFor(() => {
      for (const change of check.changes) {
        const row = rows.find(
          (item) =>
            item.textContent?.includes(change.zone) === true &&
            item.textContent.includes(change.at),
        )!;
        expect(row).toHaveTextContent(presentText(change));
        expect(row).not.toHaveTextContent("NO SIGNAL");
      }
    });
    await expectNoAxeViolations(root);
    controller.abort();
  });

  it("announces Checking… in the status line while the check runs, then clears it", async () => {
    const user = userEvent.setup();
    const root = host();
    const controller = new AbortController();
    const check = computeMoroccoCheck(INSTANTS[0]!, MOROCCO_STOP_YEAR);
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    let gets = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("no", { status: 500 });
      gets += 1;
      if (gets > 1) await held;
      return Response.json(check);
    });
    await mountMoroccoClockChange(root, controller.signal, {
      fetch: fetchFn as unknown as typeof fetch,
      now: () => INSTANTS[0]!,
    });
    const status = within(root).getByRole("status", { name: "Check status" });
    await user.click(within(root).getByRole("button", { name: "Check again" }));
    await vi.waitFor(() => expect(status).toHaveTextContent("Checking…"));
    release();
    await vi.waitFor(() => expect(status).toHaveTextContent(/^$/));
    controller.abort();
  });
});

describe("the verdict", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A browser that answers `blind` for every instant but the verdict's, and `verdict` there. */
  function stubBrowser(blind: string, verdict: string) {
    const verdictMs = MOROCCO_PROBE.find((p) => p.role === "verdict")!.epochMs;
    const real = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
      this: unknown,
      locale?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      const inner = new real(locale, options);
      if (options?.timeZone === "UTC") return inner;
      return {
        formatToParts: (ms: number) => [
          {
            type: "timeZoneName",
            value: `GMT${ms === verdictMs ? verdict : blind}`,
          },
        ],
      } as unknown as Intl.DateTimeFormat;
    } as unknown as typeof Intl.DateTimeFormat);
  }

  /** The finished answer the verdict card shows: hidden ones are not in the role tree. */
  const shownLine = (root: HTMLElement) =>
    flat(
      within(within(root).getByRole("status", { name: "Verdict" }))
        .getAllByRole("paragraph")
        .find((p) => /Your browser (has|cannot)/.test(p.textContent ?? ""))!,
    );

  async function mountPending(root: HTMLElement) {
    const controller = new AbortController();
    void mountMoroccoClockChange(root, controller.signal, {
      fetch: vi.fn(() => new Promise(() => {})) as unknown as typeof fetch,
    });
    return controller;
  }

  it("comes from the verdict row alone: +00:00 at the blind instant and +01:00 at the verdict is wrong", async () => {
    const root = host();
    stubBrowser("", "+01:00");
    const controller = await mountPending(root);
    await vi.waitFor(() =>
      expect(shownLine(root)).toMatch(
        /^✗ Your browser has old time zone data for/,
      ),
    );
    controller.abort();
  });

  it("is right when the verdict row is +00:00 even if the blind row differs", async () => {
    const root = host();
    stubBrowser("+01:00", "");
    const controller = await mountPending(root);
    await vi.waitFor(() =>
      expect(shownLine(root)).toMatch(
        /^✓ Your browser has the new rules for both places\./,
      ),
    );
    const table = within(root).getByRole("table", { name: /offsets by place/ });
    const casablancaBlind = cellsInColumn(table, /^Yours/)[2]!;
    expect(casablancaBlind).toHaveTextContent("01:00");
    expect(casablancaBlind).not.toHaveTextContent(/[✓✗]/);
    await expectNoAxeViolations(root);
    controller.abort();
  });
});

describe("unique ids per mounted instance", () => {
  /** The map draws after the answer: wait for the list to leave "no answer yet". */
  const drawn = (root: HTMLElement) =>
    vi.waitFor(() =>
      expect(
        within(within(root).getByRole("list", { name: "Zones" })).getAllByRole(
          "button",
        )[0],
      ).not.toHaveTextContent("no answer yet"),
    );

  it("gives a Morocco page and a Morocco widget no id in common, after both mount", async () => {
    const page = place(
      renderMoroccoClockChangeTemplate({
        tense: moroccoTense,
        keyPoints: true,
      }),
    );
    const widget = place(
      renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense),
    );
    const check = computeMoroccoCheck(INSTANTS[0]!, MOROCCO_STOP_YEAR);
    const controller = new AbortController();
    for (const root of [page, widget]) {
      await mountMoroccoClockChange(root, controller.signal, {
        fetch: fetching(check),
        now: () => INSTANTS[0]!,
      });
    }
    await drawn(widget);
    await expectUniqueIds(document.body);
    controller.abort();
  });

  it("gives a Canada page and a Canada widget no id in common, after both mount", async () => {
    resetRateLimitState();
    const roots = [
      place(
        renderCanadaClockChangeTemplate({
          tense: canadaTense,
          keyPoints: true,
        }),
      ),
      place(renderCanadaClockChangeWidgetTemplate("rail-1", canadaTense)),
    ];
    const response = await handleCanadaClockChange(
      new Request("https://northguild.dev/gmt/api/canada-clock-change", {
        headers: { "cf-connecting-ip": "4.4.4.4" },
      }),
      {},
      () => INSTANTS[0]!,
    );
    const answer = await response.json();
    const answering = vi.fn(async () =>
      Response.json(answer),
    ) as unknown as typeof fetch;
    const controller = new AbortController();
    for (const root of roots) {
      await mountCanadaClockChange(root, controller.signal, {
        fetch: answering,
        now: () => INSTANTS[0]!,
      });
    }
    for (const root of roots) await drawn(root);
    await expectUniqueIds(document.body);
    controller.abort();
  });
});
