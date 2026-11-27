/** `src/assets` JSON files, read and written by the generators (`prepare-sky-orbits.ts`). */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/assets",
);

export const readJson = (file: string) =>
  JSON.parse(readFileSync(path.join(ASSETS, file), "utf8"));

/** Compact, or indented (with a final newline) when `indent` is given. */
export const writeJson = (file: string, value: unknown, indent?: number) =>
  writeFileSync(
    path.join(ASSETS, file),
    JSON.stringify(value, null, indent) + (indent ? "\n" : ""),
  );
