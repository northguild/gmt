import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The installed version of a package in `scripts/zone-matrix/node_modules`. */
export const versionOf = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../node_modules/${name}/package.json`, import.meta.url),
      ),
      "utf8",
    ),
  ).version;
