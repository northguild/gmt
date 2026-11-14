import {
  isIslamicEraCompatNeeded,
  isJapaneseEraCompatNeeded,
  isJapaneseTwoDigitYearCompatNeeded,
  isRelatedYearWidthCompatNeeded,
  runRepro,
  reproPasses,
} from "./capabilities";
import { repros } from "./repros";

/*
 * CORE-112 slice 7: each shipped probe (D25 to D28) reads the same defect as its canary repros.
 * The probe says "needed" exactly when some repro of its defect fails on this engine, so the
 * canary's verdict and the library's gate cannot disagree. The test never asserts which way: that
 * would fail the day an engine ships the fix, which is the canary's job.
 */
describe("year printing probes agree with their repros", () => {
  it.each`
    defect   | probe
    ${"D25"} | ${isJapaneseEraCompatNeeded}
    ${"D26"} | ${isIslamicEraCompatNeeded}
    ${"D27"} | ${isJapaneseTwoDigitYearCompatNeeded}
    ${"D28"} | ${isRelatedYearWidthCompatNeeded}
  `(
    "$defect probe is true exactly when a $defect repro fails",
    ({ defect, probe }) => {
      const own = repros.filter((repro) => repro.defect === defect);
      expect(own.length).toBeGreaterThan(0);
      expect(probe()).toBe(
        own.some((repro) => !reproPasses(repro, runRepro(repro))),
      );
    },
  );
});
