/**
 * The one module in `src` that names the Temporal implementation. Every other file, tests
 * included, imports from here, so the implementation can change in one place.
 *
 * The specifier is `/full/implementation`, never `/full` or the package's default entry: `/full`
 * hands back the runtime's built-in `Temporal` when there is one, and the default entry supports
 * only the `iso8601` and `gregory` calendars. `/full/implementation` is always the polyfill, with
 * every calendar.
 */
export {
  Intl,
  Temporal,
  toTemporalInstant,
} from "temporal-polyfill/full/implementation";
