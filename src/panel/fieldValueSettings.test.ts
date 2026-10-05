import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("safe field value setting", () => {
  it("exposes an on/off control and explains permanent masking", () => {
    expect(panel).toContain("Сохранять безопасные значения");
    expect(panel).toContain("captureSafeFieldValues");
    expect(panel).toContain("Пароли, токены, OTP и платёжные данные всегда скрываются");
  });
});
