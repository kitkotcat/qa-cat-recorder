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

  it("expands the floating controller when the Side Panel closes during a session", () => {
    expect(panel).toContain('chrome.runtime.connect({ name: "side-panel-lifecycle" })');
    expect(background).toContain('port.name !== "side-panel-lifecycle"');
    expect(background).toContain("setControllerCollapsedFromPanel(true)");
    expect(background).toContain("setControllerCollapsedFromPanel(false)");
    expect(background).toContain("port.onDisconnect.addListener");
  });
});
