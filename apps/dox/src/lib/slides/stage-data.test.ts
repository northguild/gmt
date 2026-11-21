import {
  getPlanetZones,
  resolvePlace,
  setPlanetZones,
  setPoints,
} from "./places";
import { applyStageData, checkStageNames, NO_STAGE_DATA } from "./stage-data";

afterEach(() => {
  setPoints({});
  setPlanetZones([]);
});

describe("applyStageData", () => {
  it("hands the deck's points and planet zones to the camera", () => {
    applyStageData({
      ...NO_STAGE_DATA,
      points: {
        harbour: {
          lng: 1,
          lat: 2,
          label: "Harbour",
          source: "a survey, 1 N 2 E",
        },
      },
      planetZones: ["Asia/Tokyo", "Europe/Helsinki"],
    });
    expect(resolvePlace("harbour")).toMatchObject({
      kind: "point",
      label: "Harbour",
    });
    expect(getPlanetZones()).toEqual(["Asia/Tokyo", "Europe/Helsinki"]);
  });

  it("forgets the last deck's points when a deck has none", () => {
    applyStageData({
      ...NO_STAGE_DATA,
      points: { a: { lng: 0, lat: 0, label: "A", source: "none" } },
    });
    applyStageData(NO_STAGE_DATA);
    expect(() => resolvePlace("a")).toThrow(/Unknown slide place/);
  });

  it("throws on a planet zone the coordinate table lacks", () => {
    expect(() =>
      applyStageData({ ...NO_STAGE_DATA, planetZones: ["Nowhere/Land"] }),
    ).toThrow();
  });
});

describe("checkStageNames", () => {
  const data = {
    ...NO_STAGE_DATA,
    points: {
      harbour: { lng: 1, lat: 2, label: "Harbour", source: "a survey" },
    },
    lapses: { dawn: { zones: ["Asia/Tokyo"] } },
  };

  it("passes the deck's own places, a reveal zone and its lapses", () => {
    expect(() =>
      checkStageNames(
        data,
        { place: "harbour", reveal: "Asia/Tokyo", lapse: "dawn" },
        'Slide "a"',
      ),
    ).not.toThrow();
    expect(() =>
      checkStageNames(data, { place: "Europe/Helsinki" }, "Build 1"),
    ).not.toThrow();
  });

  it("fails on a place the deck does not name", () => {
    expect(() =>
      checkStageNames(data, { place: "harbor" }, 'Slide "a"'),
    ).toThrow(/Unknown slide place/);
  });

  it("fails on a lapse the deck does not define, naming the slide", () => {
    expect(() => checkStageNames(data, { lapse: "dusk" }, 'Slide "a"')).toThrow(
      'Slide "a" names the unknown lapse "dusk"',
    );
  });

  it("checks against the deck it is given, not the one before", () => {
    checkStageNames(data, { place: "harbour" }, "Build 1");
    expect(() =>
      checkStageNames(NO_STAGE_DATA, { place: "harbour" }, "Build 1"),
    ).toThrow(/Unknown slide place/);
  });
});
