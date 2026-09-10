/**
 * DOX-C3b (#139) — the fixed, typed map from a tool name to a mountable widget.
 *
 * ## No dynamic code, anywhere on this path
 *
 * The DoD line is "no `eval` or dynamic code execution exists anywhere in the
 * registry or its dispatch path — verified by reading the implementation".
 * Concretely, in this file:
 *
 *   - `WIDGET_REGISTRY` is an object literal with literal keys. Lookup is a
 *     guarded property read (`Object.hasOwn`), never a constructed key.
 *   - Each `load` is a literal `import("…")` with a static specifier — which is
 *     also what keeps d3-geo, world-atlas and the Temporal polyfill out of the
 *     chat chunk until a widget is actually mounted.
 *   - Nothing here reaches `playground-client.ts`, the one module in `src/` that
 *     contains a `new Function` (its `evaluateArg`, reachable only from
 *     `PlaygroundForm.astro`). Keep it that way.
 *
 * The spec also sketched a generic `showPlayground({ fn, args })`. It is
 * deliberately **not** here: it is the only entry with any reason to approach
 * `evaluateArg`, and it would turn the line above from a fact into an argument —
 * for the least reader value of the five, since a citation already links to the
 * playground page itself.
 *
 * ## Three layers of validation, because a schema is not enough
 *
 *   1. **Shape** — the widget's own zod schema, re-run here even though the
 *      Worker ran it. The client is what renders; it validates what it renders.
 *   2. **Semantics** — `validate()`. `"Mars/Olympus_Mons"` clears the zone regex
 *      by design (see `dox-tools.ts`) and fails here, against
 *      `@northguild/gmt`'s own `isValidTimeZone`. There is a pleasing symmetry
 *      in the docs site refusing a hallucinated zone by calling the library it
 *      documents.
 *   3. **Runtime** — `MountedWidget` wraps the mount in try/catch.
 *
 * Templates are imported statically and mounts dynamically, on purpose: a
 * template is a pure string function with no heavy dependencies, and the rail
 * needs it *before* the mount module has loaded.
 */
import {
  renderConverterTemplate,
  type ConverterArgs,
} from "~/lib/converter-bench-mount";
import { renderGlobeTemplate, type GlobeArgs } from "~/lib/globe-mount";
import { renderDstTemplate, type DstArgs } from "~/lib/dst-inspector-mount";
import {
  renderIntervalTemplate,
  type IntervalArgs,
} from "~/lib/interval-visualizer-mount";
import {
  showConverterBenchInput,
  showDstInspectorInput,
  showGlobeInput,
  showIntervalVisualizerInput,
} from "~/lib/dox-tools";
import type { MountFn } from "~/lib/widget-mount";
import type { WidgetKind } from "~/lib/widget-permalink";

/**
 * A registry entry with its argument type erased.
 *
 * The registry is heterogeneous — each widget has its own `Args` — so it cannot
 * be a `Record` of a single generic type without either lying (`never`, which
 * does not typecheck) or spreading `any` through every consumer. Instead the
 * erasure happens exactly once, in `defineWidget`, and is sound by construction:
 * an entry's `parse`, `mount` and `validate` are checked against the *same*
 * `Args` inside that call, and nothing else ever constructs the args they
 * receive.
 */
export interface AnyWidgetEntry {
  title: string;
  kind: WidgetKind;
  parse: (
    input: unknown,
  ) => { ok: true; args: unknown } | { ok: false; reason: string };
  renderTemplate: (idPrefix: string, args: unknown) => string;
  load: () => Promise<{ mount: MountFn<never> }>;
  validate?: (args: unknown) => Promise<string | null>;
}

export interface WidgetEntry<Args> {
  /** Shown on the Artifact frame. */
  title: string;
  kind: WidgetKind;
  /** Parses unknown input into `Args`, or reports why it cannot. */
  parse: (
    input: unknown,
  ) => { ok: true; args: Args } | { ok: false; reason: string };
  /**
   * Markup for the mount to wire. Pure — no DOM access.
   *
   * Takes the args so a seeded widget paints seeded on its first frame rather
   * than rendering defaults and correcting itself a moment later. `idPrefix`
   * namespaces any `id` the markup needs, so a widget in the rail cannot
   * collide with the same widget on the page behind it.
   */
  renderTemplate: (idPrefix: string, args: Args) => string;
  /** Lazy, with a literal specifier. */
  load: () => Promise<{ mount: MountFn<Args> }>;
  /** Semantic check the schema cannot make. `null` means fine. */
  validate?: (args: Args) => Promise<string | null>;
}

/**
 * The one place the argument type is erased. Everything above the line is
 * type-checked against a concrete `Args`; everything below treats args as
 * opaque and only ever hands them back to the same entry.
 */
function defineWidget<Args>(entry: WidgetEntry<Args>): AnyWidgetEntry {
  return entry as unknown as AnyWidgetEntry;
}

async function checkZones(zones: readonly string[]): Promise<string | null> {
  const { isValidTimeZone } = await import("@northguild/gmt/zoned/validate");
  const unknown = zones.filter((zone) => !isValidTimeZone(zone));
  if (unknown.length === 0) return null;
  return unknown.length === 1
    ? `${unknown[0]} isn't a time zone this browser knows about.`
    : `These aren't time zones this browser knows about: ${unknown.join(", ")}.`;
}

const globeEntry = defineWidget<GlobeArgs>({
  title: "Zoned Earth",
  kind: "globe",
  parse: (input) => {
    const result = showGlobeInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  // The globe seeds after mount instead: `focusZone` animates there, which
  // reads better than snapping to the zone on the first frame.
  renderTemplate: (idPrefix) => renderGlobeTemplate({ idPrefix }),
  load: () =>
    import("~/lib/globe-mount").then((m) => ({ mount: m.mountGlobe })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

/**
 * A literal object with literal keys. Do not make this dynamic.
 *
 * All four Tier 2 widgets are registered. `ENABLED_TOOL_NAMES` remains the
 * declaration of what the model is offered, and a test asserts the two sets
 * are equal — so a fifth tool cannot be offered without a widget to mount. Until then those tool names are known to `dox-tools.ts` but
 * unregistered here — and `ENABLED_TOOL_NAMES` keeps them from being offered to
 * the model at all, so Dox can never promise a widget this build cannot show.
 */
const converterEntry = defineWidget<ConverterArgs>({
  title: "Converter + format bench",
  kind: "converter",
  parse: (input) => {
    const result = showConverterBenchInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  renderTemplate: (_idPrefix, args) => renderConverterTemplate(args),
  load: () =>
    import("~/lib/converter-bench-mount").then((m) => ({
      mount: m.mountConverterBench,
    })),
  /* `ConverterArgs` are all optional — the template falls back to its own
     defaults — so only the zones actually supplied are checked. */
  validate: ({ from, to }) =>
    checkZones([from, to].filter((zone): zone is string => !!zone)),
});

const intervalEntry = defineWidget<IntervalArgs>({
  title: "Interval algebra visualizer",
  kind: "interval",
  parse: (input) => {
    const result = showIntervalVisualizerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  // Seeds after mount rather than in the template: `applyPreset()` runs at the
  // end of setup and would overwrite anything painted here.
  renderTemplate: () => renderIntervalTemplate(),
  load: () =>
    import("~/lib/interval-visualizer-mount").then((m) => ({
      mount: m.mountIntervalVisualizer,
    })),
  /* No zones to check. The widget pre-validates each interval with the
     library's own `isValidZonedRange` and renders the invalid case visibly
     differently from the empty one — see the component docstring — so a
     nonsense date reaches an explanatory state rather than an error box. */
});

const dstEntry = defineWidget<DstArgs>({
  title: "DST transition inspector",
  kind: "dst",
  parse: (input) => {
    const result = showDstInspectorInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template rather than after mount: every argument here is a
     control value, and `setupWidget` reads those controls on its first render.
     Writing them afterwards would be a second source of truth for one state. */
  renderTemplate: (_idPrefix, args) => renderDstTemplate(args),
  load: () =>
    import("~/lib/dst-inspector-mount").then((m) => ({
      mount: m.mountDstInspector,
    })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

export const WIDGET_REGISTRY: Record<string, AnyWidgetEntry | undefined> = {
  showGlobe: globeEntry,
  showConverterBench: converterEntry,
  showIntervalVisualizer: intervalEntry,
  showDstInspector: dstEntry,
};

/** Whether a streamed tool part names a widget this build actually has. */
export function isRegisteredWidget(toolName: string): boolean {
  return Object.hasOwn(WIDGET_REGISTRY, toolName);
}

export type ResolvedWidget =
  | { ok: true; entry: AnyWidgetEntry; args: unknown }
  | { ok: false; reason: string };

/**
 * The single dispatch point: tool name plus raw input in, a mountable entry or
 * a reason out. Never throws.
 */
export function resolveWidget(
  toolName: string,
  input: unknown,
): ResolvedWidget {
  if (!Object.hasOwn(WIDGET_REGISTRY, toolName)) {
    return {
      ok: false,
      reason: "Dox asked for a widget this build doesn't have.",
    };
  }
  const entry = WIDGET_REGISTRY[toolName];
  if (!entry) {
    return {
      ok: false,
      reason: "Dox asked for a widget this build doesn't have.",
    };
  }

  const parsed = entry.parse(input);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  return { ok: true, entry, args: parsed.args };
}
