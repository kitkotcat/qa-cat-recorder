import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("Side Panel theme CSS", () => {
  it("uses concrete Night QA tokens instead of self-referencing variables", () => {
    const nightBlock = css.match(/\.panel-shell, \.panel-shell\[data-theme="night"\] \{([\s\S]*?)\}/)?.[1] ?? "";
    for (const token of ["bg", "surface", "border", "text", "muted", "accent", "danger", "warning", "success"]) {
      expect(nightBlock).not.toContain(`--${token}:var(--${token})`);
      expect(nightBlock).toMatch(new RegExp(`--${token}:\\s*#[0-9a-fA-F]{6}`));
    }
  });

  it("does not bypass theme text tokens with stale hardcoded slate text", () => {
    expect(css).not.toContain("#cbd5e1");
  });

  it("does not hardcode the old navy translucent panel background", () => {
    expect(css).not.toContain("rgba(2, 6, 23, .72)");
  });
});
