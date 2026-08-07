/**
 * CLDR data embedded in Node's ICU build changes between major ICU
 * versions (which track Node major versions — see
 * https://nodejs.org/en/download/releases for the ICU version each Node
 * release ships). A handful of goldens in this suite depend on locale
 * strings that changed wording between ICU 77 (Node 20) and ICU 78
 * (Node 22/24) — e.g. pt-PT's day period ("da tarde" -> "p.m."), Turkish
 * and Korean long time zone names, and Hebrew/Swedish relative-time
 * phrasing. These are not "full" vs "partial" ICU — every Node LTS here
 * ships complete locale data; the *wording* CLDR chose for a given
 * locale/option simply changed.
 *
 * `oneOfIcu` accepts any of the known-valid strings for a case like this,
 * so the assertion still fails if the formatter starts returning
 * something else, but doesn't fail on a CLDR wording revision alone.
 *
 * Use this only for goldens verified (against real Node 20/22/24 runs) to
 * differ solely by CLDR wording, not for masking an actual bug — every
 * variant listed should be independently confirmed to come from a real
 * ICU version.
 */
export function oneOfIcu(...variants: string[]): Set<string> {
  return new Set(variants);
}

export function expectOneOfIcu(actual: string, variants: Set<string>): void {
  if (!variants.has(actual)) {
    throw new Error(
      `Expected one of ${JSON.stringify([...variants])}, got ${JSON.stringify(actual)}`,
    );
  }
}

// Some CI runners' ICU/CLDR data renders the day-period marker for CJK
// locales as ASCII "AM"/"PM" instead of the native-script word, even though
// the same Node version renders the native word locally. This is a test-
// comparison concern only — the functions under test are not changed to
// normalize their output, since that would alter real formatted output for
// every caller. Use `expectDateTimeEqual` in place of `toEqual`/`toBe` for
// any golden containing one of these words.
const DAY_PERIOD_VARIANTS: Record<string, "AM" | "PM"> = {
  오전: "AM",
  오후: "PM",
  午前: "AM",
  午後: "PM",
  上午: "AM",
  下午: "PM",
};

const DAY_PERIOD_PATTERN = new RegExp(
  Object.keys(DAY_PERIOD_VARIANTS).join("|"),
  "g",
);

function canonicalizeDayPeriod(value: string): string {
  return value.replace(
    DAY_PERIOD_PATTERN,
    (match) => DAY_PERIOD_VARIANTS[match] ?? match,
  );
}

export function expectDateTimeEqual(actual: string, expected: string): void {
  if (canonicalizeDayPeriod(actual) !== canonicalizeDayPeriod(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// Combines expectOneOfIcu's set-membership tolerance with day-period
// canonicalization, for goldens that vary by both CLDR wording and day
// period across ICU builds.
export function expectOneOfDateTimeIcu(
  actual: string,
  variants: Set<string>,
): void {
  const canonicalActual = canonicalizeDayPeriod(actual);
  const canonicalVariants = new Set(
    [...variants].map((variant) => canonicalizeDayPeriod(variant)),
  );
  if (!canonicalVariants.has(canonicalActual)) {
    throw new Error(
      `Expected one of ${JSON.stringify([...variants])}, got ${JSON.stringify(actual)}`,
    );
  }
}
