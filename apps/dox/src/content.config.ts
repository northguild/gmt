import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

import { isToolIndustryId } from "./lib/tool-industries";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** The industries a tool page belongs to (lib/tool-industries.ts).
         *  Shown as tags under its title and used to group the tools index. */
        industries: z
          .array(
            z.string().refine(isToolIndustryId, {
              message: "not an industry in lib/tool-industries.ts",
            }),
          )
          .min(1)
          .optional(),
      }),
    }),
  }),
};
