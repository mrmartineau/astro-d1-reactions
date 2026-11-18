import { describe, expect, it } from "bun:test";
import { inlineValues } from "./wrangler-d1";

describe("inlineValues", () => {
  it("fills ? and ?N with numbers and refuses the rest", () => {
    expect(inlineValues("LIMIT ?", [40])).toBe("LIMIT 40");
    expect(inlineValues("?2 AND ?1", [1, 2])).toBe("2 AND 1");
    expect(inlineValues("?1, ?", [1, 2])).toBe("1, 2");
    expect(() => inlineValues("WHERE slug = ?", ["'; DROP TABLE views"])).toThrow("numbers only");
    expect(() => inlineValues("LIMIT ?", [Number.NaN])).toThrow("numbers only");
    expect(() => inlineValues("LIMIT ?", [Number.POSITIVE_INFINITY])).toThrow("numbers only");
  });
});
