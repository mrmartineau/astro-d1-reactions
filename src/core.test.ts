import { describe, expect, it } from "bun:test";
import { resolveConfig } from "./config";
import { ago, canComment, canHighlight, flag, MAX_NAME, parseComment, place, plural } from "./core";

describe("resolveConfig", () => {
  it("needs a database and fills in the rest", () => {
    expect(() => resolveConfig({} as never)).toThrow("database");
    const config = resolveConfig({ database: "my-reactions" });
    expect(config.binding).toBe("REACTIONS_DB");
    expect(config.apiRoute).toBe("/api/reactions");
    expect(config.thanks).toHaveLength(10);
    expect(config.pages).toBeNull();
  });

  it("keeps comments off until they are asked for", () => {
    const config = resolveConfig({ database: "my-reactions" });
    expect(config.comments).toBe(false);
    expect(config.maxComments).toBe(20);
    expect(config.maxPageComments).toBe(200);
    expect(config.maxCommentLength).toBe(2000);
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

describe("canComment", () => {
  it("takes true, false or path prefixes", () => {
    expect(canComment(false, "/blog/a")).toBe(false);
    expect(canComment(true, "/blog/a")).toBe(true);
    expect(canComment(["/blog/"], "/blog/a")).toBe(true);
    expect(canComment(["/blog/"], "/uses")).toBe(false);
  });
});

describe("parseComment", () => {
  const limits = { maxLength: 20, maxQuote: 10 };

  it("trims a comment on the whole page", () => {
    expect(parseComment({ text: "  hello \n" }, limits)).toEqual({
      name: null,
      body: "hello",
      quote: null,
      start: null,
    });
  });

  it("keeps the name on one line and caps it", () => {
    expect(parseComment({ text: "hi", name: "  Ada \n Lovelace " }, limits)?.name).toBe(
      "Ada Lovelace",
    );
    expect(parseComment({ text: "hi", name: "x".repeat(200) }, limits)?.name).toHaveLength(
      MAX_NAME,
    );
    expect(parseComment({ text: "hi", name: "   " }, limits)?.name).toBeNull();
  });

  it("rejects text that is missing, empty or too long", () => {
    expect(parseComment({}, limits)).toBeNull();
    expect(parseComment({ text: "   " }, limits)).toBeNull();
    expect(parseComment({ text: 5 }, limits)).toBeNull();
    expect(parseComment({ text: "x".repeat(21) }, limits)).toBeNull();
    expect(parseComment({ text: "x".repeat(20) }, limits)).not.toBeNull();
  });

  it("takes a passage with where it starts", () => {
    expect(parseComment({ text: "yes", quote: " a line ", start: 12 }, limits)).toEqual({
      name: null,
      body: "yes",
      quote: "a line",
      // the quote lost one leading space, so the start moves with it
      start: 13,
    });
    expect(parseComment({ text: "yes", quote: "a line", start: 12 }, limits)?.start).toBe(12);
  });

  it("rejects half a passage or a bad one", () => {
    expect(parseComment({ text: "yes", quote: "a line" }, limits)).toBeNull();
    expect(parseComment({ text: "yes", start: 3 }, limits)).toBeNull();
    expect(parseComment({ text: "yes", quote: "  ", start: 3 }, limits)).toBeNull();
    expect(parseComment({ text: "yes", quote: "x".repeat(11), start: 3 }, limits)).toBeNull();
    expect(parseComment({ text: "yes", quote: "a line", start: -1 }, limits)).toBeNull();
    expect(parseComment({ text: "yes", quote: "a line", start: 1.5 }, limits)).toBeNull();
    expect(parseComment({ text: "yes", quote: "a line", start: "3" }, limits)).toBeNull();
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
