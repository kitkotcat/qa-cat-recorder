(() => {
  const MASK = "••••••••";
  const SENSITIVE_PATTERN = /(pass(word)?|pwd|secret|token|api[_-]?key|access[_-]?key|auth|otp|one[-_ ]?time|verification|confirm(ation)?[_-]?code|security[_-]?code|cvv|cvc|card[_-]?(number|no)|pan|pin|парол|секрет|токен|api[_ -]?ключ|код[ _-]?(подтверждения|безопасности|из[ _-]?смс)|одноразов|номер[ _-]?карт|пин)/i;
  const SENSITIVE_AUTOCOMPLETE = /^(current-password|new-password|one-time-code|cc-number|cc-csc)$/i;
  const clean = (value: unknown, max = 160) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  const api: QACatFieldPrivacyApi = {
    isSensitive(meta) {
      if ((meta.type ?? "").toLowerCase() === "password") return true;
      if (SENSITIVE_AUTOCOMPLETE.test(meta.autocomplete ?? "")) return true;
      return SENSITIVE_PATTERN.test([meta.name, meta.id, meta.label].filter(Boolean).join(" "));
    },
    buildStep(input) {
      const label = clean(input.label, 80) || "поле";
      if (input.kind === "checkbox") return input.checked ? `Отметить «${label}»` : `Снять отметку «${label}»`;
      if (input.kind === "radio") return `Выбрать «${label}»`;
      if (!input.captureSafeValues) return `Заполнить поле «${label}»`;
      const value = input.sensitive ? MASK : clean(input.value);
      if (!value) return `Заполнить поле «${label}»`;
      if (input.kind === "select") return `Выбрать «${value}» в поле «${label}»`;
      return `Ввести в поле «${label}» значение «${value}»`;
    },
    redactSensitiveStepLabel(label) {
      if (!SENSITIVE_PATTERN.test(label)) return label;
      return label.replace(/(значение «)[^»]*(»)/gi, `$1${MASK}$2`);
    },
  };

  (globalThis as typeof globalThis & { QACatFieldPrivacy: QACatFieldPrivacyApi }).QACatFieldPrivacy = api;
})();
