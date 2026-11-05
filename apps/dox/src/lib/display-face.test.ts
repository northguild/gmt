/**
 * The inline script that loads the display font before the first paint. It runs here against a
 * stand-in document whose stylesheets hold plain rule objects, since no test DOM loads fonts.
 */
import { describe, expect, it } from "vitest";
import { DISPLAY_FAMILY, displayFaceInlineSource } from "./display-face";

/** A face the script adds to the stand-in font set. */
interface Made {
  family: string;
  bytes: number[];
  descriptors: Record<string, string>;
}

type Rule =
  | { type: 1; cssRules?: Rule[] }
  | { type: 5; style: { getPropertyValue: (name: string) => string } }
  | { type: 0 | 4; cssRules: Rule[] };

function fontFaceRule(declared: Record<string, string>): Rule {
  return {
    type: 5,
    style: { getPropertyValue: (name) => declared[name] ?? "" },
  };
}

function dataUri(bytes: number[]): string {
  return `url("data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}") format("woff2")`;
}

/** Runs the script over `sheets`; a sheet given as `null` throws on read, as a cross-origin one does. */
function run(sheets: Array<Rule[] | null>, withFontFace = true): Made[] {
  const added: Made[] = [];
  class StandInFontFace {
    constructor(
      family: string,
      source: ArrayBuffer,
      descriptors: Record<string, string>,
    ) {
      Object.assign(this, {
        family,
        bytes: [...new Uint8Array(source)],
        descriptors,
      });
    }
  }
  const document = {
    fonts: { add: (face: Made) => added.push(face) },
    styleSheets: sheets.map((rules) => ({
      get cssRules() {
        if (rules === null)
          throw new DOMException("cross-origin", "SecurityError");
        return rules;
      },
    })),
  };
  new Function("document", "FontFace", "atob", displayFaceInlineSource())(
    document,
    withFontFace ? StandInFontFace : undefined,
    (text: string) => Buffer.from(text, "base64").toString("latin1"),
  );
  // What reaches the font set is what counts: a face built and dropped never draws.
  expect(added.every((face) => face instanceof StandInFontFace)).toBe(true);
  return added;
}

const BYTES = [0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0x80, 0x10];

describe("the display face script", () => {
  it("builds the face from the stylesheet's bytes, with its descriptors", () => {
    const added = run([
      [
        fontFaceRule({
          "font-family": "Display Fallback",
          src: 'local("Menlo")',
        }),
        fontFaceRule({
          "font-family": DISPLAY_FAMILY,
          "font-style": "normal",
          "font-weight": "400",
          src: dataUri(BYTES),
        }),
      ],
    ]);
    expect(added).toEqual([
      {
        family: DISPLAY_FAMILY,
        bytes: BYTES,
        descriptors: { style: "normal", weight: "400", display: "block" },
      },
    ]);
  });

  it("finds a face inside a cascade layer, past a sheet it may not read", () => {
    const added = run([
      null,
      [
        { type: 1, cssRules: [] },
        {
          type: 0,
          cssRules: [
            fontFaceRule({
              "font-family": `"${DISPLAY_FAMILY}"`,
              src: dataUri(BYTES),
            }),
          ],
        },
      ],
    ]);
    expect(added.map((face) => face.bytes)).toEqual([BYTES]);
  });

  it("leaves the page to the stylesheet when the face is a file, missing, or unsupported", () => {
    expect(
      run([
        [
          fontFaceRule({
            "font-family": DISPLAY_FAMILY,
            src: 'url("/fonts/m.woff2")',
          }),
        ],
      ]),
    ).toEqual([]);
    expect(
      run([[fontFaceRule({ "font-family": "Other", src: dataUri(BYTES) })]]),
    ).toEqual([]);
    expect(
      run(
        [
          [
            fontFaceRule({
              "font-family": DISPLAY_FAMILY,
              src: dataUri(BYTES),
            }),
          ],
        ],
        false,
      ),
    ).toEqual([]);
  });
});
