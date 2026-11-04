// Views, hearts and highlights for pages, kept in D1. The page POSTs one
// action and gets the page's full state back, so a page load is one request.
// A reader is a random id the browser keeps in localStorage: "views" are
// unique readers, and "mine" marks that reader's own highlights.
// ponytail: anyone can make up new reader ids to add views, hearts or
// highlights. Add a Cloudflare rate limiting rule on the route if that ever
// happens.
import config from "virtual:astro-d1-reactions/config";
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { canHighlight, type D1Like, getState } from "./core";

export const prerender = false;

const SLUG = /^\/[\w/-]{0,200}$/;
const VISITOR = /^[0-9a-f-]{36}$/;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Hash both sides so the comparison time says nothing about the token.
const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].join();

async function isAdmin(token: unknown, secret: unknown) {
  if (typeof token !== "string" || !token || typeof secret !== "string" || !secret) return false;
  return (await sha256(token)) === (await sha256(secret));
}

export const POST: APIRoute = async ({ request }) => {
  type Body = Partial<
    Record<"slug" | "visitor" | "action" | "text" | "start" | "id" | "token", unknown>
  >;
  const body: Body = (await request.json().catch(() => null)) ?? {};
  const { slug, visitor, action } = body;
  if (typeof slug !== "string" || !SLUG.test(slug)) {
    return json({ error: "Invalid slug" }, 400);
  }
  if (typeof visitor !== "string" || !VISITOR.test(visitor)) {
    return json({ error: "Invalid visitor" }, 400);
  }

  // `env` comes from `cloudflare:workers` and the reader's location from
  // `request.cf` (Astro 6+ adapter; the old `locals.runtime` is gone).
  const db = env[config.binding] as D1Like | undefined;
  if (!db) {
    return json({ error: `D1 binding "${config.binding}" not found` }, 500);
  }
  const admin = await isAdmin(body.token, env[config.adminTokenEnv]);
  // Where the reader is, from Cloudflare: shown with highlights and on the
  // stats page. Structurally typed (via unknown) so the package depends on
  // neither the host project's Env types nor workers-types.
  const cf = (request as unknown as { cf?: { city?: string; country?: string } }).cf;
  const city = cf?.city ?? null;
  const country = cf?.country ?? null;

  if (action === "view") {
    // Your own reads don't count.
    if (!admin)
      await db
        .prepare("INSERT OR IGNORE INTO views (slug, visitor) VALUES (?, ?)")
        .bind(slug, visitor)
        .run();
  } else if (action === "heart") {
    await db
      .prepare(
        `INSERT INTO hearts (slug, visitor, city, country, updated_at)
         VALUES (?, ?, ?, ?, unixepoch())
         ON CONFLICT DO UPDATE SET n = n + 1, city = excluded.city,
           country = excluded.country, updated_at = excluded.updated_at
         WHERE n < ${Number(config.maxHearts)}`,
      )
      .bind(slug, visitor, city, country)
      .run();
  } else if (action === "highlight") {
    const { text, start } = body;
    if (
      !canHighlight(config.highlights, slug) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > config.maxText ||
      typeof start !== "number" ||
      !Number.isInteger(start) ||
      start < 0
    ) {
      return json({ error: "Invalid highlight" }, 400);
    }
    await db
      .prepare(
        `INSERT INTO highlights (slug, visitor, text, start, city, country)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
         WHERE (SELECT COUNT(*) FROM highlights WHERE slug = ?1 AND visitor = ?2) < ${Number(config.maxHighlights)}
         ON CONFLICT DO NOTHING`,
      )
      .bind(slug, visitor, text, start, city, country)
      .run();
  } else if (action === "delete") {
    // Readers can delete their own highlights, the admin anyone's.
    const { id } = body;
    if (typeof id !== "number" || !Number.isInteger(id)) {
      return json({ error: "Invalid id" }, 400);
    }
    await db
      .prepare("DELETE FROM highlights WHERE id = ?1 AND slug = ?2 AND (visitor = ?3 OR ?4)")
      .bind(id, slug, visitor, admin ? 1 : 0)
      .run();
  } else if (action !== "state") {
    return json({ error: "Invalid action" }, 400);
  }

  return json(await getState(db, slug, visitor, admin));
};
