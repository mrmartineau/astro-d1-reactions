# astro-d1-reactions

Page reactions for [Astro](https://astro.build), kept in [Cloudflare D1](https://developers.cloudflare.com/d1/).

One integration gives you:

- **A pill fixed to the bottom of the page** with hearts, unique reads and reader highlights
- **Highlights** drawn with the CSS Custom Highlight API, so your page's DOM is never changed
- **Comments**, on a page or on a passage the reader selects (optional)
- **An injected API endpoint** (`POST /api/reactions`)
- **Stats components** for a public dashboard: totals, every page, recent activity
- **Frontmatter switches**: `reactions: false`, `highlights: false` or `comments: false` on any page

No cookies and no sign-in. A reader is a random id kept in their browser, so each person counts once per page. Each heart, highlight and comment stores the reader's city and country from Cloudflare. A comment can also carry a name, if the reader types one.

Needs the [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter. The rest of your site can stay static. Only the endpoint and the stats page run on the server.

Sister package: [`astro-d1-search`](https://github.com/mrmartineau/astro-d1-search).

🤖 **Using a coding agent?** Install the skill and ask it to do the setup for you:

```sh
npx skills add mrmartineau/astro-d1-reactions
```

It teaches the agent the setup order, every file to change and the failure modes. See [`SKILL.md`](./SKILL.md).

## Install

```sh
pnpm add astro-d1-reactions
```

## Quick start

### 1. Make the database

```sh
wrangler d1 create my-site-reactions
```

### 2. Add the binding

In `wrangler.toml`. The integration checks this at startup and prints this snippet if it is missing.

```toml
[[d1_databases]]
binding = "REACTIONS_DB"
database_name = "my-site-reactions"
database_id = "<id from step 1>"
migrations_dir = "node_modules/astro-d1-reactions/migrations"
```

The schema ships with the package. Apply it, and again after any update that adds a migration:

```sh
wrangler d1 migrations apply my-site-reactions --local    # for astro dev
wrangler d1 migrations apply my-site-reactions --remote   # for production
```

This is real reader data, so it is never rebuilt. Migrations only add to it.

### 3. Add the integration

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

`platformProxy` gives `astro dev` your **local** D1 database.

### 4. Add the pill

Put it in your layout, once per page:

```astro
---
import { Reactions } from 'astro-d1-reactions/components';
---

<Reactions />
```

With no props it uses the current path as the page key. For highlights, mark the element that holds the text:

```astro
<article data-highlightable>
  <slot />
</article>
```

That's it. Open a page, give it a heart, select a sentence.

## The pill

```astro
<Reactions
  slug="/blog/my-post"            // the key reactions are kept under. Default: the current path
  highlights={false}              // hearts and reads only
  frontmatter={entry.data}        // reads `reactions`, `highlights` and `comments` from it
  when="html.classic"             // only show when <html> matches this selector
/>
```

`slug={false}` hides hearts and reads, so only what you slot in shows.

It works with Astro's `ClientRouter` (view transitions). The pill starts again after each navigation, and counts a read for each page you land on. Do not put the pill under `transition:persist`: Astro then keeps the old pill, with the old page's slug.

### Add your own buttons

Anything in the default slot joins the pill. Give it `class="reactions-seg"` for the same look, and `data-hint` for the line that pops up on hover. The `after` slot is for popovers that belong to the pill. Give them `class="reactions-popover"` for the same look and position.

```astro
<Reactions>
  <button class="reactions-seg" popovertarget="share" data-hint="share this page">
    Share
  </button>
  <div slot="after" id="share" class="reactions-popover" popover>…</div>
</Reactions>
```

### Admin

Set a secret (`REACTIONS_ADMIN_TOKEN` by default):

```sh
wrangler pages secret put REACTIONS_ADMIN_TOKEN   # .dev.vars locally
```

Open any page with `#admin=<token>` once. From then on, that browser can delete anyone's highlights and comments, and its own reads don't count. `#admin=` forgets it. A fragment never reaches the server logs.

## Comments

Readers can comment on a page, or on one passage of it. Comments are off until you turn them on, with `true` or a list of path prefixes:

```js
reactions({
  database: "my-site-reactions",
  comments: ["/blog/"],
});
```

Apply the new migration, then put `<Comments>` under the article:

```sh
wrangler d1 migrations apply my-site-reactions --local
wrangler d1 migrations apply my-site-reactions --remote
```

```astro
---
import { Comments, Reactions } from 'astro-d1-reactions/components';
const { entry } = Astro.props;
---

<article data-highlightable><slot /></article>
<Comments frontmatter={entry.data} />
<Reactions frontmatter={entry.data} />
```

| Prop          | Default      | Description                                          |
| ------------- | ------------ | ---------------------------------------------------- |
| `slug`        | current path | The key comments are kept under. `false`: no section |
| `frontmatter` |              | `comments: false` in it hides the section            |

**On a passage.** With `<Reactions>` on the page too, text selected inside `[data-highlightable]` gets a **Comment** button next to **Highlight**. It jumps to the comment form, which quotes the passage. The comment then shows the quote. The passage is not marked in the page text. Comment also shows where `highlights` is off, with no Highlight button beside it.

A comment is plain text and an optional name. The browser remembers the name. With no name, it reads "someone from London". Comments show at once. Readers delete their own, and the admin deletes any. Nothing is HTML, so a comment cannot add markup or links.

`comments: false` in frontmatter hides the section and the Comment button. It does not close the API: the route only knows the `comments` option. To keep a path closed, leave it out of that option. `reactions: false` also removes the Comment button, because the pill carries it. The section stays.

Anyone can make up reader ids, so on a public site add a Cloudflare rate limiting rule on the route. Each reader is also held to `maxComments` per page.

## Frontmatter

Pass a page's frontmatter (or a content entry's `data`) to the pill:

```astro
---
// src/layouts/PostLayout.astro
import { Reactions } from 'astro-d1-reactions/components';
const { entry } = Astro.props;
---

<article data-highlightable><slot /></article>
<Reactions slug={`/blog/${entry.id}`} frontmatter={entry.data} />
```

Then, in any post:

```md
---
title: A quiet post
reactions: false # no hearts, reads or highlights here
---
```

```md
---
title: A short note
highlights: false # hearts and reads, no highlights
---
```

```md
---
title: A closed topic
comments: false # no comments, and no Comment button on selected text
---
```

Add the keys to your collection schema:

```ts
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { reactionsSchema } from "astro-d1-reactions/schema";

const blog = defineCollection({
  schema: z.object({ title: z.string(), ...reactionsSchema }),
});
```

### Pages without frontmatter

A homepage or other `.astro` page has no frontmatter to switch. Let the layout take the pill's props and pass them on:

```astro
---
// src/layouts/Layout.astro
import { Reactions } from 'astro-d1-reactions/components';
const { reactions } = Astro.props;
---

<slot />
<Reactions {...reactions} />
```

Then each page sets its own:

```astro
---
// src/pages/index.astro
import Layout from '../layouts/Layout.astro';
---

<Layout reactions={{ slug: '/', highlights: false }}>…</Layout>
```

```astro
<Layout reactions={{ highlights: false }}>   <!-- hearts and reads, no highlights -->
<Layout reactions={{ slug: false }}>          <!-- no hearts or reads -->
```

Don't use `'/'` in the `highlights` option to mean the homepage. The option matches the start of the path, and every path starts with `/`, so it turns highlights on everywhere.

## The stats page

The whole dashboard is one component. The page must render on the server:

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

| Prop            | Default | Description                                         |
| --------------- | ------- | --------------------------------------------------- |
| `activityLimit` | `40`    | Hearts and highlights in the activity feed          |
| `cacheMaxAge`   | `60`    | `Cache-Control` max-age in seconds. `0`: no caching |
| `locale`        | runtime | Number format locale, e.g. `'en-GB'`                |

Slots: `empty` (no data yet) and `error` (D1 failed).

### Titles come from your frontmatter

Tell the integration which pages to list. Collection entries are titled from their `title` frontmatter:

```js
reactions({
  database: "my-site-reactions",
  pages: [
    // `where`: only entries with this frontmatter key set. The first match for a path wins.
    { collection: "blog", where: "worklog", url: "/blog/:slug", type: "Worklog" },
    { collection: "blog", url: "/blog/:slug", type: "Post", noun: "the post" },
    { collection: "notes", url: "/notes/:slug", type: "Note" },
    { url: "/uses", title: "My setup" },
  ],
});
```

Entries with `draft: true` are left out in production. Without `pages`, the dashboard lists every path in the database, titled by its path. Anyone can post a made-up path to the API, so set `pages` on a public site.

### Your own layout

```astro
---
export const prerender = false;
import { loadStats, StatsActivity, StatsTable, StatsTotals } from 'astro-d1-reactions/components';
const stats = await loadStats();
---

<StatsTotals stats={stats} />
<h2>Most read</h2>
<StatsTable stats={stats} />
<h2>Lately</h2>
<StatsActivity stats={stats} />
```

`stats.rows`, `stats.activity` and `stats.totals` are plain data, so you can also render them yourself.

### In the terminal

Run this in your site's folder:

```sh
npx astro-d1-reactions stats
```

```
4,812 reads · 1,203 readers · 318 hearts · 41 highlights

PAGE                                       READS       ♥       ✎
/blog/d1-is-good                           1,940     122      17
/notes/astro-7                               801      40       3

LATEST
  2m  ♥ ×3  /blog/d1-is-good  🇩🇪 Berlin, Germany
  9m  ✎ "the best code is the code never written"  /blog/d1-is-good  🇯🇵 Tokyo, Japan
```

It asks D1 through `wrangler d1 execute`, so it uses your wrangler config and login. It only reads. It lists every path, because it can't read the `pages` option. It does not run on Windows yet (use WSL).

| Flag          | Default        | What it does                                |
| ------------- | -------------- | ------------------------------------------- |
| `--db <name>` | `REACTIONS_DB` | D1 binding or database name                 |
| `--local`     | off            | Read the local dev database, not the remote |
| `--limit <n>` | `20`           | Rows in each list                           |
| `--watch`     | off            | Refresh every 10 seconds                    |

To run it with `pnpm run stats`, add scripts to your site's `package.json`:

```json
{
  "scripts": {
    "stats": "astro-d1-reactions stats",
    "stats:watch": "astro-d1-reactions stats --watch",
    "stats:local": "astro-d1-reactions stats --local"
  }
}
```

Add `--db <name>` to each one if your binding is not `REACTIONS_DB`.

## Icons

Swap any icon. Give SVG markup, or a path to an `.svg` file from the project root:

```js
reactions({
  database: "my-site-reactions",
  icons: {
    heart: "./src/icons/star.svg",
    eye: '<svg viewBox="0 0 24 24" fill="currentColor">…</svg>',
  },
});
```

Names: `heart`, `highlighter`, `eye`, `trash`, `users`. Use `fill="currentColor"` or `stroke="currentColor"` so the icon takes the pill's colours. The defaults are from [Phosphor](https://phosphoricons.com).

## Theming

Set any of these on `:root`. The package's defaults have zero specificity, so your rule wins wherever it sits.

```css
:root {
  --rx-bg: #1d2127; /* pill and popover background */
  --rx-line: #2b3038; /* borders, hover */
  --rx-text: #ffffffb3;
  --rx-text-bright: #fff;
  --rx-accent: #f5d04c; /* hint bubble, your highlights, stats bars */
  --rx-heart: #e11d74;
  --rx-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  --rx-font: system-ui, sans-serif;
  --rx-font-headings: inherit;
  --rx-font-mono: ui-monospace, monospace;
  --rx-bottom: 1rem; /* gap under the pill */
  --rx-radius: 0.625rem; /* corner roundness */
  --rx-border-width: 1px; /* pill border; 0 removes it */
  --rx-stats-tile: #ffffff12; /* stats total tiles */
  --rx-stats-radius: 0.5rem;
}
```

The comment section is part of your page, so it takes the page's text colour and font. It uses `--rx-accent`, `--rx-heart` and `--rx-radius` if they are set. Or write rules for the `.comments-*` classes.

## Options

| Option             | Default                   | Description                                                                            |
| ------------------ | ------------------------- | -------------------------------------------------------------------------------------- |
| `database`         | required                  | D1 database name                                                                       |
| `binding`          | `'REACTIONS_DB'`          | D1 binding name in wrangler config                                                     |
| `adminTokenEnv`    | `'REACTIONS_ADMIN_TOKEN'` | Name of the admin token secret                                                         |
| `apiRoute`         | `'/api/reactions'`        | Injected endpoint                                                                      |
| `highlights`       | `true`                    | Where readers may highlight: `true`, `false` or path prefixes, e.g. `['/blog/']`       |
| `comments`         | `false`                   | Where readers may comment: `true`, `false` or path prefixes. See [Comments](#comments) |
| `maxComments`      | `20`                      | Comments one reader can post on one page                                               |
| `maxCommentLength` | `2000`                    | Longest comment, in characters                                                         |
| `maxHearts`        | `10`                      | Hearts one reader can give one page                                                    |
| `maxHighlights`    | `50`                      | Highlights one reader can make on one page                                             |
| `maxText`          | `1000`                    | Longest highlight, or quoted passage, in characters                                    |
| `thanks`           | ten lines                 | The line shown for each heart given, in order                                          |
| `icons`            | Phosphor icons            | See [Icons](#icons)                                                                    |
| `pages`            | every path                | What the stats page lists. See [The stats page](#the-stats-page)                       |

## The API

`POST /api/reactions` with JSON `{ slug, visitor, action, … }`. Every action returns the page's full state:

```json
{ "views": 12, "hearts": 30, "myHearts": 2, "admin": false, "highlights": [ … ] }
```

| `action`    | Extra fields    | Does                                          |
| ----------- | --------------- | --------------------------------------------- |
| `state`     |                 | Nothing. Just the state                       |
| `view`      |                 | Counts this reader once for this page         |
| `heart`     |                 | Adds a heart, up to `maxHearts`               |
| `highlight` | `text`, `start` | Saves a highlight (`start`: character offset) |
| `delete`    | `id`            | Deletes your highlight, or anyone's as admin  |

The comment actions return the page's comments instead of its state:

```json
{ "admin": false, "comments": [{ "id": 1, "name": null, "body": "…", "quote": null, "start": null, "mine": true, … }] }
```

| `action`         | Extra fields                        | Does                                                                                                                                |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `comments`       |                                     | Nothing. Just the comments, oldest first                                                                                            |
| `comment`        | `text`, `name?`, `quote?`, `start?` | Saves a comment. `quote` and `start` go together. `400` if comments are off here or the text is not valid. `429` over `maxComments` |
| `delete-comment` | `id`                                | Deletes your comment, or anyone's as admin                                                                                          |

`slug` must match `/^\/[\w/-]{0,200}$/`. `visitor` is a UUID.

Anyone can make up reader ids. If that becomes a problem, add a Cloudflare rate limiting rule on the route.

## Query helpers

`astro-d1-reactions/core` runs in a Worker, so you can use it in your own endpoints:

```ts
import { getState, getStats, place, flag, ago } from "astro-d1-reactions/core";

const stats = await getStats(env.REACTIONS_DB);
```

## More Astro packages

Other Astro tools I have made:

- [astro-d1-search](https://github.com/mrmartineau/astro-d1-search): site search backed by Cloudflare D1 (SQLite FTS5)
- [astro-entry-meta](https://github.com/mrmartineau/astro-entry-meta): publishing rules, computed fields and git dates for content collections
- [zed-astro-starter](https://github.com/mrmartineau/zed-astro-starter): an opinionated Astro starter, ready to deploy to Cloudflare Workers
- [ZUI](https://github.com/mrmartineau/zui): a CSS-first UI library with Astro (and React, Solid, Svelte, Vue) components

## License

[MIT](https://choosealicense.com/licenses/mit/) © [Zander Martineau](https://zander.wtf)

> Made by Zander • [zander.wtf](https://zander.wtf) • [GitHub](https://github.com/mrmartineau/)
