import { z } from "astro/zod";

/**
 * Frontmatter keys the `<Reactions>` component reads. Spread into a content
 * collection schema so entries can switch reactions off:
 *
 *   schema: z.object({ title: z.string(), ...reactionsSchema })
 *
 * `reactions: false` hides hearts, reads and highlights on that page.
 * `highlights: false` keeps hearts and reads but turns highlights off.
 * `comments: false` hides the comments, and the Comment button on selected text.
 */
export const reactionsSchema = {
  reactions: z.boolean().optional(),
  highlights: z.boolean().optional(),
  comments: z.boolean().optional(),
};
