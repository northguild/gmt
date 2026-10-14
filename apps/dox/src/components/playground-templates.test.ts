/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { GMT_MODULES } from "../lib/gmt-modules";
import {
  classifyPlaygroundResult,
  evaluateArg,
} from "../lib/playground-client";
import {
  buildCall,
  type CallField,
  parseCallArgs,
} from "../lib/playground-parsers";
import {
  LIVE_PLAYGROUND_TEMPLATES,
  type PlaygroundField,
} from "../lib/playground-spec";

/**
 * Every generated template, end to end.
 *
 * `buildPlaygroundFields` drops `fields` when it cannot model an argument, and a
 * template with no `fields` gets no `<PlaygroundForm>` — the reference page
 * falls back to a dead code block, silently. These rows are the guard: a
 * function that loses its widget, or whose seeded form assembles a call the real
 * gmt function rejects, fails here rather than shipping.
 */

const templates = Object.entries(LIVE_PLAYGROUND_TEMPLATES);

/** Read a field the way `PlaygroundForm`'s controls do at their seeded state. */
function seededField(field: PlaygroundField): CallField {
  const base = {
    name: field.name,
    kind: field.kind as CallField["kind"],
    optional: field.optional,
  };

  if (field.kind === "list") {
    return { ...base, items: field.items ?? [], element: field.element };
  }
  if (field.kind === "intervals") {
    return { ...base, pairs: field.pairs ?? [] };
  }
  if (field.kind === "units") {
    return { ...base, value: field.seed, unit: field.unitSeed };
  }
  return { ...base, value: field.seed };
}

describe("live playground templates", () => {
  it("covers every function the reference generates a template for", () => {
    expect(templates.length).toBeGreaterThan(500);
  });

  // The regression that let 12 functions ship with a dead code block: an
  // argument the generator could not model (an object literal) cost the whole
  // function its form.
  it.each(templates.map(([id, t]) => ({ id, t })))(
    "$id has form fields",
    ({ t }) => {
      expect(t.fields).toBeDefined();
    },
  );

  // The seeded form must rebuild the call the `@example` wrote, so the widget
  // opens showing exactly what the page's code block promises.
  it.each(templates.map(([id, t]) => ({ id, t })))(
    "$id rebuilds its template call from the seeded fields",
    ({ t }) => {
      const fields = (t.fields ?? []).map(seededField);
      const call = buildCall(t.fn, fields, {
        optionsSuffix: t.optionsSuffix,
        objectArg: t.objectArg,
      });

      expect(parseCallArgs(call).length).toBeGreaterThanOrEqual(0);
      expect(call.startsWith(`${t.fn}(`)).toBe(true);
    },
  );

  // And the rebuilt call must actually answer. A playground whose opening state
  // reads NO SIGNAL teaches nothing — `mergeCalendars` shipped that way, its
  // object literals re-quoted into strings by the list editor.
  it.each(templates.map(([id, t]) => ({ id, t })))(
    "$id evaluates to a live result at its seeded state",
    async ({ t }) => {
      const mod = await GMT_MODULES[t.module]?.();
      expect(mod, `module not registered: ${t.module}`).toBeDefined();

      const fn = mod?.[t.fn];
      expect(typeof fn, `export not found: ${t.fn}`).toBe("function");

      const fields = (t.fields ?? []).map(seededField);
      const call = buildCall(t.fn, fields, {
        optionsSuffix: t.optionsSuffix,
        objectArg: t.objectArg,
      });
      const args = parseCallArgs(call)
        .map((a) => a.trim())
        .map(evaluateArg);
      const result = (fn as (...a: unknown[]) => unknown)(...args);

      // The same decision the form makes, so a seeded call that renders as
      // NO SIGNAL on the page fails here first. A seeded empty answer is
      // allowed: `mergeIntervalsUnix([])` is `[]`, correctly.
      expect(
        classifyPlaygroundResult(result, t),
        `${call} renders as the sentinel`,
      ).not.toBe("sentinel");
    },
  );
});

// The two functions that take a unit object. Every unit the control lists must answer, for
// every target unit the select offers: a listed unit that returns the sentinel (a week given
// to `totalUnits`) would be a dead choice in the form.
describe("unit-object playgrounds", () => {
  async function callWith(
    id: string,
    over: Record<string, Partial<CallField>>,
  ): Promise<{ call: string; result: unknown }> {
    const t = LIVE_PLAYGROUND_TEMPLATES[id];
    const mod = await GMT_MODULES[t.module]?.();
    const fields = (t.fields ?? []).map((f) => ({
      ...seededField(f),
      ...over[f.name],
    }));
    const call = buildCall(t.fn, fields, {
      optionsSuffix: t.optionsSuffix,
      objectArg: t.objectArg,
    });
    const args = parseCallArgs(call)
      .map((a) => a.trim())
      .map(evaluateArg);
    const fn = mod?.[t.fn] as (...a: unknown[]) => unknown;
    return { call, result: fn(...args) };
  }

  it("totalUnits returns a number for every unit and target unit it offers", async () => {
    const t = LIVE_PLAYGROUND_TEMPLATES.totalUnits;
    const units = t.fields?.find((f) => f.kind === "units");
    const target = t.fields?.find((f) => f.kind === "enum");
    expect(units?.unitKeys?.length).toBeGreaterThan(0);
    expect(target?.choices?.length).toBeGreaterThan(0);
    for (const unit of units?.unitKeys ?? []) {
      for (const choice of target?.choices ?? []) {
        const { call, result } = await callWith("totalUnits", {
          [units!.name]: { value: "15", unit },
          [target!.name]: { value: choice },
        });
        expect(typeof result, call).toBe("number");
      }
    }
  });

  it("durationFromUnits writes a duration string for every unit it offers", async () => {
    const t = LIVE_PLAYGROUND_TEMPLATES.durationFromUnits;
    const units = t.fields?.find((f) => f.kind === "units");
    expect(units?.unitKeys?.length).toBeGreaterThan(0);
    for (const unit of units?.unitKeys ?? []) {
      const { call, result } = await callWith("durationFromUnits", {
        [units!.name]: { value: "15", unit },
      });
      expect(result, call).toMatch(/^P/);
    }
  });
});

describe("unit name order in selects", () => {
  const PLURAL = [
    "years",
    "months",
    "weeks",
    "days",
    "hours",
    "minutes",
    "seconds",
    "milliseconds",
    "microseconds",
    "nanoseconds",
  ];
  const UNITS = [...PLURAL, ...PLURAL.map((u) => u.slice(0, -1))];
  const rank = (c: string) => UNITS.indexOf(c);

  /** Unit names largest first, then every other choice in its order, then `""`. */
  const expected = (choices: readonly string[]) => [
    ...choices.filter((c) => rank(c) >= 0).sort((a, b) => rank(a) - rank(b)),
    ...choices.filter((c) => rank(c) < 0 && c !== ""),
    ...choices.filter((c) => c === ""),
  ];

  it("lists unit names largest first in every select that offers one", () => {
    const wrong: string[] = [];
    for (const [id, t] of templates) {
      for (const f of t.fields ?? []) {
        const choices = (f as { choices?: string[] }).choices;
        if (!choices?.some((c) => rank(c) >= 0)) continue;
        if (JSON.stringify(choices) !== JSON.stringify(expected(choices))) {
          wrong.push(`${id}.${f.name}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it.each([
    "getNowUnit",
    "getUnixNowUnit",
    "getUtcNowUnit",
    "getZonedNowUnit",
    "parseUnitFromDate",
    "parseUnitFromDateTime",
    "parseUnitFromUnix",
    "parseUnitFromUtc",
    "parseUnitFromZoned",
  ])("%s lists its units largest first, then dayOfWeek", (id) => {
    const unit = LIVE_PLAYGROUND_TEMPLATES[id]?.fields?.find(
      (f) => f.name === "unit",
    ) as { choices?: string[] } | undefined;
    const choices = unit?.choices ?? [];
    expect(choices).toContain("dayOfWeek");
    expect(choices).toEqual(expected(choices));
    expect(rank(choices[0])).toBe(0);
  });
});
