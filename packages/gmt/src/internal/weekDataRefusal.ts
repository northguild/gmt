/**
 * Week data GMT refuses on every runtime (compat D36). `Intl.Locale#getWeekInfo` reads the
 * runtime's CLDR copy, and the copies differ: macOS Safari reads the system's, older than CLDR 48
 * and wrong for the regions below; Safari on Linux reads an older CLDR than every other runtime.
 * ECMA-402 WeekInfoOfLocale and UTS #35 Part 4 § 4 (Week Data) give one answer per region, but
 * GMT owns no CLDR data, so a region some runtime gets wrong has no answer GMT can give the same
 * everywhere. Each reader returns its empty value for these on every runtime.
 */

/**
 * Regions whose first day of the week some runtime does not return as CLDR 48 gives it: `CN`
 * (mon), `JO` (sat) and `DZ` (sat) on macOS Safari; `AE` (mon) and `IS` (sun) on Safari for Linux.
 */
export const DISPUTED_FIRST_DAY_REGIONS: ReadonlySet<string> = new Set([
  "AE",
  "CN",
  "DZ",
  "IS",
  "JO",
]);

/**
 * Regions whose weekend some runtime does not return as CLDR 48 gives it: `DZ` (fri-sat) and
 * `BD` (no entry, so `001`'s sat-sun) on macOS Safari.
 */
export const DISPUTED_WEEKEND_REGIONS: ReadonlySet<string> = new Set([
  "BD",
  "DZ",
]);

/**
 * Deprecated region codes whose successor every runtime reads once the tag is canonicalized, so
 * GMT repairs them. UTS #35 Part 1 § 3.2.1 (`territoryAlias`): `BU` is `MM`, `DD` is `DE`, `FX`
 * is `FR`, `TP` is `TL`, `YD` is `YE`, `ZR` is `CD`.
 */
export const REPAIRED_DEPRECATED_REGIONS: ReadonlySet<string> = new Set([
  "BU",
  "DD",
  "FX",
  "TP",
  "YD",
  "ZR",
]);

/**
 * Deprecated region codes that some runtime keeps as written: its canonical form still carries
 * the old code and its week data is the world's (`001`), where others canonicalize to the
 * successor. Refused on every runtime, since GMT owns no `territoryAlias` data to map them.
 * Measured against Chromium, Firefox, Node 22 to 26, and Safari on macOS and Linux.
 */
export const UNCANONICALIZED_DEPRECATED_REGIONS: ReadonlySet<string> = new Set([
  "AN",
  "CS",
  "CT",
  "DY",
  "FQ",
  "HV",
  "JT",
  "MI",
  "NH",
  "NQ",
  "NT",
  "PC",
  "PU",
  "PZ",
  "QU",
  "RH",
  "SU",
  "UK",
  "VD",
  "WK",
  "YU",
]);

/**
 * Whether a region's first day of the week is refused (compat D36).
 *
 * @param region an upper-case region code
 * @returns `true` for the disputed and uncanonicalized regions
 *
 * @example isFirstDayRefused("CN") // true
 * @example isFirstDayRefused("US") // false
 */
export function isFirstDayRefused(region: string): boolean {
  return (
    DISPUTED_FIRST_DAY_REGIONS.has(region) ||
    UNCANONICALIZED_DEPRECATED_REGIONS.has(region)
  );
}

/**
 * Whether a region's weekend is refused (compat D36).
 *
 * @param region an upper-case region code
 * @returns `true` for the disputed and uncanonicalized regions
 *
 * @example isWeekendRefused("DZ") // true
 * @example isWeekendRefused("CN") // false
 */
export function isWeekendRefused(region: string): boolean {
  return (
    DISPUTED_WEEKEND_REGIONS.has(region) ||
    UNCANONICALIZED_DEPRECATED_REGIONS.has(region)
  );
}

/**
 * Languages, written without a region, whose likely region (UTS #35 Part 1 § 3.6.5, likely
 * subtags) some runtime does not give as the others do, so the first day it leads to differs
 * between runtimes (a language one runtime maximizes to `IN` and another leaves without a
 * region reads Sunday on one and Monday on the other). Measured over every two- and three-letter
 * language subtag, alone and with each common script, on Node 22 to 26, Chromium, Firefox and
 * Safari builds for macOS and Linux. GMT owns no likely-subtags data, so each is refused.
 */
export const DISPUTED_FIRST_DAY_LANGUAGES: ReadonlySet<string> = new Set([
  "adi",
  "adp",
  "aes",
  "agp",
  "aii",
  "ais",
  "ajp",
  "aju",
  "anq",
  "anu",
  "apd",
  "arb",
  "arv",
  "asr",
  "ayx",
  "azb",
  "azj",
  "bcc",
  "bcl",
  "bh",
  "bhk",
  "bih",
  "bix",
  "bkb",
  "bkk",
  "blr",
  "brb",
  "bro",
  "bru",
  "brw",
  "bur",
  "bxk",
  "ccq",
  "cdn",
  "chi",
  "cjr",
  "cka",
  "cld",
  "clk",
  "cls",
  "cmk",
  "cmn",
  "cmo",
  "coy",
  "cra",
  "cty",
  "cuy",
  "dap",
  "dgl",
  "dgo",
  "dhd",
  "drh",
  "drw",
  "elp",
  "ers",
  "esk",
  "eud",
  "evn",
  "gaz",
  "ggn",
  "ggo",
  "gno",
  "goj",
  "gom",
  "grr",
  "gug",
  "hak",
  "hdn",
  "hea",
  "him",
  "hnm",
  "hrr",
  "ice",
  "ike",
  "ili",
  "isk",
  "ium",
  "jeg",
  "jeh",
  "jge",
  "jra",
  "jrb",
  "kbg",
  "kcy",
  "kdv",
  "kev",
  "kfg",
  "kfu",
  "kgd",
  "kgh",
  "kgm",
  "khk",
  "kho",
  "kjz",
  "kmr",
  "kns",
  "kpp",
  "kte",
  "kwx",
  "kxl",
  "kzh",
  "lbc",
  "lbf",
  "lbk",
  "leg",
  "llo",
  "ltc",
  "luh",
  "mey",
  "mnc",
  "mof",
  "mqt",
  "mst",
  "mup",
  "mve",
  "myt",
  "mzb",
  "nan",
  "nbf",
  "nln",
  "nom",
  "noo",
  "npi",
  "nte",
  "nts",
  "nxk",
  "nxu",
  "nyw",
  "ojg",
  "ola",
  "omx",
  "ory",
  "oui",
  "oyb",
  "pbu",
  "pcr",
  "per",
  "pes",
  "phu",
  "pi",
  "pli",
  "pmc",
  "pmu",
  "pnb",
  "ppa",
  "ppr",
  "pra",
  "prp",
  "prs",
  "pry",
  "psu",
  "puq",
  "puz",
  "quz",
  "sap",
  "sdr",
  "sgh",
  "sgl",
  "sjc",
  "skk",
  "slq",
  "spy",
  "stu",
  "sul",
  "sum",
  "thw",
  "thx",
  "tib",
  "tid",
  "tkk",
  "tlw",
  "tmk",
  "tne",
  "tnf",
  "tpw",
  "tsf",
  "ttz",
  "umu",
  "uzn",
  "vjk",
  "wbl",
  "wle",
  "xia",
  "xkf",
  "xkh",
  "xom",
  "xsl",
  "xtq",
  "ybd",
  "ycr",
  "yej",
  "yos",
  "zai",
  "zhd",
  "zhx",
  "zrg",
  "zwa",
  "zyb",
]);

/**
 * Languages, written without a region, whose likely region some runtime does not give as the
 * others do, so the weekend it leads to differs between runtimes. Measured as
 * `DISPUTED_FIRST_DAY_LANGUAGES` is, and refused for the same reason.
 */
export const DISPUTED_WEEKEND_LANGUAGES: ReadonlySet<string> = new Set([
  "adi",
  "aii",
  "ajp",
  "aju",
  "anq",
  "aot",
  "apd",
  "arb",
  "asr",
  "azb",
  "azj",
  "bh",
  "bih",
  "bix",
  "bkk",
  "brw",
  "cdn",
  "cfm",
  "cld",
  "clk",
  "cls",
  "cty",
  "dap",
  "dgl",
  "dgo",
  "dhd",
  "drw",
  "ggo",
  "gno",
  "goj",
  "gom",
  "grr",
  "him",
  "isk",
  "jge",
  "jrb",
  "kbg",
  "kcy",
  "kev",
  "kfg",
  "kfu",
  "kho",
  "kmr",
  "kwx",
  "kxl",
  "kzh",
  "lbf",
  "lus",
  "mey",
  "mjt",
  "mki",
  "mup",
  "mzb",
  "ory",
  "pbu",
  "per",
  "pes",
  "pi",
  "pli",
  "ppa",
  "prp",
  "prs",
  "psu",
  "puz",
  "sdr",
  "sgh",
  "sgl",
  "slq",
  "tkk",
  "tnf",
  "uzn",
  "vjk",
  "wbl",
  "xom",
  "xtq",
  "yej",
  "yos",
  "zrg",
]);

/**
 * Whether a language's first day of the week is refused because its likely region is disputed
 * (compat D36).
 *
 * @param language a lower-case language subtag
 * @returns `true` for a language in `DISPUTED_FIRST_DAY_LANGUAGES`
 *
 * @example isLanguageFirstDayRefused("pi") // true
 * @example isLanguageFirstDayRefused("en") // false
 */
export function isLanguageFirstDayRefused(language: string): boolean {
  return DISPUTED_FIRST_DAY_LANGUAGES.has(language);
}

/**
 * Whether a language's weekend is refused because its likely region is disputed (compat D36).
 *
 * @param language a lower-case language subtag
 * @returns `true` for a language in `DISPUTED_WEEKEND_LANGUAGES`
 *
 * @example isLanguageWeekendRefused("pi") // true
 * @example isLanguageWeekendRefused("en") // false
 */
export function isLanguageWeekendRefused(language: string): boolean {
  return DISPUTED_WEEKEND_LANGUAGES.has(language);
}
