import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DATABASES,
  DB_ELSEWHERE,
  DB_FORMS,
  DB_PRESETS,
  ZONE_LITERAL,
  callOf,
  formOf,
  formsOf,
} from "./database-timestamp-forms";

describe("the forms", () => {
  it("have unique ids of the guide's shape", () => {
    const ids = DB_FORMS.map((form) => form.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
  });

  it("take one to three fields, each named in the call", () => {
    for (const form of DB_FORMS) {
      expect(form.fields.length, form.id).toBeGreaterThanOrEqual(1);
      expect(form.fields.length, form.id).toBeLessThanOrEqual(3);
      for (const field of form.fields) {
        expect(form.call, `${form.id}: ${field.name}`).toMatch(
          new RegExp(`\\b${field.name}\\b`),
        );
      }
    }
  });

  it("give only a form with a zone a zone and a wall-time call", () => {
    for (const form of DB_FORMS) {
      if (form.zone) {
        expect(form.call, form.id).toContain(ZONE_LITERAL);
        expect(form.plainCall, form.id).toBeDefined();
        expect(form.call, form.id).toContain(form.plainCall);
      } else {
        expect(form.plainCall, form.id).toBeUndefined();
      }
    }
    expect(DB_FORMS.filter((form) => form.zone).map((form) => form.id)).toEqual(
      ["mysql-timestamp"],
    );
  });

  it("derive the databases and their forms from one list", () => {
    expect(DATABASES.flatMap((name) => formsOf(name))).toHaveLength(
      DB_FORMS.length,
    );
    expect(new Set(DATABASES).size).toBe(DATABASES.length);
  });

  it("write the zone into the call, or fall back to the wall-time call", () => {
    const form = formOf("mysql-timestamp")!;
    expect(callOf(form, "Asia/Kolkata")).toBe(
      'resolveLocal(parseSqlDateTime(v), "Asia/Kolkata")',
    );
    expect(callOf(form, "  ")).toBe("parseSqlDateTime(v)");
    expect(callOf(formOf("sqlite-datetime")!, "Asia/Kolkata")).toBe(
      formOf("sqlite-datetime")!.call,
    );
  });
});

describe("the forms left elsewhere", () => {
  it("point at a page on this site", () => {
    for (const entry of DB_ELSEWHERE) {
      expect(entry.href, entry.form).toMatch(/^\/(tools|guides)\//);
      expect(entry.why, entry.form).not.toBe("");
    }
  });
});

describe("the presets", () => {
  it("have unique ids and name a form", () => {
    const ids = DB_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of DB_PRESETS) {
      expect(formOf(preset.form), preset.id).toBeDefined();
    }
  });

  it("give as many values as the form has fields", () => {
    for (const preset of DB_PRESETS) {
      expect(preset.values, preset.id).toHaveLength(
        formOf(preset.form)!.fields.length,
      );
    }
  });

  it("carry a zone only on a form with one", () => {
    for (const preset of DB_PRESETS) {
      if (preset.zone !== undefined) {
        expect(formOf(preset.form)!.zone, preset.id).toBe(true);
      }
    }
  });

  it("cover every database and every new form", () => {
    for (const name of DATABASES) {
      expect(
        DB_PRESETS.some((p) => formOf(p.form)!.database === name),
        name,
      ).toBe(true);
    }
    for (const form of DB_FORMS) {
      expect(
        DB_PRESETS.some((p) => p.form === form.id),
        form.id,
      ).toBe(true);
    }
  });

  it("gives each form a first preset with the form's own id", () => {
    for (const form of DB_FORMS) {
      expect(DB_PRESETS.find((p) => p.form === form.id)?.id, form.id).toBe(
        form.id,
      );
    }
    expect(DB_PRESETS[0].id).toBe("postgresql-timestamptz");
    expect(DB_PRESETS[0].values).toEqual(["2024-03-15 14:30:00+00"]);
  });
});

describe("the module", () => {
  it("imports nothing from the library or the polyfill", () => {
    const source = readFileSync(
      join(__dirname, "database-timestamp-forms.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/@northguild\/gmt/);
    expect(source).not.toMatch(/@js-temporal/);
    expect(source).not.toMatch(/^import /m);
  });
});
