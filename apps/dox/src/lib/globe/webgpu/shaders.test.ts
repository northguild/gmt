/// <reference types="vitest/globals" />

/**
 * What can be checked about the shaders without a GPU.
 *
 * Whether they *compile* is a browser question, answered by
 * `scripts/globe-smoke.mjs`. What is checkable here is everything that would
 * otherwise drift silently: that the sun-elevation constants in the WGSL are the
 * same numbers the TypeScript shading module is tested against, that the uniform
 * block the shader declares matches the one the renderer writes, and that the
 * graticule constants really do describe `d3.geoGraticule10()` — which is the
 * grid the canvas-2D renderer draws and the shader has to reproduce analytically.
 */

import { geoGraticule10 } from "d3-geo";
import { describe, expect, it } from "vitest";
import { CIVIL_TWILIGHT, GAMMA, HAZE_START, TWILIGHT_END } from "../shading";
import {
  fillShader,
  GRATICULE_MAJOR_STEP_DEG,
  GRATICULE_MINOR_LIMIT_DEG,
  GRATICULE_STEP_DEG,
  labelShader,
  markerShader,
  regionOverlayShader,
  strokeShader,
  surfaceShader,
} from "./shaders";
import {
  slotOffset,
  UNIFORM_BYTES,
  UNIFORM_SLOTS,
  uniformStructWgsl,
  writeUniforms,
  type UniformSlot,
} from "./uniforms";
import type { GlobeTheme } from "../types";

/** WGSL comments, both forms, so prose cannot trip a source check. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const SHADERS: Record<string, () => string> = {
  surface: surfaceShader,
  regionOverlay: regionOverlayShader,
  fill: fillShader,
  stroke: strokeShader,
  marker: markerShader,
  label: labelShader,
};

describe("every shader", () => {
  for (const [name, build] of Object.entries(SHADERS)) {
    describe(name, () => {
      const source = build();

      it("interpolates no undefined or NaN", () => {
        /* A missing import or a renamed constant shows up as the string
           "undefined" in the WGSL, which compiles to a confusing parse error in
           the browser and nothing at all here. Comments are stripped first: the
           shader source explains *why* it avoids WGSL's `smoothstep`, and the
           word "undefined" appears in that explanation. */
        const code = stripComments(source);
        expect(code).not.toMatch(/undefined/);
        expect(code).not.toMatch(/NaN/);
        expect(code).not.toMatch(/\[object/);
      });

      it("declares a vertex and a fragment entry point", () => {
        expect(source).toContain("@vertex");
        expect(source).toContain("@fragment");
        expect(source).toContain("fn vs(");
        expect(source).toContain("fn fs(");
      });

      it("binds the uniform block the renderer writes", () => {
        expect(source).toContain(
          "@group(0) @binding(0) var<uniform> g: Globe;",
        );
        expect(source).toContain(uniformStructWgsl());
      });

      it("has balanced braces", () => {
        const open = (source.match(/\{/g) ?? []).length;
        const close = (source.match(/\}/g) ?? []).length;
        expect(open).toBe(close);
      });
    });
  }
});

describe("shading constants", () => {
  /**
   * The point of generating WGSL from TypeScript: these four numbers decide where
   * day fades to night, and `shading.test.ts` covers them as TypeScript. If the
   * shader restated them, the two could disagree and only a screenshot would show
   * it.
   */
  const source = surfaceShader();

  it("carries the exact TypeScript values into the WGSL", () => {
    for (const [name, value] of [
      ["TWILIGHT_END", TWILIGHT_END],
      ["CIVIL_TWILIGHT", CIVIL_TWILIGHT],
      ["GAMMA", GAMMA],
      ["HAZE_START", HAZE_START],
    ] as const) {
      const match = new RegExp(`const ${name}: f32 = ([^;]+);`).exec(source);
      expect(match, `${name} is declared`).not.toBeNull();
      // Parsed back, so a precision loss in the emitter would fail here.
      expect(Number.parseFloat(match![1])).toBeCloseTo(value, 15);
    }
  });

  it("uses a hand-written ramp rather than WGSL's smoothstep", () => {
    /* The night curve ramps downwards — `ramp(0.0, -TWILIGHT_END, x)` — and
       WGSL's `smoothstep` is undefined when its low edge is not below its high
       edge. Reaching for the builtin here is a plausible future "cleanup" that
       would break night shading on some drivers and not others. */
    expect(source).toContain("fn ramp(");
    expect(source).toContain("ramp(0.0, -TWILIGHT_END, elevation)");
    expect(source).not.toMatch(/\bsmoothstep\s*\(/);
  });

  it("keeps the day, haze and night layers stacked in the tested order", () => {
    // Mirrors `paintShading`: both lit layers are the day colour, so alphas stack.
    expect(source).toContain("let litA = 1.0 - (1.0 - dayA) * (1.0 - hazeA);");
    expect(source).toContain("let shadeA = nightA + litA * (1.0 - nightA);");
  });
});

describe("graticule constants", () => {
  /**
   * The shader draws the grid from each pixel's own latitude and longitude, so it
   * has to be told what `geoGraticule10()` would have drawn. These assertions read
   * that back out of d3 rather than trusting the numbers.
   */
  const lines = (geoGraticule10() as unknown as { coordinates: number[][][] })
    .coordinates;

  const meridians = lines.filter(
    (line) => Math.abs(line[0][0] - line[line.length - 1][0]) < 1e-9,
  );
  const parallels = lines.filter(
    (line) => Math.abs(line[0][1] - line[line.length - 1][1]) < 1e-9,
  );

  it("steps every 10 degrees", () => {
    expect(GRATICULE_STEP_DEG).toBe(10);
    for (const line of parallels) {
      expect(line[0][1] % GRATICULE_STEP_DEG).toBeCloseTo(0, 9);
    }
    for (const line of meridians) {
      expect(line[0][0] % GRATICULE_STEP_DEG).toBeCloseTo(0, 9);
    }
  });

  it("stops minor meridians at 80 degrees and runs majors to the poles", () => {
    expect(GRATICULE_MINOR_LIMIT_DEG).toBe(80);
    expect(GRATICULE_MAJOR_STEP_DEG).toBe(90);
    for (const line of meridians) {
      const longitude = line[0][0];
      const extreme = Math.max(...line.map((point) => Math.abs(point[1])));
      const isMajor = Math.abs(longitude) % GRATICULE_MAJOR_STEP_DEG === 0;
      if (isMajor) {
        /* d3 stops a hair short of the pole — 89.999999 — to avoid the
           singularity there, so this is not an exact 90. */
        expect(extreme, `meridian ${longitude} reaches a pole`).toBeCloseTo(
          90,
          4,
        );
      } else {
        expect(extreme, `meridian ${longitude} stops at 80`).toBeCloseTo(
          GRATICULE_MINOR_LIMIT_DEG,
          4,
        );
      }
    }
  });

  it("keeps parallels inside 80 degrees", () => {
    for (const line of parallels) {
      // d3's extent overshoots by a millionth of a degree; see above.
      expect(Math.abs(line[0][1])).toBeLessThanOrEqual(
        GRATICULE_MINOR_LIMIT_DEG + 1e-5,
      );
    }
  });

  it("matches the line counts the shader's rules imply", () => {
    // 36 meridians at 10° steps, and 17 parallels from -80 to 80.
    expect(meridians.length).toBe(36);
    expect(parallels.length).toBe(17);
    const majors = meridians.filter(
      (line) => Math.abs(line[0][0]) % GRATICULE_MAJOR_STEP_DEG === 0,
    );
    expect(majors.length).toBe(4);
  });

  it("combines meridians and parallels with max, never a sum", () => {
    /* d3 strokes the whole graticule as one path, so a crossing is drawn once.
       Adding the two coverages would leave a brighter dot at every intersection —
       a subtle difference that only a pixel comparison would catch. */
    expect(surfaceShader()).toContain("return max(parallel, meridian);");
  });
});

describe("the uniform block", () => {
  it("puts every slot at a 16-byte boundary", () => {
    UNIFORM_SLOTS.forEach((slot, index) => {
      expect(slotOffset(slot)).toBe(index * 16);
    });
    expect(UNIFORM_BYTES).toBe(UNIFORM_SLOTS.length * 16);
  });

  it("declares the same members, in the same order, in WGSL", () => {
    const wgsl = uniformStructWgsl();
    const declared = [...wgsl.matchAll(/^\s{2}(\w+): vec4<f32>,$/gm)].map(
      (m) => m[1],
    );
    expect(declared).toEqual([...UNIFORM_SLOTS]);
  });

  it("uses only vec4 members, so no member needs hand-tracked padding", () => {
    const wgsl = uniformStructWgsl();
    const members = [...wgsl.matchAll(/^\s{2}\w+: ([^,]+),$/gm)].map(
      (m) => m[1],
    );
    expect(members.every((type) => type === "vec4<f32>")).toBe(true);
  });

  it("writes each value where the shader expects to read it", () => {
    const theme: GlobeTheme = {
      ocean: [0.1, 0.2, 0.3, 0.4],
      limb: [0.11, 0.21, 0.31, 0.41],
      grid: [0.12, 0.22, 0.32, 0.42],
      land: [0.13, 0.23, 0.33, 0.43],
      landStroke: [0.14, 0.24, 0.34, 0.44],
      day: [0.15, 0.25, 0.35, 0.45],
      night: [0.16, 0.26, 0.36, 0.46],
      atmosphere: [0.17, 0.27, 0.37, 0.47],
      haze: [0.18, 0.28, 0.38, 0.48],
      label: [0.19, 0.29, 0.39, 0.49],
    };
    const target = new Float32Array(UNIFORM_BYTES / 4);
    writeUniforms(target, {
      widthDev: 800,
      heightDev: 600,
      radiusDev: 280,
      centreXDev: 400,
      centreYDev: 300,
      dpr: 2,
      zoom: 1.5,
      quiet: true,
      sun: [0.1, -0.2, 0.9],
      cameraTrig: [1, 2, 3, 4],
      rotationLngDeg: -139.5,
      subsolar: [0.3, 0.4, 0.5],
      theme,
      gridWidthCss: 0.5,
      limbWidthCss: 1,
      atmosphereReach: 1.06,
      regionFill: [0.5, 0.6, 0.7, 0.8],
      regionStroke: [0.51, 0.61, 0.71, 0.81],
    });

    const at = (slot: UniformSlot): number[] => {
      const start = slotOffset(slot) / 4;
      return Array.from(target.slice(start, start + 4));
    };

    expect(at("viewport")).toEqual([800, 600, 280, 2]);
    expect(at("view")).toEqual([400, 300, 1.5, 1]);
    expect(at("cameraTrig")).toEqual([1, 2, 3, 4]);
    // Stroke widths are scaled to device pixels here, not in the shader.
    const lines = at("lines");
    expect(lines[0]).toBeCloseTo(-139.5, 4);
    expect(lines[1]).toBeCloseTo(1, 6);
    expect(lines[2]).toBeCloseTo(2, 6);
    expect(lines[3]).toBeCloseTo(1.06, 6);
    expect(at("ocean").map((v) => +v.toFixed(4))).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(at("label").map((v) => +v.toFixed(4))).toEqual([
      0.19, 0.29, 0.39, 0.49,
    ]);
    expect(at("regionFill").map((v) => +v.toFixed(4))).toEqual([
      0.5, 0.6, 0.7, 0.8,
    ]);
    expect(at("subsolar").map((v) => +v.toFixed(4))).toEqual([
      0.3, 0.4, 0.5, 0,
    ]);
  });

  it("treats a missing region as fully transparent", () => {
    const target = new Float32Array(UNIFORM_BYTES / 4);
    writeUniforms(target, {
      widthDev: 1,
      heightDev: 1,
      radiusDev: 1,
      centreXDev: 0,
      centreYDev: 0,
      dpr: 1,
      zoom: 1,
      quiet: false,
      sun: [0, 0, 1],
      cameraTrig: [1, 0, 1, 0],
      rotationLngDeg: 0,
      subsolar: [1, 0, 0],
      theme: {
        ocean: [0, 0, 0, 0],
        limb: [0, 0, 0, 0],
        grid: [0, 0, 0, 0],
        land: [0, 0, 0, 0],
        landStroke: [0, 0, 0, 0],
        day: [0, 0, 0, 0],
        night: [0, 0, 0, 0],
        atmosphere: [0, 0, 0, 0],
        haze: [0, 0, 0, 0],
        label: [0, 0, 0, 0],
      },
      gridWidthCss: 0.5,
      limbWidthCss: 1,
      atmosphereReach: 1.06,
    });
    const start = slotOffset("regionFill") / 4;
    expect(Array.from(target.slice(start, start + 8))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("the coverage pass", () => {
  it("writes a one-hot channel mask, so one shader serves all four layers", () => {
    /* `max(dst, 0)` leaves the other channels untouched, which is why there is a
       mask instead of four write-masked pipelines. */
    expect(fillShader()).toContain("return layer.mask;");
    expect(strokeShader()).toContain("return layer.mask * coverage;");
  });

  it("discards the far hemisphere per fragment", () => {
    // A triangle can straddle the limb, so this cannot be a per-draw decision.
    expect(fillShader()).toContain("if (in.depth < 0.0) { discard; }");
    expect(strokeShader()).toContain("if (in.depth < 0.0) { discard; }");
  });
});

describe("premultiplied output", () => {
  it("clamps each channel to its own alpha, as the canvas alpha mode requires", () => {
    /* `alphaMode: "premultiplied"` leaves a channel above its own alpha
       undefined, and the dither can push one there. */
    expect(surfaceShader()).toContain(
      "let rgb = clamp(premult.rgb + vec3<f32>(offset), vec3<f32>(0.0), vec3<f32>(a));",
    );
    for (const build of [markerShader, labelShader, regionOverlayShader]) {
      expect(build()).toMatch(
        /vec4<f32>\([^)]*\balpha\b[^)]*\)|colour\.rgb \* colour\.a/,
      );
    }
  });

  it("mixes the sphere against the glow by coverage, never composites them", () => {
    /* The two do not overlap — the canvas-2D renderer cuts the inner disc out of
       the ring with an even-odd fill. An `over` here lays a full-strength glow
       under the whole globe and roughly doubles its alpha, which reads as a
       darker, more saturated planet on every theme. */
    const source = surfaceShader();
    expect(source).toContain(
      "let blended = mix(premultiply(ring), premultiply(colour), sphereCoverage);",
    );
    expect(source).not.toContain("over(ring,");
  });
});
