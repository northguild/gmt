import {
  isIslamicEraCompatNeeded,
  isIslamicCalendarResolutionCompatNeeded,
  isJapaneseEraCompatNeeded,
  isJapaneseNumberingSystemCompatNeeded,
  isJapaneseTwoDigitYearCompatNeeded,
  isRangeFieldCompatNeeded,
  isRelatedYearWidthCompatNeeded,
  runRepro,
  reproPasses,
} from "./capabilities";
import { rangeFieldCases } from "./rangeFieldRepros";
import { repros } from "./repros";

/*
 * CORE-112 slice 7: each shipped probe (D25 to D30) reads the same defect as its canary repros.
 * The probe says "needed" exactly when some repro of its defect fails on this engine, so the
 * canary's verdict and the library's gate cannot disagree. The test never asserts which way: that
 * would fail the day an engine ships the fix, which is the canary's job.
 */
describe("year printing probes agree with their repros", () => {
  it.each`
    defect   | names                                              | probe
    ${"D25"} | ${["japaneseTwoBc", "japaneseLastGregorianDay"]}   | ${isJapaneseEraCompatNeeded}
    ${"D26"} | ${["islamicCivilEraBeforeHijra"]}                  | ${isIslamicEraCompatNeeded}
    ${"D27"} | ${["jaJapaneseTwoDigitEraYear"]}                   | ${isJapaneseTwoDigitYearCompatNeeded}
    ${"D27"} | ${["jaJapaneseNumberingSystemYear"]}               | ${isJapaneseNumberingSystemCompatNeeded}
    ${"D28"} | ${["chineseRelatedYearFullWidth"]}                 | ${isRelatedYearWidthCompatNeeded}
    ${"D29"} | ${rangeFieldCases.map((c) => c.name)}              | ${isRangeFieldCompatNeeded}
    ${"D30"} | ${["islamicResolvesTbla", "islamicRgsaIsIgnored"]} | ${isIslamicCalendarResolutionCompatNeeded}
  `(
    "the probe for $names is true exactly when one of those $defect repros fails",
    ({ defect, names, probe }) => {
      const own = repros.filter(
        (repro) => repro.defect === defect && names.includes(repro.name),
      );
      expect(own).toHaveLength(names.length);
      expect(probe()).toBe(
        own.some((repro) => !reproPasses(repro, runRepro(repro))),
      );
    },
  );
});
