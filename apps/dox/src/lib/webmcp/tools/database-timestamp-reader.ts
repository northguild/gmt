/**
 * WebMCP tool for `/tools/database-timestamp-reader/`: one value a database driver returned, read
 * in the form its database and type name, from the same `readDb` the page's redraw calls. The
 * printed-call frames and the offset plate's layout are drawing and not part of it.
 */
import { loadDatabaseLib } from "../../database-lib";
import { DB_PRESETS, type DbPreset } from "../../database-timestamp-forms";
import {
  permalinkOf,
  readArgs,
  readDb,
  reasonOf,
  type DatabaseTimestampReaderArgs,
} from "../../database-timestamp-reader";
import { showDatabaseTimestampReaderInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first: DbPreset | undefined = DB_PRESETS[0];
if (first === undefined)
  throw new Error("database-timestamp-reader: no presets");

/** A preset's fields as the tool's own keys. */
function valuesOf(p: DbPreset): {
  value: string;
  value2?: string;
  value3?: string;
} {
  const [value = "", value2, value3] = p.values;
  return {
    value,
    ...(value2 === undefined ? {} : { value2 }),
    ...(value3 === undefined ? {} : { value3 }),
  };
}

export const def = definePageTool({
  page: "database-timestamp-reader",
  name: "read_database_timestamp",
  title: "Database Timestamp Reader",
  doxTool: "showDatabaseTimestampReader",
  returns:
    "form, database, shape, value, ok, valid, instant, offset, timeZone, calls and iso",
  calls: [
    "parseSqlDateTime",
    "parseSqlOffsetDateTime",
    "fromPgMicroseconds",
    "parseDuration",
    "convertUnixToUtc",
    "resolveLocal",
    "durationFromUnits",
    "isValidUtc",
    "fromArrowTimestamp",
    "toOffsetInstant",
    "addDate",
    "convertUtcToPlainTime",
    "fromNanoseconds",
    "isValidDateTime",
    "isValidTimeZone",
    "parseRfc3339",
  ],
  rules: ["Each field of the form needs a value; empty is refused."],
  argsSwaps: [
    [
      "form: required, the id of the form the reader's database and type select; value, and value2 or value3 when the form has more fields: exactly as the reader gave them, never trimmed or corrected; zone: only for MySQL TIMESTAMP, and only when the reader named the session time zone.",
      "form: required; value, value2, value3: as given, never trimmed or corrected; zone: only for MySQL TIMESTAMP, only when the reader named the session time zone",
    ],
  ],
  input: showDatabaseTimestampReaderInput,
  example: {
    form: first.form,
    ...valuesOf(first),
    ...(first.zone === undefined ? {} : { zone: first.zone }),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadDatabaseLib, signal);
    const seed: DatabaseTimestampReaderArgs = {
      form: args.form,
      value: args.value,
      ...(args.value2 === undefined ? {} : { value2: args.value2 }),
      ...(args.value3 === undefined ? {} : { value3: args.value3 }),
      ...(args.zone === undefined ? {} : { zone: args.zone }),
    };
    const state = readArgs(seed);
    const reading = readDb(lib, state.formId, state.values, state.zone);
    const reason = reasonOf(reading);
    const pair = (c: { code: string; returned: string }) => ({
      code: c.code,
      returned: c.returned,
    });
    return {
      input: { ...args },
      result: jsonSafe({
        form: reading.form.id,
        database: reading.form.database,
        shape: reading.shape,
        value: reading.value,
        ok: reading.ok,
        valid: reading.valid ?? null,
        instant: reading.instant ?? null,
        offset: reading.offset ?? null,
        timeZone: reading.timeZone ?? null,
        calls: reading.calls.map(pair),
        iso: reading.iso === undefined ? null : reading.iso.map(pair),
      }),
      notes: reason === "" ? [] : [reason],
      link: encodeWidgetPermalink("dbstamp", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
