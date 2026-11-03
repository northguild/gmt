/**
 * The forms the Database Timestamp Reader reads: one per row of the databases guide's matrix that
 * has a Read cell, with the field names, the call template and the presets.
 *
 * This is the only module that holds database facts as literals (a vendor name, a type name, a
 * database's own epoch arithmetic). It is light on purpose: no library import and no polyfill, so
 * the chat schema can import it. The reader runs each `call` through the library, and a test holds
 * every form to the guide's matrix and every printed call to the call made.
 */

export type FormKind = "export" | "composition" | "new";

/**
 * What a form returns, which decides how the reading is drawn:
 * - `instant`: an instant string;
 * - `offset`: a string that is also split into instant and offset by a second call;
 * - `pair`: the call itself returns an instant and an offset;
 * - `plain`: a zoneless wall time or date;
 * - `valid`: a validator's boolean;
 * - `duration`: an ISO 8601 duration.
 */
export type ResultShape =
  | "instant"
  | "offset"
  | "pair"
  | "plain"
  | "valid"
  | "duration";

/**
 * How a field's text becomes the literal the call takes:
 * - `text`: a string literal;
 * - `number`: a number literal;
 * - `bigint`: an integer as a `bigint` literal;
 * - `integer-text`: a string literal that the template turns into a `bigint` itself.
 */
export type FieldType = "text" | "number" | "bigint" | "integer-text";

/** `name` is the free variable the call template uses. */
export interface DbField {
  name: string;
  label: string;
  hint?: string;
  type?: FieldType;
}

export interface DbForm {
  /** The guide's `db-row` id where the row has one, e.g. `postgresql-timestamptz`. */
  id: string;
  /** The guide's Database cell. */
  database: string;
  /** The guide's "Type or form on the wire" cell, backticks removed. */
  form: string;
  kind: FormKind;
  shape: ResultShape;
  /** One to three fields; each name is a free variable in `call`. */
  fields: readonly DbField[];
  /** MySQL `TIMESTAMP` only: the session time zone, which the template writes as `"UTC"`. */
  zone?: true;
  /** With `zone`, the call that reads the wall time alone, used when the zone is blank. */
  plainCall?: string;
  /** The guide's Read cell, exactly. */
  call: string;
}

/** The literal in a zone form's `call` that the reader's zone replaces. */
export const ZONE_LITERAL = '"UTC"';

const text = (name: string, label: string, hint?: string): DbField => ({
  name,
  label,
  ...(hint ? { hint } : {}),
});
const number = (name: string, label: string, hint?: string): DbField => ({
  ...text(name, label, hint),
  type: "number",
});

export const DB_FORMS: readonly DbForm[] = [
  {
    id: "postgresql-timestamp-text",
    database: "PostgreSQL",
    form: "date, time, timestamp text",
    kind: "export",
    shape: "plain",
    fields: [text("v", "Column text")],
    call: "parseSqlDateTime(v)",
  },
  {
    id: "postgresql-timestamptz",
    database: "PostgreSQL",
    form: "timestamptz text, 2024-03-15 14:30:00+05:30 or …-08",
    kind: "new",
    shape: "offset",
    fields: [text("v", "Column text")],
    call: "parseSqlOffsetDateTime(v)",
  },
  {
    id: "postgresql-binary-microseconds",
    database: "PostgreSQL",
    form: "binary timestamp and timestamptz: int64 µs since 2000-01-01",
    kind: "export",
    shape: "instant",
    fields: [{ ...text("v", "Microseconds"), type: "bigint" }],
    call: "fromPgMicroseconds(v)",
  },
  {
    id: "postgresql-interval",
    database: "PostgreSQL",
    form: "interval with intervalstyle = iso_8601",
    kind: "export",
    shape: "duration",
    fields: [text("v", "Interval text")],
    call: "parseDuration(v)",
  },
  {
    id: "postgresql-extract-epoch",
    database: "PostgreSQL",
    form: "EXTRACT(EPOCH FROM …): numeric seconds with a fraction",
    kind: "composition",
    shape: "instant",
    fields: [number("s", "Seconds")],
    call: "convertUnixToUtc(Math.round(s * 1000))",
  },
  {
    id: "mysql-datetime",
    database: "MySQL",
    form: "DATE, DATETIME(fsp) text",
    kind: "export",
    shape: "plain",
    fields: [text("v", "Column text")],
    call: "parseSqlDateTime(v)",
  },
  {
    id: "mysql-timestamp",
    database: "MySQL",
    form: "TIMESTAMP: stored UTC, shown in the session time_zone, no offset",
    kind: "composition",
    shape: "instant",
    fields: [text("v", "Column text")],
    zone: true,
    plainCall: "parseSqlDateTime(v)",
    call: 'resolveLocal(parseSqlDateTime(v), "UTC")',
  },
  {
    id: "mysql-time",
    database: "MySQL",
    form: "TIME: −838:59:59 to 838:59:59, an elapsed time",
    kind: "composition",
    shape: "duration",
    fields: [
      number("hours", "Hours"),
      number("minutes", "Minutes"),
      number("seconds", "Seconds"),
    ],
    call: "durationFromUnits({ hours, minutes, seconds })",
  },
  {
    id: "sqlserver-datetime-text",
    database: "SQL Server",
    form: "date, time(7), datetime2(7), datetime, smalldatetime text",
    kind: "export",
    shape: "plain",
    fields: [text("v", "Column text")],
    call: "parseSqlDateTime(v)",
  },
  {
    id: "sqlserver-datetimeoffset",
    database: "SQL Server",
    form: "datetimeoffset text, 2007-05-08 12:35:29.1234567 +12:15",
    kind: "new",
    shape: "offset",
    fields: [text("v", "Column text")],
    call: "parseSqlOffsetDateTime(v)",
  },
  {
    id: "oracle-timestamp",
    database: "Oracle",
    form: "TIMESTAMP under NLS_TIMESTAMP_FORMAT",
    kind: "export",
    shape: "plain",
    fields: [text("v", "Column text")],
    call: "parseSqlDateTime(v)",
  },
  {
    id: "oracle-timestamptz",
    database: "Oracle",
    form: "TIMESTAMP WITH TIME ZONE under a TZH:TZM format",
    kind: "new",
    shape: "offset",
    fields: [text("v", "Column text")],
    call: "parseSqlOffsetDateTime(v)",
  },
  {
    id: "sqlite-datetime",
    database: "SQLite",
    form: "datetime() text, UTC",
    kind: "composition",
    shape: "instant",
    fields: [text("v", "Column text")],
    call: 'resolveLocal(parseSqlDateTime(v), "UTC")',
  },
  {
    id: "sqlite-unixepoch",
    database: "SQLite",
    form: "unixepoch(): integer seconds",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Seconds")],
    call: 'convertUnixToUtc(v, { epochUnit: "seconds" })',
  },
  {
    id: "sqlite-julianday",
    database: "SQLite",
    form: "julianday(): real",
    kind: "composition",
    shape: "instant",
    fields: [number("jd", "Julian day")],
    call: "convertUnixToUtc(Math.round((jd - 2440587.5) * 86400000))",
  },
  {
    id: "mongodb-bson-date",
    database: "MongoDB",
    form: "BSON Date: int64 ms since 1970",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Milliseconds")],
    call: "convertUnixToUtc(v)",
  },
  {
    id: "mongodb-extended-json",
    database: "MongoDB",
    form: 'Extended JSON v2 relaxed, {"$date": "2019-08-11T17:54:14.692Z"}',
    kind: "export",
    shape: "valid",
    fields: [text("v", "The $date text")],
    call: "isValidUtc(v)",
  },
  {
    id: "mongodb-timestamp",
    database: "MongoDB",
    form: "Timestamp { t, i }, where t is seconds",
    kind: "export",
    shape: "instant",
    fields: [number("t", "t, in seconds")],
    call: 'convertUnixToUtc(t, { epochUnit: "seconds" })',
  },
  {
    id: "dynamodb-ttl",
    database: "DynamoDB",
    form: "TTL attribute: a Number of epoch seconds",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Seconds")],
    call: 'convertUnixToUtc(v, { epochUnit: "seconds" })',
  },
  {
    id: "redis-time",
    database: "Redis",
    form: "TIME: [seconds, microseconds]",
    kind: "composition",
    shape: "instant",
    fields: [
      { ...text("s", "Seconds"), type: "integer-text" },
      { ...text("us", "Microseconds"), type: "integer-text" },
    ],
    call: 'fromArrowTimestamp(BigInt(s) * 1_000_000n + BigInt(us), "microsecond")',
  },
  {
    id: "redis-expireat",
    database: "Redis",
    form: "EXPIREAT, EXPIRETIME: epoch seconds",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Seconds")],
    call: 'convertUnixToUtc(v, { epochUnit: "seconds" })',
  },
  {
    id: "redis-pexpireat",
    database: "Redis",
    form: "PEXPIREAT, PEXPIRETIME: epoch milliseconds",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Milliseconds")],
    call: "convertUnixToUtc(v)",
  },
  {
    id: "redis-stream-id",
    database: "Redis",
    form: "stream ID, <ms>-<seq>",
    kind: "composition",
    shape: "instant",
    fields: [text("id", "Stream ID")],
    call: 'convertUnixToUtc(Number(id.split("-")[0]))',
  },
  {
    id: "couchbase-epoch-ms",
    database: "Couchbase",
    form: "epoch ms (STR_TO_MILLIS, MILLIS_TO_STR)",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Milliseconds")],
    call: "convertUnixToUtc(v)",
  },
  {
    id: "couchbase-iso",
    database: "Couchbase",
    form: "ISO 8601 strings",
    kind: "export",
    shape: "pair",
    fields: [text("v", "ISO 8601 text")],
    call: "toOffsetInstant(v)",
  },
  {
    id: "cql-timestamp",
    database: "Cassandra, ScyllaDB",
    form: "timestamp: int64 ms since 1970",
    kind: "export",
    shape: "instant",
    fields: [number("v", "Milliseconds")],
    call: "convertUnixToUtc(v)",
  },
  {
    id: "cql-date",
    database: "Cassandra, ScyllaDB",
    form: "date: uint32 days, epoch at 2^31",
    kind: "composition",
    shape: "plain",
    fields: [number("raw", "Raw value")],
    call: 'addDate("1970-01-01", { days: raw - 2 ** 31 })',
  },
  {
    id: "cql-time",
    database: "Cassandra, ScyllaDB",
    form: "time: int64 ns since midnight",
    kind: "composition",
    shape: "plain",
    fields: [number("ns", "Nanoseconds")],
    call: "convertUtcToPlainTime(fromNanoseconds(BigInt(ns)))",
  },
  {
    id: "cql-duration",
    database: "Cassandra, ScyllaDB",
    form: "duration: months, days, ns",
    kind: "composition",
    shape: "duration",
    fields: [
      number("months", "Months"),
      number("days", "Days"),
      number("nanoseconds", "Nanoseconds"),
    ],
    call: "durationFromUnits({ months, days, nanoseconds })",
  },
  {
    id: "neo4j-datetime",
    database: "Neo4j",
    form: "DATE, LOCAL TIME, LOCAL DATETIME",
    kind: "export",
    shape: "valid",
    fields: [text("v", "Property text")],
    call: "isValidDateTime(v)",
  },
  {
    id: "neo4j-zoned-datetime",
    database: "Neo4j",
    form: "ZONED DATETIME, 2025-02-18T12:34:56.789+01:00[Europe/Stockholm]",
    kind: "export",
    shape: "pair",
    fields: [text("v", "Property text")],
    call: "toOffsetInstant(v)",
  },
  {
    id: "neo4j-duration",
    database: "Neo4j",
    form: "DURATION, P14DT16H12M",
    kind: "export",
    shape: "duration",
    fields: [text("v", "Duration text")],
    call: "parseDuration(v)",
  },
];

/** The databases in the order the forms first name them. */
export const DATABASES: readonly string[] = [
  ...new Set(DB_FORMS.map((f) => f.database)),
];

export function formsOf(database: string): readonly DbForm[] {
  return DB_FORMS.filter((form) => form.database === database);
}

/** Matrix rows that have a Read cell and are not forms here: another tool or the guide covers them. */
export const DB_ELSEWHERE: readonly {
  database: string;
  form: string;
  href: string;
  why: string;
}[] = [
  {
    database: "PostgreSQL",
    form: "uuidv7()",
    href: "/tools/id-timestamp-decoder/",
    why: "An identifier holds its creation time. The ID Timestamp Decoder reads it.",
  },
  {
    database: "SQL Server",
    form: ".NET ticks from CLR interop",
    href: "/guides/conversion/foreign-epoch-bridges/",
    why: "A foreign epoch. Foreign Epoch Bridges reads it.",
  },
  {
    database: "SQL Server",
    form: "FILETIME from CLR interop",
    href: "/guides/conversion/foreign-epoch-bridges/",
    why: "A foreign epoch. Foreign Epoch Bridges reads it.",
  },
  {
    database: "Oracle",
    form: "INTERVAL YEAR TO MONTH and DAY TO SECOND, as driver objects",
    href: "/guides/conversion/databases/#oracle",
    why: "A driver object of up to six fields. The guide shows the call.",
  },
  {
    database: "MongoDB",
    form: "ObjectId",
    href: "/tools/id-timestamp-decoder/",
    why: "An identifier holds its creation time. The ID Timestamp Decoder reads it.",
  },
  {
    database: "Cassandra, ScyllaDB",
    form: "timeuuid (UUID v1)",
    href: "/tools/id-timestamp-decoder/",
    why: "An identifier holds its creation time. The ID Timestamp Decoder reads it.",
  },
];

/** `values` is one text per field, in order; `zone` is MySQL `TIMESTAMP`'s session zone. */
export interface DbPreset {
  id: string;
  label: string;
  form: string;
  values: readonly string[];
  zone?: string;
}

export const DB_PRESETS: readonly DbPreset[] = [
  {
    id: "postgresql-timestamptz",
    label: "PostgreSQL timestamptz, +00",
    form: "postgresql-timestamptz",
    values: ["2024-03-15 14:30:00+00"],
  },
  {
    id: "postgresql-timestamptz-half-hour",
    label: "PostgreSQL timestamptz, +05:30",
    form: "postgresql-timestamptz",
    values: ["2024-03-15 14:30:00+05:30"],
  },
  {
    id: "postgresql-timestamptz-minus-eight",
    label: "PostgreSQL timestamptz, -08",
    form: "postgresql-timestamptz",
    values: ["2024-03-15 14:30:00-08"],
  },
  {
    id: "postgresql-timestamptz-seconds-offset",
    label: "PostgreSQL timestamptz, an offset with seconds",
    form: "postgresql-timestamptz",
    values: ["1880-01-01 00:00:00-00:44:30"],
  },
  {
    id: "postgresql-timestamptz-t-rejected",
    label: "PostgreSQL timestamptz with a T",
    form: "postgresql-timestamptz",
    values: ["2024-03-15T14:30:00+00"],
  },
  {
    id: "postgresql-timestamptz-infinity",
    label: "PostgreSQL timestamptz, infinity",
    form: "postgresql-timestamptz",
    values: ["infinity"],
  },
  {
    id: "postgresql-timestamp-text",
    label: "PostgreSQL timestamp",
    form: "postgresql-timestamp-text",
    values: ["2024-03-15 14:30:00"],
  },
  {
    id: "postgresql-binary-microseconds",
    label: "PostgreSQL binary timestamp",
    form: "postgresql-binary-microseconds",
    values: ["763828200000000"],
  },
  {
    id: "postgresql-interval",
    label: "PostgreSQL interval, ISO style",
    form: "postgresql-interval",
    values: ["P1Y2M3DT4H5M6S"],
  },
  {
    id: "postgresql-extract-epoch",
    label: "PostgreSQL EXTRACT(EPOCH …)",
    form: "postgresql-extract-epoch",
    values: ["1710513000.123"],
  },
  {
    id: "mysql-datetime",
    label: "MySQL DATETIME(6)",
    form: "mysql-datetime",
    values: ["2024-03-15 14:30:00.123456"],
  },
  {
    id: "mysql-timestamp",
    label: "MySQL TIMESTAMP, session zone UTC",
    form: "mysql-timestamp",
    values: ["2024-03-15 14:30:00"],
    zone: "UTC",
  },
  {
    id: "mysql-timestamp-kolkata",
    label: "MySQL TIMESTAMP, session zone Asia/Kolkata",
    form: "mysql-timestamp",
    values: ["2024-03-15 14:30:00"],
    zone: "Asia/Kolkata",
  },
  {
    id: "mysql-time",
    label: "MySQL TIME, the largest value",
    form: "mysql-time",
    values: ["838", "59", "59"],
  },
  {
    id: "sqlserver-datetime-text",
    label: "SQL Server datetime2(7)",
    form: "sqlserver-datetime-text",
    values: ["2007-05-08 12:35:29.1234567"],
  },
  {
    id: "sqlserver-datetimeoffset",
    label: "SQL Server datetimeoffset",
    form: "sqlserver-datetimeoffset",
    values: ["2007-05-08 12:35:29.1234567 +12:15"],
  },
  {
    id: "sqlserver-datetimeoffset-t-rejected",
    label: "SQL Server datetimeoffset with a T",
    form: "sqlserver-datetimeoffset",
    values: ["2007-05-08T12:35:29.1234567 +12:15"],
  },
  {
    id: "oracle-timestamp",
    label: "Oracle TIMESTAMP",
    form: "oracle-timestamp",
    values: ["2024-03-15 14:30:00.123456"],
  },
  {
    id: "oracle-timestamptz",
    label: "Oracle TIMESTAMP WITH TIME ZONE",
    form: "oracle-timestamptz",
    values: ["2024-03-15 14:30:00.123456 +05:30"],
  },
  {
    id: "oracle-timestamptz-t-rejected",
    label: "Oracle TIMESTAMP WITH TIME ZONE with a T",
    form: "oracle-timestamptz",
    values: ["2024-03-15T14:30:00.123456 +05:30"],
  },
  {
    id: "sqlite-datetime",
    label: "SQLite datetime()",
    form: "sqlite-datetime",
    values: ["2024-03-15 14:30:00"],
  },
  {
    id: "sqlite-unixepoch",
    label: "SQLite unixepoch()",
    form: "sqlite-unixepoch",
    values: ["1710513000"],
  },
  {
    id: "sqlite-julianday",
    label: "SQLite julianday()",
    form: "sqlite-julianday",
    values: ["2460385.1041666665"],
  },
  {
    id: "mongodb-bson-date",
    label: "MongoDB BSON Date",
    form: "mongodb-bson-date",
    values: ["1710513000123"],
  },
  {
    id: "mongodb-extended-json",
    label: "MongoDB Extended JSON $date",
    form: "mongodb-extended-json",
    values: ["2019-08-11T17:54:14.692Z"],
  },
  {
    id: "mongodb-timestamp",
    label: "MongoDB Timestamp",
    form: "mongodb-timestamp",
    values: ["1710513000"],
  },
  {
    id: "dynamodb-ttl",
    label: "DynamoDB TTL attribute",
    form: "dynamodb-ttl",
    values: ["1710513000"],
  },
  {
    id: "redis-time",
    label: "Redis TIME",
    form: "redis-time",
    values: ["1710513000", "123456"],
  },
  {
    id: "redis-expireat",
    label: "Redis EXPIREAT",
    form: "redis-expireat",
    values: ["1710513000"],
  },
  {
    id: "redis-pexpireat",
    label: "Redis PEXPIREAT",
    form: "redis-pexpireat",
    values: ["1710513000000"],
  },
  {
    id: "redis-stream-id",
    label: "Redis stream ID",
    form: "redis-stream-id",
    values: ["1710513000123-0"],
  },
  {
    id: "couchbase-epoch-ms",
    label: "Couchbase epoch milliseconds",
    form: "couchbase-epoch-ms",
    values: ["1710513000123"],
  },
  {
    id: "couchbase-iso",
    label: "Couchbase ISO 8601 string",
    form: "couchbase-iso",
    values: ["2024-03-15T14:30:00+05:30"],
  },
  {
    id: "cql-timestamp",
    label: "CQL timestamp",
    form: "cql-timestamp",
    values: ["1710513000123"],
  },
  {
    id: "cql-date",
    label: "CQL date",
    form: "cql-date",
    values: ["2147503445"],
  },
  {
    id: "cql-time",
    label: "CQL time",
    form: "cql-time",
    values: ["52200000000000"],
  },
  {
    id: "cql-duration",
    label: "CQL duration",
    form: "cql-duration",
    values: ["14", "3", "4000000000"],
  },
  {
    id: "neo4j-datetime",
    label: "Neo4j LOCAL DATETIME",
    form: "neo4j-datetime",
    values: ["2024-03-15T14:30:00"],
  },
  {
    id: "neo4j-zoned-datetime",
    label: "Neo4j ZONED DATETIME",
    form: "neo4j-zoned-datetime",
    values: ["2025-02-18T12:34:56.789+01:00[Europe/Stockholm]"],
  },
  {
    id: "neo4j-duration",
    label: "Neo4j DURATION",
    form: "neo4j-duration",
    values: ["P14DT16H12M"],
  },
];

/** The form with this id, or undefined. */
export function formOf(id: string): DbForm | undefined {
  return DB_FORMS.find((form) => form.id === id);
}

/**
 * The call the reader makes: the template, with a zone form's `"UTC"` replaced by the zone, or the
 * wall-time call alone when the zone is blank.
 */
export function callOf(form: DbForm, zone?: string): string {
  if (!form.zone) return form.call;
  const named = (zone ?? "").trim();
  if (named === "") return form.plainCall ?? form.call;
  return form.call.replace(ZONE_LITERAL, JSON.stringify(named));
}
