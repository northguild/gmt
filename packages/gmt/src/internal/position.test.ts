import * as root from "../index";
import * as types from "../types";
import { hostileProxy, revokedProxy } from "../test/hostileValues";
import type { Position } from "./position";
import { readPosition } from "./position";

// Type rows are checked by `pnpm typecheck`. Each is a used expression with `satisfies`, because
// `noUnusedLocals` would satisfy a `@ts-expect-error` above an unused local on its own.

describe("Position (type)", () => {
  it("T1 accepts latitude and longitude", () => {
    expect(
      readPosition({
        latitude: 35.68,
        longitude: 139.77,
      } satisfies Position),
    ).toStrictEqual({ latitude: 35.68, longitude: 139.77 });
  });

  it("T2 accepts an ellipsoidal height", () => {
    expect(
      readPosition({
        latitude: 35.68,
        longitude: 139.77,
        height: 40,
      } satisfies Position),
    ).toStrictEqual({ latitude: 35.68, longitude: 139.77, height: 40 });
  });

  it("T3 accepts height: undefined (no exactOptionalPropertyTypes)", () => {
    expect(
      readPosition({
        latitude: 35.68,
        longitude: 139.77,
        height: undefined,
      } satisfies Position),
    ).toStrictEqual({ latitude: 35.68, longitude: 139.77 });
  });

  it("T4 rejects the GeoJSON tuple", () => {
    // @ts-expect-error -- GeoJSON order is an array; Position takes named fields
    expect([139.77, 35.68] satisfies Position).toBeDefined();
  });

  it("T5 rejects a latitude-first tuple", () => {
    // @ts-expect-error -- a tuple is not a Position, whichever order it is in
    expect([35.68, 139.77] satisfies Position).toBeDefined();
  });

  it("T6 rejects short names", () => {
    // @ts-expect-error -- the members are latitude and longitude, not lat and lon
    expect({ lat: 35.68, lon: 139.77 } satisfies Position).toBeDefined();
  });

  it("T7 rejects a string member", () => {
    expect({
      // @ts-expect-error -- latitude is a number
      latitude: "35.68",
      longitude: 139.77,
    } satisfies Position).toBeDefined();
  });

  it("T8 rejects a missing longitude", () => {
    // @ts-expect-error -- longitude is required
    expect({ latitude: 35.68 } satisfies Position).toBeDefined();
  });

  it("T9 pins the shape", () => {
    expectTypeOf<Position>().toEqualTypeOf<{
      latitude: number;
      longitude: number;
      height?: number;
    }>();
  });
});

describe("Position (export surface)", () => {
  it.each`
    name
    ${"readPosition"}
    ${"isValidPosition"}
  `("$name is not exported from the root or ../types", ({ name }) => {
    expect(name in root).toBe(false);
    expect(name in types).toBe(false);
  });
});

const loggingProxy = (target: object): { proxy: object; log: string[] } => {
  const log: string[] = [];
  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      log.push(`get:${String(key)}`);
      return Reflect.get(t, key, receiver);
    },
    has(t, key) {
      log.push(`has:${String(key)}`);
      return Reflect.has(t, key);
    },
    ownKeys(t) {
      log.push("ownKeys");
      return Reflect.ownKeys(t);
    },
    getOwnPropertyDescriptor(t, key) {
      log.push(`getOwnPropertyDescriptor:${String(key)}`);
      return Reflect.getOwnPropertyDescriptor(t, key);
    },
    getPrototypeOf(t) {
      log.push("getPrototypeOf");
      return Reflect.getPrototypeOf(t);
    },
  });
  return { proxy, log };
};

const readOrder = ["get:height", "get:latitude", "get:longitude"];

describe("readPosition", () => {
  describe("valid input is returned exactly as given", () => {
    it.each`
      row       | input                                                           | expected
      ${"V1"}   | ${{ latitude: 35.68, longitude: 139.77 }}                       | ${{ latitude: 35.68, longitude: 139.77 }}
      ${"V2"}   | ${{ latitude: 35.68, longitude: 139.77, height: 40 }}           | ${{ latitude: 35.68, longitude: 139.77, height: 40 }}
      ${"V3"}   | ${{ latitude: 35.68, longitude: 139.77, height: -30 }}          | ${{ latitude: 35.68, longitude: 139.77, height: -30 }}
      ${"V4"}   | ${{ latitude: 35.68, longitude: 139.77, height: 0 }}            | ${{ latitude: 35.68, longitude: 139.77, height: 0 }}
      ${"V5a"}  | ${{ latitude: 90, longitude: 0 }}                               | ${{ latitude: 90, longitude: 0 }}
      ${"V5b"}  | ${{ latitude: -90, longitude: 0 }}                              | ${{ latitude: -90, longitude: 0 }}
      ${"V6"}   | ${{ latitude: 90, longitude: 135 }}                             | ${{ latitude: 90, longitude: 135 }}
      ${"V7a"}  | ${{ latitude: 0, longitude: 180 }}                              | ${{ latitude: 0, longitude: 180 }}
      ${"V7b"}  | ${{ latitude: 0, longitude: -180 }}                             | ${{ latitude: 0, longitude: -180 }}
      ${"V10"}  | ${{ latitude: Number.MIN_VALUE, longitude: -Number.MIN_VALUE }} | ${{ latitude: Number.MIN_VALUE, longitude: -Number.MIN_VALUE }}
      ${"V11a"} | ${{ latitude: 0, longitude: 0, height: 1e9 }}                   | ${{ latitude: 0, longitude: 0, height: 1e9 }}
      ${"V11b"} | ${{ latitude: 0, longitude: 0, height: -Number.MAX_VALUE }}     | ${{ latitude: 0, longitude: 0, height: -Number.MAX_VALUE }}
    `("$row $input returns $expected", ({ input, expected }) => {
      expect(readPosition(input)).toStrictEqual(expected);
    });

    it("V8 keeps -0 as -0 in both members", () => {
      const r = readPosition({ latitude: -0, longitude: -0 });
      expect(Object.is(r?.latitude, -0)).toBe(true);
      expect(Object.is(r?.longitude, -0)).toBe(true);
    });

    it("V9 height: undefined means no height key", () => {
      const r = readPosition({
        latitude: 35.68,
        longitude: 139.77,
        height: undefined,
      });
      expect(r).toStrictEqual({ latitude: 35.68, longitude: 139.77 });
      expect(r !== null && "height" in r).toBe(false);
    });
  });

  describe("shape and reading", () => {
    class Holder {
      get latitude(): number {
        return 1;
      }
      get longitude(): number {
        return 2;
      }
    }

    it.each`
      row     | input                                                                | expected
      ${"S1"} | ${{ latitude: 1, longitude: 2, name: "x", altitude: 5, lat: 9 }}     | ${{ latitude: 1, longitude: 2 }}
      ${"S3"} | ${Object.create({ latitude: 1, longitude: 2 })}                      | ${{ latitude: 1, longitude: 2 }}
      ${"S4"} | ${new Holder()}                                                      | ${{ latitude: 1, longitude: 2 }}
      ${"S5"} | ${Object.assign(() => 0, { latitude: 1, longitude: 2 })}             | ${{ latitude: 1, longitude: 2 }}
      ${"S6"} | ${Object.assign([0, 0], { latitude: 1, longitude: 2 })}              | ${{ latitude: 1, longitude: 2 }}
      ${"S7"} | ${Object.defineProperty({ longitude: 2 }, "latitude", { value: 1 })} | ${{ latitude: 1, longitude: 2 }}
      ${"S8"} | ${Object.assign(Object.create(null), { latitude: 1, longitude: 2 })} | ${{ latitude: 1, longitude: 2 }}
    `("$row reads the named members of $input", ({ input, expected }) => {
      expect(readPosition(input)).toStrictEqual(expected);
    });

    it("S2 returns a fresh object, not the input", () => {
      const input = { latitude: 35.68, longitude: 139.77 };
      const r = readPosition(input);
      expect(r).not.toBe(input);
      if (r === null) throw new Error("expected a Position");
      r.latitude = 0;
      expect(input.latitude).toBe(35.68);
    });

    it("S9 returns a plain, unfrozen object with keys in order", () => {
      const r = readPosition({ height: 3, longitude: 2, latitude: 1 });
      expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
      expect(Object.isFrozen(r)).toBe(false);
      expect(Object.keys(r ?? {})).toStrictEqual([
        "latitude",
        "longitude",
        "height",
      ]);
    });

    it("S10 reads latitude once", () => {
      let calls = 0;
      const input = {
        get latitude(): number {
          calls += 1;
          return calls === 1 ? 10 : 99;
        },
        longitude: 0,
      };
      expect(readPosition(input)?.latitude).toBe(10);
      expect(calls).toBe(1);
    });

    it("S11 reads height, latitude, longitude once each in that order", () => {
      const { proxy, log } = loggingProxy({
        latitude: 1,
        longitude: 2,
        height: 3,
      });
      expect(readPosition(proxy)).toStrictEqual({
        latitude: 1,
        longitude: 2,
        height: 3,
      });
      expect(log).toStrictEqual(readOrder);
    });

    it("S12b reads all three members before checking an invalid height", () => {
      const { proxy, log } = loggingProxy({
        latitude: 1,
        longitude: 2,
        height: "x",
      });
      expect(readPosition(proxy)).toBeNull();
      expect(log).toStrictEqual(readOrder);
    });

    it.each(["latitude", "longitude", "height"])(
      "N11 does not coerce %s",
      (member) => {
        const calls: string[] = [];
        const bad = {
          valueOf: () => (calls.push("valueOf"), 1),
          toString: () => (calls.push("toString"), "1"),
          [Symbol.toPrimitive]: () => (calls.push("toPrimitive"), 1),
        };
        expect(
          readPosition({ latitude: 1, longitude: 2, [member]: bad }),
        ).toBeNull();
        expect(calls).toStrictEqual([]);
      },
    );

    it("S12 reads all three members before checking any", () => {
      const { proxy, log } = loggingProxy({
        latitude: 91,
        longitude: 2,
        height: 3,
      });
      expect(readPosition(proxy)).toBeNull();
      expect(log).toStrictEqual(readOrder);
    });
  });

  describe("invalid input returns null", () => {
    it.each`
      row     | input
      ${"N1"} | ${{ latitude: 90.000001, longitude: 0 }}
      ${"N1"} | ${{ latitude: -90.000001, longitude: 0 }}
      ${"N1"} | ${{ latitude: 91, longitude: 0 }}
      ${"N2"} | ${{ latitude: 0, longitude: 180.000001 }}
      ${"N2"} | ${{ latitude: 0, longitude: -180.000001 }}
      ${"N2"} | ${{ latitude: 0, longitude: 360 }}
      ${"N5"} | ${{}}
      ${"N5"} | ${{ latitude: 1 }}
      ${"N5"} | ${{ longitude: 1 }}
      ${"N5"} | ${{ latitude: undefined, longitude: 1 }}
      ${"N7"} | ${[139.77, 35.68]}
      ${"N7"} | ${[35.68, 139.77]}
      ${"N7"} | ${[139.77, 35.68, 40]}
      ${"N8"} | ${{ lat: 35.68, lon: 139.77 }}
      ${"N8"} | ${{ lat: 35.68, lng: 139.77 }}
      ${"N9"} | ${{ type: "Point", coordinates: [139.77, 35.68] }}
    `("$row $input is null", ({ input }) => {
      expect(readPosition(input)).toBeNull();
    });

    const notFinite = [
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ] as const;
    const notNumber = [
      ["string", "35.68"],
      ["bigint", 35n],
      ["Number object", new Number(35)],
      ["null", null],
      ["boolean", true],
      ["array", []],
      ["object", {}],
    ] as const;

    it.each(
      ["latitude", "longitude", "height"].flatMap((member) =>
        [...notFinite, ...notNumber].map(([label, bad]) => ({
          member,
          label,
          bad,
        })),
      ),
    )("N3/N4 $member = $label is null", ({ member, bad }) => {
      expect(
        readPosition({ latitude: 1, longitude: 2, [member]: bad }),
      ).toBeNull();
    });

    it.each`
      row     | label          | input
      ${"N6"} | ${"null"}      | ${null}
      ${"N6"} | ${"undefined"} | ${undefined}
      ${"N6"} | ${"'x'"}       | ${"x"}
      ${"N6"} | ${"''"}        | ${""}
      ${"N6"} | ${"0"}         | ${0}
      ${"N6"} | ${"NaN"}       | ${Number.NaN}
      ${"N6"} | ${"true"}      | ${true}
      ${"N6"} | ${"1n"}        | ${1n}
      ${"N6"} | ${"a symbol"}  | ${Symbol("p")}
    `("$row $label is null", ({ input }) => {
      expect(readPosition(input)).toBeNull();
    });

    it.each`
      row      | label               | make
      ${"N10"} | ${"throwing getter"} | ${() => ({ get latitude(): number {
    throw new Error("boom");
  }, longitude: 0 })}
      ${"N10"} | ${"hostileProxy()"} | ${hostileProxy}
      ${"N10"} | ${"revokedProxy()"} | ${revokedProxy}
    `("$row $label returns null and does not throw", ({ make }) => {
      const v: unknown = make();
      expect(() => readPosition(v)).not.toThrow();
      expect(readPosition(v)).toBeNull();
    });
  });
});
