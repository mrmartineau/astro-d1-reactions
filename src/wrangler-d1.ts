// A D1Like for the CLI: it runs queries through `wrangler d1 execute`, so it
// uses the site's wrangler config and login.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { D1Like, D1Statement } from "./core";

/**
 * Puts bound values into the SQL, for a runner that takes no bound values
 * (`wrangler d1 execute`). Numbers only, so a
 * value can't break out of the SQL. Takes `?` and `?1` placeholders, and
 * assumes no `?` sits inside a string literal.
 */
export function inlineValues(sql: string, values: unknown[]) {
  // Like SQLite, a bare `?` takes the slot after the highest one so far.
  let last = 0;
  return sql.replace(/\?(\d*)/g, (_, digits: string) => {
    const slot = digits ? Number(digits) : last + 1;
    last = Math.max(last, slot);
    const value = values[slot - 1];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Can't inline ${String(value)}: numbers only`);
    }
    return String(value);
  });
}

const execFileAsync = promisify(execFile);

type Statement = D1Statement & { sql: string };

/** A D1Like that runs a whole batch as one `wrangler d1 execute` call. */
export function wranglerD1(db: string, local: boolean): D1Like {
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
        // A hung wrangler would freeze --watch, so give up after a minute.
        { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
      ).then(
        (result) => result.stdout,
        // Not error.message: it holds the whole command, SQL and all.
        (error: { stdout?: string; stderr?: string; killed?: boolean }) =>
          error.stdout || error.stderr || (error.killed ? "wrangler took over a minute" : ""),
      );
      // With --json, wrangler prints the results, or {"error":{"text":"…"}}.
      // It sends SQL NULL as the string "null". Only city and country are
      // turned back: `text` is NULL on heart rows, which never show it, and a
      // highlight's text may really be "null".
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
