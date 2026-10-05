import { normalizeRecorderTheme } from "./theme.js";

export type MascotActivity = "off" | "calm" | "active";
export type ReducedMotionOverride = "system" | "on" | "off";

type AnyRecord = Record<string, any>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function clampThreshold(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(30000, Math.max(250, Math.round(parsed)))
    : 2000;
}

function migrateMascotActivity(settings: AnyRecord): MascotActivity {
  if (settings.mascotActivity === "off" || settings.mascotActivity === "calm" || settings.mascotActivity === "active") {
    return settings.mascotActivity;
  }
  if (settings.mascotEnabled === false) return "off";
  if (settings.mascotEnabled === true && settings.funMode === true) return "active";
  return "calm";
}

function migrateReducedMotion(settings: AnyRecord): ReducedMotionOverride {
  if (settings.reducedMotionOverride === "on" || settings.reducedMotionOverride === "off" || settings.reducedMotionOverride === "system") {
    return settings.reducedMotionOverride;
  }
  return settings.reducedMotion === true ? "on" : "system";
}

function normalizePosition(value: unknown): { x: number; y: number } | null {
  const position = asRecord(value);
  if (!Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) return null;
  return {
    x: Math.max(0, Math.round(Number(position.x))),
    y: Math.max(0, Math.round(Number(position.y))),
  };
}

export function migrateRecorderState(raw: unknown): AnyRecord {
  const source = asRecord(raw);
  const settings = asRecord(source.settings);

  return {
    schemaVersion: 4,
    status: source.status ?? "idle",
    sessionId: source.sessionId ?? null,
    targetTabId: source.targetTabId ?? null,
    startedAt: source.startedAt ?? null,
    finishedAt: source.finishedAt ?? null,
    pausedAt: source.pausedAt ?? null,
    accumulatedPausedMs: source.accumulatedPausedMs ?? 0,
    steps: Array.isArray(source.steps) ? source.steps : [],
    networkEvents: Array.isArray(source.networkEvents) ? source.networkEvents : [],
    consoleEvents: Array.isArray(source.consoleEvents) ? source.consoleEvents : [],
    screenshots: Array.isArray(source.screenshots) ? source.screenshots : [],
    environment: asRecord(source.environment),
    bugReport: asRecord(source.bugReport),
    testCase: asRecord(source.testCase),
    checklist: asRecord(source.checklist),
    settings: {
      mascotPosition: normalizePosition(settings.mascotPosition),
      theme: normalizeRecorderTheme(settings.theme),
      mascotActivity: migrateMascotActivity(settings),
      controllerPosition: normalizePosition(settings.controllerPosition ?? settings.mascotPosition),
      controllerCollapsed: typeof settings.controllerCollapsed === "boolean" ? settings.controllerCollapsed : true,
      slowRequestThresholdMs: clampThreshold(settings.slowRequestThresholdMs),
      reducedMotionOverride: migrateReducedMotion(settings),
    },
  };
}
