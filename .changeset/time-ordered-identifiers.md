---
"@northguild/gmt": minor
---

Read the time out of a UUID, ULID, MongoDB ObjectId, Snowflake or KSUID, and bridge Parquet `INT96`, Arrow and protobuf timestamps (Story CORE-56). Seven functions are in the new `@northguild/gmt/precision/identifiers` subpath, and eight converters join the foreign-epoch bridges in `@northguild/gmt/precision/convert`. The root and `@northguild/gmt/precision` export them too.

Many identifiers are timestamps. Each has its own epoch and width, so code that decodes them by hand often reads the wrong date. GMT decodes IDs and generates none.

```typescript
import { fromUuidTimestamp, fromSnowflake, uuidV7TimestampPrefix } from "@northguild/gmt/precision/identifiers";

fromUuidTimestamp("017F22E2-79B0-7CC3-98C4-DC0C0C07398F");
// { instant: "2022-02-22T19:22:22Z", version: 7 }
fromUuidTimestamp("f81d4fae-7dec-41d0-a765-00a0c91e6bf6"); // null (version 4 carries no time)
fromSnowflake("175928847299117063", { epochMs: 1420070400000, shift: 22 });
// "2016-04-30T11:18:25.796Z"
uuidV7TimestampPrefix("2024-01-01T00:00:00Z"); // "018cc251-f400"
```

- `fromUuidTimestamp` reads versions 1, 6 and 7 and returns `null` for any other. Versions 1 and 6 keep their 100 ns ticks, and version 7 gives milliseconds. `uuidV7TimestampPrefix` and `ulidTimestampPrefix` give the start of an ID for a range scan.
- `fromUlid`, `fromObjectId` and `fromKsuid` return `""` for text that is not an ID. They accept only the exact form, so a ULID with an `I`, `L`, `O` or `U` is rejected and a KSUID is case-sensitive.
- `fromSnowflake` takes the layout as a required argument (`SnowflakeLayout`), because one ID read with another system's epoch gives a plausible wrong date. It takes a `bigint` or a string and never a `number`.
- `toParquetInt96` / `fromParquetInt96`, `toArrowTimestamp` / `fromArrowTimestamp`, `toProtoTimestamp` / `fromProtoTimestamp` and `toProtoDuration` / `fromProtoDuration` convert both ways. An Arrow column without a timezone holds wall-clock time, so `fromArrowTimestamp` returns `{ local, zoneless: true }` and not an instant. A protobuf `Timestamp` counts `nanos` forward from `seconds`, so `-0.5 s` before the epoch is `{ seconds: -1n, nanos: 500000000 }`.

The docs add the ID Timestamp Decoder at `/tools/id-timestamp-decoder/`, the Column Timestamp Bridge at `/tools/column-timestamp-bridge/`, a time-ordered identifiers guide and three scenarios.
