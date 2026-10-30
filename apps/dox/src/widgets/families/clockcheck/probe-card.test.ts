// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProbeConfig, VerdictText } from "~/lib/clock-change-probe";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { widget } from "../../builders/layout";
import { findWidget } from "../../root";
import { renderHtml } from "../../test-fixture";
import { fillProbe, probeCard } from "./probe-card";

const CASABLANCA = "Africa/Casablanca";
const EL_AAIUN = "Africa/El_Aaiun";
const JUNE = 1780315200000;

const CONFIG: ProbeConfig = {
  idPrefix: "x",
  zones: [
    { zone: CASABLANCA, expected: { verdict: "+01:00" } },
    { zone: EL_AAIUN, expected: { verdict: "+01:00" } },
  ],
  instants: [{ iso: "2026-06-01T12:00:00Z", epochMs: JUNE, role: "verdict" }],
};

const TEXT: VerdictText = {
  title: "Your browser",
  correctNote: "tzdb A",
  yoursNote: "1 Jun",
  checking: "Checking your browser&hellip;",
  right: "Your browser is right.",
  wrongBefore: "Old data for ",
  wrongAfter: ".",
  more: ["Update it."],
  unknown: "Cannot read these zones.",
};

const realFormat = Intl.DateTimeFormat;

/** `Intl.DateTimeFormat` where the named zones answer with these offsets and the rest as the runtime does. */
function stubOffsets(
  offsets: Record<string, string>,
  unreadable = false,
): void {
  const Wrapped = function (
    locale: string,
    options?: Intl.DateTimeFormatOptions,
  ) {
    if (unreadable && options?.timeZoneName === "longOffset")
      throw new RangeError("longOffset");
    const zone = options?.timeZone ?? "";
    if (zone in offsets) {
      return {
        formatToParts: () => [
          { type: "timeZoneName", value: `GMT${offsets[zone]}` },
        ],
      };
    }
    return new realFormat(locale, options);
  } as unknown as typeof Intl.DateTimeFormat;
  vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: Wrapped });
}

function draw(config: ProbeConfig = CONFIG, text: VerdictText = TEXT) {
  const fixture = renderHtml(
    widget(
      { name: "probe", label: "Probe", scope: config.idPrefix },
      probeCard(config, text),
    ),
  );
  return { fixture, found: findWidget(fixture.host, "probe") };
}

const yours = () => cellsInColumn(screen.getByRole("table"), /^Yours/);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeCard", () => {
  it("is a section named by its title, with the table of places inside", () => {
    draw();
    const card = screen.getByRole("region", { name: "Your browser" });
    const table = within(card).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent?.trim()),
    ).toEqual(["Place", "Correct (tzdb A)", "Yours (1 Jun)"]);
    const places = cellsInColumn(table, "Place");
    expect(places[0]).toHaveTextContent("Casablanca");
    expect(places[1]).toHaveTextContent("El Aaiun");
  });

  it("shows the correct offset beside each place and NO SIGNAL where the browser has not answered", () => {
    draw();
    const table = screen.getByRole("table");
    expect(
      cellsInColumn(table, /^Correct/).map((c) => c.textContent?.trim()),
    ).toEqual(["+01:00", "+01:00"]);
    for (const cell of yours()) expect(cell).toHaveTextContent("NO SIGNAL");
  });

  it("says it is checking, and holds the finished answers out of sight", () => {
    draw();
    const verdict = screen.getByRole("status", { name: "Verdict" });
    expect(within(verdict).getByText("Checking your browser…")).toBeVisible();
    expect(
      within(verdict).getByText("Your browser is right."),
    ).not.toBeVisible();
    expect(within(verdict).getByText(/Old data for/)).not.toBeVisible();
    expect(
      within(verdict).getByText(/Cannot read these zones/),
    ).not.toBeVisible();
  });

  it("offers a button that checks again, and a status line it reports to", () => {
    draw();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
    expect(
      screen.getByRole("status", { name: "Check status" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { fixture } = draw();
    await expectNoAxeViolations(fixture.host);
  });

  it("keeps two checkers on one page apart", () => {
    const one = renderHtml(
      widget(
        { name: "probe", label: "One", scope: "one" },
        probeCard({ ...CONFIG, idPrefix: "one" }, TEXT),
      ),
    );
    const two = renderHtml(
      widget(
        { name: "probe", label: "Two", scope: "two" },
        probeCard({ ...CONFIG, idPrefix: "two" }, TEXT),
      ),
    );
    stubOffsets({ [CASABLANCA]: "+01:00", [EL_AAIUN]: "+01:00" });
    fillProbe(findWidget(one.host, "probe"), { ...CONFIG, idPrefix: "one" });
    const first = within(one.host).getByRole("status", { name: "Verdict" });
    const second = within(two.host).getByRole("status", { name: "Verdict" });
    expect(within(first).getByText("Your browser is right.")).toBeVisible();
    expect(within(second).getByText("Checking your browser…")).toBeVisible();
  });
});

describe("fillProbe", () => {
  it("shows the right answer, with a tick beside each reading", () => {
    stubOffsets({ [CASABLANCA]: "+01:00", [EL_AAIUN]: "+01:00" });
    const { found } = draw();
    fillProbe(found, CONFIG);
    const verdict = screen.getByRole("status", { name: "Verdict" });
    expect(within(verdict).getByText("Your browser is right.")).toBeVisible();
    expect(
      within(verdict).getByText("Checking your browser…"),
    ).not.toBeVisible();
    expect(
      yours().map((c) => c.textContent?.replace(/\s+/g, " ").trim()),
    ).toEqual(["✓ +01:00", "✓ +01:00"]);
  });

  it("names the places an old browser has wrong", () => {
    stubOffsets({ [CASABLANCA]: "+00:00", [EL_AAIUN]: "+01:00" });
    const { found } = draw();
    fillProbe(found, CONFIG);
    const verdict = screen.getByRole("status", { name: "Verdict" });
    const line = within(verdict).getByText(/Old data for/);
    expect(line).toBeVisible();
    expect(line).toHaveTextContent("Old data for Casablanca.");
    expect(within(verdict).getByText("Update it.")).toBeVisible();
    expect(yours()[0]).toHaveTextContent("✗ +00:00");
    expect(yours()[1]).toHaveTextContent("✓ +01:00");
  });

  it("joins several wrong places as a list in words", () => {
    stubOffsets({ [CASABLANCA]: "+00:00", [EL_AAIUN]: "+00:00" });
    const { found } = draw();
    fillProbe(found, CONFIG);
    expect(screen.getByText(/Old data for/)).toHaveTextContent(
      "Old data for Casablanca and El Aaiun.",
    );
  });

  it("says NO SIGNAL, never a blank, when the browser cannot read the zones", () => {
    stubOffsets({}, true);
    const { found } = draw();
    fillProbe(found, CONFIG);
    const verdict = screen.getByRole("status", { name: "Verdict" });
    expect(within(verdict).getByText(/Cannot read these zones/)).toBeVisible();
    for (const cell of yours()) expect(cell).toHaveTextContent("NO SIGNAL");
  });

  it("leaves a card alone when the same readings arrive again", () => {
    stubOffsets({ [CASABLANCA]: "+01:00", [EL_AAIUN]: "+01:00" });
    const { found } = draw();
    fillProbe(found, CONFIG);
    const before = yours()[0];
    fillProbe(found, CONFIG);
    expect(yours()[0]).toBe(before);
  });

  it("has no accessibility violations after each answer", async () => {
    const { fixture, found } = draw();
    for (const offset of ["+01:00", "+00:00"]) {
      stubOffsets({ [CASABLANCA]: offset, [EL_AAIUN]: offset });
      fillProbe(found, CONFIG);
      await expectNoAxeViolations(fixture.host);
    }
  });
});

describe("probeCard with a blind instant", () => {
  const BLIND: ProbeConfig = {
    idPrefix: "x",
    zones: [
      {
        zone: "Europe/Lisbon",
        expected: { verdict: "+00:00", blind: "+01:00" },
      },
    ],
    instants: [
      { iso: "2026-12-01T12:00:00Z", epochMs: 1796126400000, role: "verdict" },
      { iso: "2026-07-01T12:00:00Z", epochMs: 1782907200000, role: "blind" },
    ],
  };

  it("gives the verdict row and the blind row each its own correct offset", () => {
    draw(BLIND, { ...TEXT, blindNote: "Shown only." });
    const table = screen.getByRole("table");
    expect(
      cellsInColumn(table, /^Correct/).map((c) => c.textContent?.trim()),
    ).toEqual(["+00:00", "+01:00"]);
    expect(screen.getByText("Shown only.")).toBeInTheDocument();
  });

  it("judges only the verdict row; the blind row shows its reading plain", () => {
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: function (
        _locale: string,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return {
          formatToParts: (at: number) => [
            {
              type: "timeZoneName",
              value:
                options?.timeZone === "Europe/Lisbon"
                  ? at === 1796126400000
                    ? "GMT"
                    : "GMT+01:00"
                  : "GMT",
            },
          ],
        };
      } as unknown as typeof Intl.DateTimeFormat,
    });
    const { found } = draw(BLIND, TEXT);
    fillProbe(found, BLIND);
    const [verdictRow, blindRow] = yours();
    expect(verdictRow).toHaveTextContent("✓ +00:00");
    expect(blindRow).toHaveTextContent("+01:00");
    expect(blindRow).not.toHaveTextContent("✓");
    expect(blindRow).not.toHaveTextContent("✗");
  });

  it("refuses a blind instant that has no expected offset", () => {
    expect(() =>
      probeCard(
        {
          ...CONFIG,
          instants: [
            ...CONFIG.instants,
            {
              iso: "2026-07-01T12:00:00Z",
              epochMs: 1782907200000,
              role: "blind",
            },
          ],
        },
        TEXT,
      ),
    ).toThrow(/no expected offset/);
  });
});
