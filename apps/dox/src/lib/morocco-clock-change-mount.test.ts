/**
 * @vitest-environment jsdom
 *
 * The Morocco 2026 clock-change checker (CORE-89) end to end: template, mount, fetch, render,
 * the changes that no longer happen, the help card's claims against the real library, the chat
 * widget, and the lists that must name the same two zones. The Worker's answer is built by the
 * real Worker handler, so no 2026c offset is asserted as something the runtime computed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  convertPlainDateTimeToZoned,
  convertZonedToUtc,
} from "@northguild/gmt/zoned/convert";
import { formatZonedDateTime } from "@northguild/gmt/zoned/format";
import { installJsdomShims } from "~/test/jsdom-shims";
import { handleMoroccoClockChange } from "../../worker/morocco-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import { showMoroccoClockChangeInput } from "./dox-tools";
import {
  MOROCCO_PROBE,
  MOROCCO_STORED_PRESET,
  MOROCCO_ZONES,
  NO_LONGER,
  type MoroccoCheck,
} from "./morocco-clock-change";
import { MOROCCO_HELP, MOROCCO_KEY_POINTS } from "../data/morocco-key-points";
import {
  mountMoroccoClockChange,
  mountMoroccoClockChangeWidget,
  moroccoKeyPointsMarkdown,
  moroccoServersMarkdown,
  renderMoroccoClockChangeTemplate,
  renderMoroccoClockChangeWidgetTemplate,
} from "./morocco-clock-change-mount";
import { helpMarkdown, helpText } from "./clock-check/key-points";

installJsdomShims();

const NOW = "2026-10-22T12:00:00Z";

async function workerAnswer(): Promise<MoroccoCheck> {
  const response = await handleMoroccoClockChange(
    new Request("https://northguild.dev/gmt/api/morocco-clock-change", {
      headers: { "cf-connecting-ip": "5.6.7.8" },
    }),
    {},
    () => NOW,
  );
  return (await response.json()) as MoroccoCheck;
}

function host(): HTMLElement {
  document.body.innerHTML = renderMoroccoClockChangeTemplate({
    keyPoints: true,
  });
  return document.querySelector<HTMLElement>(".gmt-morocco")!;
}

const text = (el: Element | null) => el?.textContent?.trim() ?? "";

describe("the template", () => {
  it("server-renders the known rows, groups and clocks, with the shared root and no map", () => {
    const root = host();
    expect(root.classList.contains("gmt-check")).toBe(true);
    expect(root.querySelectorAll(".gmt-check-table tbody tr")).toHaveLength(2);
    expect(root.querySelectorAll(".gmt-check-clock")).toHaveLength(2);
    expect(root.querySelector("[data-role='map']")).toBeNull();
    expect(root.querySelector("[data-role='zone-list']")).toBeNull();
    for (const zone of MOROCCO_ZONES) {
      expect(
        root.querySelector(
          `[data-role="transitions"] .gmt-check-group[data-zone="${zone}"]`,
        ),
      ).not.toBeNull();
    }
  });

  it("lists the changes that no longer happen for both zones, unread until the library loads", () => {
    const root = host();
    const zones = root.querySelectorAll(".gmt-morocco-nl-zone");
    expect(zones).toHaveLength(MOROCCO_ZONES.length);
    zones.forEach((zone) => {
      expect(zone.querySelectorAll("li[data-instant]")).toHaveLength(
        NO_LONGER.length,
      );
    });
    expect(text(root.querySelector("[data-role='no-longer']"))).toContain(
      "No longer happen",
    );
  });

  it("has each id once, and links only to ids it draws", () => {
    const html = renderMoroccoClockChangeTemplate({ keyPoints: true });
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(new Set(ids).size).toBe(ids.length);
    document.body.innerHTML = html;
    for (const m of html.matchAll(/href="#([^"]+)"/g)) {
      expect(document.getElementById(m[1]!), m[1]).not.toBeNull();
    }
  });

  it("carries no left-edge stripe or colour literal in its own stylesheet", () => {
    const css = readFileSync(
      resolve(__dirname, "../styles/morocco-clock-change.css"),
      "utf8",
    );
    expect(css).not.toMatch(/border-(left|inline-start)\s*:/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});

describe("mounting the page", () => {
  beforeEach(() => {
    resetRateLimitState();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(NOW)!);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("draws the no-longer changes at the offset before each, and the Worker's transitions", async () => {
    const answer = await workerAnswer();
    const root = host();
    const controller = new AbortController();
    await mountMoroccoClockChange(root, controller.signal, {
      fetch: vi.fn(async () =>
        Response.json(answer),
      ) as unknown as typeof fetch,
    });
    const walls = [
      ...root.querySelectorAll('[data-role="no-longer-wall"]'),
    ].map(text);
    // 2027-02-07T02:00Z read at +01:00, and 2027-03-14T02:00Z read at +00:00.
    expect(walls).toEqual([
      "2027-02-07 03:00",
      "2027-03-14 02:00",
      "2027-02-07 03:00",
      "2027-03-14 02:00",
    ]);
    expect(root.querySelectorAll(".gmt-check-group")).toHaveLength(2);
    controller.abort();
  });

  it("says so, instead of waiting, when the Worker cannot be reached", async () => {
    const root = host();
    const controller = new AbortController();
    await mountMoroccoClockChange(root, controller.signal, {
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    });
    expect(text(root.querySelector('[data-role="status"]'))).not.toBe("");
    controller.abort();
  });

  it("sets the saved-events zone from the option, and ignores a zone it does not list", async () => {
    const answer = await workerAnswer();
    const fetchFn = vi.fn(async () =>
      Response.json(answer),
    ) as unknown as typeof fetch;
    const rootA = host();
    const a = new AbortController();
    await mountMoroccoClockChange(rootA, a.signal, {
      fetch: fetchFn,
      zone: "Africa/El_Aaiun",
    });
    expect(
      rootA.querySelector<HTMLSelectElement>('[data-role="stored-zone"]')
        ?.value,
    ).toBe("Africa/El_Aaiun");
    a.abort();
    const rootB = host();
    const b = new AbortController();
    await mountMoroccoClockChange(rootB, b.signal, {
      fetch: fetchFn,
      zone: "Europe/London",
    });
    expect(
      rootB.querySelector<HTMLSelectElement>('[data-role="stored-zone"]')
        ?.value,
    ).toBe("Africa/Casablanca");
    b.abort();
  });
});

describe("the chat widget", () => {
  beforeEach(async () => {
    resetRateLimitState();
    const answer = await workerAnswer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answer)),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(NOW)!);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const widgetRoot = () => {
    document.body.innerHTML = renderMoroccoClockChangeWidgetTemplate("rail-1");
    return document.querySelector<HTMLElement>(".gmt-morocco")!;
  };

  it("prefixes the heading ids so a second copy cannot collide", () => {
    const root = widgetRoot();
    expect(root.querySelector("#rail-1-probe-title")).not.toBeNull();
    expect(root.querySelector("#morocco-probe-title")).toBeNull();
  });

  it("picks the zone it was given and says so in its permalink state", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      { zone: "Africa/El_Aaiun" },
      controller.signal,
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLSelectElement>('[data-role="stored-zone"]')
          ?.value,
      ).toBe("Africa/El_Aaiun"),
    );
    expect(handle.getPermalinkState?.()).toEqual({ zone: "Africa/El_Aaiun" });
    handle.destroy();
    handle.destroy();
  });

  it("returns an inert handle when aborted before it starts", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      {},
      controller.signal,
    );
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the lists that name the zones", () => {
  it("the chat tool's literal enum is exactly the checker's zones", () => {
    const options = showMoroccoClockChangeInput.shape.zone.unwrap().options;
    expect([...options]).toEqual([...MOROCCO_ZONES]);
    expect(showMoroccoClockChangeInput.safeParse({}).success).toBe(true);
    expect(
      showMoroccoClockChangeInput.safeParse({ zone: "Europe/London" }).success,
    ).toBe(false);
  });

  it("every zone in the example lines is one the checker lists", () => {
    for (const line of MOROCCO_STORED_PRESET.split("\n")) {
      const zone = /\[([^\]]+)\]$/.exec(line)?.[1];
      if (zone !== undefined)
        expect(MOROCCO_ZONES as readonly string[]).toContain(zone);
    }
  });
});

describe("the How gmt helps card", () => {
  const CASABLANCA_SAVED = "2027-06-01T09:00:00+01:00[Africa/Casablanca]";

  it("returns an empty string for an offset the zone no longer has, and says why", () => {
    expect(formatZonedDateTime(CASABLANCA_SAVED)).toBe("");
    expect(convertZonedToUtc(CASABLANCA_SAVED)).toBe("");
    expect(classifyStoredZoned(CASABLANCA_SAVED)).toMatchObject({
      kind: "offsetMismatch",
      storedOffset: "+01:00",
      zoneOffset: "+00:00",
      atStoredOffset: "2027-06-01T08:00:00Z", // keep the old moment
      atZoneOffset: "2027-06-01T09:00:00Z", // keep 9:00 local
    });
    expect(MOROCCO_HELP.cases[0]!.input).toBe(CASABLANCA_SAVED);
  });

  it("fixes a UTC-only value by converting its local time and place again", () => {
    expect(
      convertPlainDateTimeToZoned("2027-06-01T09:00:00", "Africa/Casablanca"),
    ).toMatch(/^2027-06-01T09:00:00(\.0+)?\+00:00\[Africa\/Casablanca\]$/);
    expect(
      formatZonedDateTime("2027-06-01T08:00:00Z", {
        timeZone: "Africa/Casablanca",
        pattern: "HH:mm",
      } as never),
    ).toSatisfy((value: string) => value === "" || value === "08:00");
    expect(MOROCCO_HELP.cases[1]!.output).toBe("08:00");
  });

  it("states what the card says, in its text and Markdown, and links the section by its heading", () => {
    expect(helpText(MOROCCO_HELP)).toContain("Saved with an offset");
    expect(helpText(MOROCCO_HELP)).toContain("Saved as UTC only");
    expect(helpMarkdown(MOROCCO_HELP)).toContain("morocco-2026.test.ts");
    const html = renderMoroccoClockChangeTemplate({ keyPoints: true });
    const heading = html.match(
      /<h4 id="morocco-stored-title">([^<]*)<\/h4>/,
    )?.[1];
    expect(heading).toBe("Did your saved events move?");
    const links = [
      ...html.matchAll(
        /<a [^>]*href="#morocco-stored-title"[^>]*>([\s\S]*?)<\/a>/g,
      ),
    ].map((m) => m[1]!.replace(/<[^>]*>/g, "").trim());
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.replace(/\s*↓$/, "")).toBe(heading);
  });
});

describe("the text surfaces", () => {
  it("carries the key points, the command, the minimums and the help card as Markdown", () => {
    const md = moroccoKeyPointsMarkdown() + moroccoServersMarkdown();
    expect(md).toContain("2026c");
    expect(md).toContain("```sh");
    expect(md).toContain("Upgrade to at least");
    expect(md).toContain("How gmt helps");
    expect(MOROCCO_KEY_POINTS).toHaveLength(2);
    for (const fact of MOROCCO_PROBE) expect(md).toContain(fact.offset);
  });
});
