#!/usr/bin/env node
/**
 * Builds the cases: every case of every experiment with its expected answer.
 *
 * The answer comes from the Temporal specification, asked twice: `@js-temporal/polyfill` and the
 * Temporal built into Node 26. A case is kept only when both give the same string; the others are
 * listed under `dropped` and printed. No peer library and not GMT is ever asked.
 *
 *   cd scripts/zone-matrix && pnpm install --ignore-workspace
 *   fnm exec --using=26 -- node probe/build-cases.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Temporal as Polyfill } from "@js-temporal/polyfill";
import { EXPERIMENTS } from "./experiments.mjs";
import { versionOf } from "./versions.mjs";
import { temporalOps } from "./temporal-ops.mjs";

/** Where `run.mjs` writes the cases for `child.mjs`; the folder is ignored by git. */
export const CASES_PATH = new URL("../.work/cases.json", import.meta.url);

const answer = (ops, c) => {
  try {
    return String(ops[c.op](c.args));
  } catch (error) {
    return `THROWS ${error?.name}`;
  }
};

export function buildCases(native) {
  const ref = temporalOps(Polyfill);
  const nat = temporalOps(native);
  const experiments = [];
  const dropped = [];
  for (const e of EXPERIMENTS) {
    const cases = [];
    for (const c of e.cases()) {
      const a = answer(ref, c);
      const b = answer(nat, c);
      if (a !== b || a.startsWith("THROWS")) {
        dropped.push({
          experiment: e.id,
          input: c.input,
          polyfill: a,
          native: b,
        });
        continue;
      }
      cases.push({
        id: `${e.id}-${cases.length + 1}`,
        op: c.op,
        args: c.args,
        input: c.input,
        group: c.group,
        expected: a,
      });
    }
    experiments.push({
      id: e.id,
      number: e.number,
      title: e.title,
      question: e.question,
      fed: e.fed,
      cases,
    });
  }
  return { experiments, dropped };
}

/** The cases with who answered them: what `child.mjs` reads. */
export function casesFile(native) {
  const { experiments, dropped } = buildCases(native);
  return {
    answeredBy: {
      polyfill: versionOf("@js-temporal/polyfill"),
      native: process.version,
      tzdata: process.versions.tz,
    },
    experiments,
    dropped,
  };
}

/** Writes the cases file under `.work/` and returns its text, which keys the probe's cache. */
export function writeCases(cases) {
  const text = `${JSON.stringify(cases)}\n`;
  mkdirSync(new URL(".", CASES_PATH), { recursive: true });
  writeFileSync(CASES_PATH, text);
  return text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (typeof globalThis.Temporal === "undefined") {
    console.error(
      "Run this on Node 26: its built-in Temporal is the second opinion.",
    );
    process.exit(2);
  }
  const cases = casesFile(globalThis.Temporal);
  writeCases(cases);
  for (const e of cases.experiments)
    console.log(`${e.id}: ${e.cases.length} cases`);
  console.log(`dropped (the two Temporals disagree): ${cases.dropped.length}`);
  for (const d of cases.dropped.slice(0, 20))
    console.log(" ", JSON.stringify(d));
}
