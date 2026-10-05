import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await import("../shared/fieldPrivacy");
});

function privacy() {
  return (globalThis as any).QACatFieldPrivacy;
}

describe("field value privacy", () => {
  it.each([
    [{ type: "password", label: "Пароль" }, true],
    [{ type: "text", autocomplete: "one-time-code", label: "Код" }, true],
    [{ type: "text", name: "api_token", label: "API token" }, true],
    [{ type: "text", id: "cvv", label: "CVV" }, true],
    [{ type: "email", name: "email", label: "Email" }, false],
    [{ type: "text", name: "search", label: "Поиск" }, false],
  ])("classifies %o sensitive=%s", (meta, expected) => {
    expect(privacy().isSensitive(meta)).toBe(expected);
  });

  it("includes safe values when enabled", () => {
    expect(privacy().buildStep({ label: "Email", kind: "text", value: "katya@test.ru", captureSafeValues: true })).toBe(
      "Ввести в поле «Email» значение «katya@test.ru»"
    );
  });

  it("masks sensitive values and never exposes the raw secret", () => {
    const step = privacy().buildStep({ label: "Пароль", kind: "text", value: "SuperSecret123", captureSafeValues: true, sensitive: true });
    expect(step).toBe("Ввести в поле «Пароль» значение «••••••••»");
    expect(step).not.toContain("SuperSecret123");
  });

  it("omits values completely when capture is disabled", () => {
    expect(privacy().buildStep({ label: "Email", kind: "text", value: "katya@test.ru", captureSafeValues: false })).toBe(
      "Заполнить поле «Email»"
    );
  });

  it("formats select and checkbox actions without leaking sensitive values", () => {
    expect(privacy().buildStep({ label: "Страна", kind: "select", value: "Беларусь", captureSafeValues: true })).toBe(
      "Выбрать «Беларусь» в поле «Страна»"
    );
    expect(privacy().buildStep({ label: "Запомнить меня", kind: "checkbox", checked: true, captureSafeValues: true })).toBe(
      "Отметить «Запомнить меня»"
    );
  });

  it("redacts a sensitive recorder step again before storage", () => {
    const raw = "Ввести в поле «Пароль» значение «SuperSecret123»";
    const redacted = privacy().redactSensitiveStepLabel(raw);
    expect(redacted).toBe("Ввести в поле «Пароль» значение «••••••••»");
  });
});
