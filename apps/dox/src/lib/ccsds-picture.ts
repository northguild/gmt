/**
 * The CCSDS Time Code Decoder's picture and its reasons (SPA-52).
 *
 * The picture is cut from the library's own written code (`formatCcsdsAsciiA` or `…B` on the
 * instant the parser returned), never from the reader's text, so the fields drawn are the ones
 * the library writes. A refusal is explained by asking the library again: each probe changes the
 * text a little and the first probe either parser accepts names the reason. A probe is a question
 * put to the library; the site holds no CCSDS grammar, leap-second table or leap-year rule.
 *
 * No DOM; the library arrives as a `CcsdsLib`.
 */
import type { FractionalDigit } from "@northguild/gmt";
import type { PicField, PicHalf } from "./edi-picture";
import { runCall, type EdiCall } from "./edi-widgets";
import type { CcsdsLib } from "./ccsds-widgets";

export type CcsdsKind = "A" | "B";

/** The standard's own mask letters, in the order each code writes its numeric fields. */
const MASKS: Record<CcsdsKind, readonly string[]> = {
  A: ["YYYY", "MM", "DD", "hh", "mm", "ss"],
  B: ["YYYY", "DDD", "hh", "mm", "ss"],
};

/** The number of fraction digits in `text`, counted after the period of its time. */
export function fractionDigits(text: string): number {
  return /\.(\d+)/.exec(text)?.[1]?.length ?? 0;
}

/** What the figure draws and what a screen reader hears. */
export interface CcsdsPicture {
  halves: PicHalf[];
  aria: string;
}

const field = (
  text: string,
  mask: string,
  group: PicField["group"],
  word: string,
  extra: Pick<PicField, "bracket" | "run"> = {},
): PicField => ({ text, mask, group, word, ...extra });

/**
 * The fields of a written code. `written` is what `formatCcsdsAsciiA` or `…B` returned: digit
 * runs and single separator characters, cut where the characters change. `dayCaption` is the
 * words under a Code B day field (`day 061 = 1 March`).
 */
export function pictureOf(
  kind: CcsdsKind,
  written: string,
  dayCaption = "",
): CcsdsPicture {
  const tokens = written.match(/\d+|\D/g) ?? [];
  const masks = MASKS[kind];
  const fields: PicField[] = [];
  const words: string[] = [];
  let digitRun = 0;
  let afterPeriod = false;
  let seenT = false;
  for (const token of tokens) {
    if (!/\d/.test(token)) {
      afterPeriod = token === ".";
      if (token === "T") seenT = true;
      // Punctuation inside the date or the time joins that group's bracket; T, the period and Z
      // are neutral boxes of their own.
      const inner = token === "-" || token === ":";
      fields.push(
        field(
          token,
          "",
          inner ? (seenT ? "time" : "date") : "neutral",
          token === "T"
            ? "T"
            : token === "." || token === "Z"
              ? token
              : "separator",
        ),
      );
      continue;
    }
    if (afterPeriod) {
      for (let i = 0; i < token.length; i += 3) {
        const chunk = token.slice(i, i + 3);
        fields.push(
          field(chunk, "d".repeat(chunk.length), "time", `digits ${i + 1}`, {
            bracket: `digits ${i + 1}–${i + chunk.length}`,
            run: `fraction-${i}`,
          }),
        );
      }
      words.push(`fraction ${token}`);
      continue;
    }
    const mask = masks[digitRun] ?? "";
    digitRun += 1;
    const isDay = kind === "B" && mask === "DDD";
    fields.push(
      field(
        token,
        mask,
        seenT ? "time" : "date",
        mask,
        isDay && dayCaption !== "" ? { bracket: dayCaption } : {},
      ),
    );
    words.push(`${mask} ${token}`);
  }
  return {
    halves: [{ label: "", fields }],
    aria: `Code ${kind} ${written}: ${words.join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// The reasons
// ---------------------------------------------------------------------------

export const REASON_CASE = "CCSDS writes `T` and `Z` in upper case only.";
export const REASON_FALSE_60 = "UTC inserted no second 60 on that day.";
export const REASON_WRONG_MINUTE =
  "UTC inserts a second 60 only at 23:59:60, and not at that minute.";
export const REASON_DAY_366 = "Day 366 exists only in a leap year.";
export const REASON_COARSE =
  "A code coarser than whole seconds names a span, not an instant.";
export const REASON_GENERAL =
  "Not a Code A (`YYYY-MM-DDThh:mm:ss`) or a Code B (`YYYY-DDDThh:mm:ss`), or a field is out of range.";

/** Every reason, for the hold that reserves the widest. */
export const REASON_SAMPLES: readonly string[] = [
  REASON_CASE,
  REASON_FALSE_60,
  REASON_WRONG_MINUTE,
  REASON_DAY_366,
  REASON_COARSE,
  REASON_GENERAL,
];

export interface Reason {
  text: string;
  /** Every probe call made, in order; the last pair is the one that was accepted, if any. */
  calls: EdiCall[];
}

/** The two parser calls on one probe text. */
function ask(lib: CcsdsLib, text: string): { calls: EdiCall[]; ok: boolean } {
  const a = runCall(lib, "parseCcsdsAsciiA", text);
  const b = runCall(lib, "parseCcsdsAsciiB", text);
  return { calls: [a, b], ok: a.result !== "" || b.result !== "" };
}

/**
 * Why the library refused `text`. The first probe either parser accepts names the reason:
 *
 * 1. `t` and `z` upper-cased;
 * 2. a trailing `:60` changed to `:59` (and then the same day at 23:59:60, which tells a wrong
 *    minute from a wrong day);
 * 3. `-366T` changed to `-365T`;
 * 4. `:00`, or `T00:00:00`, appended;
 * 5. one general sentence.
 */
export function reasonOf(lib: CcsdsLib, text: string): Reason {
  const calls: EdiCall[] = [];
  const probe = (candidate: string): boolean => {
    if (candidate === text) return false;
    const r = ask(lib, candidate);
    calls.push(...r.calls);
    return r.ok;
  };

  if (probe(text.replace(/t/g, "T").replace(/z/g, "Z"))) {
    return { text: REASON_CASE, calls };
  }

  const sixty = /(.*?)(\d{2}:\d{2}):60(.*)/s.exec(text);
  if (sixty !== null) {
    const [, head, , tail] = sixty;
    if (probe(`${head}${sixty[2]}:59${tail}`)) {
      // The same day at 23:59:60 is accepted only if UTC inserted a second that day.
      return {
        text: probe(`${head}23:59:60${tail}`)
          ? REASON_WRONG_MINUTE
          : REASON_FALSE_60,
        calls,
      };
    }
  }

  if (probe(text.replace("-366T", "-365T"))) {
    return { text: REASON_DAY_366, calls };
  }

  const stem = text.endsWith("Z") ? text.slice(0, -1) : text;
  const z = text.endsWith("Z") ? "Z" : "";
  for (const suffix of [":00", "T00:00:00", ":00:00"]) {
    if (probe(`${stem}${suffix}${z}`)) return { text: REASON_COARSE, calls };
  }

  return { text: REASON_GENERAL, calls };
}

// ---------------------------------------------------------------------------
// Dropped digits
// ---------------------------------------------------------------------------

const withoutZ = (s: string): string => (s.endsWith("Z") ? s.slice(0, -1) : s);

/**
 * How many digits after the ninth the reader sent. Only where the parser's return holds nine
 * digits: the library writes the return at nine digits and the difference in length between the
 * reader's text and that is the digits it left off. A comparison of string lengths.
 */
export function droppedDigits(
  lib: CcsdsLib,
  kind: CcsdsKind,
  input: string,
  returned: string,
): number {
  if (fractionDigits(returned) !== 9) return 0;
  const nine: FractionalDigit = 9;
  const written =
    kind === "A"
      ? lib.formatCcsdsAsciiA(returned, nine)
      : lib.formatCcsdsAsciiB(returned, nine);
  return Math.max(0, withoutZ(input).length - withoutZ(written).length);
}
