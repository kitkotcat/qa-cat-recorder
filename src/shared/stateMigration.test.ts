import { describe, expect, it } from "vitest";
import { migrateRecorderState } from "./stateMigration";

const baseV31 = {
  schemaVersion: 3,
  status: "recording",
  sessionId: "session-1",
  targetTabId: 42,
  startedAt: 1000,
  finishedAt: null,
  pausedAt: null,
  accumulatedPausedMs: 50,
  steps: [{ id: "s1", type: "page", label: "Открыть example.com", url: "https://example.com", timestamp: 1000, note: "", important: false }],
  networkEvents: [{ id: "n1", method: "GET", url: "https://example.com/api", statusCode: 500, timestamp: 1200 }],
  consoleEvents: [{ id: "c1", level: "error", message: "boom", url: "https://example.com", timestamp: 1300 }],
  screenshots: [{ id: "shot1", dataUrl: "data:image/jpeg;base64,x", url: "https://example.com", timestamp: 1400, attached: true, stepId: "s1" }],
  environment: { url: "https://example.com", domain: "example.com", browser: "Chrome", os: "macOS", viewport: "1200×800", language: "ru", capturedAt: 1000 },
  bugReport: { title: "Bug", preconditions: "p", actualResult: "a", expectedResult: "e", environment: "env", severity: "Major", priority: "High" },
  testCase: { title: "TC", module: "m", preconditions: "p", testData: "d", steps: ["one"], expectedResult: "ok", priority: "Medium", caseType: "Positive", tags: "smoke" },
  checklist: { title: "CL", items: [{ id: "i1", text: "check", checked: false }] },
  settings: { locale: "ru", mascotEnabled: true, reducedMotion: false, funMode: false, slowRequestThresholdMs: 3000, mascotPosition: { x: 10, y: 20 } },
};

describe("migrateRecorderState", () => {
  it.each([
    [{ mascotEnabled: false, funMode: false }, "off"],
    [{ mascotEnabled: true, funMode: false }, "calm"],
    [{ mascotEnabled: true, funMode: true }, "active"],
  ] as const)("maps old mascot settings %o to %s", (oldSettings, expected) => {
    const result = migrateRecorderState({ ...baseV31, settings: { ...baseV31.settings, ...oldSettings } });
    expect(result.settings.mascotActivity).toBe(expected);
  });

  it("applies v0.3.2 defaults for new settings", () => {
    const result = migrateRecorderState(baseV31);
    expect(result.schemaVersion).toBe(5);
    expect(result.settings.theme).toBe("night");
    expect(result.settings.controllerManuallyCollapsed).toBe(false);
    expect(result.settings.reducedMotionOverride).toBe("system");
    expect(result.settings.controllerPosition).toEqual({ x: 10, y: 20 });
  });

  it("preserves only the explicit manual collapse preference", () => {
    const legacyLifecycleState = migrateRecorderState({
      ...baseV31,
      schemaVersion: 4,
      settings: { ...baseV31.settings, controllerCollapsed: true },
    });
    expect(legacyLifecycleState.settings.controllerManuallyCollapsed).toBe(false);

    const manualState = migrateRecorderState({
      ...baseV31,
      schemaVersion: 5,
      settings: { ...baseV31.settings, controllerManuallyCollapsed: true },
    });
    expect(manualState.settings.controllerManuallyCollapsed).toBe(true);
  });

  it("preserves active session data and drafts", () => {
    const result = migrateRecorderState(baseV31);
    expect(result.sessionId).toBe(baseV31.sessionId);
    expect(result.status).toBe(baseV31.status);
    expect(result.targetTabId).toBe(baseV31.targetTabId);
    expect(result.startedAt).toBe(baseV31.startedAt);
    expect(result.steps).toEqual(baseV31.steps);
    expect(result.networkEvents).toEqual(baseV31.networkEvents);
    expect(result.consoleEvents).toEqual(baseV31.consoleEvents);
    expect(result.screenshots).toEqual(baseV31.screenshots);
    expect(result.bugReport).toEqual(baseV31.bugReport);
    expect(result.testCase).toEqual(baseV31.testCase);
    expect(result.checklist).toEqual(baseV31.checklist);
    expect(result.settings.slowRequestThresholdMs).toBe(3000);
  });

  it("normalizes invalid theme and clamps threshold", () => {
    const result = migrateRecorderState({
      ...baseV31,
      settings: { ...baseV31.settings, theme: "pink", slowRequestThresholdMs: 999999 },
    });
    expect(result.settings.theme).toBe("night");
    expect(result.settings.slowRequestThresholdMs).toBe(30000);
  });

  it("is idempotent for schema v5 state", () => {
    const once = migrateRecorderState(baseV31);
    const twice = migrateRecorderState(once);
    expect(twice).toEqual(once);
  });
});
