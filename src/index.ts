import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import {
  type D1ReactionsOptions,
  type ReactionsIcons,
  type ResolvedD1ReactionsConfig,
  resolveConfig,
} from "./config";

export {
  type D1ReactionsOptions,
  type ReactionsIcons,
  type ResolvedD1ReactionsConfig,
  resolveConfig,
  type StatsPage,
} from "./config";

const VIRTUAL_ID = "virtual:astro-d1-reactions/config";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

/**
 * Absolute path of the API route module, sitting next to this one. Works from
 * the built package (`dist/route.mjs`) and from source (`src/route.ts`).
 */
function resolveRouteEntrypoint(): string {
  for (const name of ["route.mjs", "route.js", "route.ts"]) {
    const path = fileURLToPath(new URL(`./${name}`, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new Error("[astro-d1-reactions] could not find the API route next to the integration");
}

const ICON_NAMES = ["heart", "highlighter", "eye", "trash", "users"] as const;

/**
 * SVG markup for every icon: the option's markup as given, an option's file
 * path read from the project root, or the package's own icon. Works from
 * `dist/` and `src/`, since both sit next to `src/icons`.
 */
function resolveIcons(icons: Partial<ReactionsIcons>, root: URL): ReactionsIcons {
  const read = (path: string | URL) => readFileSync(path, "utf-8").trim();
  return Object.fromEntries(
    ICON_NAMES.map((name) => {
      const given = icons[name]?.trim();
      if (given?.startsWith("<svg")) return [name, given];
      if (given) return [name, read(new URL(given, root))];
      return [name, read(new URL(`../src/icons/${name}.svg`, import.meta.url))];
    }),
  ) as ReactionsIcons;
}

const WRANGLER_SNIPPET = (config: ResolvedD1ReactionsConfig) => `
[[d1_databases]]
binding = "${config.binding}"
database_name = "${config.database}"
database_id = "<run: wrangler d1 create ${config.database}>"
migrations_dir = "node_modules/astro-d1-reactions/migrations"
`;

/**
 * Warn, with a snippet to paste, if the wrangler config doesn't mention the
 * binding and database. String search only, so any config format works.
 */
function checkWranglerConfig(
  config: ResolvedD1ReactionsConfig,
  root: URL,
  logger: { warn(msg: string): void },
) {
  const found = ["wrangler.toml", "wrangler.jsonc", "wrangler.json"]
    .map((name) => fileURLToPath(new URL(name, root)))
    .find((path) => existsSync(path));

  if (!found) {
    logger.warn(
      `no wrangler config found. Reactions need the "${config.binding}" D1 binding. For wrangler.toml:\n${WRANGLER_SNIPPET(config)}`,
    );
    return;
  }
  const contents = readFileSync(found, "utf-8");
  if (!contents.includes(config.binding) || !contents.includes(config.database)) {
    logger.warn(
      `${found} doesn't reference the "${config.binding}" binding for database "${config.database}". Add:\n${WRANGLER_SNIPPET(config)}`,
    );
  }
}

export default function d1Reactions(options: D1ReactionsOptions): AstroIntegration {
  const config = resolveConfig(options);

  return {
    name: "astro-d1-reactions",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig, logger, config: astroConfig }) => {
        checkWranglerConfig(config, astroConfig.root, logger);
        config.icons = resolveIcons(config.icons, astroConfig.root);

        updateConfig({
          vite: {
            plugins: [
              {
                name: "astro-d1-reactions-config",
                resolveId(id: string) {
                  return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
                },
                load(id: string) {
                  if (id !== RESOLVED_VIRTUAL_ID) return undefined;
                  // Named exports too, so the browser bundle only takes the
                  // keys it uses.
                  const named = Object.entries(config).map(
                    ([key, value]) => `export const ${key} = ${JSON.stringify(value)};`,
                  );
                  return [...named, `export default ${JSON.stringify(config)};`].join("\n");
                },
              },
            ],
            // The components ship as source and import the virtual module, so
            // the project's Vite has to compile them rather than load them as
            // plain Node modules.
            ssr: { noExternal: ["astro-d1-reactions"] },
            optimizeDeps: { exclude: ["astro-d1-reactions"] },
          },
        });

        injectRoute({
          pattern: config.apiRoute,
          entrypoint: resolveRouteEntrypoint(),
          prerender: false,
        });
      },
    },
  };
}
