# The Authority Table

Every GMT function implements rules that came from somewhere. The Authority table is where a
spec records where — one row per rule, naming the clause that decides it.

A table that forces each rule to name its clause turns "this seems correct" into something a
reviewer can check.

## The shape

```markdown
## Authority — what each rule rests on

| Rule                                 | Source                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| `t ∈ [start, end) ⇔ start ≤ t < end` | EWD831 (Dijkstra, _Why numbering should start at zero_);      |
|                                      | SQL:2011 application-time `PERIOD` is closed-open              |
|                                      | (ISO/IEC 9075-2:2011); RFC 5545 §3.6.1 `DTEND` is exclusive    |
| Endpoints are instants; zone and     | TC39 Temporal: `Temporal.Instant` carries only epoch           |
| calendar are irrelevant to ordering  | nanoseconds, with no time zone or calendar                     |
| Instant range ±8.64 × 10^21 ns       | TC39 Temporal `Instant` limits. Verified:                      |
|                                      | `fromEpochNanoseconds(8640000000000000000001n)` throws         |
| Sentinels                            | [coding-standards § API Contract](../coding-standards/api-contract.md#api-contract) |
| Tie-breaks between two spellings of  | **GMT rule.** No spec covers this. Reasoning is given where    |
| one instant; empty-interval edges    | the rule is stated                                             |
```

Rows wrap in that sketch only to fit this page; write them on one line.

## Rules for filling it in

- **Name the clause, not just the standard.** "RFC 9557" is not a citation; "RFC 9557 §4.1" is.
  A reviewer has to be able to open the source and read the sentence you relied on.
- **The citation must be verifiable, and a reviewer will open it.** A standard number that does
  not exist, or does not say what the row claims, is a blocker.
- **Prefer the issuing body's own text.** A vendor summary, a blog post, or another library's
  documentation is evidence of what someone concluded, never the authority itself.
- **Mark a rule GMT invents as `GMT rule`, with its reasoning.** Tie-breaks, sentinel choices,
  empty-edge behaviour and precision policies usually have no standard behind them. Owning them
  explicitly is correct; implying a standard covers them is worse than saying nothing.
- **A rule you cannot source is a blocker, not a blank cell.** Report it rather than handing on
  a spec that looks complete. A wrong constant behind a correct function still returns a wrong
  answer, and it will pass every test written from it.
- **Record which rung decided a contested rule.** Where sources disagree, the precedence order
  is on the docs site under
  [The Standards § When sources disagree](../../apps/dox/src/content/docs/guides/concepts/standards.mdx):
  the Temporal specification, then ECMA-402 and the Intl proposals, then RFC 9557 / RFC 3339 /
  ISO 8601, then CLDR, then test262, then real engines as corroboration only.

## Who uses it

| Role                   | Use                                                                              |
| ---------------------- | -------------------------------------------------------------------------------- |
| Planning (`architect`) | Writes the table. A spec without one is incomplete.                              |
| Implementation (`tdd-dev`) | Derives each expected value from the row before writing the assertion.       |
| Coverage (`tester`)    | A row asserting a domain constant cites its clause in the row name or a comment.  |
| Review (`gmt-reviewer`) | Checks the implementation against the table, and a missing row is itself a finding. |

The Definition of Done requires that every function implementing a standard cites the clause it
implements. This table is what that means in practice.

## Where a rule has no spec

Some rules are GMT's own and always will be: which spelling wins when two strings name the same
instant, what an empty interval at a range edge means, which sentinel a return type gets. Put
them in the table marked **GMT rule** with a sentence of reasoning, so a later reader can tell a
deliberate choice from an unsourced guess. That distinction is the whole point of the table.
