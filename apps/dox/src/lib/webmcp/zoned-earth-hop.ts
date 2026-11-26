/**
 * One extra hop to the zoned-earth tool, so the landing page's Globe script does not carry the tool's
 * preload table. The globe sits on the landing page, whose first-input budget is tight; this chunk is
 * fetched only when the page's head names the tool and the browser has a model context. It lives
 * outside `tools/` because the coverage and browser gates treat each file there as a page tool.
 * Imports nothing statically and holds no top-level await.
 */
export const loadZonedEarthTool = () => import("./tools/zoned-earth");
