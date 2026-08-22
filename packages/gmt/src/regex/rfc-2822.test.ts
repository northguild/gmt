import { rfc2822DateTime } from "./rfc-2822";

describe("regex/rfc-2822", () => {
  it.each`
    value                                    | expected
    ${"Fri, 15 Mar 2024 14:30:00 -0400"}     | ${true}
    ${"15 Mar 2024 14:30:00 -0400"}          | ${true}
    ${"5 Mar 2024 14:30:00 -0400"}           | ${true}
    ${"Fri, 15 Mar 2024 14:30 -0400"}        | ${true}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"}       | ${true}
    ${"Fri, 05 Jan 2024 09:00:00 UT"}        | ${true}
    ${"Fri, 15 Mar 2024 14:30:00 EST"}       | ${true}
    ${"Fri, 15 Mar 2024 14:30:00 PDT"}       | ${true}
    ${"Fri, 15 Mar 2024 14:30:00 +0000"}     | ${true}
    ${"Fri, 15 Mar 2024 14:30:00 Z"}         | ${false}
    ${"Fri, 15 Mar 2024 14:30:00 J"}         | ${false}
    ${"Fri 15 Mar 2024 14:30:00 -0400"}      | ${false}
    ${"Fri, 15 March 2024 14:30:00 -0400"}   | ${false}
    ${"Fri, 15 Mar 24 14:30:00 -0400"}       | ${false}
    ${"Fri, 15 Mar 2024 14:30:00.500 -0400"} | ${false}
    ${"not a date"}                          | ${false}
    ${""}                                    | ${false}
  `(
    "rfc2822DateTime pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(rfc2822DateTime.test(value)).toBe(expected);
    },
  );
});
