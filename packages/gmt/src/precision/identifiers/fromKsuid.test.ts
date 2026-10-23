import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromKsuid } from "./fromKsuid";

describe("fromKsuid", () => {
  it.each`
    ksuid                            | expected                  | reason
    ${"0ujtsYcgvSTl8PAuAdqWYSMnLOv"} | ${"2017-10-10T04:00:47Z"} | ${"README inspect example, timestamp 107608047"}
    ${"0ujzPyRiIAffKhBux4PvQdDqMHY"} | ${"2017-10-10T04:46:20Z"} | ${"README generate example, timestamp 107610780"}
    ${"000000000000000000000000000"} | ${"2014-05-13T16:53:20Z"} | ${"all zero is the KSUID epoch, not 1970"}
    ${"aWgEPTl1tmebfsQzFP4bxwgy80V"} | ${"2150-06-19T23:21:35Z"} | ${"maxStringEncoded, 2^160 - 1"}
    ${"0UJTSYCGVSTL8PAUADQWYSMNLOV"} | ${"2016-03-09T02:31:53Z"} | ${"upper-cased is a different KSUID"}
    ${"0ujtsycgvstl8pauadqwysmnlov"} | ${"2017-10-10T04:00:51Z"} | ${"lower-cased is a different KSUID"}
    ${"000007n42DGM5Tflk9n8mt7Fhc8"} | ${"2014-05-13T16:53:21Z"} | ${"timestamp 1 is one second after the epoch"}
    ${"000007n42DGM5Tflk9n8mt7Fhc9"} | ${"2014-05-13T16:53:21Z"} | ${"payload differs, same second: payload carries no time"}
    ${"aWgEPLxxrZOFaOlDVFHTB3ZiQOO"} | ${"2150-06-19T23:21:35Z"} | ${"largest timestamp 2^32 - 1 with zero payload"}
  `("returns $expected for $ksuid ($reason)", ({ ksuid, expected }) => {
    expect(fromKsuid(ksuid)).toBe(expected);
  });

  it.each`
    ksuid                              | reason
    ${"aWgEPTl1tmebfsQzFP4bxwgy80W"}   | ${"one above the maximum"}
    ${"zzzzzzzzzzzzzzzzzzzzzzzzzzz"}   | ${"above the maximum"}
    ${"0ujtsYcgvSTl8PAuAdqWYSMnLO"}    | ${"26 characters"}
    ${"0ujtsYcgvSTl8PAuAdqWYSMnLOv0"}  | ${"28 characters"}
    ${"0ujtsYcgvSTl8PAuAdqWYSMnLO-"}   | ${"outside the alphabet"}
    ${" 0ujtsYcgvSTl8PAuAdqWYSMnLOv"}  | ${"leading space"}
    ${"0ujtsYcgvSTl8PAuAdqWYSMnLOv\n"} | ${"trailing newline"}
    ${""}                              | ${"empty"}
    ${42}                              | ${"number"}
    ${null}                            | ${"null"}
    ${undefined}                       | ${"undefined"}
    ${{}}                              | ${"object"}
  `("returns an empty string for $ksuid ($reason)", ({ ksuid }) => {
    expect(fromKsuid(ksuid)).toBe("");
  });

  it.each`
    kind                             | value
    ${"a hostile Proxy"}             | ${hostileProxy()}
    ${"a revoked Proxy"}             | ${revokedProxy()}
    ${"a boolean"}                   | ${true}
    ${"an array holding a valid id"} | ${["0ujtsYcgvSTl8PAuAdqWYSMnLOv"]}
    ${"a symbol"}                    | ${Symbol("id")}
    ${"a bigint"}                    | ${1n}
  `("returns an empty string and never throws for $kind", ({ value }) => {
    expect(() => fromKsuid(value)).not.toThrow();
    expect(fromKsuid(value)).toBe("");
  });
});
