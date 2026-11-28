/**
 * The candidate release's own `Temporal` (CORE-92, CORE-108), read from the npm alias by name and
 * not through the seam's alias. Only `swapEntry.test.ts` imports it, and only in a swap pass: the
 * alias is installed in the upgrade job's checkout alone, so an ordinary run never loads this file.
 */
export { Temporal } from "temporal-polyfill-candidate/full/implementation";
