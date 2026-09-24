(() => {
  const SOURCE = "qa-buddy-recorder-page";
  const SECRET_PATTERNS = [
    /(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi,
    /((?:token|password|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
    /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  ];

  function sanitize(value: string): string {
    let output = value;

    for (const pattern of SECRET_PATTERNS) {
      output = output.replace(pattern, "$1[redacted]");
    }

    return output.slice(0, 500);
  }

  function formatValue(value: unknown): string {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }

    if (typeof value === "string") {
      return value;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      return String(value);
    }

    return Object.prototype.toString.call(value);
  }

  function publish(
    level: RecorderConsoleEvent["level"],
    message: string
  ) {
    window.postMessage(
      {
        source: SOURCE,
        level,
        message: sanitize(message),
      },
      "*"
    );
  }

  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    publish("error", args.map(formatValue).join(" "));
    originalError(...args);
  };

  window.addEventListener("error", (event) => {
    publish(
      "exception",
      event.message || "Uncaught JavaScript error"
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    publish(
      "unhandledrejection",
      `Unhandled promise rejection: ${formatValue(event.reason)}`
    );
  });
})();
