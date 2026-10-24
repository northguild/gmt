import { parseCronExpression } from "./parseCronExpression";

describe("parseCronExpression", () => {
  it.each`
    value                      | field           | expected
    ${"*/15 9-17 * * mon-fri"} | ${"dayOfWeek"}  | ${{ values: [1, 2, 3, 4, 5], star: false }}
    ${"*/15 9-17 * * mon-fri"} | ${"minute"}     | ${{ values: [0, 15, 30, 45], star: true }}
    ${"*/15 9-17 * * mon-fri"} | ${"hour"}       | ${{ values: [9, 10, 11, 12, 13, 14, 15, 16, 17], star: false }}
    ${"@daily"}                | ${"minute"}     | ${{ values: [0], star: false }}
    ${"0 0 30 2 *"}            | ${"dayOfMonth"} | ${{ values: [30], star: false }}
    ${"0 0 * * fri-sun"}       | ${"dayOfWeek"}  | ${{ values: [5, 6, 7], star: false }}
    ${"0 0 * * 0"}             | ${"dayOfWeek"}  | ${{ values: [7], star: false }}
    ${"@weekly"}               | ${"dayOfWeek"}  | ${{ values: [7], star: false }}
    ${"@weekly"}               | ${"dayOfMonth"} | ${{ values: Array.from({ length: 31 }, (_, i) => i + 1), star: true }}
  `("reads $field of $value", ({ value, field, expected }) => {
    expect(parseCronExpression(value)?.[field as "minute"]).toEqual(expected);
  });

  it.each`
    value
    ${"0 0 * * * *"}
    ${"@reboot"}
    ${"@DAILY"}
    ${"* * * * *\n"}
    ${"CRON_TZ=UTC 0 0 * * *"}
    ${""}
    ${"60 * * * *"}
    ${"*/0 * * * *"}
    ${"1,*/5 * * * *"}
  `("returns null for $value", ({ value }) => {
    expect(parseCronExpression(value)).toBeNull();
  });

  it.each`
    name           | input
    ${"null"}      | ${null}
    ${"undefined"} | ${undefined}
    ${"a number"}  | ${5}
    ${"an array"}  | ${["* * * * *"]}
    ${"an object"} | ${{}}
    ${"a String"}  | ${new String("* * * * *")}
  `("returns null when the input is $name", ({ input }) => {
    expect(parseCronExpression(input)).toBeNull();
  });

  it("returns the same record for the nickname and its five-field line, apart from star", () => {
    const nickname = parseCronExpression("@monthly");
    const line = parseCronExpression("0 0 1 * *");
    expect(nickname?.minute).toEqual(line?.minute);
    expect(nickname?.dayOfMonth).toEqual(line?.dayOfMonth);
    expect(nickname?.dayOfWeek).toEqual({ ...line?.dayOfWeek, star: true });
  });
});
