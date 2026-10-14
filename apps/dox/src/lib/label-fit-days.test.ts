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
