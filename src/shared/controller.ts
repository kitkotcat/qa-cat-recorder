export function isRecorderOwnedInteraction(
  path: EventTarget[],
  host: EventTarget | null
): boolean {
  return Boolean(host && path.includes(host));
}

export function normalizeControllerPosition(
  value: unknown
): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}
