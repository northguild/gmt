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
