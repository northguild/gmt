#!/usr/bin/env node
/**
 * Report the reference documentation the gmt source does not yet supply: types, members and
 * options with no description, optional inputs with no `@defaultValue`, `@param` tags that
 * name no parameter, and public types no public function reaches.
 *
 * It runs the same extraction the reference generator runs (`extractReference`), ignores
 * the generator's input hash, and writes nothing.
 *
 * Exits 1 when there is at least one gap.
 *
 * Run as: pnpm dox:docs-check
 *   --json    print the gaps as JSON instead of the text report
 */

import { extractReference, gateInput } from "./build-reference";
import {
  countOptionDeclarations,
  findGaps,
  formatGapReport,
} from "./build-utils/doc-gate";

const args = new Set(process.argv.slice(2));

const input = gateInput(extractReference());
const gaps = findGaps(input);

if (args.has("--json")) {
  console.log(JSON.stringify(gaps, null, 2));
} else {
  console.log(formatGapReport(gaps));
  console.log("");
  console.log(
    `${countOptionDeclarations(input)} unique option-property declarations checked`,
  );
}

if (gaps.length > 0) process.exit(1);
