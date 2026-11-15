/*
 * CORE-112, D29: does a formatter's `formatRange` drop, repeat or garble a field?
 *
 * ECMA-402 PartitionDateTimeRangePattern and UTS #35 Part 4 (Interval Formats): a range holds every
 * field the formatter's single `format` prints for each date, except that a field the two dates
 * share may print once. This reads only
 * `format` and `formatRange` (never a parts method: D23) and owns no locale datum, no segmenter and
 * no word list.
 *
 * Method. A text is cut into runs of digits and runs of letters. Two texts with the same run-kind
 * sequence align position by position, so moving an instant shows which positions it changed and a
 * value printed by two fields cannot cancel out. A position's class is the smallest move that
 * changes it, split by the 7-day move (day against weekday) and the 60-year move (numbered year
 * against cyclic name). Every class an endpoint's single shows must show in the range, no value of it
 * more often than in the single, and with the same number. The probes add an era difference and a
 * check that each date's fields stay on its own side of the joiner.
 *
 * Cost: at most 8 + 2 probe ranges (4 more for a formatter that prints a day period), each 9 moves per family, three families: a few hundred `format`
 * and `formatRange` calls, memoised per verdict. Loops are bounded by the probe list, the move list
 * (9) and the length of one printed range.
 *
 * Removal is in `temporalCompat/README.md` (step 29): the D29 canary says when. This file goes with
 * `rangeFields.ts` (its only caller) and nothing else imports it.
 */

/** What the detector calls on a formatter. */
export interface RangeSource {
  format(date: number): string;
  formatRange(start: number, end: number): string;
  /**
   * The flexible day period the formatter prints for an instant (`in the afternoon`), when its
   * pattern prints one. Present, it splits the hour probes into the day-period class and the hour
   * class (ECMA-402 Table 6 orders [[AmPm]], [[DayPeriod]], [[Hour]]); absent, there is no `B` class.
   */
  dayPeriod?(date: number): string;
}

/** Why a formatter was flagged. */
export interface RangeVerdict {
  readonly flagged: boolean;
  readonly kind?: string | undefined;
  /** The probe classes whose range is wrong: `y` `M` `d` `a` `B` `h` `m` and `G` (the greatest differing field). */
  readonly classes: readonly string[];
}

type Probe = readonly [string, number, number];

const MIN = 60_000;
const HR = 60 * MIN;
const DY = 24 * HR;
const LIMIT: Readonly<Record<string, number>> = {
  y: Infinity,
  G: Infinity,
  M: 367 * DY,
  d: 32 * DY,
  a: DY,
  B: DY,
  h: DY,
  m: 61 * MIN,
};

/**
 * The fixed probe pairs, as UTC epoch milliseconds (literals: nothing here runs at import): the
 * largest field that differs is year, month, day, day period, hour, minute, year, day.
 */
const PROBES: readonly Probe[] = [
  ["y", 1715779500000, 1763656800000], // 2024-05-15 13:25 to 2025-11-20 16:40
  ["M", 1715779500000, 1718901600000], // 2024-05-15 13:25 to 2024-06-20 16:40
  ["d", 1715779500000, 1715964000000], // 2024-05-15 13:25 to 2024-05-17 16:40
  ["a", 1715765100000, 1715791200000], // 2024-05-15 09:25 to 16:40
  ["h", 1715779500000, 1715791200000], // 2024-05-15 13:25 to 16:40
  ["m", 1715779500000, 1715780400000], // 2024-05-15 13:25 to 13:40
  ["y", 1720622100000, 1752158100000], // 2024-07-10 14:35 to 2025-07-10 14:35
  ["d", 1720622100000, 1720794900000], // 2024-07-10 14:35 to 2024-07-12 14:35
];
/**
 * The probe pairs of a formatter that prints a flexible day period, all inside one AM/PM half. A
 * pair is `B` when the two times print different day periods and `h` when they print one
 * (ECMA-402 Table 6), decided per formatter, as day-period rules are per locale: 01:25 to 02:40
 * and 13:25 to 14:40 are one period in every locale that has them, 12:25 to 18:40 and 00:10 to
 * 06:45 cross a period boundary in each.
 */
const PERIOD_PROBES: readonly Probe[] = [
  ["h", 1715736300000, 1715740800000], // 2024-05-15 01:25 to 02:40
  ["h", 1715779500000, 1715784000000], // 2024-05-15 13:25 to 14:40
  ["B", 1715775900000, 1715798400000], // 2024-05-15 12:25 to 18:40
  ["B", 1715731800000, 1715755500000], // 2024-05-15 00:10 to 06:45
];
/**
 * The pairs at the hour that wraps (00:10 and 12:10 with their 02:40 and 14:40): a 12-hour cycle
 * prints that hour as 12, and a range pattern may print 0. Only the number is compared
 * (`droppedNumber`), never a word, as a range may name a finer day period (zh `凌晨12:10至2:40`
 * for the single's `上午12:10`).
 */
const WRAP_PROBES: readonly Probe[] = [
  ["h", 1715731800000, 1715740800000], // 2024-05-15 00:10 to 02:40
  ["h", 1715775000000, 1715784000000], // 2024-05-15 12:10 to 14:40
];
/** The era pairs: Heisei to Reiwa in the japanese calendar, and BC to AD in the others. */
const ERA_PROBES = {
  japanese: ["G", 1468161300000, 1594391700000], // 2016-07-10 14:35 to 2020-07-10 14:35
  other: ["G", -65306424300000, 1752158100000], // 101 BC-07-10 14:35 to 2025-07-10 14:35
} as const satisfies Record<string, Probe>;

/** Minute; hour; day period; day and weekday; day only; month; year; one sexagenary cycle; hour back. */
const MOVES = [
  MIN,
  61 * MIN,
  4 * HR,
  DY + 61 * MIN,
  7 * DY,
  32 * DY + 61 * MIN,
  367 * DY + 61 * MIN,
  21_915 * DY,
  -61 * MIN,
] as const;
const SPLIT: Readonly<Record<string, string>> = {
  "0": "8",
  "1": "8",
  "2": "8",
  "3": "4",
  "6": "7",
};

const NUMBER = /\p{Nd}/u;
// A word is a run of letters of one script family, written with no `v` flag (set subtraction and
// intersection become lookaheads, so the file parses in every engine that has `\p{sc=…}`).
// Latin letters, and the letters of the Common script, form one family; any other script is its own.
const LATIN_FIRST = String.raw`(?:\p{sc=Latin}|(?=\p{L})\p{sc=Zyyy})`;
const LATIN_NEXT = String.raw`(?:\p{sc=Latin}|\p{M}|(?=\p{L})\p{sc=Zyyy})`;
const LAT = `${LATIN_FIRST}${LATIN_NEXT}*`;
const OTH = String.raw`(?:(?![\p{sc=Latin}\p{sc=Zyyy}])[\p{L}\p{M}])+`;
// Letters joined by punctuation with no space ('Dhuʻl-Q') are one word; a dash or tilde joins two.
const JOIN = String.raw`(?:(?![‐-―−〜～~\/／])\p{P})+`;
const RUN = new RegExp(
  String.raw`\p{Nd}+|${LAT}(?:${JOIN}${LAT})*|${OTH}(?:${JOIN}${OTH})*`,
  "gu",
);
const DASH = /[‐-―−〜～~-]/u;

/** The digit zero of the run of ten digits that holds `cp`. */
function zeroOf(cp: number): number {
  let zero = cp;
  while (
    zero > 0 &&
    NUMBER.test(String.fromCodePoint(zero - 1)) &&
    cp - (zero - 1) < 10
  ) {
    zero--;
  }
  return zero;
}

/** The ASCII digits of a number written in any numbering system. */
function ascii(text: string): string {
  return [...text]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return (cp - zeroOf(cp)) % 10;
    })
    .join("");
}

/** The runs of a text: a number is `#value` (so `05` and `5` are one value), a word is itself. */
export function rangeRuns(text: string): string[] {
  return [...text.matchAll(RUN)].map((m) =>
    NUMBER.test(m[0]) ? `#${Number(ascii(m[0]))}` : m[0],
  );
}

/** The text before each run. */
function gaps(text: string): string[] {
  let end = 0;
  return [...text.matchAll(RUN)].map((m) => {
    const gap = text.slice(end, m.index);
    end = m.index + m[0].length;
    return gap;
  });
}

/** The separators between adjacent numbers, joined. */
function numberSeparators(text: string): string {
  const all = [...text.matchAll(RUN)];
  const out: string[] = [];
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const next = all[i];
    if (prev && next && NUMBER.test(prev[0]) && NUMBER.test(next[0])) {
      out.push(
        text
          .slice(prev.index + prev[0].length, next.index)
          .replace(/\s+/gu, ""),
      );
    }
  }
  return out.join("\u0000");
}

const kinds = (toks: readonly string[]): string =>
  toks.map((t) => (t.startsWith("#") ? "d" : "w")).join("");

/** One family of moves over a single and the range. */
interface Family {
  r0: string[];
  s0: string[];
  rs: string[];
  rs0: string[];
  rv: string[];
  rok: string;
  ss: string[];
  sv: string[];
  ok: string;
  sk: string[];
  rk: string[];
}

/** A word that takes its neighbour's signature (a word of a name next to a word that changes). */
function joinNames(
  toks: readonly string[],
  sigs: string[],
  gp: readonly string[],
): void {
  const was = [...sigs];
  const sub = (x: string, y: string): boolean =>
    x.length < y.length && [...x].every((j) => y.includes(j));
  const spaced = (q: number, d: number): boolean =>
    /^\s+$/u.test(gp[Math.max(q, q - d)] ?? "");
  toks.forEach((t, p) => {
    if (!was[p] || t.startsWith("#")) {
      return;
    }
    for (const d of [-1, 1]) {
      let q = p + d;
      while (
        q >= 0 &&
        q < toks.length &&
        !toks[q]?.startsWith("#") &&
        spaced(q, d) &&
        !was[q]
      ) {
        q += d;
      }
      if (
        q >= 0 &&
        q < toks.length &&
        !toks[q]?.startsWith("#") &&
        spaced(q, d) &&
        sub(was[p] ?? "", was[q] ?? "")
      ) {
        sigs[p] = was[q] ?? "";
        break;
      }
    }
  });
}

/** The memoised calls of one verdict. */
class Calls {
  private readonly memo = new Map<string, string>();
  private readonly source: RangeSource;
  constructor(source: RangeSource) {
    this.source = source;
  }
  format(t: number): string {
    const key = `f${t}`;
    let text = this.memo.get(key);
    if (text === undefined) {
      text = this.source.format(t);
      this.memo.set(key, text);
    }
    return text;
  }
  range(a: number, b: number): string {
    const key = `${a},${b}`;
    let text = this.memo.get(key);
    if (text === undefined) {
      text = this.source.formatRange(a, b);
      this.memo.set(key, text);
    }
    return text;
  }
}

/** Per position of the single and of the range, the moves that change it. */
function family(
  calls: Calls,
  range: string,
  single: string,
  limit: number,
  singleAt: (m: number) => number,
  rangeAt: (m: number) => readonly [number, number],
  other?: string,
): Family {
  const r0 = rangeRuns(range);
  const s0 = rangeRuns(single);
  const kr = kinds(r0);
  const ks = kinds(s0);
  const fallback0 =
    other !== undefined && range.includes(single) && range.includes(other);
  const rs = r0.map(() => "");
  const rv = r0.map(() => "");
  const ss = s0.map(() => "");
  const sv = s0.map(() => "");
  const rok: number[] = [];
  const ok: number[] = [];
  MOVES.forEach((m, j) => {
    const x = rangeAt(m);
    if (Math.abs(m) >= limit || !(x[0] < x[1])) {
      return;
    }
    const single1 = calls.format(singleAt(m));
    const s1 = rangeRuns(single1);
    const same = kinds(s1) === ks;
    s0.forEach((t, p) => {
      if (same ? s1[p] !== t : !s1.includes(t)) {
        sv[p] += j;
      }
    });
    const range1 = calls.range(x[0], x[1]);
    if (
      other !== undefined &&
      !fallback0 &&
      range1.includes(single1) &&
      range1.includes(other)
    ) {
      return;
    }
    const r1 = rangeRuns(range1);
    if (
      kinds(r1) !== kr ||
      numberSeparators(range1) !== numberSeparators(range)
    ) {
      return;
    }
    rok.push(j);
    r0.forEach((t, p) => {
      if (r1[p] !== t) {
        rv[p] += j;
      }
    });
    if (!same) {
      return;
    }
    const dS = s0.filter((t, p) => s1[p] !== t).length;
    if (
      other !== undefined &&
      dS &&
      r0.filter((t, p) => r1[p] !== t).length > 2 * dS + 1
    ) {
      return;
    }
    ok.push(j);
    r0.forEach((t, p) => {
      if (r1[p] !== t) {
        rs[p] += j;
      }
    });
    s0.forEach((t, p) => {
      if (s1[p] !== t) {
        ss[p] += j;
      }
    });
  });
  const gp = gaps(single);
  s0.forEach((t, p) => {
    if (ss[p] !== "7" || t.startsWith("#")) {
      return;
    }
    for (const q of [p - 1, p + 1]) {
      const between = gp[Math.max(p, q)] ?? "";
      if (
        q >= 0 &&
        q < s0.length &&
        !s0[q]?.startsWith("#") &&
        ss[q] &&
        /^[\s\p{P}]*$/u.test(between) &&
        !NUMBER.test(between)
      ) {
        ss[p] = ss[q] ?? "";
        break;
      }
    }
  });
  const rs0 = [...rs];
  joinNames(s0, ss, gp);
  joinNames(r0, rs, gaps(range));
  const key = (toks: string[], g: string[]): string[] =>
    toks.map((t, p) =>
      t.startsWith("#") && p > 0 && g[p] === "" && !toks[p - 1]?.startsWith("#")
        ? `${toks[p - 1]}\u0001${t}`
        : t,
    );
  return {
    r0,
    s0,
    rs,
    rs0,
    rv,
    rok: rok.join(""),
    ss,
    sv,
    ok: ok.join(""),
    sk: key(s0, gp),
    rk: key(r0, gaps(range)),
  };
}

/** The class of a position: the first move that changes it, plus one splitting move for that level. */
function classOf(sig: string, ok: string): string {
  if (!sig) {
    return "";
  }
  const first = sig[0] ?? "";
  const split = SPLIT[first];
  return (
    first +
    (split && ok.includes(split) ? (sig.includes(split) ? "+" : "-") : "")
  );
}

function groups(
  toks: readonly string[],
  sigs: readonly string[],
  ok: string,
  keep: (p: number) => boolean,
): Map<string, string[]> {
  const g = new Map<string, string[]>();
  toks.forEach((t, p) => {
    const c = classOf(sigs[p] ?? "", ok);
    if (c && keep(p)) {
      const list = g.get(c) ?? [];
      list.push(t);
      g.set(c, list);
    }
  });
  return g;
}

/** A range word holds the single's word: equal, beginning with a one-letter form, or containing a longer one. */
function holds(u: string, t: string): boolean {
  const upper = u.toLocaleLowerCase();
  const lower = t.toLocaleLowerCase();
  return [...lower].length > 1
    ? upper.includes(lower)
    : upper.startsWith(lower);
}

const isWord = (t: string | undefined): boolean =>
  t !== undefined && !t.startsWith("#");

/** Hooks `judge` takes besides the family. */
interface Judging {
  keep?: (p: number) => boolean;
  shared?: boolean;
  /** The other date's single, whose words a range may print once for both dates. */
  other?: string[];
  fresh?: (ts: string[]) => boolean;
  apart?: (qs: number[]) => boolean;
}

/** Whether a number of the single is missing, wrong or repeated in the range, class by class. */
function judge(F: Family, judging: Judging = {}): boolean {
  const keep = judging.keep ?? (() => true);
  const shared = judging.shared ?? false;
  const fresh = judging.fresh ?? (() => false);
  const apart = judging.apart ?? (() => false);
  const S = groups(F.s0, F.ss, F.ok, keep);
  const R = groups(F.r0, F.rs, F.ok, () => true);
  const SK = groups(F.sk, F.ss, F.ok, keep);
  const RK = groups(F.rk, F.rs, F.ok, () => true);
  for (const [c, ts] of S) {
    const r = R.get(c);
    const sup = (p: number, sig: string): boolean =>
      [...(F.ss[p] ?? "")].every((j) => sig.includes(j));
    const finer = (): boolean =>
      F.s0.every(
        (t, p) =>
          classOf(F.ss[p] ?? "", F.ok) !== c ||
          !keep(p) ||
          (isWord(t) &&
            F.r0.some(
              (u, q) =>
                (holds(u, t) && sup(p, F.rs[q] ?? "")) ||
                (q > 0 &&
                  `${F.r0[q - 1]}${u}` === t &&
                  sup(p, `${F.rs[q - 1]}${F.rs[q]}`)),
            )),
      );
    const own = (): boolean =>
      F.r0.some(
        (u, q) =>
          isWord(u) && !F.s0.includes(u) && classOf(F.rs0[q] ?? "", F.ok) === c,
      );
    // A word the range prints once for both dates (UTS #35 Part 4: an interval pattern writes a
    // field both dates share once, `下午1:25–3:39`) is in the range, on the other date's side.
    const merged = (ws: string[]): boolean =>
      ws.every((t) => F.r0.includes(t) && (judging.other ?? []).includes(t));
    if (!r) {
      if (ts.every(isWord) && (fresh(ts) || finer() || own() || merged(ts))) {
        continue;
      }
      return true;
    }
    const kd = (u: string[]): number =>
      new Set(u.map((t) => t.startsWith("#"))).size;
    if (!shared && /^([012]|3$)/.test(c) && kd(ts) === 2 && kd(r) < 2) {
      return true;
    }
    const sn = ts
      .filter((t) => t.startsWith("#"))
      .map((t) => String(Number(t.slice(1))));
    const rn = r
      .filter((t) => t.startsWith("#"))
      .map((t) => String(Number(t.slice(1))));
    if (
      sn.length &&
      rn.length &&
      !rn.some((x) => sn.some((y) => y.includes(x) || x.includes(y)))
    ) {
      return true;
    }
    const tk = SK.get(c) ?? [];
    const rk = RK.get(c) ?? [];
    const at = (t: string): number[] =>
      F.rk.flatMap((u, q) =>
        u === t && classOf(F.rs[q] ?? "", F.ok) === c ? [q] : [],
      );
    const count = (list: string[], t: string): number =>
      list.filter((u) => u === t).length;
    if (
      !shared &&
      tk.some((t) => count(rk, t) > count(tk, t) && !apart(at(t)))
    ) {
      return true;
    }
  }
  return false;
}

/** Whether a word or number of the single is in no word of the range, and the range has no stand-in for it. */
function isAbsent(
  F: Family,
  O: Family,
  known: ReadonlySet<string>,
  sameShape: boolean,
  shared: (p: number) => boolean,
  half: readonly string[],
): boolean {
  const rescue = F.r0.some((t, q) => isWord(t) && !known.has(t) && !O.rs[q]);
  const num = (p: number): boolean =>
    F.r0.some(
      (t, q) =>
        !isWord(t) &&
        !known.has(t) &&
        !O.rv[q] &&
        [...(F.sv[p] ?? "")].every(
          (j) => !F.rok.includes(j) || (F.rv[q] ?? "").includes(j),
        ),
    );
  for (let p = 0; p < F.s0.length; p++) {
    const t = F.s0[p] ?? "";
    // A word the two dates print differently (AM and PM) and the range prints for the other date
    // only, with no other word of this date's half to stand in for it: the range wrote the other
    // date's word once and dropped this date's own.
    const theirs = O.s0[p] ?? "";
    if (
      isWord(t) &&
      isWord(theirs) &&
      !F.sv[p] &&
      !F.ss[p] &&
      sameShape &&
      !shared(p) &&
      !F.r0.some((u) => u === t || holds(u, t)) &&
      F.r0.some(
        (u, q) =>
          u === theirs &&
          (!O.ss[p] ||
            classOf(O.rs[q] ?? "", F.ok) === classOf(O.ss[p] ?? "", F.ok)),
      ) &&
      !half.some((u) => isWord(u) && !known.has(u))
    ) {
      return true;
    }
    if (
      F.sv[p] &&
      !F.ss[p] &&
      !(sameShape && shared(p)) &&
      !F.r0.some((u) => u === t || (isWord(t) && holds(u, t))) &&
      !rescue &&
      !num(p)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether each date's own fields stay on its own side of the joiner: the range is cut at a dash
 * and every run only the start prints is left of it, every run only the end prints is right of it (a run may also sit on the other side, as a literal of the pattern repeats there).
 * A range with no dash has no joiner to check, and a range that prints a run neither date prints
 * is left to the other checks: a value that only one date's own run happens to equal there cannot
 * tell which side it belongs to.
 */
function isOrdered(range: string, first: string, last: string): boolean {
  if (!DASH.test(range)) {
    return true;
  }
  const own = (x: string, y: string): string[] => {
    const other = new Set(rangeRuns(y));
    return rangeRuns(x).filter((t) => !other.has(t));
  };
  const a = own(first, last);
  const b = own(last, first);
  if (!a.length || !b.length) {
    return true;
  }
  const all = [...range.matchAll(RUN)];
  const toks = rangeRuns(range);
  const printed = new Set([...rangeRuns(first), ...rangeRuns(last)]);
  if (toks.some((t) => !printed.has(t))) {
    return true;
  }
  // A dash the singles print themselves (`15-5`) is no joiner: only a dash character the range
  // prints more often than its two singles together can be one.
  const count = (text: string, ch: string): number => text.split(ch).length - 1;
  const cuts = [...range.matchAll(new RegExp(DASH.source, "gu"))]
    .filter((m) => count(range, m[0]) > count(first, m[0]) + count(last, m[0]))
    .map((m) => m.index);
  if (!cuts.length) {
    return true;
  }
  return cuts.some((cut) => {
    const left = new Set(toks.filter((_, i) => (all[i]?.index ?? 0) < cut));
    const right = new Set(toks.filter((_, i) => (all[i]?.index ?? 0) > cut));
    return a.every((t) => left.has(t)) && b.every((t) => right.has(t));
  });
}

/** Whether a range is the start's single, a short joiner with no digit, and the end's single. */
function isJoined(range: string, first: string, last: string): boolean {
  const gap = range.length - first.length - last.length;
  return (
    gap >= 0 &&
    gap <= 6 &&
    range.startsWith(first) &&
    range.endsWith(last) &&
    !NUMBER.test(range.slice(first.length, range.length - last.length))
  );
}

/**
 * Whether a formatter's `formatRange` drops an endpoint's field, prints one twice, prints another
 * value for one, or puts a date's field on the other date's side.
 *
 * @param source `format` and `formatRange` of one formatter (a UTC clone, no zone moves a pattern)
 * @param calendar the formatter's calendar, which chooses the era probe pair
 * @returns the verdict
 *
 * @example rangeVerdict(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }), "gregory") // { flagged: false }
 */
export function rangeVerdict(
  source: RangeSource,
  calendar: string,
): RangeVerdict {
  const calls = new Calls(source);
  const cyclic = calendar === "chinese" || calendar === "dangi";
  const period = source.dayPeriod?.bind(source);
  const probes = [
    ...PROBES,
    ...(period ? PERIOD_PROBES : []),
    calendar === "japanese" ? ERA_PROBES.japanese : ERA_PROBES.other,
  ];
  const classes = new Set<string>();
  let kind: string | undefined;
  for (const [probe, a, b] of probes) {
    // An hour-or-period probe takes the class its own two day-period texts give.
    const g =
      period && (probe === "h" || probe === "B")
        ? period(a) === period(b)
          ? "h"
          : "B"
        : probe;
    const found =
      probeKind(calls, cyclic, g, a, b) ??
      (period && droppedPeriod(calls, period, a, b));
    if (found) {
      classes.add(g);
      kind ??= found;
    }
  }
  for (const [, a, b] of WRAP_PROBES) {
    if (droppedNumber(calls, a, b)) {
      const g = period && period(a) !== period(b) ? "B" : "h";
      classes.add(g);
      kind ??= "number";
    }
  }
  return classes.size
    ? { flagged: true, kind, classes: [...classes] }
    : { flagged: false, classes: [] };
}

/**
 * Whether the range writes the hour 0 of a 12-hour cycle as `0` where the single writes `12` (a
 * range may keep a number both dates share, never change one: ja `夜中0:10` for `夜中12:10`). Only
 * the digit groups of value twelve are read, so a zone offset or a date field never decides.
 */
function droppedNumber(calls: Calls, a: number, b: number): boolean {
  const twelve = (text: string): boolean =>
    (text.match(/\p{Nd}+/gu) ?? []).some((n) => Number.parseInt(n, 10) === 12);
  return (
    [a, b].some((date) => twelve(calls.format(date))) &&
    !twelve(calls.range(a, b))
  );
}

/**
 * `"period"` when both singles print a flexible day period and the range prints no word of either
 * (a range may print the one period both times share once, or in another width: bn `দুপুর` for the
 * single's `দুপুরবেলায়`; never none: UTS #35 Part 4 builds each date's part from its single
 * pattern).
 */
function droppedPeriod(
  calls: Calls,
  period: (date: number) => string,
  a: number,
  b: number,
): string | undefined {
  const printed = [a, b].flatMap((date) => {
    const text = period(date);
    return text !== "" && calls.format(date).includes(text)
      ? rangeRuns(text).filter(isWord)
      : [];
  });
  const words = rangeRuns(calls.range(a, b)).filter(isWord);
  return printed.length === 0 ||
    printed.some((t) => words.some((w) => t.startsWith(w) || w.startsWith(t)))
    ? undefined
    : "period";
}

/** The reason one probe pair's range is wrong, or `undefined` when it holds every field. */
function probeKind(
  calls: Calls,
  cyclic: boolean,
  g: string,
  a: number,
  b: number,
): string | undefined {
  const R = calls.range(a, b);
  const sa = calls.format(a);
  const sb = calls.format(b);
  if (R === sa) {
    return undefined;
  }
  // The two singles joined by a short joiner hold every field of both dates. Only the sexagenary
  // calendars can garble a range that moves by a whole 60-year cycle, so only they go on.
  if (!cyclic && isJoined(R, sa, sb)) {
    return undefined;
  }
  if (!isOrdered(R, sa, sb)) {
    return "order";
  }
  const limit = LIMIT[g] ?? Infinity;
  const FA = family(
    calls,
    R,
    sa,
    limit,
    (m) => a - m,
    (m) => [a - m, b],
    sb,
  );
  const FB = family(
    calls,
    R,
    sb,
    limit,
    (m) => b + m,
    (m) => [a, b + m],
    sa,
  );
  const known = new Set([...FA.s0, ...FB.s0]);
  const low = (t: string): string => t.toLocaleLowerCase();
  const fresh =
    (F: Family, O: Family) =>
    (ts: string[]): boolean =>
      F.r0.some(
        (t, q) =>
          isWord(t) &&
          !known.has(t) &&
          !O.rs[q] &&
          ts.some((u) => u !== t && low(u).startsWith(low(t))),
      );
  const kr = kinds(rangeRuns(R));
  const apart = (qs: number[]): boolean =>
    MOVES.some((m) => {
      const r1 = rangeRuns(calls.range(a - m, b - m));
      return kinds(r1) === kr && new Set(qs.map((q) => r1[q])).size > 1;
    });
  if (judge(FA, { fresh: fresh(FA, FB), apart, other: FB.s0 })) {
    return "a";
  }
  if (judge(FB, { fresh: fresh(FB, FA), apart, other: FA.s0 })) {
    return "b";
  }
  // Each date's own half of the range, cut at the first dash: where a stand-in for the date's
  // word would be written.
  const cut = R.search(DASH);
  const halves =
    cut < 0
      ? [rangeRuns(R), rangeRuns(R)]
      : [rangeRuns(R.slice(0, cut)), rangeRuns(R.slice(cut))];
  const same = kinds(FA.s0) === kinds(FB.s0);
  const shared = (p: number): boolean => same && FA.s0[p] === FB.s0[p];
  if (
    isAbsent(FA, FB, known, same, shared, halves[0]) ||
    isAbsent(FB, FA, known, same, shared, halves[1])
  ) {
    return "absent";
  }
  const FC = family(
    calls,
    R,
    sa,
    Infinity,
    (m) => a - m,
    (m) => [a - m, b - m],
  );
  if (
    judge(FC, {
      keep: (p) => !FA.ss[p] && (!FA.sv[p] || shared(p)),
      shared: true,
    })
  ) {
    return "both";
  }
  return undefined;
}
