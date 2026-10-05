import { describe, expect, it } from "vitest";
import {
  durationFor,
  isAnimationAllowed,
  nextMicroDelay,
  nextVibeDelay,
  pickVibeState,
} from "./animation";

describe("Mascot v3 animation rules", () => {
  it("keeps micro cadence within 7–15 seconds", () => {
    expect(nextMicroDelay(0)).toBe(7000);
    expect(nextMicroDelay(0.999)).toBeGreaterThanOrEqual(7000);
    expect(nextMicroDelay(0.999)).toBeLessThanOrEqual(15000);
  });

  it("keeps vibe cadence within 25–50 seconds", () => {
    expect(nextVibeDelay(0)).toBe(25000);
    expect(nextVibeDelay(0.999)).toBeGreaterThanOrEqual(25000);
    expect(nextVibeDelay(0.999)).toBeLessThanOrEqual(50000);
  });

  it.each(["play", "walk", "litter", "coffee", "stretch"] as const)(
    "forbids %s during active recording",
    (state) => expect(isAnimationAllowed(state, true, false, "active")).toBe(false)
  );

  it("disables non-essential animation for reduced motion and off mode", () => {
    expect(isAnimationAllowed("blink", false, true, "active")).toBe(false);
    expect(isAnimationAllowed("blink", false, false, "off")).toBe(false);
  });

  it("never selects litter in calm mode", () => {
    for (const value of [0, 0.1, 0.2, 0.5, 0.99]) {
      expect(pickVibeState("calm", value)).not.toBe("litter");
    }
  });

  it("uses a 12% deterministic coffee band", () => {
    expect(pickVibeState("active", 0)).toBe("coffee");
    expect(pickVibeState("active", 0.119)).toBe("coffee");
    expect(pickVibeState("active", 0.12)).not.toBe("coffee");
  });

  it("allows a rare litter state only in active mode", () => {
    expect(pickVibeState("active", 0.13)).toBe("litter");
    expect(pickVibeState("calm", 0.13)).not.toBe("litter");
  });

  it("keeps coffee duration between 4 and 5 seconds", () => {
    expect(durationFor("coffee")).toBeGreaterThanOrEqual(4000);
    expect(durationFor("coffee")).toBeLessThanOrEqual(5000);
  });
});
