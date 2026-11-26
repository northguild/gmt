import { readNotamDateTimeFields } from "./notamDateTime";

describe("readNotamDateTimeFields", () => {
  it.each`
    value              | expected
    ${"PERM"}          | ${{ kind: "permanent" }}
    ${"1407031230"}    | ${{ kind: "dateTime", yy: 14, month: 7, day: 3, hour: 12, minute: 30, estimated: false }}
    ${"1407031230EST"} | ${{ kind: "dateTime", yy: 14, month: 7, day: 3, hour: 12, minute: 30, estimated: true }}
    ${"2513152400"}    | ${{ kind: "dateTime", yy: 25, month: 13, day: 15, hour: 24, minute: 0, estimated: false }}
    ${"0000000000"}    | ${{ kind: "dateTime", yy: 0, month: 0, day: 0, hour: 0, minute: 0, estimated: false }}
  `(
    "reads the shape of '$value' without checking the date",
    ({ value, expected }) => {
      expect(readNotamDateTimeFields(value)).toEqual(expected);
    },
  );

  it.each`
    value                     | label
    ${"1407031230 EST"}       | ${"space before EST"}
    ${"1407031230est"}        | ${"lower-case EST"}
    ${"1407031230Est"}        | ${"mixed-case EST"}
    ${"perm"}                 | ${"lower-case PERM"}
    ${"PERM\n"}               | ${"trailing newline"}
    ${"PERM "}                | ${"trailing space"}
    ${"PERMEST"}              | ${"PERM with EST"}
    ${"1407031230ESTX"}       | ${"trailing letter"}
    ${"140703123"}            | ${"nine digits"}
    ${"14070312300"}          | ${"eleven digits"}
    ${"1407031230\n"}         | ${"trailing newline after digits"}
    ${"٢٥٠٦١٥١٢٠٠"}           | ${"Arabic-Indic digits"}
    ${"２５０６１５１２００"} | ${"full-width digits"}
    ${""}                     | ${"empty"}
  `("returns null for '$value' ($label)", ({ value }) => {
    expect(readNotamDateTimeFields(value)).toBeNull();
  });
});
