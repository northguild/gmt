/**
 * One process of the probe: one adapter, under the machine zone this process was started with.
 * Prints one JSON object: the cases that broke (the wrong text, or the error) and the ones the
 * library cannot say. A case that passed is not listed.
 *
 *   TZ=Pacific/Apia node probe/child.mjs <adapter id>
 */
import { readFileSync } from "node:fs";
import { Unsupported } from "./adapter-util.mjs";

const id = process.argv[2];
const adapter = (await import(`./adapters/${id}.mjs`)).default;
const { experiments } = JSON.parse(
  readFileSync(new URL("./cases.json", import.meta.url), "utf8"),
);

const broken = {};
const unsupported = {};
for (const e of experiments) {
  for (const c of e.cases) {
    try {
      const fn = adapter.ops[c.op];
      if (!fn) throw new Unsupported(`no ${c.op}`);
      const got = fn(c.args);
      if (got !== c.expected) broken[c.id] = String(got);
    } catch (error) {
      if (error instanceof Unsupported) unsupported[c.id] = error.message;
      else
        broken[c.id] =
          `threw ${error?.name ?? "Error"}: ${String(error?.message ?? error).slice(0, 80)}`;
    }
  }
}
console.log(
  JSON.stringify({
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    version: adapter.version,
    broken,
    unsupported,
  }),
);
