/**
 * @vitest-environment jsdom
 */
import { fitDayColumns } from "./label-fit";

describe("fitDayColumns", () => {
  const classify = (px: number) =>
    px < 40
      ? ("narrow" as const)
      : px < 80
        ? ("short" as const)
        : ("full" as const);

  function days(widths: string[]) {
    const el = document.createElement("div");
    el.innerHTML = widths
      .map((w) => `<div class="gmt-ledger-day" style="width:${w}"></div>`)
      .join("");
    return { el, columns: [...el.children] as HTMLElement[] };
  }

  it("sets short and narrow from each column's width in px", () => {
    const { el, columns } = days(["5%", "10%", "20%"]);
    fitDayColumns(el, 500, classify);
    expect(columns.map((c) => c.className)).toEqual([
      "gmt-ledger-day gmt-ledger-day--narrow",
      "gmt-ledger-day gmt-ledger-day--short",
      "gmt-ledger-day",
    ]);
  });

  it("clears a class when the column grows, so a refit starts from scratch", () => {
    const { el, columns } = days(["5%"]);
    fitDayColumns(el, 500, classify);
    expect(columns[0]!.classList).toContain("gmt-ledger-day--narrow");
    fitDayColumns(el, 2000, classify);
    expect(columns[0]!.className).toBe("gmt-ledger-day");
  });

  /** A column of `columnPx` holding a chip row that reaches `chipsPx`. jsdom
   *  has no layout, so the measured sizes are set by hand. */
  function chipped(columnPx: number, chipsPx: number) {
    const el = document.createElement("div");
    el.innerHTML =
      `<div class="gmt-ledger-day" style="width:50%">` +
      `<span class="gmt-ledger-day-chips"><span>charged</span></span></div>`;
    const day = el.firstElementChild as HTMLElement;
    const chips = day.querySelector<HTMLElement>(".gmt-ledger-day-chips")!;
    Object.defineProperty(day, "clientWidth", {
      value: columnPx,
      configurable: true,
    });
    Object.defineProperty(chips, "offsetLeft", { value: 4 });
    Object.defineProperty(chips, "scrollWidth", { value: chipsPx - 4 });
    return { el, day };
  }

  it("drops the chips of a column they would overflow, and keeps them where they fit", () => {
    const tight = chipped(66, 74);
    fitDayColumns(tight.el, 200, classify);
    expect(tight.day.classList).toContain("gmt-ledger-day--bare");

    const roomy = chipped(120, 74);
    fitDayColumns(roomy.el, 200, classify);
    expect(roomy.day.classList).not.toContain("gmt-ledger-day--bare");
  });

  it("does not mark a narrow column bare: it has already dropped its chips", () => {
    const { el, day } = chipped(30, 74);
    fitDayColumns(el, 60, classify);
    expect(day.className).toBe("gmt-ledger-day gmt-ledger-day--narrow");
  });

  it("clears bare on a refit once the chips fit", () => {
    const { el, day } = chipped(66, 74);
    fitDayColumns(el, 200, classify);
    expect(day.classList).toContain("gmt-ledger-day--bare");
    Object.defineProperty(day, "clientWidth", {
      value: 140,
      configurable: true,
    });
    fitDayColumns(el, 400, classify);
    expect(day.classList).not.toContain("gmt-ledger-day--bare");
  });

  it("keeps everything when the track has no width", () => {
    const { el, columns } = days(["1%", "2%"]);
    const seen: number[] = [];
    fitDayColumns(el, 0, (px) => {
      seen.push(px);
      return "full";
    });
    expect(seen).toEqual([0, 0]);
    expect(columns.every((c) => c.className === "gmt-ledger-day")).toBe(true);
  });
});
