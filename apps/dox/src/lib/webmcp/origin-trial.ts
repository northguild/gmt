/**
 * The WebMCP origin-trial tokens for this site's origin.
 *
 * A token is public: it ships in a `<meta http-equiv="origin-trial">` tag on every tool page, so it
 * is a committed constant. Its diff gets reviewed and the build stays reproducible. While the list
 * is empty no meta is emitted, and Chrome's testing flag (`chrome://flags/#enable-webmcp-testing`)
 * still turns WebMCP on for whoever sets it.
 *
 * The owner registers `https://northguild.dev` at the origin-trial console, pastes the token here,
 * and renews it before it expires (the console emails a link).
 */
export const ORIGIN_TRIAL_TOKENS: readonly string[] = [];
