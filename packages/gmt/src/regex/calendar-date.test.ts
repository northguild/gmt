import { calendarDate } from "./calendar-date";

describe("calendarDate regex", () => {
  // Year: four to six unsigned digits, or a minus sign plus exactly six digits (Temporal's
  // PadISOYear form for negative years). Era: lowercase words joined by single hyphens.
  it.each`
    value                                                | year         | month   | day     | calendarId               | era
    ${"5785-01-01[u-ca=hebrew]"}                         | ${"5785"}    | ${"01"} | ${"01"} | ${"hebrew"}              | ${undefined}
    ${"0000-12-31[u-ca=taiwan]"}                         | ${"0000"}    | ${"12"} | ${"31"} | ${"taiwan"}              | ${undefined}
    ${"279517-10-11[u-ca=hebrew]"}                       | ${"279517"}  | ${"10"} | ${"11"} | ${"hebrew"}              | ${undefined}
    ${"-000911-01-01[u-ca=taiwan]"}                      | ${"-000911"} | ${"01"} | ${"01"} | ${"taiwan"}              | ${undefined}
    ${"-268058-11-04[u-ca=hebrew]"}                      | ${"-268058"} | ${"11"} | ${"04"} | ${"hebrew"}              | ${undefined}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}             | ${"0006"}    | ${"10"} | ${"03"} | ${"japanese"}            | ${"reiwa"}
    ${"0501-06-15[u-ca=japanese;era=bce]"}               | ${"0501"}    | ${"06"} | ${"15"} | ${"japanese"}            | ${"bce"}
    ${"0501-06-15[u-ca=japanese;era=japanese-inverse]"}  | ${"0501"}    | ${"06"} | ${"15"} | ${"japanese"}            | ${"japanese-inverse"}
    ${"-266323-03-23[u-ca=ethiopic;era=ethioaa]"}        | ${"-266323"} | ${"03"} | ${"23"} | ${"ethiopic"}            | ${"ethioaa"}
  `(
    "captures year $year month $month day $day calendar $calendarId era $era from $value",
    ({ value, year, month, day, calendarId, era }) => {
      expect(calendarDate.exec(value)?.slice(1)).toEqual([
        year,
        month,
        day,
        calendarId,
        era,
      ]);
    },
  );

  it.each`
    value                                     | reason
    ${"-000000-01-01[u-ca=taiwan]"}           | ${"negative zero is forbidden (Temporal DateYear early error)"}
    ${"-0911-01-01[u-ca=taiwan]"}             | ${"a negative year needs six digits"}
    ${"-00911-01-01[u-ca=taiwan]"}            | ${"a negative year needs exactly six digits"}
    ${"-1000000-01-01[u-ca=taiwan]"}          | ${"seven-digit negative year"}
    ${"+279517-10-11[u-ca=hebrew]"}           | ${"positive years stay unsigned"}
    ${"911-01-01[u-ca=taiwan]"}               | ${"three-digit year"}
    ${"0501-06-15[u-ca=japanese;era=-bce]"}   | ${"era token starting with a hyphen"}
    ${"0501-06-15[u-ca=japanese;era=bce-]"}   | ${"era token ending with a hyphen"}
    ${"0501-06-15[u-ca=japanese;era=a--b]"}   | ${"era token with a double hyphen"}
    ${"2024-03-15"}                           | ${"no calendar annotation"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(calendarDate.test(value)).toBe(false);
  });
});
