# astro-d1-reactions — agent & contributor guide

`CLAUDE.md` is a symlink to this file.

Page reactions (hearts, unique reads, reader highlights) and a stats dashboard
for Astro, kept in Cloudflare D1. Sister package of `astro-d1-search`, and set
up the same way: pnpm, tsdown, Vite+ (`vp check`), Bun tests, semantic-release.

```sh
pnpm install
pnpm run build   # tsdown → dist/
pnpm run test    # bun test
pnpm run check   # vp check --fix (format, lint, typecheck)
```

## Layout

| Path              | Ships as                    | Role                                                                             |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `src/index.ts`    | `astro-d1-reactions`        | The integration: virtual config, icons, wrangler check, injected route           |
| `src/config.ts`   | (internal)                  | Options, `resolveConfig`: the single source of defaults                          |
| `src/core.ts`     | `astro-d1-reactions/core`   | Types, SQL queries, helpers. **No Node built-ins**: runs in Workers and browsers |
| `src/route.ts`    | `dist/route.mjs`            | `POST /api/reactions`                                                            |
| `src/schema.ts`   | `astro-d1-reactions/schema` | `reactionsSchema` frontmatter keys                                               |
| `src/components/` | source, as is               | `.astro` components + `loadStats`. The host project's Astro compiles them        |
| `src/icons/`      | source, as is               | Default icons, read by the integration at startup                                |
| `migrations/`     | as is                       | D1 schema. The host's `migrations_dir` points here                               |

## Rules

- **Never rename or edit a shipped migration.** Wrangler tracks applied
  migrations by file name, and sites already ran these. Schema changes are a
  new numbered file that only adds. lab.zander.wtf writes to zander.wtf's
  database too, so `views` and `hearts` must keep working.
- **`virtual:astro-d1-reactions/config`** carries the resolved config (with
  icon SVGs filled in) to the route, the components and the browser script.
  It has named exports so the browser bundle only takes what it uses. Declared
  in `src/env.d.ts`; `neverBundle` in `tsdown.config.ts`.
- **The components ship as source.** They import `../core`, the virtual module
  and `astro:content`, all resolved by the host's Vite. The integration sets
  `ssr.noExternal` for that. Keep `src/core.ts` and `src/components` in `files`.
- The browser keys `reactions-visitor` and `reactions-admin` in localStorage
  are what existing readers already have. Changing them resets every count.
- **`SKILL.md`** (repo root) teaches agents to set the package up in a site.
  Users install it with `npx skills add mrmartineau/astro-d1-reactions`. Keep
  it in step with the README when options or behaviour change.
- Nothing in this repo runs the package end to end. Test it in a real Astro
  site (`pnpm add astro-d1-reactions@link:../astro-d1-reactions`), then
  `astro build` and `wrangler pages dev ./dist`.
