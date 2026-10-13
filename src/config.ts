/**
 * A page the stats dashboard knows about. Rows for any other path are left
 * out, so made-up paths posted straight to the API never show.
 *
 * - `{ collection, url, type }` lists every entry of a content collection,
 *   titled from its `title` frontmatter. `:slug` in `url` is replaced with
 *   the entry's slug (or id).
 * - `{ url, title }` lists one page by hand.
 */
export type StatsPage =
  | {
      collection: string;
      url: string;
      type: string;
      /** Only entries whose frontmatter has this key set to a truthy value. */
      where?: string;
      /** How the activity feed names it, e.g. 'the post'. Default: 'the <type>'. */
      noun?: string;
    }
  | {
      url: string;
      title: string;
      type?: string;
      noun?: string;
    };

/** The icons the pill and the stats page use. */
export type ReactionsIcons = Record<"heart" | "highlighter" | "eye" | "trash" | "users", string>;

export type D1ReactionsOptions = {
  /** D1 database name, as created with `wrangler d1 create <name>`. */
  database: string;
  /** D1 binding name in wrangler config. Default: 'REACTIONS_DB'. */
  binding?: string;
  /**
   * Name of the secret holding the admin token. Open any page with
   * `#admin=<token>` once to delete anyone's highlights and stop counting your
   * own reads. Default: 'REACTIONS_ADMIN_TOKEN'.
   */
  adminTokenEnv?: string;
  /** Route pattern for the injected API endpoint. Default: '/api/reactions'. */
  apiRoute?: string;
  /**
   * Where readers may highlight text: `true` for every page, `false` for none,
   * or a list of path prefixes such as `['/blog/', '/notes/']`. Default: true.
   */
  highlights?: boolean | string[];
  /** Hearts one reader can give one page. Default: 10. */
  maxHearts?: number;
  /** Highlights one reader can make on one page. Default: 50. */
  maxHighlights?: number;
  /** Longest highlight, in characters. Default: 1000. */
  maxText?: number;
  /** The line shown for each heart a reader gives, in order. */
  thanks?: string[];
  /**
   * Swap any icon. Each value is SVG markup (`'<svg …>…</svg>'`) or a path to
   * an .svg file, relative to the project root. Use `fill="currentColor"` or
   * `stroke="currentColor"` so it takes the pill's colours.
   */
  icons?: Partial<ReactionsIcons>;
  /**
   * The pages the stats dashboard lists. Leave it out to list every path in
   * the database, titled by its path.
   */
  pages?: StatsPage[];
};

export type ResolvedD1ReactionsConfig = Required<Omit<D1ReactionsOptions, "pages" | "icons">> & {
  pages: StatsPage[] | null;
  /** Filled in with SVG markup by the integration. */
  icons: Partial<ReactionsIcons>;
};

const THANKS = [
  "thank you",
  "oh, twice?",
  "you're too kind",
  "steady on",
  "halfway to ten",
  "you really like this one",
  "I'm blushing",
  "nearly there",
  "one more…",
  "ten! you legend",
];

export function resolveConfig(options: D1ReactionsOptions): ResolvedD1ReactionsConfig {
  if (!options?.database) {
    throw new Error("[astro-d1-reactions] `database` option is required");
  }
  const maxHearts = options.maxHearts ?? 10;
  return {
    database: options.database,
    binding: options.binding ?? "REACTIONS_DB",
    adminTokenEnv: options.adminTokenEnv ?? "REACTIONS_ADMIN_TOKEN",
    apiRoute: options.apiRoute ?? "/api/reactions",
    highlights: options.highlights ?? true,
    maxHearts,
    maxHighlights: options.maxHighlights ?? 50,
    maxText: options.maxText ?? 1000,
    // The default lines count to ten, so only use them for ten hearts.
    thanks: options.thanks ?? (maxHearts === 10 ? THANKS : ["thank you"]),
    pages: options.pages ?? null,
    icons: options.icons ?? {},
  };
}
