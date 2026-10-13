// Shared by the API route, the components and the stats page. Runs inside a
// Worker and in the browser, so it imports nothing from Node.

export type Highlight = {
  id: number;
  text: string;
  start: number;
  city: string | null;
  country: string | null;
  createdAt: number;
  mine: boolean;
};

/** What the API sends back for one page. */
export type ReactionsState = {
  views: number;
  hearts: number;
  myHearts: number;
  highlights: Highlight[];
  /** The request carried the right admin token: every highlight can be deleted. */
  admin: boolean;
};

export type StatsRow = { slug: string; views: number; hearts: number; highlights: number };

export type StatsActivity = {
  kind: "heart" | "highlight";
  slug: string;
  /** Hearts: how many this reader gave. Highlights: 1. */
  n: number;
  text: string | null;
  city: string | null;
  country: string | null;
  /** Unix seconds. */
  at: number;
};

export type Stats = { rows: StatsRow[]; readers: number; activity: StatsActivity[] };

/**
 * The parts of a D1 binding this package uses. Structural, so it depends on
 * neither the host project's generated Env types nor workers-types.
 */
export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
};
export type D1Like = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<{ results: unknown[] }[]>;
};

/** Can readers highlight text on this path? See the `highlights` option. */
export const canHighlight = (highlights: boolean | string[], slug: string) =>
  Array.isArray(highlights) ? highlights.some((prefix) => slug.startsWith(prefix)) : highlights;

/** Views, hearts and highlights for one page, as one reader sees them. */
export async function getState(
  db: D1Like,
  slug: string,
  visitor: string,
  admin: boolean,
): Promise<ReactionsState> {
  const [views, hearts, highlights] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM views WHERE slug = ?").bind(slug),
    db
      .prepare(
        "SELECT COALESCE(SUM(n), 0) AS n, COALESCE(SUM(CASE WHEN visitor = ?2 THEN n END), 0) AS mine FROM hearts WHERE slug = ?1",
      )
      .bind(slug, visitor),
    db
      .prepare(
        "SELECT id, text, start, city, country, created_at AS createdAt, visitor = ?2 AS mine FROM highlights WHERE slug = ?1 ORDER BY start",
      )
      .bind(slug, visitor),
  ]);
  const count = views!.results[0] as { n: number };
  const heart = hearts!.results[0] as { n: number; mine: number };
  return {
    views: count.n,
    hearts: heart.n,
    myHearts: heart.mine,
    admin,
    highlights: (highlights!.results as (Omit<Highlight, "mine"> & { mine: number })[]).map(
      (h) => ({ ...h, mine: Boolean(h.mine) }),
    ),
  };
}

/** Totals per page, unique readers and the latest hearts and highlights. */
export async function getStats(db: D1Like, activityLimit = 60): Promise<Stats> {
  const [perPage, distinct, recent] = await db.batch([
    db.prepare(`
      SELECT slug, SUM(v) AS views, SUM(h) AS hearts, SUM(hl) AS highlights FROM (
        SELECT slug, COUNT(*) AS v, 0 AS h, 0 AS hl FROM views GROUP BY slug
        UNION ALL SELECT slug, 0, SUM(n), 0 FROM hearts GROUP BY slug
        UNION ALL SELECT slug, 0, 0, COUNT(*) FROM highlights GROUP BY slug
      ) GROUP BY slug ORDER BY views DESC, hearts DESC`),
    db.prepare("SELECT COUNT(DISTINCT visitor) AS n FROM views"),
    // One row per reader per page for hearts (n is how many), one per highlight.
    db
      .prepare(
        `SELECT 'heart' AS kind, slug, n, NULL AS text, city, country, updated_at AS at
           FROM hearts WHERE updated_at IS NOT NULL
         UNION ALL
         SELECT 'highlight', slug, 1, text, city, country, created_at FROM highlights
         ORDER BY at DESC LIMIT ?`,
      )
      .bind(activityLimit),
  ]);
  return {
    rows: perPage!.results as StatsRow[],
    readers: (distinct!.results[0] as { n: number }).n,
    activity: recent!.results as StatsActivity[],
  };
}

const regions = new Intl.DisplayNames(["en"], { type: "region" });

// Cloudflare also sends XX (unknown) and T1 (Tor), which aren't countries.
const knownCountry = (country: string | null) =>
  country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null;

/** "London, United Kingdom", or as much of it as we know. */
export const place = (city: string | null, country: string | null) => {
  const known = knownCountry(country);
  return [city, known && regions.of(known)].filter(Boolean).join(", ");
};

/** GB → 🇬🇧: each letter maps to a regional indicator symbol. */
export const flag = (country: string | null) => {
  const known = knownCountry(country);
  return known ? String.fromCodePoint(...[...known].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
};

/** How long ago a unix time was, short: "now", "14m", "2h", "3d". */
export const ago = (at: number, now = Date.now() / 1000) => {
  const s = Math.max(0, now - at);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const rules = new Intl.PluralRules("en-GB");

/** The word for n: plural(1, 'mark', 'marks') is "mark", plural(6, …) "marks". */
export const plural = (n: number, one: string, other: string) =>
  rules.select(n) === "one" ? one : other;
