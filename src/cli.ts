#!/usr/bin/env node
// `npx astro-d1-reactions stats`: the stats page, in a terminal. Run it in the
// site's folder. It asks wrangler, so it uses the site's wrangler config and
// login, and needs no token of its own. It only reads.
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs, styleText } from "node:util";
import { ago, flag, getStats, place, plural, type Stats } from "./core";
import { wranglerD1 } from "./wrangler-d1";

const HELP = `Usage: astro-d1-reactions stats [options]

Shows reads, hearts and highlights per page, and the latest activity.
Run it in your site's folder, so wrangler finds its config.

  --db <name>   D1 binding or database name (default: REACTIONS_DB)
  --local       Read the local dev database, not the remote one
  --limit <n>   Rows in each list (default: 20)
  --watch       Refresh every 10 seconds
  -h, --help    Show this text`;

const tty = process.stdout.isTTY;
const dim = (text: string) => (tty ? styleText("dim", text) : text);
const bold = (text: string) => (tty ? styleText("bold", text) : text);
const num = (n: number) => n.toLocaleString("en-GB");
const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function render(stats: Stats, limit: number) {
  const sum = (key: "views" | "hearts" | "highlights") =>
    stats.rows.reduce((total, row) => total + row[key], 0);
  const [views, hearts, highlights] = [sum("views"), sum("hearts"), sum("highlights")];
  const row = (page: string, ...counts: string[]) =>
    [page.padEnd(40), ...counts.map((count) => count.padStart(7))].join(" ");
  return [
    bold(
      [
        `${num(views)} ${plural(views, "read", "reads")}`,
        `${num(stats.readers)} ${plural(stats.readers, "reader", "readers")}`,
        `${num(hearts)} ${plural(hearts, "heart", "hearts")}`,
        `${num(highlights)} ${plural(highlights, "highlight", "highlights")}`,
      ].join(" · "),
    ),
    "",
    dim(row("PAGE", "READS", "♥", "✎")),
    ...stats.rows
      .slice(0, limit)
      .map((r) => row(cut(r.slug, 40), num(r.views), num(r.hearts), num(r.highlights))),
    "",
    dim("LATEST"),
    ...stats.activity.map((a) => {
      // Anyone can post a highlight, so drop control characters: an escape
      // code could clear or rewrite the owner's terminal.
      const what =
        a.kind === "heart"
          ? `♥ ×${a.n}`
          : `✎ "${cut((a.text ?? "").replace(/[\s\p{Cc}]+/gu, " "), 40)}"`;
      const where = [flag(a.country), place(a.city, a.country)].filter(Boolean).join(" ");
      return `${ago(a.at).padStart(4)}  ${what}  ${a.slug}${where ? dim(`  ${where}`) : ""}`;
    }),
  ].join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string", default: "REACTIONS_DB" },
      local: { type: "boolean", default: false },
      limit: { type: "string", default: "20" },
      watch: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const limit = Number(values.limit);
  if (values.help || positionals[0] !== "stats" || !Number.isInteger(limit) || limit < 1) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const db = wranglerD1(values.db, values.local);
  if (!values.watch) {
    console.log(render(await getStats(db, limit), limit));
    return;
  }
  // The first load must work (a wrong --db fails here). After that, a failed
  // refresh keeps the last stats on screen and tries again.
  let screen = render(await getStats(db, limit), limit);
  let failed = "";
  for (;;) {
    const status = failed
      ? `${failed} · trying again in 10s`
      : dim(`${new Date().toLocaleTimeString("en-GB")} · every 10s · ctrl-c to stop`);
    console.clear();
    console.log(`${status}\n\n${screen}`);
    await sleep(10_000);
    try {
      screen = render(await getStats(db, limit), limit);
      failed = "";
    } catch (error) {
      failed = (error as Error).message;
    }
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
