/**
 * The Report Time Resolver's METAR half (AV-98, slice 1), against the real library in `dist`.
 * No expected answer is the site's: each is `parseMetarTime` called directly.
 */
import { readFileSync } from "node:fs";
import { aviationLib } from "~/test/aviation-lib";
import type { AviationLib } from "./aviation-lib";
import {
  ANSWER_REASONS,
  CUSTOM_PRESET_ID,
  METAR_PRESETS,
  NOTAM_PRESETS,
  NOTAM_REASONS,
  PERMANENT_TEXT,
  blankNotam,
  buildNotamModel,
  isNotamSeeded,
  matchNotamPreset,
  notamCallsSizerText,
  notamOptionsOf,
  notamPermalinkOf,
  notamPresetState,
  notamWindowOf,
  readNotamArgs,
  readNotamItem,
  type NotamState,
  OUTSIDE_RANGE,
  SLIDER_HINTS,
  SLOT_OFFSETS,
  blankState,
  buildModel,
  buildStrip,
  callsSizerText,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  referenceModel,
  withGroup,
  withReference,
  type MetarState,
} from "./report-time-resolver";

const lib = aviationLib as unknown as AviationLib;

const state = (over: Partial<MetarState>): MetarState => ({
  ...blankState(),
  ...over,
});

const preset = (id: string) => {
  const p = METAR_PRESETS.find((x) => x.id === id);
  if (p === undefined) throw new Error(`no preset ${id}`);
  return p;
};

describe("presets", () => {
  it("has unique ids and never the custom id", () => {
    const ids = METAR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(CUSTOM_PRESET_ID);
  });

  it.each(METAR_PRESETS.map((p) => [p.id, p] as const))(
    "%s: the answer is parseMetarTime called directly",
    (_id, p) => {
      const model = buildModel(lib, presetState(p));
      const direct = lib.parseMetarTime(p.group, p.reference);
      expect(model.answer.answer).toBe(direct === "" ? null : direct);
      expect(model.answer.valid).toBe(
        lib.isValidMetarTime(p.group, p.reference),
      );
    },
  );

  it("matches a preset back from its own state, and any edit leaves it", () => {
    for (const p of METAR_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
    }
    const first = presetState(METAR_PRESETS[0]!);
    expect(matchPreset({ ...first, shift: 5 })).toBe(CUSTOM_PRESET_ID);
    expect(matchPreset(withGroup(first, first.group + "0"))).toBe(
      CUSTOM_PRESET_ID,
    );
  });
});

describe("refusals", () => {
  const reasonOf = (s: MetarState) => buildModel(lib, s).answer.reason;

  it("tells every refusal preset from the others", () => {
    expect(reasonOf(presetState(preset("no-reference")))).toBe("noReference");
    expect(reasonOf(presetState(preset("local-reference")))).toBe(
      "referenceNotInstant",
    );
    expect(reasonOf(presetState(preset("lower-case")))).toBe("lowerCase");
    expect(reasonOf(presetState(preset("no-z")))).toBe("shape");
    expect(reasonOf(presetState(preset("day-32")))).toBe("day32");
    expect(reasonOf(presetState(preset("hour-24")))).toBe("hour24");
  });

  it("marks day 32 and hour 24 only for the preset's own value", () => {
    const p = preset("day-32");
    expect(
      reasonOf(state({ group: p.group, reference: "2024-06-25T12:21:00Z" })),
    ).toBe("shape");
  });

  it("makes the no-reference call with an empty string", () => {
    const m = buildModel(lib, presetState(preset("no-reference")));
    expect(m.answer.answer).toBeNull();
    expect(m.answer.calls[0]).toBe('parseMetarTime("251200Z", ""); // ""');
  });

  it("reads nothing typed as not a refusal, with no call", () => {
    const m = buildModel(lib, blankState());
    expect(m.answer.blank).toBe(true);
    expect(m.answer.reason).toBe("empty");
    expect(m.calls).toEqual([]);
    expect(ANSWER_REASONS.empty).not.toBe("");
  });

  it("never repairs the group before the call", () => {
    const m = buildModel(
      lib,
      state({ group: " 251200Z ", reference: "2024-06-25T12:20:00Z" }),
    );
    expect(m.answer.calls[0]).toContain('parseMetarTime(" 251200Z "');
  });
});

describe("the slider", () => {
  const month = presetState(preset("month-end"));

  it("is bounded by one month either side, in minutes", () => {
    const r = referenceModel(lib, month);
    expect(r.movable).toBe(true);
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeGreaterThan(0);
    expect(r.hint).toBe("moves");
  });

  it("keeps the typed offset and drops a bracketed zone", () => {
    const offset = presetState(preset("offset-reference"));
    const r = referenceModel(lib, { ...offset, shift: 60 });
    expect(r.current.endsWith("+02:00")).toBe(true);
    const zoned = presetState(preset("annotated-reference"));
    const z = referenceModel(lib, { ...zoned, shift: 60 });
    expect(z.current).not.toContain("[");
    expect(z.current.endsWith("+01:00")).toBe(true);
  });

  it("passes the typed reference as typed at a shift of 0", () => {
    const zoned = presetState(preset("annotated-reference"));
    expect(referenceModel(lib, zoned).current).toBe(zoned.reference);
  });

  it("says why it cannot move", () => {
    expect(referenceModel(lib, presetState(preset("no-reference"))).hint).toBe(
      "needsReference",
    );
    expect(
      referenceModel(lib, presetState(preset("local-reference"))).hint,
    ).toBe("cannotMove");
    expect(SLIDER_HINTS.cannotMove).toContain("toOffsetInstant");
  });

  it("keeps a shift inside the bounds", () => {
    const r = referenceModel(lib, { ...month, shift: 10 ** 9 });
    expect(r.shift).toBe(r.max);
  });

  it("resets the shift when the group or the reference changes", () => {
    const moved = { ...month, shift: 90 };
    expect(withGroup(moved, "151200Z").shift).toBe(0);
    expect(withReference(moved, "2024-07-02T00:00:00Z").shift).toBe(0);
  });
});

describe("anchoring", () => {
  it("keeps the seven slots and the ticks fixed at the bounds and at zero", () => {
    const base = presetState(preset("month-end"));
    const r = referenceModel(lib, base);
    const at = (shift: number) => buildModel(lib, { ...base, shift }).strip;
    const [lo, zero, hi] = [at(r.min), at(0), at(r.max)];
    for (const s of [lo, hi]) {
      expect(s.anchor).toBe(zero.anchor);
      expect(s.ticks).toEqual(zero.ticks);
      expect(
        s.slots.map((x) => [x.k, x.month, x.candidate, x.gap, x.at]),
      ).toEqual(
        zero.slots.map((x) => [x.k, x.month, x.candidate, x.gap, x.at]),
      );
    }
    expect(lo.referenceAt).not.toBe(zero.referenceAt);
    expect(hi.referenceAt).not.toBe(zero.referenceAt);
  });

  it("anchors on the answer at the typed reference", () => {
    const p = preset("month-end");
    const m = buildModel(lib, { ...presetState(p), shift: 600 });
    expect(m.strip.anchor).toBe(lib.parseMetarTime(p.group, p.reference));
  });
});

describe("the strip sweep", () => {
  const GROUPS = ["281200Z", "292350Z", "302350Z", "312350Z", "010010Z"];

  function days(year: number): string[] {
    const out: string[] = [];
    for (
      let at = `${year}-01-01T00:00:00Z`;
      at.startsWith(`${year}-`);
      at = lib.addUtc(at, { days: 1 })
    ) {
      out.push(at.split("T")[0]!);
    }
    return out;
  }

  // Only the library's own calls, so the full two years stay quick: the answer at each
  // reference, against the seven `reject` candidates around the answer at the typed one.
  it("finds the answer on exactly one of the seven slots", () => {
    const failures: string[] = [];
    for (const day of [...days(2024), ...days(2025)]) {
      for (const time of ["00:00:00Z", "23:59:00Z"]) {
        const reference = `${day}T${time}`;
        const split = lib.toOffsetInstant(reference)!;
        const lo = lib.diffUtc(
          split.instant,
          lib.addUtc(split.instant, { months: -1 }),
          "minutes",
        )!;
        const hi = lib.diffUtc(
          split.instant,
          lib.addUtc(split.instant, { months: 1 }),
          "minutes",
        )!;
        for (const group of GROUPS) {
          const anchor = lib.parseMetarTime(group, reference);
          const candidates = SLOT_OFFSETS.map((k) =>
            lib.addUtc(anchor, { months: k }, { overflow: "reject" }),
          );
          for (const shift of [lo, 0, hi]) {
            const moved = lib.addUtc(split.instant, { minutes: shift });
            const answer = lib.parseMetarTime(group, moved);
            const hits = candidates.filter(
              (c) => c !== "" && lib.areUtcEqual(c, answer),
            ).length;
            if (hits !== 1)
              failures.push(`${group} ${reference} n=${shift}: ${hits}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("draws exactly one chosen slot through the model around each month end", () => {
    const failures: string[] = [];
    for (const day of [
      "2024-02-29",
      "2024-03-01",
      "2024-04-30",
      "2024-05-01",
      "2025-02-28",
      "2025-03-01",
      "2024-12-31",
      "2025-01-01",
    ]) {
      for (const group of GROUPS) {
        const base = state({ group, reference: `${day}T23:59:00Z` });
        const r = referenceModel(lib, base);
        for (const shift of [r.min, 0, r.max]) {
          const m = buildModel(lib, { ...base, shift });
          const hits = m.strip.slots.filter((s) => s.chosen).length;
          if (hits !== 1 || m.strip.beyond)
            failures.push(`${group} ${day} n=${shift}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("gaps", () => {
  it("names the month that lacks the day", () => {
    const p = preset("february-31");
    const strip = buildModel(lib, presetState(p)).strip;
    const feb = strip.slots.find(
      (s) => s.gap !== null && s.gap.includes("Feb"),
    );
    expect(feb?.gap).toBe("no 31 in Feb");
    expect(feb?.candidate).toBeNull();
    expect(strip.slots).toHaveLength(SLOT_OFFSETS.length);
  });

  it("names the months outside the instant range", () => {
    const m = buildModel(
      lib,
      state({ group: "131200Z", reference: "+275760-09-13T00:00:00Z" }),
    );
    expect(m.strip.slots.some((s) => s.gap === OUTSIDE_RANGE)).toBe(true);
  });

  it("reads a beyond-the-strip answer when no slot holds it", () => {
    const stub = {
      ...lib,
      areUtcEqual: () => false,
    } as unknown as AviationLib;
    const base = presetState(preset("month-end"));
    const answer = lib.parseMetarTime(base.group, base.reference);
    const strip = buildStrip(stub, answer, answer, base.reference);
    expect(strip.beyond).toBe(true);
    expect(strip.chosenK).toBeNull();
    expect(strip.slots.every((s) => !s.chosen)).toBe(true);
    expect(strip.drawn).toBe(true);
  });

  it("draws seven empty slots and no marks without an answer", () => {
    const strip = buildStrip(lib, "", null, null);
    expect(strip.drawn).toBe(false);
    expect(strip.slots).toHaveLength(7);
    expect(strip.slots.every((s) => s.candidate === null && !s.chosen)).toBe(
      true,
    );
  });
});

describe("arguments", () => {
  it("seeds from a preset id, a group, a reference and a shift", () => {
    expect(readArgs({ metarPreset: "tie" })).toEqual(
      presetState(preset("tie")),
    );
    const s = readArgs({ group: "251200Z", ref: "x", shift: "-30" });
    expect(s).toEqual({ group: "251200Z", reference: "x", shift: -30 });
    expect(readArgs({ group: "251200Z", shift: 5 }).shift).toBe(5);
  });

  it("opens a chat call with the reference blank, never now", () => {
    expect(readArgs({ group: "251200Z" }).reference).toBe("");
  });

  it("knows when it is seeded", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ group: "" })).toBe(true);
  });

  it("round-trips through the permalink, an empty reference included", () => {
    expect(permalinkOf(presetState(preset("tie")))).toEqual({
      metarPreset: "tie",
    });
    const custom = state({ group: "251200Z", reference: "", shift: 0 });
    const link = permalinkOf(custom);
    expect(readArgs(link as never)).toEqual(custom);
    const moved = state({
      group: "251200Z",
      reference: "2024-06-25T12:20:00Z",
      shift: -45,
    });
    expect(readArgs(permalinkOf(moved) as never)).toEqual(moved);
  });
});

describe("what the model never does", () => {
  it("never reads the clock", () => {
    const now = vi.spyOn(Date, "now");
    const temporal = (
      globalThis as { Temporal?: { Now: Record<string, unknown> } }
    ).Temporal;
    const spies = temporal
      ? Object.keys(temporal.Now).map((k) =>
          vi.spyOn(temporal.Now as Record<string, () => unknown>, k),
        )
      : [];
    try {
      for (const p of METAR_PRESETS) buildModel(lib, presetState(p));
      expect(now).not.toHaveBeenCalled();
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("never cuts or matches the group", () => {
    const source = readFileSync(
      new URL("./report-time-resolver.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/\.slice\(|\.substring\(|\.substr\(|\.match\(/);
    expect(source).not.toMatch(
      /group\.(split|replace|trim)\(|\/[^/\n]+\/\.test\(state\.group/,
    );
  });

  it("sizes the calls frames from the widest reading", () => {
    expect(callsSizerText("answer").split("\n").length).toBeGreaterThan(3);
    expect(callsSizerText("strip").split("\n").length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Section 2: NOTAM validity
// ---------------------------------------------------------------------------

const notam = (over: Partial<NotamState>): NotamState => ({
  ...blankNotam(),
  ...over,
});

const npreset = (id: string) => {
  const p = NOTAM_PRESETS.find((x) => x.id === id);
  if (p === undefined) throw new Error(`no NOTAM preset ${id}`);
  return p;
};

describe("the NOTAM presets", () => {
  it.each(NOTAM_PRESETS.map((p) => [p.id, p] as const))(
    "%s shows what parseNotamValidity answers, item by item",
    (_id, p) => {
      const m = buildNotamModel(lib, notamPresetState(p));
      const options =
        p.window === ""
          ? {}
          : {
              yearWindow: p.window === "rolling" ? "rolling" : Number(p.window),
            };
      expect(m.b.value).toEqual(
        lib.parseNotamValidity(p.itemB, options as never),
      );
      expect(m.c.value).toEqual(
        lib.parseNotamValidity(p.itemC, options as never),
      );
    },
  );

  it("each preset is matched by its own state, and a changed field is custom", () => {
    for (const p of NOTAM_PRESETS) {
      expect(matchNotamPreset(notamPresetState(p))).toBe(p.id);
    }
    expect(
      matchNotamPreset({
        ...notamPresetState(npreset("permanent")),
        itemB: "x",
      }),
    ).toBe(CUSTOM_PRESET_ID);
  });
});

describe("the NOTAM window", () => {
  it("sends no yearWindow for a blank or non-integer first year", () => {
    expect(notamOptionsOf(notam({ first: "" }))).toEqual({});
    expect(notamOptionsOf(notam({ first: "20x0" }))).toEqual({});
    expect(notamOptionsOf(notam({ first: "2000" }))).toEqual({
      yearWindow: 2000,
    });
    expect(notamOptionsOf(notam({ mode: "rolling" }))).toEqual({
      yearWindow: "rolling",
    });
  });

  it("with no window calls without one, prints none, and refuses PERM too", () => {
    const m = buildNotamModel(lib, notamPresetState(npreset("no-window")));
    expect(m.b.value).toBeNull();
    expect(m.c.value).toBeNull();
    expect(m.b.reason).toBe("noWindow");
    expect(m.c.reason).toBe("noWindow");
    expect(m.calls.join("\n")).not.toContain("yearWindow");
    expect(m.calls[0]).toContain('parseNotamValidity("2506151200", {});');
  });

  it("reads the same two digits in the window it is given", () => {
    const a = readNotamItem(
      lib,
      notam({ itemB: "9912312359", first: "1950" }),
      "b",
    );
    const b = readNotamItem(
      lib,
      notam({ itemB: "9912312359", first: "2000" }),
      "b",
    );
    expect(a.value).not.toEqual(b.value);
  });
});

describe("the NOTAM reasons", () => {
  it("makes no call for a blank item", () => {
    const r = readNotamItem(lib, notam({ first: "2000" }), "b");
    expect(r.blank).toBe(true);
    expect(r.calls).toEqual([]);
    expect(r.reason).toBe("emptyB");
    expect(readNotamItem(lib, notam({}), "c").reason).toBe("emptyC");
  });

  it("shows EST and PERM in item B) as the library read them, with the item C) only note", () => {
    const m = buildNotamModel(lib, notamPresetState(npreset("est-in-b")));
    expect(m.b.value).toEqual(
      lib.parseNotamValidity("1407031230EST", { yearWindow: 2000 }),
    );
    expect(m.b.reason).toBe("markedInB");
    expect(m.c.reason).toBe("permanent");
    expect(NOTAM_REASONS.markedInB).toMatch(/item C\) only/);
  });

  it("refuses lower case perm for its case, and prints perm as typed", () => {
    const r = readNotamItem(lib, notam({ itemC: "perm", first: "2000" }), "c");
    expect(r.value).toBeNull();
    expect(r.reason).toBe("lowerCase");
    expect(r.calls[0]).toContain('"perm"');
    expect(r.calls.join("\n")).toContain('isValidNotamValidity("PERM"');
  });

  it("tells an estimate, a permanent and a plain instant apart by the library's own fields", () => {
    const o = { first: "2000" };
    const est = readNotamItem(
      lib,
      notam({ ...o, itemC: "1407031230EST" }),
      "c",
    );
    const plain = readNotamItem(lib, notam({ ...o, itemC: "1407031230" }), "c");
    const perm = readNotamItem(lib, notam({ ...o, itemC: "PERM" }), "c");
    expect([est.reason, plain.reason, perm.reason]).toEqual([
      "estimated",
      "read",
      "permanent",
    ]);
    expect(est.value).toMatchObject({ kind: "instant", estimated: true });
    expect(plain.value).toMatchObject({ kind: "instant", estimated: false });
    expect(perm.value).toEqual({ kind: "permanent" });
    expect(PERMANENT_TEXT).toBe("permanent, no date");
  });

  it("names a preset's own fault only for that exact value", () => {
    expect(
      readNotamItem(lib, notam({ itemC: "2506152400", first: "2000" }), "c")
        .reason,
    ).toBe("end2400");
    expect(
      readNotamItem(lib, notam({ itemC: "2506152401", first: "2000" }), "c")
        .reason,
    ).toBe("shape");
  });
});

describe("the NOTAM args and permalink", () => {
  it("round-trips a preset through its id", () => {
    const state = notamPresetState(npreset("rolling"));
    const link = notamPermalinkOf(state);
    expect(link).toEqual({ notamPreset: "rolling" });
    expect(readNotamArgs(link)).toEqual(state);
  });

  it("round-trips custom fields exactly as typed", () => {
    const state = notam({ itemB: " 2506151200", itemC: "perm", first: "19" });
    const link = notamPermalinkOf(state);
    expect(link).toEqual({ b: " 2506151200", c: "perm", window: "19" });
    expect(readNotamArgs(link)).toEqual(state);
  });

  it("opens a call with no window with the window blank", () => {
    const state = readNotamArgs({ b: "2506151200", c: "PERM" });
    expect(notamWindowOf(state)).toBe("");
  });

  it("takes a numeric window as its text, and rolling as rolling", () => {
    expect(readNotamArgs({ window: 1950 }).first).toBe("1950");
    expect(readNotamArgs({ window: "rolling" }).mode).toBe("rolling");
  });

  it("is seeded by NOTAM keys alone, and METAR keys do not seed it", () => {
    expect(isNotamSeeded({})).toBe(false);
    expect(isNotamSeeded({ window: "" })).toBe(true);
    expect(isNotamSeeded({ notamPreset: "permanent" })).toBe(true);
    expect(isSeeded({ metarPreset: "month-end" })).toBe(true);
    expect(isSeeded({ notamPreset: "permanent" } as never)).toBe(false);
  });

  it("sizes the NOTAM calls frame from the widest reading", () => {
    expect(notamCallsSizerText().split("\n").length).toBeGreaterThan(3);
  });
});
