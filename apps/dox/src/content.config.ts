import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

import { isIndustryTagId } from "./lib/industry-tags";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** The text of `<title>` and `og:title`, without the site suffix, where it should
         *  differ from `title`. Generated for reference pages (`build-utils/reference-title.ts`). */
        headTitle: z.string().optional(),
        /** The industries a tool, scenario or guide belongs to
         *  (lib/industry-tags.ts). Shown as tags under its title; the tools
         *  index groups by them. */
        industries: z
          .array(
            z.string().refine(isIndustryTagId, {
              message: "not an industry in lib/industry-tags.ts",
            }),
          )
          .min(1)
          .optional(),
      }),
    }),
  }),
};
