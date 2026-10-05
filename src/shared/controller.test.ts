import { describe, expect, it } from "vitest";
import { isRecorderOwnedInteraction, normalizeControllerPosition } from "./controller";

describe("Cat Controller helpers", () => {
  it("recognizes an interaction whose composed path contains the recorder host", () => {
    const host = { id: "qa-cat-recorder-root" } as unknown as EventTarget;
    const child = {} as EventTarget;
    expect(isRecorderOwnedInteraction([child, host], host)).toBe(true);
  });

  it("does not classify a normal page interaction as recorder-owned", () => {
    const host = { id: "qa-cat-recorder-root" } as unknown as EventTarget;
    expect(isRecorderOwnedInteraction([{} as EventTarget], host)).toBe(false);
  });

  it("clamps persisted coordinates to non-negative integer values", () => {
    expect(normalizeControllerPosition({ x: -11.8, y: 42.6 })).toEqual({ x: 0, y: 43 });
  });

  it("returns null for malformed positions", () => {
    expect(normalizeControllerPosition({ x: Number.NaN, y: 2 })).toBeNull();
    expect(normalizeControllerPosition(null)).toBeNull();
  });
});
