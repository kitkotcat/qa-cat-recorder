import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./mascot.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./Mascot.tsx", import.meta.url), "utf8");

describe("Mascot v3 polish", () => {
  it("renders the extra lightweight face and fur details", () => {
    expect(component).toContain('className="mouth"');
    expect(component).toContain('className="forehead-mark"');
    expect(css).toContain(".mouth");
    expect(css).toContain(".forehead-mark");
  });

  it("coffee animation includes a subtle cat reaction, not only moving the cup", () => {
    expect(css).toContain(".state-coffee .head");
    expect(css).toContain("mascot-coffee-head");
    expect(css).toContain(".state-coffee .tail");
  });
});
