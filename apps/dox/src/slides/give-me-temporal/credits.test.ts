import { wallCredit } from "./credits";
import { WALL_PAGES, type WallPage } from "./wall";

const page = (id: string, url: string): WallPage => ({
  id,
  name: id,
  title: id,
  url,
  capturedAt: "2026-11-18T05:15:57.989957972Z",
  image: `slides/${id}.webp`,
  clock: true,
});

describe("the wall capture credit", () => {
  it("names each page's host, linked, with its capture day", () => {
    const credit = wallCredit([
      page("a", "https://a.example/"),
      page("b", "https://b.example/x"),
    ]);
    expect(credit.label).toBe("Wall captures");
    expect(credit.parts).toContainEqual({
      text: "a.example",
      href: "https://a.example/",
    });
    expect(credit.parts).toContainEqual({
      text: "b.example",
      href: "https://b.example/x",
    });
    expect(
      credit.parts.filter((p) => p === " (18 November 2026)"),
    ).toHaveLength(2);
  });

  it("lists every capture of the wall, the newest included", () => {
    const hosts = wallCredit().parts.flatMap((p) =>
      typeof p === "string" ? [] : [p.text],
    );
    expect(hosts).toHaveLength(WALL_PAGES.length);
    expect(hosts).toContain("spacetime.how");
  });
});
