import { fromUuidTimestamp } from "./fromUuidTimestamp";

const A1 = "C232AB00-9414-11EC-B3C8-9F6BDECED846";
const A6 = "017F22E2-79B0-7CC3-98C4-DC0C0C07398F";

describe("fromUuidTimestamp", () => {
  it.each`
    uuid                                      | instant                           | version | reason
    ${A1}                                     | ${"2022-02-22T19:22:22Z"}         | ${1}    | ${"RFC 9562 A.1"}
    ${"1EC9414C-232A-6B00-B3C8-9F6BDECED846"} | ${"2022-02-22T19:22:22Z"}         | ${6}    | ${"A.5, same instant as the v1 in A.1"}
    ${A6}                                     | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"A.6"}
    ${"f81d4fae-7dec-11d0-a765-00a0c91e6bf6"} | ${"1997-02-03T17:43:12.216875Z"}  | ${1}    | ${"section 4 Figure 1, 100 ns kept"}
    ${A1.toLowerCase()}                       | ${"2022-02-22T19:22:22Z"}         | ${1}    | ${"lower case"}
    ${"00000000-0000-1000-8000-000000000000"} | ${"1582-10-15T00:00:00Z"}         | ${1}    | ${"v1 epoch"}
    ${"00000000-0000-6000-8000-000000000000"} | ${"1582-10-15T00:00:00Z"}         | ${6}    | ${"v6 epoch"}
    ${"ffffffff-ffff-1fff-bfff-ffffffffffff"} | ${"5236-03-31T21:21:00.6846975Z"} | ${1}    | ${"v1 60-bit maximum"}
    ${"ffffffff-ffff-6fff-bfff-ffffffffffff"} | ${"5236-03-31T21:21:00.6846975Z"} | ${6}    | ${"v6 60-bit maximum"}
    ${"00000000-0000-7000-8000-000000000000"} | ${"1970-01-01T00:00:00Z"}         | ${7}    | ${"v7 Unix epoch"}
    ${"ffffffff-ffff-7fff-bfff-ffffffffffff"} | ${"+010889-08-02T05:31:50.655Z"}  | ${7}    | ${"v7 48-bit maximum"}
    ${"017F22E2-79B0-7FFF-98C4-DC0C0C07398F"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"rand_a is not read"}
    ${"017f22e2-79b0-7cc3-b8c4-dc0c0c07398f"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"variant digit b"}
    ${"017f22e2-79b0-7cc3-98c4-dc0c0c07398f"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"variant digit 9"}
    ${"017f22e2-79b0-7cc3-88c4-dc0c0c07398f"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"variant digit 8"}
    ${"017f22e2-79b0-7cc3-a8c4-dc0c0c07398f"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"variant digit a"}
    ${"017F22E2-79B0-7CC3-A8C4-DC0C0C07398F"} | ${"2022-02-22T19:22:22Z"}         | ${7}    | ${"variant digit A, upper case"}
    ${"7b0aebcd-4117-11b3-8000-000000000000"} | ${"1971-01-06T15:59:57.3501901Z"} | ${1}    | ${"v1 field order: ticks 0x1b21dd213814000 + 0x123456789abcd, all three groups distinct (erratum 7955)"}
    ${"1b341177-b0ae-6bcd-8000-000000000000"} | ${"1971-01-06T15:59:57.3501901Z"} | ${6}    | ${"v6 of the same ticks as the row above, section 5.6"}
    ${"13814000-1dd2-11b2-8000-000000000000"} | ${"1970-01-01T00:00:00Z"}         | ${1}    | ${"v1 at the Unix epoch, offset 0x01b21dd213814000 (Appendix A)"}
    ${"13813fff-1dd2-11b2-8000-000000000000"} | ${"1969-12-31T23:59:59.9999999Z"} | ${1}    | ${"v1 one tick before the Unix epoch"}
    ${"1b21dd21-3813-6fff-8000-000000000000"} | ${"1969-12-31T23:59:59.9999999Z"} | ${6}    | ${"v6 one tick before the Unix epoch"}
    ${"01234567-89ab-7000-8000-000000000000"} | ${"2009-08-23T03:58:16.491Z"}     | ${7}    | ${"v7 field order and a-f digits: 0x0123456789ab ms"}
    ${"ffffffff-fffe-7000-8000-000000000000"} | ${"+010889-08-02T05:31:50.654Z"}  | ${7}    | ${"v7 one ms below the 48-bit maximum"}
  `(
    "returns $instant version $version for $uuid ($reason)",
    ({ uuid, instant, version }) => {
      expect(fromUuidTimestamp(uuid)).toEqual({ instant, version });
    },
  );

  it.each`
    uuid                                               | reason
    ${"919108f7-52d1-4320-9bac-f847db4148a8"}          | ${"A.3 v4"}
    ${"5df41881-3aed-3515-88a7-2f4a814cf09e"}          | ${"A.2 v3"}
    ${"2ed6657d-e927-568b-95e1-2665a8aea6a2"}          | ${"A.4 v5"}
    ${"c232ab00-9414-21ec-b3c8-9f6bdeced846"}          | ${"v2 has no timestamp of its own"}
    ${"c232ab00-9414-81ec-b3c8-9f6bdeced846"}          | ${"v8 carries none"}
    ${"c232ab00-9414-01ec-b3c8-9f6bdeced846"}          | ${"version 0 with the RFC variant"}
    ${"c232ab00-9414-f1ec-b3c8-9f6bdeced846"}          | ${"version 15 with the RFC variant"}
    ${"00000000-0000-0000-0000-000000000000"}          | ${"Nil UUID"}
    ${"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"}          | ${"Max UUID"}
    ${"017f22e2-79b0-7cc3-c8c4-dc0c0c07398f"}          | ${"Microsoft variant"}
    ${"017f22e2-79b0-7cc3-d8c4-dc0c0c07398f"}          | ${"Microsoft variant d"}
    ${"017f22e2-79b0-7cc3-48c4-dc0c0c07398f"}          | ${"NCS variant"}
    ${"017f22e2-79b0-7cc3-e8c4-dc0c0c07398f"}          | ${"reserved variant e"}
    ${"017f22e2-79b0-7cc3-f8c4-dc0c0c07398f"}          | ${"reserved variant f"}
    ${"urn:uuid:c232ab00-9414-11ec-b3c8-9f6bdeced846"} | ${"URN prefix"}
    ${"{c232ab00-9414-11ec-b3c8-9f6bdeced846}"}        | ${"braces"}
    ${"c232ab0094141 1ecb3c89f6bdeced846"}             | ${"inner space"}
    ${"c232ab00941411ecb3c89f6bdeced846"}              | ${"bare hex"}
    ${" c232ab00-9414-11ec-b3c8-9f6bdeced846"}         | ${"leading whitespace"}
    ${"c232ab00-9414-11ec-b3c8-9f6bdeced846 "}         | ${"trailing whitespace"}
    ${"c232ab00-9414-11ec-b3c8-9f6bdeced84g"}          | ${"non-hex digit"}
    ${""}                                              | ${"empty"}
  `("returns null for $uuid ($reason)", ({ uuid }) => {
    expect(fromUuidTimestamp(uuid)).toBeNull();
  });

  it.each`
    value
    ${123}
    ${undefined}
    ${null}
    ${{}}
  `("returns null for non-string $value", ({ value }) => {
    expect(fromUuidTimestamp(value)).toBeNull();
  });
});
