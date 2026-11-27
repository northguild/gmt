/**
 * The pinned download the prepare scripts share: fetch a source file (or read a local copy given
 * with `--<flag> <file>`), then refuse any file whose size or sha256 is not the pinned one.
 *
 * Not run on its own; `prepare-hero-milkyway.mjs`, `prepare-hero-sky.mjs` and
 * `prepare-sky-bodies.mjs` import it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/** The value after `--<name>` on the command line, or undefined. */
export const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};

/** Prints `name: message` to stderr and ends the process with a failure. */
export function fail(name, message) {
  console.error(`${name}: ${message}`);
  process.exit(1);
}

/**
 * The pinned file's bytes: read from the file named by `--<flag>` when given, else downloaded
 * from `url`. Fails when the size or sha256 is not the pinned one, naming both.
 */
export async function readPinnedSource({
  name,
  url,
  bytes,
  sha256,
  flag: given,
}) {
  const local = flag(given);
  let data;
  if (local) {
    if (!existsSync(local)) fail(name, `no file at ${local}`);
    data = readFileSync(local);
  } else {
    const response = await fetch(url);
    if (!response.ok) fail(name, `download failed: ${response.status} ${url}`);
    data = Buffer.from(await response.arrayBuffer());
  }
  const hash = createHash("sha256").update(data).digest("hex");
  if (hash !== sha256 || data.length !== bytes)
    fail(
      name,
      `the source is not the pinned file (${data.length} bytes, sha256 ${hash}); ` +
        `expected ${bytes} bytes, ${sha256}`,
    );
  return data;
}
