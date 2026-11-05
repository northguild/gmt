import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The token sheet is found by its suffix: the house-class rule bans a `gmt-` string, and this
// is a file name, so it is matched without writing the prefix.
const sheet = readdirSync(import.meta.dirname).find((f) =>
  f.endsWith("tokens.css"),
);
const tokens = readFileSync(join(import.meta.dirname, sheet ?? ""), "utf8");

describe("the display font's fallback face", () => {
  const face = /@font-face\s*{\s*font-family:\s*"Display Fallback";[^}]*}/.exec(
    tokens,
  )?.[0];

  it("is named by a face on every desktop platform, Linux included", () => {
    expect(face).toBeDefined();
    // Menlo (macOS), Consolas (Windows), DejaVu Sans Mono and Liberation Mono (Linux). A
    // browser does not map "Courier New" to Liberation Mono for `local()`, so without it a
    // Linux browser takes the unscaled monospace stack and every heading wraps again when Michroma
    // arrives.
    for (const name of [
      "Menlo",
      "Consolas",
      "DejaVu Sans Mono",
      "Liberation Mono",
    ]) {
      expect(face).toContain(`local("${name}")`);
    }
  });
});

describe("the display font's face", () => {
  const face = /@font-face\s*{\s*font-family:\s*Michroma;[^}]*}/.exec(
    tokens,
  )?.[0];

  // `optional` would keep the fallback in Chromium, which decodes a data-URI face after the first
  // layout; `block` waits the few milliseconds the decode takes, so no heading ever swaps.
  it("blocks until it is decoded, so the heading is drawn in it from the start", () => {
    expect(face).toBeDefined();
    expect(face).toMatch(/font-display:\s*block\s*;/);
  });

  // The build inlines the file named here as a data URI (the `?inline` query), so the font is in the stylesheet at first layout. The name is a relative
  // path to the vendored file, which is the one copy of the bytes.
  it("names the vendored file by a relative path, which the build inlines", () => {
    const url = /url\("([^"]+)"\)/.exec(face ?? "")?.[1] ?? "";
    expect(url.startsWith(".")).toBe(true);
    const [path, query] = url.split("?");
    expect(query).toBe("inline");
    const file = resolve(import.meta.dirname, path);
    expect(file.endsWith("public/fonts/michroma-latin-400-normal.woff2")).toBe(
      true,
    );
    expect(existsSync(file)).toBe(true);
  });

  it("keeps the fallback face at 130%", () => {
    expect(tokens).toMatch(
      /@font-face\s*{\s*font-family:\s*"Display Fallback";[^}]*size-adjust:\s*130%/,
    );
  });
});
