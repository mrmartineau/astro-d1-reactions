#!/usr/bin/env node
// `npx astro-d1-reactions stats`: the stats page, in a terminal. Run it in the
// site's folder. It asks wrangler, so it uses the site's wrangler config and
// login, and needs no token of its own. It only reads.
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs, promisify, styleText } from "node:util";
import {
  ago,
  type D1Like,
  type D1Statement,
  flag,
  getStats,
  inlineValues,
  place,
  plural,
  type Stats,
} from "./core";

const HELP = `Usage: astro-d1-reactions stats [options]

Shows reads, hearts and highlights per page, and the latest activity.
Run it in your site's folder, so wrangler finds its config.

  --db <name>   D1 binding or database name (default: REACTIONS_DB)
  --local       Read the local dev database, not the remote one
  --limit <n>   Rows in each list (default: 20)
  --watch       Refresh every 10 seconds
  -h, --help    Show this text`;

const execFileAsync = promisify(execFile);

type Statement = D1Statement & { sql: string };

/** A D1Like that runs a whole batch as one `wrangler d1 execute` call. */
function wranglerD1(db: string, local: boolean): D1Like {
  const prepare = (sql: string): Statement => ({
    sql,
    bind: (...values) => prepare(inlineValues(sql, values)),
    run: () => Promise.reject(new Error("The CLI only reads")),
  });
  return {
    prepare,
    async batch(statements) {
      const sql = (statements as Statement[]).map((s) => s.sql).join(";\n");
      const where = local ? "--local" : "--remote";
      // ponytail: runs `npx` without a shell, so not on Windows (npx.cmd).
      const output = await execFileAsync(
        "npx",
        ["wrangler", "d1", "execute", db, where, "--json", "--command", sql],
        { maxBuffer: 64 * 1024 * 1024 },
      ).then(
        (result) => result.stdout,
        // Not error.message: it holds the whole command, SQL and all.
        (error: { stdout?: string; stderr?: string }) => error.stdout || error.stderr || "",
      );
      // With --json, wrangler prints the results, or {"error":{"text":"…"}}.
      // It sends SQL NULL as the string "null": only city and country are NULL.
      let parsed: unknown;
      try {
        parsed = JSON.parse(output, (key, value) =>
          value === "null" && (key === "city" || key === "country") ? null : value,
        );
      } catch {}
      if (!Array.isArray(parsed)) {
        const text = (parsed as { error?: { text?: string } } | undefined)?.error?.text;
        throw new Error(text || output.trim() || "wrangler failed with no output");
      }
      return parsed;
    },
  };
}

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
      const what =
        a.kind === "heart" ? `♥ ×${a.n}` : `✎ "${cut((a.text ?? "").replace(/\s+/g, " "), 40)}"`;
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
  do {
    const stats = await getStats(db, limit);
    if (values.watch) {
      console.clear();
      console.log(dim(`${new Date().toLocaleTimeString("en-GB")} · every 10s · ctrl-c to stop\n`));
    }
    console.log(render(stats, limit));
    if (values.watch) await sleep(10_000);
  } while (values.watch);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
