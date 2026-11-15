import { hostileProxy, revokedProxy } from "../test/hostileValues";
import { readSecondsRecord } from "./protoRecord";

describe("readSecondsRecord", () => {
  it.each`
    member           | value                                     | expected
    ${"nanos"}       | ${{ seconds: -1n, nanos: 5 }}             | ${{ seconds: -1n, fraction: 5 }}
    ${"nanos"}       | ${{ seconds: 3, nanos: 0 }}               | ${{ seconds: 3n, fraction: 0 }}
    ${"nanoseconds"} | ${{ seconds: 7n, nanoseconds: 9 }}        | ${{ seconds: 7n, fraction: 9 }}
    ${"nanoseconds"} | ${{ seconds: 7, nanoseconds: 999999999 }} | ${{ seconds: 7n, fraction: 999999999 }}
  `(
    "reads $value under the $member member as $expected",
    ({ member, value, expected }) => {
      expect(readSecondsRecord(value, member)).toStrictEqual(expected);
    },
  );

  it.each`
    member           | value                                   | reason
    ${"nanoseconds"} | ${{ seconds: 1n, nanos: 1 }}            | ${"has nanos but no nanoseconds"}
    ${"nanos"}       | ${{ seconds: 1n, nanoseconds: 1 }}      | ${"has nanoseconds but no nanos"}
    ${"nanoseconds"} | ${{ seconds: 1n }}                      | ${"no fraction member"}
    ${"nanoseconds"} | ${{ nanoseconds: 1 }}                   | ${"no seconds"}
    ${"nanoseconds"} | ${{ seconds: "1", nanoseconds: 1 }}     | ${"string seconds"}
    ${"nanoseconds"} | ${{ seconds: 1.5, nanoseconds: 1 }}     | ${"fractional seconds"}
    ${"nanoseconds"} | ${{ seconds: 2 ** 53, nanoseconds: 1 }} | ${"seconds not a safe integer"}
    ${"nanoseconds"} | ${{ seconds: 1n, nanoseconds: 0.5 }}    | ${"fractional fraction"}
    ${"nanoseconds"} | ${{ seconds: 1n, nanoseconds: 1n }}     | ${"bigint fraction"}
    ${"nanoseconds"} | ${null}                                 | ${"null"}
    ${"nanoseconds"} | ${undefined}                            | ${"undefined"}
    ${"nanoseconds"} | ${hostileProxy()}                       | ${"proxy that throws on every trap"}
    ${"nanoseconds"} | ${revokedProxy()}                       | ${"revoked proxy"}
  `("returns null under $member for $reason", ({ member, value }) => {
    expect(readSecondsRecord(value, member)).toBeNull();
  });

  it.each`
    member           | value                              | reason
    ${"nanos"}       | ${{ seconds: -0, nanos: 0 }}       | ${"negative-zero seconds"}
    ${"nanoseconds"} | ${{ seconds: -0, nanoseconds: 0 }} | ${"negative-zero seconds under nanoseconds"}
  `("reads $reason under $member as bigint 0n", ({ member, value }) => {
    expect(readSecondsRecord(value, member)?.seconds).toBe(0n);
  });

  it("returns null for a fraction getter that throws", () => {
    const record = {
      seconds: 1n,
      get nanoseconds(): number {
        throw new Error("hostile getter");
      },
    };

    expect(readSecondsRecord(record, "nanoseconds")).toBeNull();
  });

  it("reads seconds before the fraction member, as the destructuring did", () => {
    const order: string[] = [];
    const record = {
      get seconds() {
        order.push("seconds");
        return 1n;
      },
      get nanoseconds() {
        order.push("nanoseconds");
        return 2;
      },
    };

    readSecondsRecord(record, "nanoseconds");

    expect(order).toStrictEqual(["seconds", "nanoseconds"]);
  });

  it("returns null for a getter that throws", () => {
    const record = {
      get seconds(): bigint {
        throw new Error("hostile getter");
      },
      nanoseconds: 0,
    };

    expect(readSecondsRecord(record, "nanoseconds")).toBeNull();
  });
});
