import { aviationLib } from "~/test/aviation-lib";
import { railLib } from "~/test/rail-lib";
import {
  collectGtfsFacts,
  foldGtfs,
  READ_PRESETS,
  readGtfs,
  WRITE_PRESETS,
  writeGtfs,
  type GtfsState,
} from "./gtfs-time-reader";
import {
  buildModel as buildMetarModel,
  buildNotamModel,
  METAR_PRESETS,
  NOTAM_PRESETS,
  notamPresetState,
  presetState as metarPresetState,
} from "./report-time-resolver";
import {
  buildModel as buildSsimModel,
  presetState as ssimPresetState,
  readPattern,
  readSsim,
  SSIM_PRESETS,
  writeSsim,
} from "./ssim-date-reader";

const gtfsState = (read: number, write: number): GtfsState => {
  const r = READ_PRESETS[read];
  const w = WRITE_PRESETS[write];
  if (!r || !w) throw new Error("no preset");
  return { value: r.value, seconds: w.seconds, dayOverflow: w.dayOverflow };
};

describe("collectGtfsFacts", () => {
  it.each([
    [0, 0],
    [1, 1],
    [3, 4],
    [7, 4],
  ])(
    "holds the three readings the page draws for read %i and write %i",
    (read, write) => {
      const state = gtfsState(read, write);
      const facts = collectGtfsFacts(railLib, state);
      const readBack = readGtfs(railLib, state.value);
      expect(facts.read).toEqual(readBack);
      expect(facts.fold).toEqual(foldGtfs(railLib, state.value, readBack));
      expect(facts.write).toEqual(
        writeGtfs(railLib, state.seconds, state.dayOverflow),
      );
    },
  );

  it("is JSON-safe", () => {
    const facts = collectGtfsFacts(railLib, gtfsState(0, 0));
    expect(JSON.parse(JSON.stringify(facts))).toEqual(facts);
  });
});

describe("the SSIM date reader's model", () => {
  it.each(SSIM_PRESETS.map((p) => [p.id, p] as const))(
    "is the three readings the page draws, and JSON-safe, for %s",
    (_id, preset) => {
      const state = ssimPresetState(preset);
      const model = buildSsimModel(aviationLib, state);
      expect(model.read).toEqual(readSsim(aviationLib, state));
      expect(model.pattern).toEqual(
        readPattern(aviationLib, state, model.read),
      );
      expect(model.write).toEqual(writeSsim(aviationLib, state));
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    },
  );
});

describe("the report time resolver's models", () => {
  it.each(METAR_PRESETS.map((p) => [p.id, p] as const))(
    "carry no bigint and survive JSON for the METAR preset %s",
    (_id, preset) => {
      const model = buildMetarModel(aviationLib, metarPresetState(preset));
      expect(() => JSON.stringify(model)).not.toThrow();
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    },
  );

  it.each(NOTAM_PRESETS.map((p) => [p.id, p] as const))(
    "carry no bigint and survive JSON for the NOTAM preset %s",
    (_id, preset) => {
      const model = buildNotamModel(aviationLib, notamPresetState(preset));
      expect(() => JSON.stringify(model)).not.toThrow();
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    },
  );
});
