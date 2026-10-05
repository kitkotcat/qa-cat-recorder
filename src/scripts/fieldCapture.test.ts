import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const content = readFileSync(new URL("./content.ts", import.meta.url), "utf8");

describe("field interaction capture", () => {
  it("marks typing on input and persists the final value on blur/change", () => {
    expect(content).toContain('document.addEventListener(\n    "input"');
    expect(content).toContain("dirtyFields.add(target)");
    expect(content).not.toContain("FIELD_CAPTURE_DEBOUNCE_MS");
  });

  it("flushes a single semantic field step on focusout/change", () => {
    expect(content).toContain('document.addEventListener(\n    "focusout"');
    expect(content).toContain("flushFieldCapture");
    expect(content).toContain("QACatFieldPrivacy.buildStep");
    expect(content).toContain("captureSafeFieldValues");
  });

  it("uses semantic labels and supports contenteditable fields", () => {
    expect(content).toContain("label[for=");
    expect(content).toContain("aria-labelledby");
    expect(content).toContain('[contenteditable="true"]');
  });
});
