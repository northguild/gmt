import {
  databaseFormProblems,
  showDatabaseTimestampReaderInput,
} from "./dox-tools";

describe("databaseFormProblems", () => {
  it("is empty for a sound call", () => {
    expect(
      databaseFormProblems({
        form: "postgresql-timestamptz",
        value: "2024-03-15 14:30:00+00",
      }),
    ).toEqual([]);
    expect(
      databaseFormProblems({
        form: "mysql-timestamp",
        value: "2024-03-15 14:30:00",
        zone: "Asia/Kolkata",
      }),
    ).toEqual([]);
  });

  it("names a two-field form given one value", () => {
    const problems = databaseFormProblems({ form: "redis-time", value: "1" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/takes 2 values/);
  });

  it("names a value the form has no field for", () => {
    expect(
      databaseFormProblems({
        form: "postgresql-timestamptz",
        value: "a",
        value2: "b",
      }),
    ).toHaveLength(1);
  });

  it("refuses a zone on a PostgreSQL form", () => {
    const problems = databaseFormProblems({
      form: "postgresql-timestamptz",
      value: "2024-03-15 14:30:00+00",
      zone: "Europe/London",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no session time zone/);
  });

  it("is carried by the schema", () => {
    expect(
      showDatabaseTimestampReaderInput.safeParse({
        form: "redis-time",
        value: "1",
      }).success,
    ).toBe(false);
    expect(
      showDatabaseTimestampReaderInput.safeParse({
        form: "redis-time",
        value: "1",
        value2: "2",
      }).success,
    ).toBe(true);
  });

  it("refuses an unknown form id in the enum", () => {
    expect(
      showDatabaseTimestampReaderInput.safeParse({
        form: "postgresql-nonsense",
        value: "x",
      }).success,
    ).toBe(false);
  });

  it("refuses a value over 96 characters", () => {
    expect(
      showDatabaseTimestampReaderInput.safeParse({
        form: "postgresql-timestamptz",
        value: "x".repeat(97),
      }).success,
    ).toBe(false);
  });
});
