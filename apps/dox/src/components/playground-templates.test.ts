import corpus from "../generated/reference/gmt-corpus.json";
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

      // A unit object field holds one key. The first `@example` must write
      // exactly that, or the form seeds a smaller object than the page shows
      // (a two-key `{ years: 1, months: 2 }` seeds `{ years: 1 }`).
      if (t.objectArg) return;
      const squash = (a: string) => a.replace(/\s+/g, "");
      const written = parseCallArgs(t.template);
      const rebuilt = parseCallArgs(call);
      (t.fields ?? []).forEach((field, i) => {
        if (field.kind !== "units") return;
        expect(squash(rebuilt[i] ?? ""), `${t.fn} ${field.name}`).toBe(
          squash(written[i] ?? ""),
        );
      });
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

// `rolloverEra` is `number | "rolling" | { notBefore: string }`: a union of string literals and an
// open `number` or object type. It is source text in the form, so the reader can type any form of
// the union, and the form opens on the example's argument as written. Every expected value below
// is read from the generated template or from the function's own JSDoc examples in the corpus.
describe("gnssWeekToUtc, a union of string literals and an open type", () => {
  const template = LIVE_PLAYGROUND_TEMPLATES.gnssWeekToUtc;
  const examples =
    corpus.find((e) => e.name === "gnssWeekToUtc" && e.kind === "function")
      ?.examples ?? [];
  const argsOf = (call: string) => parseCallArgs(call).map((a) => a.trim());
  /** The first example for a counter whose result is an instant. */
  const exampleFor = (counter: string) =>
    examples.find(
      (e) =>
        argsOf(e.call)[0] === JSON.stringify(counter) &&
        e.result !== '""' &&
        !e.result.startsWith('"" '),
    );

  it("has a form with the counter as a choice and the other three as typed fields", () => {
    expect(template).toBeDefined();
    expect(template?.fields?.map((f) => [f.name, f.kind])).toEqual([
      ["counter", "enum"],
      ["week", "number"],
      ["timeOfWeekSeconds", "number"],
      ["rolloverEra", "expr"],
    ]);
    const counter = template?.fields?.[0];
    expect(counter?.choices?.length).toBeGreaterThan(1);
    expect(new Set(counter?.choices).size).toBe(counter?.choices?.length);
  });

  it("opens the era on the example's own argument, with no list of choices", () => {
    const era = template?.fields?.find((f) => f.name === "rolloverEra");
    expect(era?.seed).toBe(argsOf(template!.template)[3]);
    expect(era?.choices).toBeUndefined();
  });

  it("loads the week, the time of week and the era of an example when a counter is chosen", () => {
    const seeds = template?.choiceSeeds?.counter ?? {};
    expect(Object.keys(seeds)).toContain("BDT");
    for (const [counter, entry] of Object.entries(seeds)) {
      const written = argsOf(exampleFor(counter)!.call);
      expect(entry, counter).toEqual({
        week: { seed: written[1] },
        timeOfWeekSeconds: { seed: written[2] },
        rolloverEra: { seed: written[3] },
      });
    }
  });

  it("answers an era typed as a number, a word or an object", async () => {
    const mod = await GMT_MODULES[template!.module]?.();
    const fn = mod?.gnssWeekToUtc as (...a: unknown[]) => unknown;
    const forms = ["0", '"rolling"', '{ notBefore: "2019-01-01T00:00:00Z" }'];
    for (const era of forms) {
      const fields = (template?.fields ?? []).map(seededField);
      const call = buildCall(
        template!.fn,
        fields.map((f) =>
          f.name === "rolloverEra" ? { ...f, value: era } : f,
        ),
      );
      const args = parseCallArgs(call)
        .map((a) => a.trim())
        .map(evaluateArg);
      expect(typeof fn(...args), call).toBe("string");
      expect(fn(...args), call).not.toBe("");
    }
  });
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
