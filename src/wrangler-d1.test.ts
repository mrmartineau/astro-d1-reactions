import { describe, expect, it } from "bun:test";
import { inlineValues } from "./wrangler-d1";

describe("inlineValues", () => {
  it("fills ? and ?N with numbers and refuses the rest", () => {
    expect(inlineValues("LIMIT ?", [40])).toBe("LIMIT 40");
    expect(inlineValues("?2 AND ?1", [1, 2])).toBe("2 AND 1");
    expect(() => inlineValues("WHERE slug = ?", ["'; DROP TABLE views"])).toThrow("numbers only");
  });
});
