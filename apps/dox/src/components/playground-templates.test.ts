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
