/**
 * @vitest-environment jsdom
 *
 * The Morocco 2026 clock-change checker end to end: template, mount, fetch, render. The Worker's
 * answer is built by the real Worker code at three fixed instants, so no offset is asserted as
 * something this runtime computed.
 */
import { canadaTense, moroccoTense } from "./clock-change-tense.fixture";
import { installJsdomShims } from "~/test/jsdom-shims";
import { handleCanadaClockChange } from "../../worker/canada-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import { computeMoroccoCheck } from "../../worker/morocco-clock-change";
import {
  MOROCCO_PROBE,
  MOROCCO_STOP_YEAR,
  MOROCCO_VERDICT,
  moroccoProbe,
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
import { fillBrowserCard } from "./clock-change-probe";

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

function host(): HTMLElement {
  document.body.innerHTML = renderMoroccoClockChangeTemplate({
    keyPoints: true,
    tense: moroccoTense,
  });
  return document.querySelector<HTMLElement>(".gmt-morocco")!;
}

const FORBIDDEN = /\bwill\b|\bis due\b|\bupcoming\b/i;

/** The text a reader sees before the Worker answers: the template with its scripts, attributes and the form of each tensed phrase that is not true now removed. */
function staticText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('script,style,svg,[hidden],[aria-hidden="true"]')
    .forEach((el) => el.remove());
  return clone.textContent ?? "";
}

describe("the template", () => {
  it("renders the verdict row and the blind row for each zone", () => {
    const root = host();
    expect(root.querySelectorAll("tr[data-zone]")).toHaveLength(2);
    expect(root.querySelectorAll("tr[data-blind-zone]")).toHaveLength(2);
    expect(root.querySelector(".gmt-clockcheck-blind-note")).not.toBeNull();
  });

  it("never mentions Canada", () => {
    expect(host().innerHTML).not.toMatch(/canada/i);
    expect(
      renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense),
    ).not.toMatch(/canada/i);
  });

  it("puts the cards in reading order: servers, minimums, changes", () => {
    const html = renderMoroccoClockChangeTemplate({
      tense: moroccoTense,
      keyPoints: true,
    });
    const order = [
      "morocco-keypoints-title",
      "morocco-probe-title",
      "morocco-map-title",
      "morocco-clocks-title",
      "morocco-servers-title",
      "morocco-minimums-title",
      "morocco-changes-title",
      "morocco-help-title",
      "morocco-stored-title",
    ].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("the mount", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

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
          root.querySelector('[data-role="present"]')?.textContent,
        ).toMatch(/This server/),
      );
      expect(staticText(root)).not.toMatch(FORBIDDEN);
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
    // Each row says it in the words of its own change: "still" only for a 2026b one.
    await vi.waitFor(() => {
      for (const row of check.changes) {
        expect(
          root.querySelector(
            `.gmt-morocco-wrong-row[data-zone="${row.zone}"][data-at="${row.at}"] [data-role="present"]`,
          )?.textContent,
        ).toBe(presentText(row));
      }
    });
    expect(root.querySelectorAll(".gmt-morocco-wrong-row")).toHaveLength(
      check.changes.length,
    );
    controller.abort();
  });

  it("announces Checking\u2026 in the status line while the check runs, then clears it", async () => {
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
    const status = root.querySelector('[data-role="status"]');
    root.querySelector<HTMLButtonElement>('[data-role="recheck"]')!.click();
    await vi.waitFor(() =>
      expect(status?.textContent?.trim()).toBe("Checking\u2026"),
    );
    release();
    await vi.waitFor(() => expect(status?.textContent?.trim()).toBe(""));
    controller.abort();
  });
});

describe("the verdict", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  /** A browser that answers `before` for instants up to the verdict and `after` for the verdict. */
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

  it("comes from the verdict row alone: +00:00 at the blind instant and +01:00 at the verdict is wrong", () => {
    document.body.innerHTML = renderMoroccoClockChangeTemplate({
      tense: moroccoTense,
    });
    stubBrowser("", "+01:00");
    fillBrowserCard(document.body, moroccoProbe("morocco"), MOROCCO_VERDICT);
    const verdict = document.querySelector<HTMLElement>(
      '[data-role="verdict"]',
    )!;
    expect(verdict.dataset.state).toBe("bad");
  });

  it("is right when the verdict row is +00:00 even if the blind row differs", () => {
    document.body.innerHTML = renderMoroccoClockChangeTemplate({
      tense: moroccoTense,
    });
    stubBrowser("+01:00", "");
    fillBrowserCard(document.body, moroccoProbe("morocco"), MOROCCO_VERDICT);
    const verdict = document.querySelector<HTMLElement>(
      '[data-role="verdict"]',
    )!;
    expect(verdict.dataset.state).toBe("ok");
    const blind = document.querySelector<HTMLElement>(
      'tr[data-blind-zone="Africa/Casablanca"] [data-role="browser-blind"]',
    )!;
    expect(blind.textContent).toMatch(/01:00/);
    expect(blind.textContent).not.toMatch(/[✓✗]/);
  });
});

describe("unique ids per mounted instance", () => {
  const ids = () => [...document.querySelectorAll("[id]")].map((el) => el.id);
  const duplicates = () => {
    const seen = new Set<string>();
    return ids().filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  };
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("gives a Morocco page and a Morocco widget no id in common, after both mount", async () => {
    document.body.innerHTML =
      renderMoroccoClockChangeTemplate({
        tense: moroccoTense,
        keyPoints: true,
      }) + renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense);
    const [page, widget] = [
      ...document.querySelectorAll<HTMLElement>(".gmt-morocco"),
    ];
    const check = computeMoroccoCheck(INSTANTS[0]!, MOROCCO_STOP_YEAR);
    const controller = new AbortController();
    for (const root of [page!, widget!]) {
      await mountMoroccoClockChange(root, controller.signal, {
        fetch: fetching(check),
        now: () => INSTANTS[0]!,
      });
    }
    await vi.waitFor(() =>
      expect(
        widget!.querySelector('[data-role="present"]')?.textContent,
      ).toMatch(/This server/),
    );
    expect(duplicates()).toEqual([]);
    controller.abort();
  });

  it("gives a Canada page and a Canada widget no id in common, after both mount", async () => {
    resetRateLimitState();
    document.body.innerHTML =
      renderCanadaClockChangeTemplate({ tense: canadaTense, keyPoints: true }) +
      renderCanadaClockChangeWidgetTemplate("rail-1", canadaTense);
    const roots = [...document.querySelectorAll<HTMLElement>(".gmt-canada")];
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
    await vi.waitFor(() =>
      expect(
        roots.every(
          (root) =>
            root.querySelector('[data-role="legend-count"]')?.textContent !==
            "\u2013",
        ),
      ).toBe(true),
    );
    expect(document.querySelectorAll("svg defs [id]").length).toBeGreaterThan(
      0,
    );
    expect(duplicates()).toEqual([]);
    controller.abort();
  });
});
