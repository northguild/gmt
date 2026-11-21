import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filings, type GitHubFiling } from "~/data/upstream-filings";
import record from "./intl-date-calendars.json";
import { STAND_INS } from "./stand-ins";

const root = resolve(import.meta.dirname, "../../../../..");
const matrix = resolve(root, "scripts/zone-matrix");
const text = (line: { text: string }[]) => line.map((p) => p.text).join("");
const column = (id: string) => STAND_INS.columns.find((c) => c.id === id)!;

describe("the calendar probe's record", () => {
  it("was written by the probe as it stands now", () => {
    const source = readFileSync(resolve(matrix, "intl-date-calendars.mjs"));
    // Run `cd scripts/zone-matrix && fnm exec --using=26 -- node intl-date-calendars.mjs`.
    expect(record.sourceSha256).toBe(
      createHash("sha256").update(source).digest("hex"),
    );
  });

  it("measured the library version the zone matrix installs, against native Temporal", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(matrix, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(record.version).toBe(
      manifest.dependencies["@internationalized/date"],
    );
    expect(record.reference).toBe("native Temporal");
    expect(record.node).toMatch(/^v26\./);
  });

  it("holds the sweeps' sizes, so a shortened sweep fails", () => {
    expect(record.persian.years).toBe(3000);
    expect(record.japanese.days).toBe(2192);
    expect(record.indian.months).toBe(24000);
  });
});

describe("the stand-ins slide", () => {
  it("has the three libraries in the order of its columns", () => {
    expect(STAND_INS.columns.map((c) => c.name)).toEqual([
      "@internationalized/date",
      "temporal-polyfill",
      "@js-temporal/polyfill",
    ]);
  });

  it("reads @internationalized/date's three faults from the record", () => {
    expect(column("internationalized-date").lines.map(text)).toEqual([
      `Persian: ${record.persian.differ} years start a day late.`,
      "Japanese: 1868–1872 in Meiji, where the standard says ce.",
      "Chinese: quietly Gregorian.",
    ]);
  });

  it("counts the reports and fixes in the filings, and not a maintainer's own pull request", () => {
    const of = (repo: string) =>
      filings.filter(
        (f): f is GitHubFiling => f.tracker === "github" && f.repo === repo,
      );
    const reports = of("fullcalendar/temporal-polyfill").filter(
      (f) => f.kind === "issue" && f.work === "report",
    ).length;
    const sent = (repo: string) =>
      of(repo).filter((f) => f.kind === "pr" && f.role !== "contributor");
    expect(column("temporal-polyfill").lines.map(text)).toEqual([
      `${reports} bugs reported, ${sent("fullcalendar/temporal-polyfill").length} fixes sent.`,
    ]);
    expect(column("js-temporal").lines.map(text)).toEqual([
      `${sent("js-temporal/temporal-polyfill").length} fixes sent.`,
    ]);
    expect(reports).toBeGreaterThan(0);
  });

  it("marks the faults and bug reports, and not a count of fixes sent", () => {
    for (const { id, lines } of STAND_INS.columns)
      for (const line of lines)
        expect(
          line.some((p) => p.wrong),
          id,
        ).toBe(id !== "js-temporal");
  });

  it("closes on the zone experiments all three pass", () => {
    expect(STAND_INS.closing).toBe(
      "All three pass the four zone experiments. Calendars are where they break.",
    );
  });
});
