/**
 * @vitest-environment jsdom
 *
 * The inline script of the "Your browser" card and the module read the same verdict. The script
 * runs while the page is parsed so the card is final before first paint; the module then takes
 * over and must leave an unchanged card alone. Both are run here on a freshly rendered Canada card
 * and must leave it reading the same.
 */
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellsInColumn } from "~/test/render-widget";
import { widget } from "~/widgets/builders/layout";
import { fillProbe, probeCard } from "~/widgets/families/clockcheck/probe-card";
import { findWidget } from "~/widgets/root";
import { renderHtml } from "~/widgets/test-fixture";
import {
  CANADA_VERDICT,
  TABLE_ZONES,
  canadaProbe,
} from "./canada-clock-change";
import { probeInlineSource } from "./clock-change-probe";

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

const fresh = Object.fromEntries(TABLE_ZONES.map((f) => [f.zone, f.offset]));
function shift(offset: string): string {
  const hours = Number(offset.slice(1, 3)) + 1;
  return `${offset[0]}${String(hours).padStart(2, "0")}${offset.slice(3)}`;
}
const stale = Object.fromEntries(
  TABLE_ZONES.map((f) => [f.zone, shift(f.offset)]),
);
const partly = {
  ...fresh,
  [TABLE_ZONES[1]!.zone]: stale[TABLE_ZONES[1]!.zone]!,
};

function render() {
  const config = canadaProbe("canada");
  const fixture = renderHtml(
    widget(
      { name: "canada", label: "Canada", scope: "canada" },
      probeCard(config, CANADA_VERDICT),
    ),
  );
  return { config, fixture, found: findWidget(fixture.host, "canada") };
}

/** The page runs the same source from CanadaProbeScript.astro, once the whole page is parsed. */
function runInline(): void {
  new Function("document", probeInlineSource(canadaProbe("canada")))(document);
}

/** The browser column, as a reader sees it. */
function cells(): (string | undefined)[] {
  return cellsInColumn(screen.getByRole("table"), /^Yours/).map((cell) =>
    cell.textContent?.replace(/\s+/g, " ").trim(),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const WRONG = /old time zone data for/i;

describe("the inline probe and the module agree", () => {
  const cases: [string, () => void, RegExp][] = [
    [
      "a browser with the new rules",
      () => stubOffsets(fresh),
      /has the new rules for all four places/,
    ],
    ["a browser with the old rules", () => stubOffsets(stale), WRONG],
    ["a browser that is wrong for one place", () => stubOffsets(partly), WRONG],
    [
      "a browser that cannot read the zones",
      () => stubOffsets({}, true),
      /cannot read these zones/,
    ],
  ];

  it.each(cases)("%s", (_name, setup, sentence) => {
    setup();
    const first = render();
    expect(screen.getByText(/Checking your browser/)).toBeVisible();
    runInline();
    expect(screen.getByText(sentence)).toBeVisible();
    expect(screen.getByText(/Checking your browser/)).not.toBeVisible();
    const inline = cells();

    // The module alone, on a card the script never touched, ends on the same words and cells.
    first.fixture.host.remove();
    const again = render();
    fillProbe(again.found, again.config);
    expect(screen.getByText(sentence)).toBeVisible();
    expect(cells()).toEqual(inline);
  });

  it("says NO SIGNAL in every cell when the zones cannot be read", () => {
    stubOffsets({}, true);
    render();
    runInline();
    for (const cell of cells()) expect(cell).toBe("NO SIGNAL");
  });

  it("names exactly the wrong places in the chips", () => {
    stubOffsets(partly);
    const one = render();
    runInline();
    expect(screen.getByText(WRONG)).toHaveTextContent(/for Edmonton\./);
    one.fixture.host.remove();
    stubOffsets(stale);
    render();
    runInline();
    expect(screen.getByText(WRONG)).toHaveTextContent(
      "for Vancouver, Edmonton, Inuvik and Winnipeg.",
    );
  });

  it("is not drawn again when the module finds the card already right", () => {
    stubOffsets(stale);
    const { found, config } = render();
    runInline();
    const cell = cellsInColumn(screen.getByRole("table"), /^Yours/)[0];
    fillProbe(found, config);
    expect(cellsInColumn(screen.getByRole("table"), /^Yours/)[0]).toBe(cell);
  });

  it("carries its config from the same constants as the module", () => {
    const source = probeInlineSource(canadaProbe("canada"));
    expect(source).toContain("1793620800000");
    for (const fact of TABLE_ZONES) {
      expect(source).toContain(fact.zone);
      expect(source).toContain(fact.offset);
    }
    expect(source).not.toContain("</script");
  });
});
