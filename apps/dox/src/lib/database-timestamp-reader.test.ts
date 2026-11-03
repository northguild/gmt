import { databaseLib } from "~/test/database-lib";
import type { DatabaseLib } from "./database-lib";
import {
  DB_FORMS,
  DB_PRESETS,
  formOf,
  type DbPreset,
} from "./database-timestamp-forms";
import {
  GIVE_ZONE_TEXT,
  NOT_A_NUMBER_TEXT,
  READERS,
  readDb,
  unknownZoneText,
  type DbCall,
} from "./database-timestamp-reader";

const read = (preset: DbPreset, lib: DatabaseLib = databaseLib) =>
  readDb(lib, preset.form, preset.values, preset.zone);
const preset = (id: string) => {
  const found = DB_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
};

/** Runs printed code against the lib: its declarations, then its last line as the result. */
function evaluate(code: string, lib: DatabaseLib): unknown {
  const cut = code.lastIndexOf("\n") + 1;
  const body = `${code.slice(0, cut)}return ${code.slice(cut)};`;
  return new Function(...Object.keys(lib), body)(...Object.values(lib));
}

describe("the readers", () => {
  it("have one function per form id", () => {
    expect(Object.keys(READERS).sort()).toEqual(
      DB_FORMS.map((form) => form.id).sort(),
    );
  });
});

describe("every preset", () => {
  it.each(DB_PRESETS.map((p) => [p.id, p] as const))(
    "%s gives a reading",
    (_id, p) => {
      const reading = read(p);
      expect(reading.form.id).toBe(p.form);
      expect(reading.calls.length).toBeGreaterThan(0);
      expect(reading.calls[0].code).toContain(reading.form.fields[0].name);
    },
  );

  it("prints the call it made (the printed code returns what the reading says)", () => {
    const mysql = preset("mysql-timestamp");
    const readings = [
      ...DB_PRESETS.map((p) => [p.id, read(p)] as const),
      // No preset leaves the zone blank or names an unknown one, and each prints other code.
      [
        "mysql-timestamp, blank zone",
        readDb(databaseLib, mysql.form, mysql.values),
      ] as const,
      [
        "mysql-timestamp, unknown zone",
        readDb(databaseLib, mysql.form, mysql.values, "Mars/Olympus"),
      ] as const,
    ];
    for (const [id, reading] of readings) {
      for (const call of [...reading.calls, ...(reading.iso ?? [])]) {
        const result = evaluate(call.code, databaseLib);
        expect(JSON.stringify(result), `${id}: ${call.code}`).toBe(
          call.returned,
        );
      }
    }
  });

  it("reads to something, except the sentinel presets", () => {
    for (const p of DB_PRESETS) {
      const sentinel = /-(t-rejected|infinity)$/.test(p.id);
      expect(read(p).ok, p.id).toBe(!sentinel);
    }
  });
});

describe("the new forms", () => {
  const newForms = DB_FORMS.filter((form) => form.kind === "new");

  it("have a sentinel preset that reads as no value", () => {
    for (const form of newForms) {
      const sentinels = DB_PRESETS.filter(
        (p) => p.form === form.id && /-(t-rejected|infinity)$/.test(p.id),
      );
      expect(sentinels.length, form.id).toBeGreaterThan(0);
      for (const p of sentinels) {
        const reading = read(p);
        expect(reading.ok, p.id).toBe(false);
        expect(reading.value, p.id).toBe("");
        expect(reading.iso, p.id).toHaveLength(2);
      }
    }
  });

  it("carry the real return of toOffsetInstant and parseRfc3339 on the same text", () => {
    for (const p of DB_PRESETS.filter((q) =>
      newForms.some((f) => f.id === q.form),
    )) {
      const [offset, rfc] = read(p).iso as readonly DbCall[];
      expect(offset.returned, p.id).toBe(
        JSON.stringify(databaseLib.toOffsetInstant(p.values[0])),
      );
      expect(rfc.returned, p.id).toBe(
        JSON.stringify(databaseLib.parseRfc3339(p.values[0])),
      );
    }
  });

  it("shows a space-separated form that only toOffsetInstant refuses and parseRfc3339 refuses too", () => {
    const [offset, rfc] = readDb(databaseLib, "sqlserver-datetimeoffset", [
      "2007-05-08 12:35:29.1234567 +12:15",
    ]).iso as readonly DbCall[];
    expect(offset.returned).toBe("null");
    expect(rfc.returned).toBe('""');
  });

  it("shows an hour-only and a seconds offset that parseRfc3339 refuses", () => {
    for (const text of [
      "2024-03-15 14:30:00+00",
      "1880-01-01 00:00:00-00:44:30",
    ]) {
      const iso = readDb(databaseLib, "postgresql-timestamptz", [text])
        .iso as readonly DbCall[];
      expect(iso[1].returned, text).toBe('""');
    }
  });

  it("has an overlap preset that parseRfc3339 reads, and the two readings agree", () => {
    const half = preset("postgresql-timestamptz-half-hour");
    expect(half.values).toEqual(["2024-03-15 14:30:00+05:30"]);
    const reading = read(half);
    const rfc = JSON.parse(reading.iso![1].returned) as string;
    expect(rfc).toBe("2024-03-15T14:30:00+05:30[+05:30]");
    const split = databaseLib.toOffsetInstant(rfc)!;
    expect(split.instant).toBe(reading.instant);
    expect(split.offset).toBe(reading.offset);
  });

  it("reads SQL Server's own example with its offset", () => {
    const reading = readDb(databaseLib, "sqlserver-datetimeoffset", [
      "2007-05-08 12:35:29.1234567 +12:15",
    ]);
    expect(reading.value).toBe("2007-05-08T12:35:29.1234567+12:15");
    expect(reading.offset).toBe("+12:15");
  });

  it("keeps a seconds offset", () => {
    const reading = read(preset("postgresql-timestamptz-seconds-offset"));
    expect(reading.ok).toBe(true);
    expect(reading.value).toContain("-00:44:30");
    expect(reading.offset).toBe("-00:44:30");
  });
});

describe("MySQL TIMESTAMP", () => {
  it("gives a plain reading and a note when the zone is blank", () => {
    const reading = readDb(databaseLib, "mysql-timestamp", [
      "2024-03-15 14:30:00",
    ]);
    expect(reading.shape).toBe("plain");
    expect(reading.ok).toBe(true);
    expect(reading.value).not.toMatch(/Z$/);
    expect(reading.note).toBe(GIVE_ZONE_TEXT);
    expect(reading.calls[0].code).toContain("parseSqlDateTime(v)");
    expect(reading.calls[0].code).not.toContain("resolveLocal");
  });

  it("resolves the wall time in the zone it is given", () => {
    const utc = read(preset("mysql-timestamp"));
    const kolkata = read(preset("mysql-timestamp-kolkata"));
    expect(utc.shape).toBe("instant");
    expect(utc.value).toBe(
      databaseLib.resolveLocal("2024-03-15T14:30:00", "UTC"),
    );
    expect(kolkata.value).toBe(
      databaseLib.resolveLocal("2024-03-15T14:30:00", "Asia/Kolkata"),
    );
    expect(kolkata.calls[0].code).toContain('"Asia/Kolkata"');
  });

  it("checks an unknown zone first and names it", () => {
    const reading = readDb(
      databaseLib,
      "mysql-timestamp",
      ["2024-03-15 14:30:00"],
      "Mars/Base",
    );
    expect(reading.ok).toBe(false);
    expect(reading.value).toBe("");
    expect(reading.note).toBe(unknownZoneText("Mars/Base"));
    expect(reading.calls).toEqual([
      { code: 'isValidTimeZone("Mars/Base")', returned: "false" },
    ]);
  });

  it("ignores a zone on any other form", () => {
    expect(
      readDb(
        databaseLib,
        "sqlite-datetime",
        ["2024-03-15 14:30:00"],
        "Asia/Kolkata",
      ).value,
    ).toBe(
      readDb(databaseLib, "sqlite-datetime", ["2024-03-15 14:30:00"]).value,
    );
  });
});

describe("bad numbers", () => {
  function spied() {
    const calls: string[] = [];
    const lib = Object.fromEntries(
      Object.entries(databaseLib).map(([name, fn]) => [
        name,
        (...args: unknown[]) => {
          calls.push(name);
          return (fn as (...a: unknown[]) => unknown)(...args);
        },
      ]),
    ) as unknown as DatabaseLib;
    return { lib, calls };
  }

  it("make no library call and say why", () => {
    const cases: [string, string[]][] = [
      ["postgresql-extract-epoch", ["abc"]],
      ["sqlite-unixepoch", [""]],
      ["postgresql-binary-microseconds", ["1.5"]],
      ["redis-time", ["12", "x"]],
      ["mysql-time", ["1", "", "3"]],
      ["cql-time", ["1.5"]],
    ];
    for (const [id, values] of cases) {
      const { lib, calls } = spied();
      const reading = readDb(lib, id, values);
      expect(reading.ok, id).toBe(false);
      expect(reading.value, id).toBe("");
      expect(reading.note, id).toBe(NOT_A_NUMBER_TEXT);
      expect(calls, id).toEqual([]);
    }
  });

  it("does not refuse a sentinel the library returns", () => {
    const reading = readDb(databaseLib, "sqlite-unixepoch", ["1e30"]);
    expect(reading.note).toBeUndefined();
    expect(reading.calls).toHaveLength(1);
  });
});

describe("shapes", () => {
  it("gives a validator's boolean as the value", () => {
    const yes = readDb(databaseLib, "mongodb-extended-json", [
      "2019-08-11T17:54:14.692Z",
    ]);
    expect(yes).toMatchObject({ ok: true, valid: true, value: "true" });
    const no = readDb(databaseLib, "mongodb-extended-json", ["nope"]);
    expect(no).toMatchObject({ ok: false, valid: false, value: "false" });
  });

  it("splits a pair the call itself returned", () => {
    const reading = read(preset("neo4j-zoned-datetime"));
    expect(reading.shape).toBe("pair");
    expect(reading.instant).toBe(reading.value);
    expect(reading.offset).toBe("+01:00");
    expect(reading.timeZone).toBe("Europe/Stockholm");
    expect(reading.calls).toHaveLength(1);
  });

  it("knows no form it was not given", () => {
    expect(() => readDb(databaseLib, "nope", [])).toThrow(/No database form/);
    expect(formOf("nope")).toBeUndefined();
  });
});
