# FIN-95 — Design notes

Part of [FIN-95](../FIN-95.md).

- **Precision comes from the digit count and is reported, never widened.** A millisecond stamp
  returns `"millisecond"` and an instant with three fraction digits.
- **Nothing is dropped silently.** Temporal holds nanoseconds, and FIX allows picoseconds. The
  parser puts the first nine digits in `instant` and the last three in `picoseconds`, so a caller
  who needs them keeps them. INT-15 refuses a fraction longer than nine digits for the same reason:
  a parser must not cut a value without saying so.
- **The formatter cuts to the precision and never rounds**, as INT-15's formatters do. Under
  `"picosecond"` it writes the nine nanosecond digits and then `000`: the value holds nothing finer.
  This widens the field to the width the counterparty asked for, as INT-15 writes `14:30:00` as
  `14300000` under `HHMMSSDD`.
- **The leap second is checked against the table, not the pattern.** `60` is well-formed on any day
  and real on 27. The parser accepts it only where `isLeapSecond` (SPA-48) does, and returns the
  instant as `…T23:59:60Z`, the string `fromTAI` writes. The formatter takes that string back, so a
  leap second round-trips.
- **One public check, no public pattern.** A `UTCTimestamp` is valid only once its day exists and
  its `60` is an inserted second, which no pattern can say. So the public check is
  `isValidFixUtcTimestamp`, and the grammar stays in `internal/`, as INT-15 keeps the EDI grammars.
- **A local time is not written.** `UTCTimestamp` is UTC. A local date-time with no offset names no
  UTC second until a zone is supplied, so the formatter returns the sentinel for one; `resolveLocal`
  gives the instant first.
- **Another width is the parties' agreement, not the standard's.** FIX says "Other number of digits
  may be used with bilateral agreement". The precision of such a width is whatever the parties
  agreed, which no value states, so the parser returns the sentinel and the caller who has the
  agreement reads it with `parseDateTimeWithPattern` or its own code.
- Which FIX field carries which timestamp (`SendingTime`, `TransactTime`) is the FIX dictionary's
  concern. This story reads and writes the data type.
