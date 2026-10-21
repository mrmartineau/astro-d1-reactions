---
name: astro-d1-reactions
description: "Add page reactions to an Astro site with the astro-d1-reactions integration: hearts, unique reads and reader highlights in a pill at the bottom of the page, kept in Cloudflare D1, plus a public /stats dashboard. Covers the D1 database and binding, the shipped migrations, the integration, the <Reactions /> pill, frontmatter switches, the stats page, the admin token, icons, theming and the failure modes. Use when asked to add hearts, likes, reactions, read counts, view counts, reader highlights or a stats page to an Astro site, or to work with an existing astro-d1-reactions setup."
---

# astro-d1-reactions

Hearts, unique reads and reader highlights for Astro pages, kept in Cloudflare
D1. One integration injects `POST /api/reactions`. One component, `<Reactions />`,
draws a pill fixed to the bottom of the page. A second component, `<Stats />`,
is a whole dashboard.

Needs the `@astrojs/cloudflare` adapter. The site can stay `output: 'static'`.
Only the API route and the stats page run on the server.

## Before you start

Look at the project first. Find out:

- **Package manager**: from the lock file. Use it for every install.
- **Adapter**: is `@astrojs/cloudflare` in `astro.config.*`? If not, add it.
- **Wrangler config**: `wrangler.toml`, `wrangler.jsonc` or `wrangler.json`. Edit
  the one that is there. Make `wrangler.toml` only if there is none.
- **Pages or Workers**: `pages_build_output_dir` in the wrangler config means
  Pages. `main` or `assets` means Workers. This changes the secret command.
- **The layout** that wraps every page, and the element that holds the article
  text. That element gets `data-highlightable`.
- **Content collections** in `src/content.config.ts` (or `src/content/config.ts`),
  and the URL each one renders at. These become the `pages` option.

Ask the user only for what you cannot find: the database name (default to
`<site-name>-reactions`) and whether they want the stats page.

## Setup

1. Install:

   ```sh
   pnpm add astro-d1-reactions
   pnpm add -D wrangler          # if absent
   pnpm astro add cloudflare     # if the adapter is absent
   ```

2. Make the database. Keep the `database_id` it prints:

   ```sh
   pnpm wrangler d1 create my-site-reactions
   ```

3. Add the binding to the wrangler config. `migrations_dir` points into the
   package, so the schema updates with it.

   ```toml
   # wrangler.toml
   [[d1_databases]]
   binding = "REACTIONS_DB"
   database_name = "my-site-reactions"
   database_id = "<id from step 2>"
   migrations_dir = "node_modules/astro-d1-reactions/migrations"
   ```

   ```jsonc
   // wrangler.jsonc
   "d1_databases": [
     {
       "binding": "REACTIONS_DB",
       "database_name": "my-site-reactions",
       "database_id": "<id from step 2>",
       "migrations_dir": "node_modules/astro-d1-reactions/migrations"
     }
   ]
   ```

   If the project already has a `d1_databases` list (for example from
   `astro-d1-search`), add to it. Do not replace it.

4. Apply the migrations, locally and to production:

   ```sh
   pnpm wrangler d1 migrations apply my-site-reactions --local
   pnpm wrangler d1 migrations apply my-site-reactions --remote
   ```

   Ask before you run `--remote`. It changes the live database.

5. Add the integration. `platformProxy` gives `astro dev` the local D1 database.

   ```js
   // astro.config.mjs
   import cloudflare from "@astrojs/cloudflare";
   import { defineConfig } from "astro/config";
   import reactions from "astro-d1-reactions";

   export default defineConfig({
     output: "static",
     adapter: cloudflare({ platformProxy: { enabled: true } }),
     integrations: [reactions({ database: "my-site-reactions" })],
   });
   ```

   Keep the existing `output`, adapter options and integrations. Only add.

6. Add the pill to the layout, once, and mark the article text:

   ```astro
   ---
   import { Reactions } from 'astro-d1-reactions/components';
   ---

   <article data-highlightable>
     <slot />
   </article>
   <Reactions />
   ```

7. Optional: the stats page, the frontmatter switches and the admin token
   (below).

8. Check it: run `pnpm dev`, open a page, give it a heart, select a sentence and
   click **Highlight**. Reload. The counts must stay.

## The pill

```astro
<Reactions
  slug="/blog/my-post"     // key for this page's reactions. Default: current path, no trailing slash
  highlights={false}       // hearts and reads only
  frontmatter={entry.data} // reads `reactions` and `highlights` from it
  when="html.classic"      // show only when <html> matches this selector
/>
```

- `slug={false}` hides hearts and reads. Only slotted buttons show.
- Use **one** `<Reactions />` per page. The script finds the first one only.
- Highlights use the **first** `[data-highlightable]` on the page. Put it on the
  element that holds the article body, not on `<body>`. Nav and footer text
  would then be selectable too.
- The `slug` is the key in the database. Pick it once. A new key starts from zero.

Add buttons to the pill with the default slot. Popovers go in the `after` slot:

```astro
<Reactions>
  <button class="reactions-seg" popovertarget="share" data-hint="share this page">Share</button>
  <div slot="after" id="share" class="reactions-popover" popover>…</div>
</Reactions>
```

## Frontmatter switches

Pass the entry's `data` to the pill in the post layout:

```astro
<article data-highlightable><slot /></article>
<Reactions slug={`/blog/${entry.id}`} frontmatter={entry.data} />
```

Add the keys to each collection schema that uses them. Without this, Zod
removes them from `entry.data` and the switches do nothing:

```ts
// src/content.config.ts
import { reactionsSchema } from "astro-d1-reactions/schema";

const blog = defineCollection({
  schema: z.object({ title: z.string(), ...reactionsSchema }),
});
```

Then `reactions: false` in a post hides everything. `highlights: false` keeps
hearts and reads.

### Pages without frontmatter

A homepage or other `.astro` page has no frontmatter. When one layout wraps
every page, let the layout take the pill's props and pass them on:

```astro
---
// src/layouts/Layout.astro
const { reactions } = Astro.props;
---
<slot />
<Reactions {...reactions} />
```

```astro
<!-- src/pages/index.astro -->
<Layout reactions={{ slug: '/', highlights: false }}>…</Layout>
```

- `{ highlights: false }`: hearts and reads, no highlights.
- `{ slug: false }`: no hearts or reads.
- Do not put `'/'` in the `highlights` option for the homepage. It matches the
  start of the path, so it turns highlights on for every page.

## The stats page

```astro
---
// src/pages/stats.astro
export const prerender = false;
import { Stats } from 'astro-d1-reactions/components';
import Layout from '../layouts/Layout.astro';
---

<Layout title="Stats">
  <Stats />
</Layout>
```

`prerender = false` is required. The page reads D1 on each request.

Props: `activityLimit` (40), `cacheMaxAge` (60 seconds, `0` for none),
`locale`. Slots: `empty` and `error`.

**Set `pages` on a public site.** Anyone can post a made-up path to the API.
Without `pages`, the dashboard lists every path in the database. With `pages`,
it lists only known pages and takes titles from `title` frontmatter:

```js
reactions({
  database: "my-site-reactions",
  pages: [
    // The first match for a path wins, so put `where` entries first.
    { collection: "blog", where: "worklog", url: "/blog/:slug", type: "Worklog" },
    { collection: "blog", url: "/blog/:slug", type: "Post", noun: "the post" },
    { url: "/uses", title: "My setup" },
  ],
});
```

Make each `url` match the `slug` the pill uses on that page, with no trailing
slash. `:slug` becomes the entry's `slug`, or its `id`. Entries with
`draft: true` are left out in production.

For a custom layout, use `loadStats(Astro.locals)` with `StatsTotals`,
`StatsTable` and `StatsActivity`, all from `astro-d1-reactions/components`.

## Admin token

The admin can delete any highlight. The admin's own reads do not count.

```sh
pnpm wrangler pages secret put REACTIONS_ADMIN_TOKEN   # Pages
pnpm wrangler secret put REACTIONS_ADMIN_TOKEN         # Workers
```

Locally, put `REACTIONS_ADMIN_TOKEN=...` in `.dev.vars`. Make sure `.dev.vars`
is in `.gitignore`. Then open any page with `#admin=<token>` once. `#admin=`
clears it.

## Options

| Option          | Default                   | Note                                                    |
| --------------- | ------------------------- | ------------------------------------------------------- |
| `database`      | required                  | Name from `wrangler d1 create`                          |
| `binding`       | `'REACTIONS_DB'`          | Must match the wrangler config                          |
| `adminTokenEnv` | `'REACTIONS_ADMIN_TOKEN'` | Name of the admin secret                                |
| `apiRoute`      | `'/api/reactions'`        | The injected endpoint                                   |
| `highlights`    | `true`                    | `true`, `false`, or path prefixes such as `['/blog/']`  |
| `maxHearts`     | `10`                      | Per reader, per page                                    |
| `maxHighlights` | `50`                      | Per reader, per page                                    |
| `maxText`       | `1000`                    | Longest highlight, in characters                        |
| `thanks`        | ten lines                 | Line per heart. Only the default when `maxHearts` is 10 |
| `icons`         | Phosphor                  | `heart`, `highlighter`, `eye`, `trash`, `users`         |
| `pages`         | every path                | What the stats page lists                               |

Icons take SVG markup or a path to an `.svg` file from the project root. Use
`fill="currentColor"` or `stroke="currentColor"`.

Theme with CSS custom properties on `:root`: `--rx-bg`, `--rx-line`,
`--rx-text`, `--rx-text-bright`, `--rx-accent`, `--rx-heart`, `--rx-shadow`,
`--rx-font`, `--rx-font-headings`, `--rx-font-mono`, `--rx-bottom`, `--rx-radius`, `--rx-border-width`,
`--rx-stats-tile`, `--rx-stats-radius`. The defaults have zero specificity, so
any rule wins.

## Troubleshooting

| Symptom                                            | Cause                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Startup warning about the wrangler config          | The config does not contain the binding and database names. Add the snippet it prints   |
| `500`, `D1 binding "REACTIONS_DB" not found`       | Binding missing or misspelled, or `platformProxy` not on in dev                         |
| `no such table: views` (or `hearts`, `highlights`) | Migrations not applied. Run them with `--local` for dev, `--remote` for production      |
| `400 Invalid slug`                                 | The path has a character outside `[A-Za-z0-9_/-]`, such as a dot. Pass a `slug` prop    |
| Pill does not show                                 | `when` does not match, `reactions: false` in frontmatter, or the script did not run     |
| No highlight button                                | `highlights` option, prop or frontmatter turns it off for this path                     |
| Selecting text does nothing                        | No `[data-highlightable]` element, or the selection is outside it                       |
| Highlights in the list but not drawn on the page   | Browser without the CSS Custom Highlight API, or the text changed since                 |
| Stats page fails at build                          | Missing `export const prerender = false`                                                |
| A page is missing from the stats                   | Not in `pages`, a `draft`, or its `url` differs from the pill's `slug` (trailing slash) |
| Your own reads do not count                        | This browser has the admin token. Open a page with `#admin=` to clear it                |
| Counts reset for every reader                      | The `slug` for the page changed. Old counts are still under the old key                 |

## Rules

- Never edit, rename or delete files in the package's `migrations/`. Wrangler
  tracks applied migrations by file name.
- Never drop or rebuild the reactions tables. They hold real reader data.
- After a package update, run the migrations again. New ones only add.
