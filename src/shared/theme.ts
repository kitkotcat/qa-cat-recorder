export type RecorderTheme = "night" | "cafe" | "violet";

export function normalizeRecorderTheme(value: unknown): RecorderTheme {
  return value === "cafe" || value === "violet" || value === "night"
    ? value
    : "night";
}
