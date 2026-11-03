/**
 * The reader's forms are the guide's matrix. This guard reads the guide as text and holds every
 * form to its row (Database, form and Read cell), every row with a Read cell to a form or to a
 * reader elsewhere, the Kind cell to the form's kind, and each snippet's own values to the call.
 */
import { databaseLib } from "~/test/database-lib";
import { ONE_WAY, guideRows, guideSnippets } from "~/test/databases-guide-page";
import { DB_ELSEWHERE, DB_FORMS } from "./database-timestamp-forms";
import { readDb } from "./database-timestamp-reader";

const rows = guideRows();
const snippets = guideSnippets();
const KIND = { export: "✓", composition: "≈", new: "new" } as const;

describe("the forms against the guide's matrix", () => {
  it("has a row for every form, with the same Database, form and Read cell", () => {
    for (const form of DB_FORMS) {
      const row = rows.find(
        (r) => r.database === form.database && r.form === form.form,
      );
      expect(row, `${form.id}: ${form.database}, ${form.form}`).toBeDefined();
      expect(row!.read, form.id).toBe(form.call);
    }
  });

  it("has a snippet with the form's id whenever its kind is not export", () => {
    for (const form of DB_FORMS.filter((f) => f.kind !== "export")) {
      expect(
        snippets.some((s) => s.id === form.id),
        form.id,
      ).toBe(true);
    }
  });

  it("agrees on the Kind cell", () => {
    for (const form of DB_FORMS) {
      const row = rows.find(
        (r) => r.database === form.database && r.form === form.form,
      );
      expect(row?.kind, form.id).toBe(KIND[form.kind]);
    }
  });

  it("makes every row with a Read cell a form or an entry left elsewhere", () => {
    for (const row of rows.filter((r) => !ONE_WAY.includes(r.read))) {
      const isForm = DB_FORMS.some(
        (f) => f.database === row.database && f.form === row.form,
      );
      const isElsewhere = DB_ELSEWHERE.some(
        (e) => e.database === row.database && e.form === row.form,
      );
      expect(isForm !== isElsewhere, `${row.database}: ${row.form}`).toBe(true);
    }
  });

  it("leaves no entry elsewhere without a row", () => {
    for (const entry of DB_ELSEWHERE) {
      expect(
        rows.some(
          (r) => r.database === entry.database && r.form === entry.form,
        ),
        `${entry.database}: ${entry.form}`,
      ).toBe(true);
    }
  });

  it("treats a row with one direction only as no form", () => {
    for (const row of rows.filter((r) => ONE_WAY.includes(r.read))) {
      expect(
        DB_FORMS.some(
          (f) => f.database === row.database && f.form === row.form,
        ),
        `${row.database}: ${row.form}`,
      ).toBe(false);
    }
  });
});

describe("the guide's snippets against the reader", () => {
  it("reads each snippet's own values to the literal the guide prints", () => {
    for (const form of DB_FORMS) {
      const snippet = snippets.find((s) => s.id === form.id);
      if (!snippet) continue;
      const values = form.fields.map((field) => {
        const constant = snippet.constants.find((c) => c.name === field.name);
        expect(constant, `${form.id}: ${field.name}`).toBeDefined();
        const value = new Function(`return ${constant!.literal}`)();
        return String(value);
      });
      const reading = readDb(
        databaseLib,
        form.id,
        values,
        form.zone ? "UTC" : undefined, // the snippet writes its zone into the call
      );
      expect(JSON.stringify(reading.value), form.id).toBe(snippet.literal);
    }
  });
});
