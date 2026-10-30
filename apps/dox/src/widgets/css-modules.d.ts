/**
 * Types for the kit's CSS Modules. `tsconfig.json` lists its `types`, so Vite's
 * client types are not loaded; this declares the one shape the kit imports.
 * `localsConvention: "camelCaseOnly"` (astro.config.mjs) makes every key camelCase.
 */
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
