import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { distDirOrSkip } from "./dist-dir";

const dist = distDirOrSkip();

/** Every page of the built site. */
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

describe.skipIf(dist === null)("the display font in the built site", () => {
  const site = join(dist ?? "", "gmt");
  const astro = join(site, "_astro");
  const vendored = readFileSync(
    join(
      import.meta.dirname,
      "../public/fonts/michroma-latin-400-normal.woff2",
    ),
  );
  const sheets = readdirSync(astro)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(astro, f), "utf8"));
  const faces = sheets.flatMap(
    (css) =>
      css.match(/@font-face\s*{[^}]*font-family:\s*Michroma[^}]*}/g) ?? [],
  );

  it("is declared once, in a stylesheet, as the vendored file's own bytes", () => {
    expect(faces).toHaveLength(1);
    const uri = /url\(\s*["']?(data:font\/woff2;base64,[A-Za-z0-9+/=]+)/.exec(
      faces[0],
    )?.[1];
    expect(uri, "the face's src is a data:font/woff2 URI").toBeDefined();
    const bytes = Buffer.from((uri ?? "").split(",")[1], "base64");
    expect(bytes.equals(vendored)).toBe(true);
    expect(faces[0]).toMatch(/font-display:\s*optional/);
  });

  it("is preloaded by no page: the file is in the stylesheet", () => {
    const all = pages(site);
    expect(all.length).toBeGreaterThan(100);
    const preloading = all.filter((page) => {
      const head = readFileSync(page, "utf8").split("</head>")[0];
      return /<link\b[^>]*michroma[^>]*>/i.test(head);
    });
    expect(preloading).toEqual([]);
  });
});
