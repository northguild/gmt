import { describe, expect, it } from "vitest";
import {
  industriesByPath,
  isDirectoryIndex,
  pageIndustries,
  type PageEntry,
} from "./page-industries";

const entry = (id: string, industries?: string[]): PageEntry => ({
  id,
  industries,
});

describe("pageIndustries", () => {
  it("gives a page its own tags, whatever sits under it", () => {
    const all = [entry("guides", ["workforce"]), entry("guides/a", ["core"])];
    expect(pageIndustries("guides", ["workforce"], all)).toEqual(["workforce"]);
  });

  it("gives a directory index the union of the tags of the pages under it, at any depth", () => {
    const all = [
      entry("guides"),
      entry("guides/concepts"),
      entry("guides/concepts/a", ["core"]),
      entry("guides/industries/b", ["transport"]),
    ];
    expect(pageIndustries("guides", undefined, all)).toEqual([
      "core",
      "transport",
    ]);
  });

  it("reads a folder index by its file id (`<dir>/index`) as well as by the folder", () => {
    const all = [entry("tools/index"), entry("tools/a", ["core"])];
    expect(pageIndustries("tools/index", undefined, all)).toEqual(["core"]);
  });

  it("gives an index whose pages carry no tags none", () => {
    const all = [entry("guides"), entry("guides/a"), entry("guides/b")];
    expect(pageIndustries("guides", undefined, all)).toEqual([]);
  });

  it("gives a page that is not an index and has no tags none", () => {
    const all = [entry("guides"), entry("guides/a", ["core"]), entry("lone")];
    expect(pageIndustries("lone", undefined, all)).toEqual([]);
    expect(pageIndustries("guides/a", undefined, all)).toEqual([]);
  });

  it("lists each tag once, in the declared order", () => {
    const all = [
      entry("tools"),
      entry("tools/a", ["transport", "core"]),
      entry("tools/b", ["transport"]),
      entry("tools/c", ["core"]),
    ];
    expect(pageIndustries("tools", undefined, all)).toEqual([
      "core",
      "transport",
    ]);
  });

  it("puts Core first even when the industry's page sorts first by id", () => {
    const all = [
      entry("scenarios"),
      entry("scenarios/a-workforce", ["workforce"]),
      entry("scenarios/z-core", ["core"]),
    ];
    expect(pageIndustries("scenarios", undefined, all)).toEqual([
      "core",
      "workforce",
    ]);
  });

  it("gives the site root none: it is a splash page, not an index", () => {
    const all = [entry("index"), entry("guides/a", ["core"])];
    expect(pageIndustries("index", undefined, all)).toEqual([]);
    expect(pageIndustries("", undefined, all)).toEqual([]);
  });
});

describe("isDirectoryIndex", () => {
  it("is true when another page sits under the id's directory", () => {
    const all = [entry("guides"), entry("guides/a")];
    expect(isDirectoryIndex("guides", all)).toBe(true);
    expect(isDirectoryIndex("guides/index", all)).toBe(true);
  });

  it("is false for a page with nothing under it", () => {
    expect(
      isDirectoryIndex("guides/a", [entry("guides"), entry("guides/a")]),
    ).toBe(false);
  });

  it("does not take a sibling whose id merely starts with the same letters", () => {
    expect(isDirectoryIndex("guide", [entry("guide"), entry("guides/a")])).toBe(
      false,
    );
  });
});

describe("industriesByPath", () => {
  const page = (tags?: string) =>
    `---\ntitle: "T"\n${tags ? `industries: ${tags}\n` : ""}---\nBody\n`;
  const RAW = {
    "../content/docs/guides/index.mdx": page(),
    "../content/docs/guides/a.mdx": page("[core, workforce]"),
    "../content/docs/lone.mdx": page(),
  };

  it("keys the tags a page shows by its path, as the Markdown export reads them", () => {
    const tags = industriesByPath(RAW);
    expect(tags.get("guides/a")).toBe("[core, workforce]");
    expect(tags.get("guides/index")).toBe("[core, workforce]");
  });

  it("leaves a page with no tags out", () => {
    expect(industriesByPath(RAW).has("lone")).toBe(false);
  });
});
