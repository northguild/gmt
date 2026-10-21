/** Module shapes the harnesses import that TypeScript cannot see: the browser config's virtual source tree and Vite's `?raw` suffix. */
declare module "virtual:gmt-source-tree" {
  const data: {
    trees: Record<string, Record<string, string>>;
    repo: Record<string, string>;
  };
  export default data;
}

/** A file imported as its text, as Vite does for the `?raw` suffix. */
declare module "*?raw" {
  const text: string;
  export default text;
}
