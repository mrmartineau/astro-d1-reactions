// Loads the stats dashboard's data: the numbers from D1, the titles from the
// `pages` option (content collection frontmatter, or listed by hand).
import { getCollection } from "astro:content";
import config from "virtual:astro-d1-reactions/config";
import { type D1Like, getStats, type StatsActivity, type StatsRow } from "../core";

type PageInfo = { title: string; type: string; noun: string };

export type LoadedStats = {
  rows: (StatsRow & PageInfo)[];
  readers: number;
  activity: (StatsActivity & PageInfo)[];
  totals: { views: number; readers: number; hearts: number; highlights: number };
};

const noun = (type: string, given?: string) => given ?? `the ${type.toLowerCase()}`;

/** Every page the dashboard knows, by path. null: list every path. */
async function pageMap() {
  if (!config.pages) return null;
  const map = new Map<string, PageInfo>();
  for (const page of config.pages) {
    if ("collection" in page) {
      // Typed loosely: the collection names are the host project's.
      const entries = await (
        getCollection as unknown as (
          name: string,
        ) => Promise<{ id: string; slug?: string; data: Record<string, unknown> }[]>
      )(page.collection);
      for (const entry of entries) {
        if (page.where && !entry.data[page.where]) continue;
        if (entry.data.draft && !import.meta.env.DEV) continue;
        const url = page.url.replace(":slug", entry.slug ?? entry.id);
        // The first source to claim a path wins, so list `where` sources first.
        if (map.has(url)) continue;
        map.set(url, {
          title: typeof entry.data.title === "string" ? entry.data.title : url,
          type: page.type,
          noun: noun(page.type, page.noun),
        });
      }
    } else if (!map.has(page.url)) {
      const type = page.type ?? "Page";
      map.set(page.url, { title: page.title, type, noun: noun(type, page.noun) });
    }
  }
  return map;
}

/**
 * The stats for a server-rendered page. Pass `Astro.locals`.
 * Throws if the D1 binding is missing or the query fails.
 */
export async function loadStats(locals: unknown, activityLimit = 40): Promise<LoadedStats> {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env;
  const db = env?.[config.binding] as D1Like | undefined;
  if (!db) throw new Error(`[astro-d1-reactions] D1 binding "${config.binding}" not found`);

  // Fetch extra activity: rows for unknown paths are dropped below.
  const [stats, pages] = await Promise.all([getStats(db, activityLimit * 2), pageMap()]);
  const known = <T extends { slug: string }>(row: T) => {
    const page = pages ? pages.get(row.slug) : { title: row.slug, type: "Page", noun: "the page" };
    return page ? [{ ...row, ...page }] : [];
  };
  const rows = stats.rows.flatMap(known);
  const sum = (key: "views" | "hearts" | "highlights") =>
    rows.reduce((total, row) => total + row[key], 0);
  return {
    rows,
    readers: stats.readers,
    // ponytail: the latest activityLimit only; add paging if the feed ever needs history.
    activity: stats.activity.flatMap(known).slice(0, activityLimit),
    totals: {
      views: sum("views"),
      readers: stats.readers,
      hearts: sum("hearts"),
      highlights: sum("highlights"),
    },
  };
}
