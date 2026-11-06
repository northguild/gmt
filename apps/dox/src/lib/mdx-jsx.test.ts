import { alternativesStack } from "../data/date-alternatives";
import { dateFaults } from "../data/date-faults";
import { competitorComparisons } from "../data/library-comparison";
import { renderMdxComponents } from "./mdx-jsx";
import { whyGmtFigures } from "./why-gmt-figures";

const rowsOf = (md: string): string[] =>
  md.split("\n").filter((line) => line.startsWith("|"));

describe("the Date-bug table in the text surfaces", () => {
  it("shows the landing's short list as two columns", () => {
    const rows = rowsOf(renderMdxComponents('<WhyDateBug variant="home" />'));
    const shown = dateFaults.filter((f) => f.home);
    expect(rows[0]).toBe("| You write | You get |");
    expect(rows).toHaveLength(2 + shown.length);
    for (const f of shown) expect(rows.join("\n")).toContain(f.output);
  });

  it("shows every fault with its reason on the full variant, leaving the heading to the page", () => {
    const md = renderMdxComponents('<WhyDateBug variant="full" />');
    expect(md).not.toMatch(/^#/m);
    const rows = rowsOf(md);
    expect(rows[0]).toBe("| You write | You get | Why |");
    expect(rows).toHaveLength(2 + dateFaults.length);
    for (const f of dateFaults) expect(md).toContain(f.why);
  });

  it("leaves no component tag behind", () => {
    const md = renderMdxComponents(
      '<WhyDateBug variant="home" /><WhyDateAlternatives variant="full" />',
    );
    expect(md).not.toMatch(/<[A-Z]/);
  });
});

describe("the /why-gmt headline figures in the text surfaces", () => {
  it("lists every figure with its label", () => {
    const md = renderMdxComponents("<WhyGmtFigures />");
    expect(md).not.toMatch(/<[A-Z]/);
    const items = md.split("\n").filter((line) => line.startsWith("- "));
    expect(items).toHaveLength(whyGmtFigures.length);
    for (const f of whyGmtFigures)
      expect(md).toContain(`- **${f.value}** ${f.label}`);
  });
});

describe("the library table in the text surfaces", () => {
  it("shows name and foundation on the landing's variant", () => {
    const rows = rowsOf(
      renderMdxComponents('<WhyDateAlternatives variant="home" />'),
    );
    expect(rows[0]).toBe("| Layer | Built on |");
    expect(rows).toHaveLength(2 + alternativesStack.length);
  });

  it("adds what each library is on the full variant, under its heading", () => {
    const md = renderMdxComponents('<WhyDateAlternatives variant="full" />');
    expect(md).toContain(
      "## The alternatives inherit it, or deviate from the standard",
    );
    expect(rowsOf(md)[0]).toBe("| Layer | Built on | What it is |");
    for (const layer of alternativesStack) expect(md).toContain(layer.detail);
  });
});

describe("the landing hero", () => {
  it("keeps the text of its lead slot", () => {
    const md = renderMdxComponents(
      '<HeroGlobe>\n<Fragment slot="lead">\nCurrent release: **v1**\n</Fragment>\n</HeroGlobe>',
    );
    expect(md).toContain("Current release: **v1**");
    expect(md).not.toMatch(/<[A-Z]/);
  });
});

describe("competitor data the library table leans on", () => {
  it("states every library's time resolution, so the table can say it", () => {
    for (const lib of competitorComparisons)
      expect(lib.timeResolution).toBe("millisecond");
  });
});
