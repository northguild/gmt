/// <reference types="vitest/globals" />
/**
 * DOX-C3b's dispatch DoD lines, asserted directly rather than inferred from a
 * happy path — which is what the spec asks for by name:
 *
 *   - a tool call with a **valid shape but nonsense arguments** renders an error
 *     state rather than crashing the panel;
 *   - an **unknown tool name** is handled without crashing;
 *   - **no `eval` or dynamic code execution** exists on this path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { DOX_TOOL_NAMES, ENABLED_TOOL_NAMES } from "~/lib/dox-tools";
import {
  isRegisteredWidget,
  resolveWidget,
  WIDGET_REGISTRY,
} from "./widget-registry";

describe("resolveWidget", () => {
  it("resolves a real call", () => {
    const result = resolveWidget("showGlobe", { zone: "Asia/Tokyo" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.title).toBe("Zoned Earth");
    expect(result.args).toEqual({ zone: "Asia/Tokyo" });
  });

  it("refuses an unknown tool name instead of throwing", () => {
    /* A name that is not a tool at all, rather than one that merely was not
       registered yet. This previously used `showDstInspector`, which was honest
       while that widget was pending and became meaningless the moment it
       landed — a test whose subject can quietly turn into a passing case is
       worse than no test. */
    const result = resolveWidget("showTimeMachine", { zone: "UTC" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("doesn't have");
  });

  it("refuses a name that is not a tool at all", () => {
    expect(resolveWidget("rm -rf /", {}).ok).toBe(false);
    expect(resolveWidget("", {}).ok).toBe(false);
  });

  it("is not fooled by inherited Object properties", () => {
    // A lookup written as `WIDGET_REGISTRY[name]` without an own-property guard
    // would resolve "constructor" or "toString" to a function.
    for (const name of ["constructor", "toString", "__proto__", "valueOf"]) {
      expect(isRegisteredWidget(name)).toBe(false);
      expect(resolveWidget(name, {}).ok).toBe(false);
    }
  });

  it("refuses input that does not fit the schema", () => {
    expect(resolveWidget("showGlobe", {}).ok).toBe(false);
    expect(resolveWidget("showGlobe", { zone: 42 }).ok).toBe(false);
    expect(resolveWidget("showGlobe", null).ok).toBe(false);
    expect(resolveWidget("showGlobe", "Asia/Tokyo").ok).toBe(false);
  });

  it("accepts a shape-valid but nonsense zone here, and defers it to validate()", () => {
    // The regex cannot know the tz database, and pretending otherwise would put
    // the check in the wrong place. This documents that split.
    const result = resolveWidget("showGlobe", { zone: "Mars/Olympus_Mons" });
    expect(result.ok).toBe(true);
  });

  it("rejects an invented zone at the semantic layer", async () => {
    const result = resolveWidget("showGlobe", { zone: "Mars/Olympus_Mons" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const problem = await result.entry.validate?.(result.args);
    expect(problem).toBeTruthy();
    expect(problem).toContain("Mars/Olympus_Mons");
  });

  it("passes a real zone at the semantic layer", async () => {
    const result = resolveWidget("showGlobe", { zone: "Asia/Tokyo" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await result.entry.validate?.(result.args)).toBeNull();
  });

  it("produces markup carrying every role its mount looks up", () => {
    // `mountGlobe` uses null-tolerant lookups, so a missing data-role would not
    // throw — it would silently make a control inert.
    const entry = WIDGET_REGISTRY.showGlobe;
    expect(entry).toBeDefined();
    const html = entry?.renderTemplate("probe", {}) ?? "";
    for (const role of [
      'data-role="stage"',
      'data-role="clocks"',
      "data-globe-search",
      "data-globe-zoom",
    ]) {
      expect(html).toContain(role);
    }
    // The id prefix is what stops a rail globe colliding with one on the page.
    expect(html).toContain('id="probe-stage"');
  });
});

/**
 * The parity contract.
 *
 * Dox is offered exactly the tools it can mount. Without this, a tool added to
 * `dox-tools.ts` without a registry entry reaches a reader as an answer that
 * promises a widget followed by a chip saying the widget is not in this build —
 * and nothing in the suite would object.
 */
describe("offered tools and mountable widgets are the same set", () => {
  it("every enabled tool has a registry entry", () => {
    const registered = Object.keys(WIDGET_REGISTRY).sort();
    expect([...ENABLED_TOOL_NAMES].sort()).toEqual(registered);
  });

  it("every registry entry names a real tool", () => {
    for (const name of Object.keys(WIDGET_REGISTRY)) {
      expect(DOX_TOOL_NAMES).toContain(name);
    }
  });

  it("keeps any not-yet-extracted tool defined but unoffered", () => {
    /* Derived, not hardcoded: the pending set shrinks by one each time a widget
       is extracted, and a test that had to be edited on each of those steps
       would eventually be edited to agree with whatever the code did. Their
       schemas stay ready so enabling one is a single line; what must not happen
       is offering one early. */
    const pending = DOX_TOOL_NAMES.filter(
      (name) => !(ENABLED_TOOL_NAMES as readonly string[]).includes(name),
    );
    for (const name of pending) {
      expect(isRegisteredWidget(name)).toBe(false);
    }
  });
});

describe("no dynamic code execution on the dispatch path", () => {
  /** Source with comments removed — several of these files *document* the
   *  banned constructs in prose, so scanning the raw text reports the warnings
   *  as violations. */
  const read = (relative: string) =>
    readFileSync(path.resolve(import.meta.dirname, relative), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => {
        const trimmed = line.trimStart();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*");
      })
      .join("\n");

  const DISPATCH_FILES = [
    "./widget-registry.ts",
    "./MountedWidget.tsx",
    "./WidgetRail.tsx",
    "./WidgetReceipt.tsx",
    "../../lib/widget-mount.ts",
    "../../lib/globe-mount.ts",
    "../../lib/widget-permalink.ts",
  ];

  for (const file of DISPATCH_FILES) {
    it(`${file} contains no eval or Function constructor`, () => {
      const source = read(file);
      expect(source).not.toMatch(/\bnew\s+Function\b/);
      expect(source).not.toMatch(/\beval\s*\(/);
    });
  }

  it("never reaches playground-client, the one module holding a new Function", () => {
    for (const file of DISPATCH_FILES) {
      expect(read(file)).not.toContain("playground-client");
    }
  });

  it("imports its mount modules by literal specifier, never a variable", () => {
    const source = read("./widget-registry.ts");
    for (const match of source.matchAll(/import\(([^)]*)\)/g)) {
      // A literal string argument, not an identifier or a template with a hole.
      expect(match[1].trim()).toMatch(/^["'][^"'`]+["']$/);
    }
  });
});
