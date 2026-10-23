/**
 * @vitest-environment jsdom
 *
 * The inline script of the "Your browser" card and the module read the same verdict. The script
 * runs while the page is parsed so the card is final before first paint; the module then takes
 * over and must leave an unchanged card alone.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { TABLE_ZONES } from "./canada-clock-change";
import {
  mountCanadaClockChange,
  probeInlineSource,
  renderCanadaClockChangeTemplate,
} from "./canada-clock-change-mount";

installJsdomShims();

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
    const real = new realFormat(locale, options);
    const zone = options?.timeZone ?? "";
    if (zone in offsets) {
      return {
        formatToParts: () => [
          { type: "timeZoneName", value: `GMT${offsets[zone]}` },
        ],
        format: () => `GMT${offsets[zone]}`,
      };
    }
    return real;
  } as unknown as typeof Intl.DateTimeFormat;
  vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: Wrapped });
}

const fresh = Object.fromEntries(TABLE_ZONES.map((f) => [f.zone, f.offset]));
const stale = Object.fromEntries(
  TABLE_ZONES.map((f) => [f.zone, shift(f.offset)]),
);
function shift(offset: string): string {
  const hours = Number(offset.slice(1, 3)) + 1;
  return `${offset[0]}${String(hours).padStart(2, "0")}${offset.slice(3)}`;
}
const partly = {
  ...fresh,
  [TABLE_ZONES[1]!.zone]: stale[TABLE_ZONES[1]!.zone]!,
};

function render(): { root: HTMLElement; card: HTMLElement } {
  document.body.innerHTML = renderCanadaClockChangeTemplate();
  const root = document.querySelector<HTMLElement>(".gmt-canada")!;
  return { root, card: root.querySelector<HTMLElement>(".gmt-check-browser")! };
}

function runInline(_card: HTMLElement): void {
  // The page runs the same source from CanadaProbeScript.astro, once the whole page is parsed.
  new Function("document", probeInlineSource())(document);
}

const snapshot = (card: HTMLElement) => ({
  state: card.querySelector<HTMLElement>('[data-role="verdict"]')!.dataset
    .state,
  cells: [...card.querySelectorAll('[data-role="browser"]')].map((c) =>
    c.textContent?.trim(),
  ),
  // Only the shown variant counts: the page also carries the other variants, hidden.
  places:
    card.querySelector<HTMLElement>('[data-role="verdict"]')!.dataset.state ===
    "bad"
      ? (card.querySelector('[data-role="wrong-places"]')?.textContent ?? null)
      : null,
});

/** What the module alone draws for the same browser, on markup the script never touched. */
async function moduleOnly(): Promise<ReturnType<typeof snapshot>> {
  document.body.innerHTML = renderCanadaClockChangeTemplate();
  const root = document.querySelector<HTMLElement>(".gmt-canada")!;
  const ac = new AbortController();
  void mountCanadaClockChange(root, ac.signal, {
    fetch: (() => new Promise(() => {})) as unknown as typeof fetch,
  });
  await vi.waitFor(() =>
    expect(
      root.querySelector<HTMLElement>('[data-role="verdict"]')!.dataset.state,
    ).not.toBe("pending"),
  );
  const out = snapshot(root.querySelector<HTMLElement>(".gmt-check-browser")!);
  ac.abort();
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the inline probe and the module agree", () => {
  const cases: [string, () => void, string][] = [
    ["a browser with the new rules", () => stubOffsets(fresh), "ok"],
    ["a browser with the old rules", () => stubOffsets(stale), "bad"],
    ["a browser that is wrong for one place", () => stubOffsets(partly), "bad"],
    [
      "a browser that cannot read the zones",
      () => stubOffsets({}, true),
      "unreadable",
    ],
  ];
  it.each(cases)("%s", async (_name, setup, state) => {
    setup();
    const { card } = render();
    const pending = snapshot(card);
    expect(pending.state).toBe("pending");
    runInline(card);
    const inline = snapshot(card);
    expect(inline.state).toBe(state);
    expect(inline.cells.some((c) => c === "NO SIGNAL")).toBe(
      state === "unreadable",
    );
    expect(inline).toEqual(await moduleOnly());
  });

  it("names exactly the wrong places in the chips", () => {
    stubOffsets(partly);
    const { card } = render();
    runInline(card);
    expect(snapshot(card).places).toBe("Edmonton");
    stubOffsets(stale);
    const again = render();
    runInline(again.card);
    expect(snapshot(again.card).places).toBe(
      "Vancouver, Edmonton, Inuvik and Winnipeg",
    );
  });

  it("is not drawn again when the module finds the card already right", async () => {
    stubOffsets(stale);
    const { root, card } = render();
    runInline(card);
    const verdict = card.querySelector('[data-role="verdict"]')!;
    const first = verdict.firstElementChild;
    const ac = new AbortController();
    void mountCanadaClockChange(root, ac.signal, {
      fetch: (() => new Promise(() => {})) as unknown as typeof fetch,
    });
    await vi.waitFor(() =>
      expect(root.querySelector('[data-role="clocks"]')).not.toBeNull(),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(verdict.firstElementChild).toBe(first);
    ac.abort();
  });

  it("carries its config from the same constants as the module", () => {
    const source = probeInlineSource();
    expect(source).toContain("1793620800000");
    for (const fact of TABLE_ZONES) {
      expect(source).toContain(fact.zone);
      expect(source).toContain(fact.offset);
    }
    expect(source).not.toContain("</script");
  });
});
