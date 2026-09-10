/**
 * Ambient types for the `virtual:starlight/components/*` internal virtual
 * modules used by Header.astro's override.
 *
 * These ARE declared by `@astrojs/starlight`'s own `virtual-internal.d.ts`,
 * but that file isn't referenced by Astro's generated `.astro/types.d.ts` for
 * a consuming project — only Starlight's own package build sees it. The
 * import path itself resolves fine at build time (Astro's Vite plugin
 * provides the virtual module); this file only fills the type-checking gap,
 * mirroring `virtual-internal.d.ts`'s own declarations exactly.
 *
 * Deliberately NOT a direct `@astrojs/starlight/components/X.astro` import in
 * Header.astro instead — that would resolve to Starlight's *default*
 * component, silently bypassing this repo's own SocialIcons.astro and
 * ThemeSelect.astro overrides (see `astro.config.mjs`'s `components` map).
 * The virtual module path is what makes Header.astro compose the site's
 * actual configured overrides, matching how Starlight's own Header.astro
 * composes them.
 */
declare module "virtual:starlight/components/LanguageSelect" {
  const LanguageSelect: typeof import("@astrojs/starlight/components/LanguageSelect.astro").default;
  export default LanguageSelect;
}
declare module "virtual:starlight/components/Search" {
  const Search: typeof import("@astrojs/starlight/components/Search.astro").default;
  export default Search;
}
declare module "virtual:starlight/components/SiteTitle" {
  const SiteTitle: typeof import("@astrojs/starlight/components/SiteTitle.astro").default;
  export default SiteTitle;
}
declare module "virtual:starlight/components/SocialIcons" {
  const SocialIcons: typeof import("@astrojs/starlight/components/SocialIcons.astro").default;
  export default SocialIcons;
}
declare module "virtual:starlight/components/ThemeSelect" {
  const ThemeSelect: typeof import("@astrojs/starlight/components/ThemeSelect.astro").default;
  export default ThemeSelect;
}
