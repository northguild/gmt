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
import { createCamera, unproject, wrapLng } from "../camera";
import { G, P, RIM, rayHit, type Vec3 } from "../pinhole";
import {
  CIVIL_TWILIGHT,
  GAMMA,
  HAZE_START,
  IMAGERY_AMBIENT,
  IMAGERY_FADE_END_ZOOM,
  IMAGERY_FADE_START_ZOOM,
  TWILIGHT_END,
} from "../shading";
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

describe("imagery", () => {
  /**
   * The Earth imagery (#293) is drawn by the surface pass alone, and every rule
   * about it that can be read off the source is checked here. Whether it looks
   * right is `scripts/globe-smoke.mjs`'s question.
   */
  const source = surfaceShader();
  const code = stripComments(source);

  it("carries the zoom fade and the ambient floor from shading.ts", () => {
    for (const [name, value] of [
      ["IMAGERY_FADE_START_ZOOM", IMAGERY_FADE_START_ZOOM],
      ["IMAGERY_FADE_END_ZOOM", IMAGERY_FADE_END_ZOOM],
      ["IMAGERY_AMBIENT", IMAGERY_AMBIENT],
    ] as const) {
      const match = new RegExp(`const ${name}: f32 = ([^;]+);`).exec(source);
      expect(match, `${name} is declared`).not.toBeNull();
      expect(Number.parseFloat(match![1])).toBeCloseTo(value, 15);
    }
  });

  it("binds the imagery texture and its sampler beside the coverage target", () => {
    expect(source).toContain(
      "@group(0) @binding(2) var imagery: texture_2d<f32>;",
    );
    expect(source).toContain(
      "@group(0) @binding(3) var imagerySampler: sampler;",
    );
  });

  it("samples with explicit gradients, never with implicit derivatives", () => {
    /* The sample sits inside the "is this pixel on the sphere" branch, and
       `textureSample` must be called in uniform control flow. The analytic
       gradients from `geoAt` are also exact across the antimeridian, where
       screen-space derivatives of a wrapping longitude would read a 360° jump
       and pick the smallest mip — a one-pixel seam of the whole planet's
       average colour. */
    expect(code).toContain("textureSampleGrad(imagery, imagerySampler,");
    expect(code).not.toMatch(/\btextureSample\s*\(/);
  });

  it("maps the image with 180°W at u = 0 and the north pole at v = 0", () => {
    expect(code).toContain(
      "return vec2<f32>((lngDeg + 180.0) / 360.0, (90.0 - latDeg) / 180.0);",
    );
  });

  it("re-encodes the sampled colour, since the texture is stored as sRGB", () => {
    /* An `-srgb` texture filters and builds its mips in linear light and
       returns linear values; the rest of the shader composites encoded sRGB,
       as a 2D canvas does. */
    expect(code).toContain("srgbEncode(");
  });

  it("leaves the flat globe untouched wherever the imagery weight is zero", () => {
    /* That is the whole canvas-2D parity story once zoomed in: with no
       imagery, every layer below has to come out exactly as before. */
    expect(code).toContain("if (imageryW > 0.0) {");
    expect(code).toContain(
      "let vectorW = 1.0 - imageryW * (1.0 - g.imagery.z * imageryLight(elevation));",
    );
    expect(code).toContain(
      "let dayA = g.day.a * dayFactor(elevation) * (1.0 - imageryW);",
    );
    expect(code).toContain("g.land.a * texel.r * vectorW");
    expect(code).toContain("g.landStroke.a * texel.g * vectorW");
  });

  it("keeps the theme's share of the vector land over the imagery", () => {
    /* The vector overlay: land fill and coastline fade with the imagery down
       to `g.imagery.z` of their strength, not to nothing. The day wash does
       not stay — over a photograph that carries its own light it reads as
       haze — so it fades out fully, as before. */
    expect(code).toContain("g.land.a * texel.r * vectorW");
    expect(code).toContain("g.landStroke.a * texel.g * vectorW");
    expect(code).not.toMatch(/dayFactor\(elevation\) \* vectorW/);
  });

  it("draws the grid only where the photograph gives way to the flat globe", () => {
    /* The grid is a map device. Over the photograph of the Earth it reads as
       a wireframe, so it fades out with the imagery and comes back as the
       zoom fades the photo to the vector map. With no imagery (canvas 2D,
       the light theme, raised contrast) it is drawn as before. */
    expect(code).toContain(
      "g.grid.a * gridCoverage * quietFactor * (1.0 - imageryW)",
    );
  });

  it("lights the vector overlay like the photograph under it", () => {
    /* Drawn after the night wash, an unlit overlay keeps the night side's land
       as bright as the day side's and blurs the terminator. Scaled by
       `imageryLight`, it dims to the photograph's own night-side level. */
    expect(code).toContain("g.imagery.z * imageryLight(elevation)");
  });

  it("can recolour the photograph onto the theme's own ramp", () => {
    /* The duotone: the photo's brightness mapped from the night colour
       through the ocean teal and the day cyan to the label ice, mixed in by
       `g.imagery.w`. At 0 the photograph keeps its own colours. The dark end
       is not the casing's colour: that one is tuned for contrast, and
       retuning it must not recolour the Earth. */
    expect(code).toContain("fn duotone(");
    expect(code).toContain("mix(photo, duotone(photo), g.imagery.w)");
    expect(code).toContain("mix(g.night.rgb, g.ocean.rgb,");
    expect(code).not.toMatch(/mix\(g\.casing\.rgb/);
  });

  it("draws every casing at full strength, on every globe", () => {
    /* The casing is what holds every ink to its contrast floor whatever lies
       behind it — the photo, the flat globe's lit limb, or a mix of both
       partway through the zoom fade — so it never fades and never waits for
       the imagery. `globe-contrast.test.ts` measures the inks against it. */
    for (const build of [
      surfaceShader,
      regionOverlayShader,
      markerShader,
      labelShader,
    ]) {
      const shader = stripComments(build());
      expect(shader).toContain("g.casing.a *");
      expect(shader).not.toMatch(/g\.casing\.a \* [^;]*imageryW/);
      expect(shader).not.toContain("casingWeight");
    }
    // The outline's casing is the region stroke dilated, in both passes.
    expect(stripComments(surfaceShader())).toContain("regionCasing(");
    expect(stripComments(regionOverlayShader())).toContain("regionCasing(");
    /* Neither sprite shader depends on the imagery any more: the one mention
       left is the shared helpers' definition of it, never a call. */
    for (const build of [markerShader, labelShader]) {
      expect(stripComments(build()).match(/imageryWeight\(\)/g)).toHaveLength(
        1,
      );
    }
  });

  it("moves a ringed marker's label clear of its ring", () => {
    /* The label's halo would otherwise cover the right half of the selection
       ring — the one signal of which zone is selected. */
    const label = stripComments(labelShader());
    expect(label).toContain("@location(4) ringShift: f32,");
    expect(label).toContain("offset + vec2<f32>(ringShift, 0.0)");
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
      casing: [0.2, 0.3, 0.4, 0.5],
      imagery: 1,
      vectorOverlay: 0.4,
      imageryDuotone: 0.6,
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
      imagery: 0.75,
      casingWidthCss: 1,
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
    // The weight as given, the casing in device pixels, the vector overlay.
    expect(at("imagery").map((v) => +v.toFixed(4))).toEqual([
      0.75, 2, 0.4, 0.6,
    ]);
    expect(at("casing").map((v) => +v.toFixed(4))).toEqual([
      0.2, 0.3, 0.4, 0.5,
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
        casing: [0, 0, 0, 0],
        imagery: 0,
        vectorOverlay: 0,
        imageryDuotone: 0,
      },
      gridWidthCss: 0.5,
      limbWidthCss: 1,
      atmosphereReach: 1.06,
      imagery: 0,
      casingWidthCss: 1,
    });
    const start = slotOffset("regionFill") / 4;
    expect(Array.from(target.slice(start, start + 8))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("the entrance exposure", () => {
  const input = (exposure?: number) => {
    const target = new Float32Array(UNIFORM_BYTES / 4);
    const zero = [0, 0, 0, 0] as [number, number, number, number];
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
        ocean: zero,
        limb: zero,
        grid: zero,
        land: zero,
        landStroke: zero,
        day: zero,
        night: zero,
        atmosphere: zero,
        haze: zero,
        label: zero,
        casing: zero,
        imagery: 0,
        vectorOverlay: 0,
        imageryDuotone: 0,
      },
      gridWidthCss: 0.5,
      limbWidthCss: 1,
      atmosphereReach: 1.06,
      imagery: 0,
      casingWidthCss: 1,
      ...(exposure === undefined ? {} : { exposure }),
    });
    const start = slotOffset("entrance") / 4;
    return Array.from(target.slice(start, start + 4));
  };

  it("is written to its own slot, and is 1 unless a host asks for less", () => {
    expect(UNIFORM_SLOTS.at(-1)).toBe("entrance");
    expect(input()).toEqual([1, 0, 0, 0]);
    expect(input(0.25)).toEqual([0.25, 0, 0, 0]);
  });

  it("dims every overlay and the rim in the surface pass", () => {
    const source = stripComments(surfaceShader());
    for (const layer of [
      "g.grid.a",
      "g.land.a",
      "g.landStroke.a",
      "g.regionFill.a",
      "g.casing.a",
      "g.regionStroke.a",
      "g.limb.a",
    ]) {
      const use = source
        .split("\n")
        .filter((line) => line.includes(layer) && line.includes("*"));
      expect(
        use.some((line) => line.includes("exposure")),
        layer,
      ).toBe(true);
    }
    expect(source).toContain("ring.a * exposure");
  });

  it("lights the disc from the night colour, and leaves it alone at full exposure", () => {
    const source = stripComments(surfaceShader());
    expect(source).toMatch(
      /if \(exposure\(\) < 1\.0\) \{[^}]*mixStraight\(vec4<f32>\(g\.night\.rgb, 1\.0\), colour, exposure\(\)\)/,
    );
  });

  it("dims the region overlay, markers and labels", () => {
    for (const shader of [regionOverlayShader, markerShader, labelShader]) {
      expect(stripComments(shader())).toContain("exposure()");
    }
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

/** The body of a WGSL `fn name(`, from its signature to the next top-level `}`. */
function fnBody(source: string, name: string): string {
  const start = source.indexOf(`fn ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end);
}

/** `geoAt`'s normal and derivatives, written once as plain TS: u right, v down. */
function analytic(u: number, v: number): { n: Vec3; du: Vec3; dv: Vec3 } {
  const rho2 = u * u + v * v;
  const w = Math.sqrt(Math.max(0, 1 - rho2));
  const safeW = Math.max(w, 1e-4);
  const D = 1 + rho2 / (G * G);
  const t = (P - w) / D;
  const dtdu = ((u / safeW) * D - (P - w) * ((2 * u) / (G * G))) / (D * D);
  const dtdv = ((v / safeW) * D - (P - w) * ((2 * v) / (G * G))) / (D * D);
  return {
    n: [P - t, (t * u) / G, (-t * v) / G],
    du: [-dtdu, (dtdu * u + t) / G, (-dtdu * v) / G],
    dv: [-dtdv, (dtdv * u) / G, -(dtdv * v + t) / G],
  };
}

/**
 * The whole `geoAt` chain as plain TS, from the same `analytic` terms: latitude un-rotation,
 * then longitude and latitude with their gradients, all per radius and in degrees.
 */
function chain(u: number, v: number, c: number, s: number) {
  const { n, du, dv } = analytic(u, v);
  const x1 = n[0] * c + n[2] * s;
  const y1 = n[1];
  const z1 = n[2] * c - n[0] * s;
  const grad = (d: Vec3) => {
    const dx1 = d[0] * c + d[2] * s;
    const dy1 = d[1];
    const dz1 = d[2] * c - d[0] * s;
    const horizontal = Math.max(x1 * x1 + y1 * y1, 1e-9);
    const cosLat = Math.sqrt(Math.max(1 - z1 * z1, 1e-9));
    return [
      (((x1 * dy1 - y1 * dx1) / horizontal) * 180) / Math.PI,
      ((dz1 / cosLat) * 180) / Math.PI,
    ] as const;
  };
  return {
    lng: (Math.atan2(y1, x1) * 180) / Math.PI,
    lat: (Math.asin(Math.min(1, Math.max(-1, z1))) * 180) / Math.PI,
    du: grad(du),
    dv: grad(dv),
  };
}

describe("the pinhole", () => {
  const surface = stripComments(surfaceShader());

  it("carries P, G and RIM from pinhole.ts", () => {
    const expected = { PINHOLE_P: P, PINHOLE_G: G, PINHOLE_RIM: RIM };
    for (const [name, value] of Object.entries(expected)) {
      const match = new RegExp(`const ${name}: f32 = ([0-9.eE+-]+);`).exec(
        surface,
      );
      expect(match, name).not.toBeNull();
      expect(Number(match?.[1])).toBeCloseTo(value, 15);
    }
  });

  it("restates no camera number", () => {
    for (const build of Object.values(SHADERS)) {
      /* The three constants themselves carry the digits; everything else must not. */
      const code = stripComments(build()).replace(
        /const PINHOLE_\w+: f32 = [^;]+;/g,
        "",
      );
      for (const literal of ["6.61", "6.53", "35786", "6378"]) {
        expect(code).not.toContain(literal);
      }
    }
  });

  it("has no orthographic depth left", () => {
    for (const build of Object.values(SHADERS)) {
      const code = stripComments(build());
      expect(code).not.toContain("sqrt(max(0.0, 1.0 - u * u - v * v))");
      const outside = code.includes("fn pinholeNormal(")
        ? code.replace(fnBody(code, "pinholeNormal"), "")
        : code;
      expect(outside).not.toContain("1.0 - u * u - v * v");
    }
  });

  it("projectGeo divides by the camera distance", () => {
    const body = fnBody(surface, "projectGeo");
    expect(body).toContain("PINHOLE_P - towardsViewer");
    expect(body).toContain("towardsViewer - PINHOLE_RIM");
  });

  it("computes the hit once per pixel and hands it to geoAt", () => {
    expect(fnBody(surface, "geoAt")).not.toContain("pinholeNormal(");
    expect(fnBody(surface, "geoAt")).toContain("hit: vec3<f32>");
    expect(fnBody(surface, "fs").match(/pinholeNormal\(/g)).toHaveLength(1);
    expect(fnBody(surface, "fs")).toContain("geoAt(u, v, radius, normal)");
    expect(surface.match(/fn pinholeNormal\(/g)).toHaveLength(1);
  });

  it("maps the normal to shading axes for the elevation", () => {
    const body = fnBody(surface, "fs");
    expect(body).toContain("vec3<f32>(normal.y, -normal.z, normal.x)");
  });

  it("pulls past-the-limb pixels onto the unit circle before the hit", () => {
    const body = fnBody(surface, "fs");
    expect(body).toContain("u = u0 / d0;");
    expect(body).toContain("v = v0 / d0;");
  });

  it("puts the rim normal's towards-viewer component at RIM on the circle", () => {
    expect(analytic(1, 0).n[0]).toBeCloseTo(RIM, 12);
    expect(analytic(0, 1).n[0]).toBeCloseTo(RIM, 12);
    expect(analytic(Math.SQRT1_2, Math.SQRT1_2).n[0]).toBeCloseTo(RIM, 12);
  });

  it("transcribes geoAt's latitude un-rotation and derivative lines verbatim", () => {
    const body = fnBody(surface, "geoAt");
    for (const line of [
      "let x1 = hit.x * c + hit.z * s;",
      "let y1 = hit.y;",
      "let z1 = hit.z * c - hit.x * s;",
      "let dtdu = ((u / safeW) * D - (PINHOLE_P - w) * (2.0 * u / (PINHOLE_G * PINHOLE_G))) / (D * D);",
      "let dtdv = ((v / safeW) * D - (PINHOLE_P - w) * (2.0 * v / (PINHOLE_G * PINHOLE_G))) / (D * D);",
      "let dXdu = -dtdu;",
      "let dXdv = -dtdv;",
      "let dYdu = (dtdu * u + t) / PINHOLE_G;",
      "let dYdv = dtdv * u / PINHOLE_G;",
      "let dZdu = -dtdu * v / PINHOLE_G;",
      "let dZdv = -(dtdv * v + t) / PINHOLE_G;",
      "let dx1du = dXdu * c + dZdu * s;",
      "let dx1dv = dXdv * c + dZdv * s;",
      "let dz1du = dZdu * c - dXdu * s;",
      "let dz1dv = dZdv * c - dXdv * s;",
      "let dLngdu = (x1 * dy1du - y1 * dx1du) / horizontal;",
      "let dLngdv = (x1 * dy1dv - y1 * dx1dv) / horizontal;",
      "let dLatdu = dz1du / cosLat;",
      "let dLatdv = dz1dv / cosLat;",
    ]) {
      expect(body).toContain(line);
    }
  });

  it("transcribes pinholeNormal and geoAt's ray terms verbatim", () => {
    const normal = fnBody(surface, "pinholeNormal");
    for (const line of [
      "let rho2 = u * u + v * v;",
      "let w = sqrt(max(0.0, 1.0 - rho2));",
      "let t = (PINHOLE_P - w) / (1.0 + rho2 / (PINHOLE_G * PINHOLE_G));",
      "return vec3<f32>(PINHOLE_P - t, t * u / PINHOLE_G, -t * v / PINHOLE_G);",
    ]) {
      expect(normal).toContain(line);
    }
    const geo = fnBody(surface, "geoAt");
    for (const line of [
      "let rho2 = u * u + v * v;",
      "let w = sqrt(max(0.0, 1.0 - rho2));",
      "let safeW = max(w, 1e-4);",
      "let D = 1.0 + rho2 / (PINHOLE_G * PINHOLE_G);",
      "let t = PINHOLE_P - hit.x;",
      "let horizontal = max(x1 * x1 + y1 * y1, 1e-9);",
      "let cosLat = sqrt(max(1.0 - z1 * z1, 1e-9));",
    ]) {
      expect(geo).toContain(line);
    }
  });
});

describe("the per-pixel Jacobian the WGSL transcribes", () => {
  it("agrees with central differences of rayHit at 200 seeded pixels", () => {
    let seed = 20260611;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const h = 1e-6;
    const hit = (u: number, v: number): Vec3 => {
      const out: Vec3 = [0, 0, 0];
      /* rayHit takes v up; the shader's v is down. */
      expect(rayHit(u, -v, out)).toBe(true);
      return out;
    };
    for (let i = 0; i < 200; i++) {
      const rho = Math.sqrt(next()) * 0.98;
      const angle = next() * 2 * Math.PI;
      const u = rho * Math.cos(angle);
      const v = rho * Math.sin(angle);
      const { n, du, dv } = analytic(u, v);
      const here = hit(u, v);
      const uPlus = hit(u + h, v);
      const uMinus = hit(u - h, v);
      const vPlus = hit(u, v + h);
      const vMinus = hit(u, v - h);
      for (let k = 0; k < 3; k++) {
        expect(n[k]).toBeCloseTo(here[k]!, 12);
        const fdU = (uPlus[k]! - uMinus[k]!) / (2 * h);
        const fdV = (vPlus[k]! - vMinus[k]!) / (2 * h);
        expect(Math.abs(du[k]! - fdU)).toBeLessThanOrEqual(
          1e-5 * Math.max(1, Math.abs(fdU)),
        );
        expect(Math.abs(dv[k]! - fdV)).toBeLessThanOrEqual(
          1e-5 * Math.max(1, Math.abs(fdV)),
        );
      }
    }
  });

  it("agrees with finite differences of camera.unproject through the whole chain", () => {
    const camera = createCamera([20, 35]);
    camera.radius = 100;
    const R = camera.radius;
    const at = (u: number, v: number) => {
      const out = unproject(
        camera,
        camera.centreX + u * R,
        camera.centreY + v * R,
      );
      expect(out).not.toBeNull();
      return out!;
    };
    const h = 1e-5;
    for (const [u, v] of [
      [0, 0],
      [0.3, -0.4],
      [-0.6, 0.2],
      [0.1, 0.8],
      [-0.5, -0.5],
    ] as const) {
      const { lng, lat, du, dv } = chain(u, v, camera.cosPhi, camera.sinPhi);
      const [gLng, gLat] = at(u, v);
      expect(wrapLng(lng - camera.rotation[0] - gLng)).toBeCloseTo(0, 6);
      expect(lat).toBeCloseTo(gLat, 6);
      const [uPlus, uMinus] = [at(u + h, v), at(u - h, v)];
      const [vPlus, vMinus] = [at(u, v + h), at(u, v - h)];
      const fd = (p: [number, number], m: [number, number]) =>
        [wrapLng(p[0] - m[0]) / (2 * h), (p[1] - m[1]) / (2 * h)] as const;
      const fdU = fd(uPlus, uMinus);
      const fdV = fd(vPlus, vMinus);
      for (let k = 0; k < 2; k++) {
        expect(Math.abs(du[k]! - fdU[k]!)).toBeLessThanOrEqual(
          1e-3 * Math.max(1, Math.abs(fdU[k]!)),
        );
        expect(Math.abs(dv[k]! - fdV[k]!)).toBeLessThanOrEqual(
          1e-3 * Math.max(1, Math.abs(fdV[k]!)),
        );
      }
    }
  });
});
