import { describe, expect, it } from "bun:test";
import { resolveConfig } from "./config";
import { ago, canHighlight, flag, place, plural } from "./core";

describe("resolveConfig", () => {
  it("needs a database and fills in the rest", () => {
    expect(() => resolveConfig({} as never)).toThrow("database");
    const config = resolveConfig({ database: "my-reactions" });
    expect(config.binding).toBe("REACTIONS_DB");
    expect(config.apiRoute).toBe("/api/reactions");
    expect(config.thanks).toHaveLength(10);
    expect(config.pages).toBeNull();
  });

  it("drops the count-to-ten lines for another heart limit", () => {
    expect(resolveConfig({ database: "x", maxHearts: 3 }).thanks).toEqual(["thank you"]);
  });
});

describe("canHighlight", () => {
  it("takes true, false or path prefixes", () => {
    expect(canHighlight(true, "/uses")).toBe(true);
    expect(canHighlight(false, "/blog/a")).toBe(false);
    expect(canHighlight(["/blog/", "/notes/"], "/notes/a")).toBe(true);
    expect(canHighlight(["/blog/"], "/projects/a")).toBe(false);
  });
});

describe("place", () => {
  it("names the city and country", () => {
    expect(place("London", "GB")).toBe("London, United Kingdom");
  });

  it("drops what Cloudflare does not know", () => {
    expect(place(null, "AU")).toBe("Australia");
    expect(place("Lisbon", null)).toBe("Lisbon");
    expect(place(null, "XX")).toBe("");
    expect(place(null, "T1")).toBe("");
  });
});

describe("flag", () => {
  it("turns a country code into a flag emoji", () => {
    expect(flag("GB")).toBe("🇬🇧");
    expect(flag("T1")).toBe("");
    expect(flag(null)).toBe("");
  });
});

describe("ago", () => {
  it("rounds down to the largest unit", () => {
    expect(ago(1000, 1030)).toBe("now");
    expect(ago(1000, 1000 + 14 * 60 + 59)).toBe("14m");
    expect(ago(0, 2 * 3600)).toBe("2h");
    expect(ago(0, 3 * 86400 + 5)).toBe("3d");
  });
});

describe("plural", () => {
  it("picks the word for the count", () => {
    expect(plural(1, "mark", "marks")).toBe("mark");
    expect(plural(0, "mark", "marks")).toBe("marks");
  });
});
