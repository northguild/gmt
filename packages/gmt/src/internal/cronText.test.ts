import { checkCronExpression, readCronExpression } from "./cronText";

const upTo = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
};

const MINUTES = upTo(0, 59);
const HOURS = upTo(0, 23);
const DAYS = upTo(1, 31);
const MONTHS = upTo(1, 12);
const WEEKDAYS = upTo(1, 7);

describe("readCronExpression: five fields", () => {
  it("reads * * * * * as every field full with star true", () => {
    expect(readCronExpression("* * * * *")).toEqual({
      minute: { values: MINUTES, star: true },
      hour: { values: HOURS, star: true },
      dayOfMonth: { values: DAYS, star: true },
      month: { values: MONTHS, star: true },
      dayOfWeek: { values: WEEKDAYS, star: true },
    });
  });

  it("reads the crontab(5) NOTES line 30 4 1,15 * 5", () => {
    expect(readCronExpression("30 4 1,15 * 5")).toEqual({
      minute: { values: [30], star: false },
      hour: { values: [4], star: false },
      dayOfMonth: { values: [1, 15], star: false },
      month: { values: MONTHS, star: true },
      dayOfWeek: { values: [5], star: false },
    });
  });

  it("accepts a leading zero: 05 09 is minute 5 hour 9", () => {
    const parsed = readCronExpression("05 09 * * *");
    expect(parsed?.minute.values).toEqual([5]);
    expect(parsed?.hour.values).toEqual([9]);
  });

  it("accepts mixed blanks between fields", () => {
    expect(readCronExpression("0\t0  *\t* *")?.minute.values).toEqual([0]);
  });

  it("returns a frozen record", () => {
    const parsed = readCronExpression("* * * * *");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.minute)).toBe(true);
    expect(Object.isFrozen(parsed?.minute.values)).toBe(true);
  });
});

describe("checkCronExpression", () => {
  const valid = () => ({
    minute: { values: [0, 30], star: false },
    hour: { values: [1], star: false },
    dayOfMonth: { values: [1], star: true },
    month: { values: [12], star: false },
    dayOfWeek: { values: [7], star: false },
  });

  it("returns a fresh frozen copy of a valid expression", () => {
    const input = valid();
    const checked = checkCronExpression(input);
    expect(checked).toEqual(input);
    expect(checked).not.toBe(input);
    expect(Object.isFrozen(checked)).toBe(true);
    expect(Object.isFrozen(checked?.minute.values)).toBe(true);
  });

  it.each`
    name                                | mutate
    ${"empty values"}                   | ${(e: any) => (e.minute.values = [])}
    ${"descending values [3, 1]"}       | ${(e: any) => (e.hour.values = [3, 1])}
    ${"repeated values [1, 1]"}         | ${(e: any) => (e.hour.values = [1, 1])}
    ${"dayOfWeek [0] (cron numbering)"} | ${(e: any) => (e.dayOfWeek.values = [0])}
    ${"dayOfWeek [8]"}                  | ${(e: any) => (e.dayOfWeek.values = [8])}
    ${"minute 60"}                      | ${(e: any) => (e.minute.values = [60])}
    ${"hour 24"}                        | ${(e: any) => (e.hour.values = [24])}
    ${"dayOfMonth 0"}                   | ${(e: any) => (e.dayOfMonth.values = [0])}
    ${"month 13"}                       | ${(e: any) => (e.month.values = [13])}
    ${"fractional value 1.5"}           | ${(e: any) => (e.minute.values = [1.5])}
    ${"star is the string yes"}         | ${(e: any) => (e.month.star = "yes")}
    ${"missing field"}                  | ${(e: any) => delete e.month}
    ${"values not an array"}            | ${(e: any) => (e.minute.values = "1")}
    ${"values a typed array"}           | ${(e: any) => (e.minute.values = new Uint8Array([1]))}
    ${"values missing"}                 | ${(e: any) => delete e.minute.values}
    ${"star missing"}                   | ${(e: any) => delete e.hour.star}
    ${"star the number 1"}              | ${(e: any) => (e.hour.star = 1)}
    ${"star null"}                      | ${(e: any) => (e.hour.star = null)}
    ${"field null"}                     | ${(e: any) => (e.minute = null)}
    ${"field an array"}                 | ${(e: any) => (e.minute = [0])}
    ${"minute missing"}                 | ${(e: any) => delete e.minute}
    ${"hour missing"}                   | ${(e: any) => delete e.hour}
    ${"dayOfMonth missing"}             | ${(e: any) => delete e.dayOfMonth}
    ${"dayOfWeek missing"}              | ${(e: any) => delete e.dayOfWeek}
    ${"minute -1"}                      | ${(e: any) => (e.minute.values = [-1])}
    ${"hour -1"}                        | ${(e: any) => (e.hour.values = [-1])}
    ${"dayOfMonth 32"}                  | ${(e: any) => (e.dayOfMonth.values = [32])}
    ${"month 0"}                        | ${(e: any) => (e.month.values = [0])}
    ${"dayOfWeek -1"}                   | ${(e: any) => (e.dayOfWeek.values = [-1])}
    ${"NaN value"}                      | ${(e: any) => (e.minute.values = [Number.NaN])}
    ${"Infinity value"}                 | ${(e: any) => (e.minute.values = [Number.POSITIVE_INFINITY])}
    ${"numeric string value"}           | ${(e: any) => (e.minute.values = ["1"])}
    ${"null value"}                     | ${(e: any) => (e.minute.values = [null])}
    ${"sparse array"}                   | ${(e: any) => (e.minute.values = Object.assign([], { 1: 1 }))}
    ${"descending after a valid start"} | ${(e: any) => (e.minute.values = [0, 5, 4])}
    ${"dayOfWeek [7, 1]"}               | ${(e: any) => (e.dayOfWeek.values = [7, 1])}
  `("returns null for $name", ({ mutate }) => {
    const input = valid();
    mutate(input);
    expect(checkCronExpression(input)).toBeNull();
  });

  it.each`
    name                 | input
    ${"undefined"}       | ${undefined}
    ${"null"}            | ${null}
    ${"a number"}        | ${5}
    ${"a string"}        | ${"* * * * *"}
    ${"an array"}        | ${[]}
    ${"an empty object"} | ${{}}
  `("returns null when the input is $name", ({ input }) => {
    expect(checkCronExpression(input)).toBeNull();
  });

  it.each`
    field           | values
    ${"minute"}     | ${[0, 59]}
    ${"hour"}       | ${[0, 23]}
    ${"dayOfMonth"} | ${[1, 31]}
    ${"month"}      | ${[1, 12]}
    ${"dayOfWeek"}  | ${[1, 7]}
  `("accepts both range ends of $field: $values", ({ field, values }) => {
    const input = valid() as Record<string, unknown>;
    input[field] = { values, star: false };
    expect(checkCronExpression(input)?.[field as "minute"].values).toEqual(
      values,
    );
  });

  it("copies the value arrays so a later change to the input does not reach the result", () => {
    const input = valid();
    const checked = checkCronExpression(input);
    input.minute.values.push(45);
    expect(checked?.minute.values).toEqual([0, 30]);
  });

  // An array whose iterator yields `passes[n]` on pass n+1. Copy once, check, freeze: it runs once.
  const shifting = (passes: number[]) => {
    const values = [1];
    const state = { pass: 0 };
    Object.defineProperty(values, Symbol.iterator, {
      value: function* () {
        state.pass += 1;
        yield passes[state.pass - 1] ?? 0;
      },
    });
    return { values, state };
  };

  it.each`
    passes    | expected
    ${[1, 0]} | ${{ values: [1], star: false }}
    ${[0, 1]} | ${null}
  `(
    "reads a changing iterator once: passes $passes gives $expected",
    ({ passes, expected }) => {
      const { values, state } = shifting(passes);
      const checked = checkCronExpression({
        ...valid(),
        dayOfWeek: { values, star: false },
      });
      expect(checked).toEqual(
        expected === null ? null : { ...valid(), dayOfWeek: expected },
      );
      expect(state.pass).toBe(1);
    },
  );

  it("returns null when a getter throws", () => {
    const hostile = {
      get minute(): never {
        throw new Error("boom");
      },
    };
    expect(checkCronExpression(hostile)).toBeNull();
  });
});

type FieldKey = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

describe("readCronExpression: lists, ranges, steps and names", () => {
  // Expected values are derived from the grammar by hand, in the stored numbering.
  it.each`
    text                      | field           | values                | star
    ${"0 */23 * * *"}         | ${"hour"}       | ${[0, 23]}            | ${true}
    ${"0 0-23/2 * * *"}       | ${"hour"}       | ${upTo(0, 22, 2)}     | ${false}
    ${"*/35 * * * *"}         | ${"minute"}     | ${[0, 35]}            | ${true}
    ${"*/90 * * * *"}         | ${"minute"}     | ${[0]}                | ${true}
    ${"10-20/5 * * * *"}      | ${"minute"}     | ${[10, 15, 20]}       | ${false}
    ${"5,1,5 * * * *"}        | ${"minute"}     | ${[1, 5]}             | ${false}
    ${"0 0 */10 * *"}         | ${"dayOfMonth"} | ${[1, 11, 21, 31]}    | ${true}
    ${"0 0 * jan-mar,dec *"}  | ${"month"}      | ${[1, 2, 3, 12]}      | ${false}
    ${"0 0 * JAN,Feb,mAr *"}  | ${"month"}      | ${[1, 2, 3]}          | ${false}
    ${"0 0 * 2-nov/3 *"}      | ${"month"}      | ${[2, 5, 8, 11]}      | ${false}
    ${"0 0 * * MON,Wed,fri"}  | ${"dayOfWeek"}  | ${[1, 3, 5]}          | ${false}
    ${"0 0 * * mon-fri/2"}    | ${"dayOfWeek"}  | ${[1, 3, 5]}          | ${false}
    ${"0 0 * * fri-sun"}      | ${"dayOfWeek"}  | ${[5, 6, 7]}          | ${false}
    ${"0 0 * * 5-7"}          | ${"dayOfWeek"}  | ${[5, 6, 7]}          | ${false}
    ${"0 0 * * 0-2"}          | ${"dayOfWeek"}  | ${[1, 2, 7]}          | ${false}
    ${"0 0 * * 7"}            | ${"dayOfWeek"}  | ${[7]}                | ${false}
    ${"0 0 * * 0"}            | ${"dayOfWeek"}  | ${[7]}                | ${false}
    ${"0 0 * * 0,7"}          | ${"dayOfWeek"}  | ${[7]}                | ${false}
    ${"0 0 * * sun,7"}        | ${"dayOfWeek"}  | ${[7]}                | ${false}
    ${"0 0 * * sun-sat"}      | ${"dayOfWeek"}  | ${upTo(1, 7)}         | ${false}
    ${"0 0 * * sat-sun"}      | ${"dayOfWeek"}  | ${[6, 7]}             | ${false}
    ${"0 0 * * */2"}          | ${"dayOfWeek"}  | ${[2, 4, 6, 7]}       | ${true}
    ${"0 0 * * */7"}          | ${"dayOfWeek"}  | ${[7]}                | ${true}
    ${"0 0 * * */4"}          | ${"dayOfWeek"}  | ${[4, 7]}             | ${true}
    ${"0 0 * * sun-sat/2"}    | ${"dayOfWeek"}  | ${[2, 4, 6, 7]}       | ${false}
    ${"0 0 * * 0-6/3"}        | ${"dayOfWeek"}  | ${[3, 6, 7]}          | ${false}
    ${"0 0 * * 3-7/2"}        | ${"dayOfWeek"}  | ${[3, 5, 7]}          | ${false}
    ${"0 0 * * 6-0"}          | ${"dayOfWeek"}  | ${[6, 7]}             | ${false}
    ${"0 0 * * 2-sun"}        | ${"dayOfWeek"}  | ${[2, 3, 4, 5, 6, 7]} | ${false}
    ${"0 0 * * 7-0"}          | ${"dayOfWeek"}  | ${[7]}                | ${false}
    ${"0 0 * * 0-7"}          | ${"dayOfWeek"}  | ${upTo(1, 7)}         | ${false}
    ${"0 0 * * SUN-SAT"}      | ${"dayOfWeek"}  | ${upTo(1, 7)}         | ${false}
    ${"0 0 * */5 *"}          | ${"month"}      | ${[1, 6, 11]}         | ${true}
    ${"0 0 * 1-12/6 *"}       | ${"month"}      | ${[1, 7]}             | ${false}
    ${"1-5/90 * * * *"}       | ${"minute"}     | ${[1]}                | ${false}
    ${"000 * * * *"}          | ${"minute"}     | ${[0]}                | ${false}
    ${"05 * * * *"}           | ${"minute"}     | ${[5]}                | ${false}
    ${"*/100 * * * *"}        | ${"minute"}     | ${[0]}                | ${true}
    ${"*/4294967297 * * * *"} | ${"minute"}     | ${[0]}                | ${true}
    ${"*/01 * * * *"}         | ${"minute"}     | ${MINUTES}            | ${true}
    ${"01-03 * * * *"}        | ${"minute"}     | ${[1, 2, 3]}          | ${false}
    ${"0 0 31 * *"}           | ${"dayOfMonth"} | ${[31]}               | ${false}
    ${"59 23 * * *"}          | ${"minute"}     | ${[59]}               | ${false}
    ${"0 */6 * * *"}          | ${"hour"}       | ${[0, 6, 12, 18]}     | ${true}
    ${"0 0 * * 0-0"}          | ${"dayOfWeek"}  | ${[7]}                | ${false}
  `(
    "reads $text: $field is $values (star $star)",
    ({ text, field, values, star }) => {
      const parsed = readCronExpression(text);
      expect(parsed?.[field as FieldKey]).toEqual({ values, star });
    },
  );
});

describe("readCronExpression: nicknames", () => {
  const field = (values: number[], star: boolean) => ({ values, star });
  const fixed = (
    minute: number[],
    hour: number[],
    stars: { hour?: boolean; dom?: boolean; month?: boolean; dow?: boolean },
    dayOfMonth: number[] = DAYS,
    month: number[] = MONTHS,
    dayOfWeek: number[] = WEEKDAYS,
  ) => ({
    minute: field(minute, false),
    hour: field(hour, stars.hour === true),
    dayOfMonth: field(dayOfMonth, stars.dom === true),
    month: field(month, stars.month === true),
    dayOfWeek: field(dayOfWeek, stars.dow === true),
  });

  // Star flags are the ones cronie entry.c lines 173-211 set; values are the table's equivalent
  // five-field line.
  it.each`
    nickname       | expected
    ${"@yearly"}   | ${fixed([0], [0], { dow: true }, [1], [1])}
    ${"@annually"} | ${fixed([0], [0], { dow: true }, [1], [1])}
    ${"@monthly"}  | ${fixed([0], [0], { month: true, dow: true }, [1])}
    ${"@weekly"}   | ${fixed([0], [0], { dom: true, month: true }, DAYS, MONTHS, [7])}
    ${"@daily"}    | ${fixed([0], [0], { dom: true, month: true, dow: true })}
    ${"@midnight"} | ${fixed([0], [0], { dom: true, month: true, dow: true })}
    ${"@hourly"}   | ${fixed([0], HOURS, { hour: true, dom: true, month: true, dow: true })}
  `("reads $nickname", ({ nickname, expected }) => {
    expect(readCronExpression(nickname)).toEqual(expected);
  });

  it("returns a fresh frozen record each time", () => {
    const first = readCronExpression("@daily");
    expect(Object.isFrozen(first)).toBe(true);
    expect(readCronExpression("@daily")).not.toBe(first);
  });
});

describe("readCronExpression: outside the grammar", () => {
  it.each`
    text                       | why
    ${""}                      | ${"empty"}
    ${" * * * * *"}            | ${"leading blank"}
    ${"* * * * * "}            | ${"trailing blank"}
    ${"* * * *"}               | ${"four fields"}
    ${"* * * * * *"}           | ${"six fields"}
    ${"* * * * *\n"}           | ${"trailing newline"}
    ${"*\n* * * *"}            | ${"newline between fields"}
    ${"60 * * * *"}            | ${"minute 60"}
    ${"* 24 * * *"}            | ${"hour 24"}
    ${"* * 0 * *"}             | ${"day of month 0"}
    ${"* * 32 * *"}            | ${"day of month 32"}
    ${"* * * 13 *"}            | ${"month 13"}
    ${"* * * 0 *"}             | ${"month 0"}
    ${"* * * * 8"}             | ${"day of week 8"}
    ${"5-1 * * * *"}           | ${"descending range"}
    ${"*/0 * * * *"}           | ${"step 0"}
    ${"5/10 * * * *"}          | ${"step on a single value"}
    ${"1,*/5 * * * *"}         | ${"star inside a list"}
    ${"*-5 * * * *"}           | ${"star as a range end"}
    ${"1-5/ * * * *"}          | ${"empty step"}
    ${"1,,2 * * * *"}          | ${"empty list item"}
    ${",1 * * * *"}            | ${"leading comma"}
    ${"1, * * * *"}            | ${"trailing comma"}
    ${"4294967296 * * * *"}    | ${"2^32 would wrap to 0 in a C int"}
    ${"0060 * * * *"}          | ${"long digit run out of range"}
    ${"* * * * sat-mon"}       | ${"descending day-of-week names"}
    ${"* * * * 6-1"}           | ${"descending day-of-week range"}
    ${"* * * * 7-1"}           | ${"descending day-of-week range from 7"}
    ${"* * * * mon-fri/mon"}   | ${"name as a step"}
    ${"* * * */jan *"}         | ${"month name as a step"}
    ${"* * * * toString"}      | ${"inherited key as a name"}
    ${"* * * * constructor"}   | ${"inherited key, long, as a name"}
    ${"* * * * __proto__"}     | ${"proto as a name"}
    ${"1-5/2/3 * * * *"}       | ${"two steps"}
    ${"*/2/3 * * * *"}         | ${"star with two steps"}
    ${"-1 * * * *"}            | ${"negative value"}
    ${"+1 * * * *"}            | ${"signed value"}
    ${"1.5 * * * *"}           | ${"fraction"}
    ${"* * * * monday"}        | ${"long name"}
    ${"jan * * * *"}           | ${"name in the wrong field"}
    ${"* * * * jan"}           | ${"month name in day of week"}
    ${"* * * dec-sun *"}       | ${"mixed field names"}
    ${"* * * * sun-sat-mon"}   | ${"three range ends"}
    ${"* * * * mon-sun-"}      | ${"dangling dash"}
    ${"* * * * 5-mo"}          | ${"short name"}
    ${"@reboot"}               | ${"@reboot is not a time"}
    ${"@DAILY"}                | ${"upper-case nickname"}
    ${"@every 5m"}             | ${"@every"}
    ${"@daily "}               | ${"nickname with a blank"}
    ${"@daily * * * *"}        | ${"nickname with fields"}
    ${"0 0 L * *"}             | ${"L"}
    ${"0 0 15W * *"}           | ${"W"}
    ${"0 0 * * 5#3"}           | ${"#"}
    ${"0 0 ? * *"}             | ${"?"}
    ${"H * * * *"}             | ${"H"}
    ${"0~30 * * * *"}          | ${"~"}
    ${"CRON_TZ=UTC 0 0 * * *"} | ${"CRON_TZ"}
    ${"0 0 * * *"}             | ${"non-breaking space"}
    ${"٠ * * * *"}             | ${"Arabic-Indic digit"}
    ${"*/ * * * *"}            | ${"star with empty step"}
    ${"*/00 * * * *"}          | ${"star step 00"}
    ${"1-5/0 * * * *"}         | ${"range step 0"}
    ${"*/-1 * * * *"}          | ${"negative step"}
    ${"*5 * * * *"}            | ${"star then digit"}
    ${"** * * * *"}            | ${"double star"}
    ${"*,1 * * * *"}           | ${"star first in a list"}
    ${"5- * * * *"}            | ${"range missing its end"}
    ${"5-0 * * * *"}           | ${"descending range ending 0 outside day of week"}
    ${"0 5-0 * * *"}           | ${"descending hour range ending 0"}
    ${"* * 5-0 * *"}           | ${"descending day-of-month range ending 0"}
    ${"* * * * 5-8"}           | ${"day-of-week range past 7"}
    ${"* * * * mon,jan"}       | ${"month name in a day-of-week list"}
    ${"* * * * m0n"}           | ${"name with a digit"}
    ${"* * * * mon-"}          | ${"name range missing its end"}
    ${"* * * * -mon"}          | ${"name range missing its start"}
    ${"* * * * sunday"}        | ${"long day name"}
    ${"* * * * 1-5,8"}         | ${"one list item out of range"}
    ${"* * * 1-13 *"}          | ${"month range past 12"}
    ${"* * * jan-feb-mar *"}   | ${"three month range ends"}
    ${"* * * * *\r"}           | ${"trailing carriage return"}
    ${"*\v* * * *"}            | ${"vertical tab as a separator"}
    ${"*\f* * * *"}            | ${"form feed as a separator"}
    ${"*\u00a0* * * *"}        | ${"non-breaking space as a separator"}
    ${"\t* * * * *"}           | ${"leading tab"}
    ${"* * * * *\t"}           | ${"trailing tab"}
    ${"@"}                     | ${"bare at sign"}
    ${"@@daily"}               | ${"double at sign"}
    ${" @daily"}               | ${"nickname with a leading blank"}
    ${"@daily\n"}              | ${"nickname with a newline"}
    ${"@Daily"}                | ${"mixed-case nickname"}
    ${"@YEARLY"}               | ${"upper-case yearly"}
    ${"@constructor"}          | ${"inherited object key"}
    ${"@__proto__"}            | ${"prototype key"}
    ${"@toString"}             | ${"inherited method name"}
  `("returns null for $why: $text", ({ text }) => {
    expect(readCronExpression(text)).toBeNull();
  });
});
