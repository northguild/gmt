/**
 * The real gmt functions the HL7 Timestamp Reader's unit tests inject as an `Hl7Lib`, loaded by
 * module path so a test never needs the loader's dynamic imports. Cast as `Hl7Lib` through `unknown`, as `test/edi-lib.ts` does, because `resolveLocal`'s options
 * are a narrower type than the widgets' `Hl7Lib` states; `hl7-lib.test.ts` checks the two against
 * each other.
 */
import { formatHL7 } from "@northguild/gmt/healthcare/format";
import { parseHL7 } from "@northguild/gmt/healthcare/parse";
import {
  classifyLocal,
  fromOffsetInstant,
  resolveLocal,
  toOffsetInstant,
} from "@northguild/gmt/instant/convert";
import {
  diffUtcAsDuration,
  maxUtc,
  minUtc,
} from "@northguild/gmt/utc/calculate";
import type { Hl7Lib } from "~/lib/hl7-lib";

export const hl7Lib = {
  parseHL7,
  formatHL7,
  resolveLocal,
  classifyLocal,
  toOffsetInstant,
  fromOffsetInstant,
  minUtc,
  maxUtc,
  diffUtcAsDuration,
} as unknown as Hl7Lib;
