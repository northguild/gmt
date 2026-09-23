import { readRfc5322DateTime } from "./rfc5322DateTime";

const FIELDS_2024_01_01 = {
  dayOfWeek: 1,
  year: 2024,
  month: 1,
  day: 1,
  hour: 0,
  minute: 0,
  second: 0,
  offset: "+00:00",
};

describe("readRfc5322DateTime comment folding", () => {
  // RFC 5322 §3.2.2: comment = "(" *([FWS] ccontent) [FWS] ")", ccontent = ctext / quoted-pair /
  // comment, quoted-pair = "\" (VCHAR / WSP). A quoted-pair escapes the parenthesis after it at
  // every depth, including right after a nested comment.
  it.each`
    description                                             | comment
    ${"a quoted-pair ( after a nested comment"}             | ${"(()\\()"}
    ${"a quoted-pair ) after a nested comment"}             | ${"(()\\))"}
    ${"a quoted-pair ( between two nested comments"}        | ${"((a)\\((b))"}
    ${"an escaped backslash before a nested comment"}       | ${"(\\\\(a))"}
    ${"a quoted-pair ( inside a comment nested three deep"} | ${"(((\\()))"}
  `("reads the date-time after $description: $comment", ({ comment }) => {
    expect(
      readRfc5322DateTime(`Mon, 01 Jan 2024 00:00:00 +0000 ${comment}`),
    ).toEqual(FIELDS_2024_01_01);
  });

  // The same grammar: the quoted-pair consumes the parenthesis, so the comment closes one
  // parenthesis earlier (a stray ")" follows) or never closes.
  it.each`
    description                          | comment
    ${"a stray ) after a quoted-pair ("} | ${"(()\\())"}
    ${"an unclosed quoted-pair ) end"}   | ${"((a)\\)"}
    ${"a lone backslash at the end"}     | ${"(a\\"}
  `("returns null for $description: $comment", ({ comment }) => {
    expect(
      readRfc5322DateTime(`Mon, 01 Jan 2024 00:00:00 +0000 ${comment}`),
    ).toBeNull();
  });

  // Charter item 4: no super-linear work on attacker-sized input. 50,000 nested comments are
  // 100 KB of grammatical input (RFC 5322 sets no nesting limit); a linear fold reads it in a few
  // milliseconds, while folding one level per pass took seconds. Best of three to absorb noise.
  it("folds 100 KB of nested comments in under 100 ms", () => {
    const value = `Mon, 01 Jan 2024 00:00:00 +0000 ${"(".repeat(50_000)}${")".repeat(50_000)}`;
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      expect(readRfc5322DateTime(value)).toEqual(FIELDS_2024_01_01);
      best = Math.min(best, performance.now() - started);
    }
    expect(best).toBeLessThan(100);
  });
});
