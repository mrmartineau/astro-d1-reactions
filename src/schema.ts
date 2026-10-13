import { z } from "astro/zod";

/**
 * Frontmatter keys the `<Reactions>` component reads. Spread into a content
 * collection schema so entries can switch reactions off:
 *
 *   schema: z.object({ title: z.string(), ...reactionsSchema })
 *
 * `reactions: false` hides hearts, reads and highlights on that page.
 * `highlights: false` keeps hearts and reads but turns highlights off.
 */
export const reactionsSchema = {
  reactions: z.boolean().optional(),
  highlights: z.boolean().optional(),
};
