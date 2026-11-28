import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { afterAll, expect } from "vitest";

/** What the prepare scripts' map tests share: sharp's decode and the WebP-against-sidecar check. */

type Sharp = (input: Buffer) => {
  raw: () => {
    toBuffer: (options: { resolveWithObject: true }) => Promise<{
      data: Buffer;
      info: { width: number; height: number; channels: number };
    }>;
  };
};

/** Loading sharp sets `VIPSHOME`; the calling file puts it back as it found it. */
export function restoreVipsHomeAfterAll(): void {
  const vipsHome = process.env["VIPSHOME"];
  afterAll(() => {
    if (vipsHome === undefined) delete process.env["VIPSHOME"];
    else process.env["VIPSHOME"] = vipsHome;
  });
}

/** The raw pixels of a WebP, decoded by sharp. */
export async function decodeWebp(webp: Buffer) {
  /* Sharp is a dependency of Astro, not of the app, so it is found from Astro's own install. */
  const sharpFile = createRequire(
    createRequire(import.meta.url).resolve("astro/package.json"),
  ).resolve("sharp");
  const sharp = (await import(pathToFileURL(sharpFile).href)).default as Sharp;
  return sharp(webp).raw().toBuffer({ resolveWithObject: true });
}

/** The file is a WebP whose size and hash are the ones its sidecar states. */
export function expectWebpMatchesSidecar(
  webp: Buffer,
  sidecar: { map: { bytes: number; sha256: string } },
): void {
  expect(webp.toString("latin1", 0, 4)).toBe("RIFF");
  expect(webp.toString("latin1", 8, 12)).toBe("WEBP");
  expect(webp.length).toBe(sidecar.map.bytes);
  expect(createHash("sha256").update(webp).digest("hex")).toBe(
    sidecar.map.sha256,
  );
}
