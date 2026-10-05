import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const content = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const background = readFileSync(new URL("./background.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../panel/App.tsx", import.meta.url), "utf8");

describe("Cat Controller lifecycle", () => {
  it("keeps the controller available for a stopped session", () => {
    expect(content).toContain('state?.status === "stopped"');
    expect(content).toContain('state?.sessionId');
  });

  it("renders a completed state without active recording controls", () => {
    expect(content).toContain('state.status === "stopped" ? "ГОТОВО"');
    expect(content).toContain('actions?.classList.toggle("hidden", state.status === "stopped")');
  });

  it("notifies the previous target tab when a new session clears controller state", () => {
    expect(background).toContain("const previousTargetTabId = previous.targetTabId");
    expect(background).toContain("notifyTab(previousTargetTabId, state)");
  });

  it("tracks Side Panel lifecycle without persisting collapse state", () => {
    expect(panel).toContain('chrome.runtime.connect({ name: "side-panel-lifecycle" })');
    expect(background).toContain('port.name !== "side-panel-lifecycle"');
    expect(background).toContain('type: "PANEL_VISIBILITY_CHANGED"');
    expect(background).toContain('panelOpen: sidePanelConnections > 0');
    expect(background).not.toContain("setControllerCollapsedFromPanel");
  });

  it("keeps manual collapse separate from panel lifecycle", () => {
    expect(content).toContain("let panelOpen = false");
    expect(content).toContain("controllerManuallyCollapsed");
    expect(content).toContain("panelOpen || state.settings.controllerManuallyCollapsed");
    expect(background).toContain("controllerManuallyCollapsed: false");
  });

  it("renders the full active toolbar when expanded", () => {
    expect(content).toContain("📸 Скрин");
    expect(content).toContain("⏸ Пауза");
    expect(content).toContain("■ Стоп");
    expect(content).toContain("Открыть боковую панель");
    expect(content).toContain("controllerActionInFlight");
  });
});
