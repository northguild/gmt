import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromObjectId } from "./fromObjectId";

describe("fromObjectId", () => {
  it.each`
    objectId                      | expected                  | reason
    ${"65a0f4d0c3b1a2e4f5d6c7b8"} | ${"2024-01-12T08:14:08Z"} | ${"0x65a0f4d0 = 1705047248 s"}
    ${"000000000000000000000000"} | ${"1970-01-01T00:00:00Z"} | ${"MongoDB Test Plan 0x00000000"}
    ${"7fffffff0000000000000000"} | ${"2038-01-19T03:14:07Z"} | ${"Test Plan 0x7FFFFFFF"}
    ${"800000000000000000000000"} | ${"2038-01-19T03:14:08Z"} | ${"Test Plan 0x80000000, unsigned not sign-extended"}
    ${"ffffffff0000000000000000"} | ${"2106-02-07T06:28:15Z"} | ${"Test Plan 0xFFFFFFFF"}
    ${"FFFFFFFF0000000000000000"} | ${"2106-02-07T06:28:15Z"} | ${"upper-case hex"}
    ${"65A0f4D0c3b1a2e4f5d6c7b8"} | ${"2024-01-12T08:14:08Z"} | ${"mixed-case hex"}
    ${"65a0f4d0ffffffffffffffff"} | ${"2024-01-12T08:14:08Z"} | ${"random and counter bytes carry no time"}
    ${"65a0f4d00000000000000000"} | ${"2024-01-12T08:14:08Z"} | ${"all-zero random and counter bytes, same second"}
    ${"000000010000000000000000"} | ${"1970-01-01T00:00:01Z"} | ${"one second after the epoch"}
  `("returns $expected for $objectId ($reason)", ({ objectId, expected }) => {
    expect(fromObjectId(objectId)).toBe(expected);
  });

  it.each`
    objectId                                  | reason                       | label
    ${"65a0f4d0c3b1a2e4f5d6c7b"}              | ${"23 characters"}           | ${"'65a0f4d0c3b1a2e4f5d6c7b'"}
    ${"65a0f4d0c3b1a2e4f5d6c7b81"}            | ${"25 characters"}           | ${"'65a0f4d0c3b1a2e4f5d6c7b81'"}
    ${"65a0f4d0c3b1a2e4f5d6c7bg"}             | ${"not hex"}                 | ${"'65a0f4d0c3b1a2e4f5d6c7bg'"}
    ${'ObjectId("65a0f4d0c3b1a2e4f5d6c7b8")'} | ${"shell form not accepted"} | ${"'ObjectId(\"65a0f4d0c3b1a2e4f5d6c7b8\")'"}
    ${" 65a0f4d0c3b1a2e4f5d6c7b8"}            | ${"leading space"}           | ${"' 65a0f4d0c3b1a2e4f5d6c7b8'"}
    ${"65a0f4d0c3b1a2e4f5d6c7b8\n"}           | ${"trailing newline"}        | ${"'65a0f4d0c3b1a2e4f5d6c7b8\\n'"}
    ${""}                                     | ${"empty"}                   | ${"''"}
    ${42}                                     | ${"number"}                  | ${"42"}
    ${null}                                   | ${"null"}                    | ${"null"}
    ${undefined}                              | ${"undefined"}               | ${"undefined"}
    ${{}}                                     | ${"object"}                  | ${"{}"}
  `("returns an empty string for $label ($reason)", ({ objectId }) => {
    expect(fromObjectId(objectId)).toBe("");
  });

  it.each`
    kind                             | value
    ${"a hostile Proxy"}             | ${hostileProxy()}
    ${"a revoked Proxy"}             | ${revokedProxy()}
    ${"a boolean"}                   | ${true}
    ${"an array holding a valid id"} | ${["65a0f4d0c3b1a2e4f5d6c7b8"]}
    ${"a symbol"}                    | ${Symbol("id")}
    ${"a bigint"}                    | ${1n}
  `("returns an empty string and never throws for $kind", ({ value }) => {
    expect(() => fromObjectId(value)).not.toThrow();
    expect(fromObjectId(value)).toBe("");
  });
});
