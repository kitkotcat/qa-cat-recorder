import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const content = readFileSync(new URL("./content.ts", import.meta.url), "utf8");

describe("field interaction capture", () => {
  it("captures typing through input events instead of relying only on change", () => {
    expect(content).toContain('document.addEventListener(\n    "input"');
    expect(content).toContain("scheduleFieldCapture");
    expect(content).toContain("FIELD_CAPTURE_DEBOUNCE_MS");
  });

  it("flushes a field step on focusout/change without recording values", () => {
    expect(content).toContain('document.addEventListener(\n    "focusout"');
    expect(content).toContain("flushFieldCapture");
    expect(content).toContain('`Заполнить поле «${describeField(target)}»`');
    expect(content).not.toContain("target.value");
  });

  it("uses semantic labels and supports contenteditable fields", () => {
    expect(content).toContain("label[for=");
    expect(content).toContain("aria-labelledby");
    expect(content).toContain('[contenteditable="true"]');
  });
});
