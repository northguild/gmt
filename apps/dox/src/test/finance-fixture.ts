/**
 * The real finance functions as a `FinanceLib`, for tests that hold the Dox tools to the
 * library (not a `.test` file, so the `dox-test/*` lint does not read it).
 */
import { formatFixUtcTimestamp } from "@northguild/gmt/finance/format";
import { parseFixUtcTimestamp } from "@northguild/gmt/finance/parse";
import { isValidFixUtcTimestamp } from "@northguild/gmt/finance/validate";
import type { FinanceLib } from "~/lib/finance-widgets";

export const realFinanceLib: FinanceLib = {
  parseFixUtcTimestamp,
  formatFixUtcTimestamp,
  isValidFixUtcTimestamp,
};
