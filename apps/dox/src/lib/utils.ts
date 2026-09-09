import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, resolving Tailwind utility conflicts (e.g. `p-2 p-4` -> `p-4`).
 * Standard shadcn/ui utility — every AI Elements / shadcn component imports this
 * from `~/lib/utils` (see `components.json`'s `aliases.utils`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
