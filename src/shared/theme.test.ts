import { describe, expect, it } from "vitest";
import { normalizeRecorderTheme } from "./theme";

describe("normalizeRecorderTheme", () => {
  it.each(["night", "cafe", "violet"])("keeps supported theme %s", (theme) => {
    expect(normalizeRecorderTheme(theme)).toBe(theme);
  });

  it("falls back to night for missing or invalid values", () => {
    expect(normalizeRecorderTheme(undefined)).toBe("night");
    expect(normalizeRecorderTheme("pink")).toBe("night");
  });
});
