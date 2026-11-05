/**
 * The swap entry's own `Temporal` (CORE-92), read from the package by name and not through the
 * `@js-temporal/polyfill` alias. Only `swapEntry.test.ts` imports it, and only in a swap pass: the
 * package is installed in the swap job's checkout alone, so an ordinary run never loads this file.
 */
export { Temporal } from "temporal-polyfill/full/implementation";
