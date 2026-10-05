export type MascotActivity = "off" | "calm" | "active";
export type MascotState =
  | "idle"
  | "blink"
  | "ear"
  | "tail"
  | "look"
  | "paw"
  | "wash"
  | "stretch"
  | "play"
  | "walk"
  | "coffee"
  | "litter";

const MICRO_STATES: MascotState[] = ["blink", "ear", "tail", "look", "paw"];
const ACTIVE_VIBE_STATES: MascotState[] = ["wash", "stretch", "play", "walk"];
const CALM_VIBE_STATES: MascotState[] = ["wash", "stretch"];

export function nextMicroDelay(random = Math.random()): number {
  return 7000 + Math.floor(Math.min(0.999999, Math.max(0, random)) * 8001);
}

export function nextVibeDelay(random = Math.random()): number {
  return 25000 + Math.floor(Math.min(0.999999, Math.max(0, random)) * 25001);
}

export function pickMicroState(random = Math.random()): MascotState {
  const index = Math.min(MICRO_STATES.length - 1, Math.floor(Math.max(0, random) * MICRO_STATES.length));
  return MICRO_STATES[index];
}

export function pickVibeState(activity: MascotActivity, random = Math.random()): MascotState {
  const value = Math.min(0.999999, Math.max(0, random));
  if (value < 0.12) return "coffee";
  if (activity === "active" && value < 0.17) return "litter";
  const states = activity === "active" ? ACTIVE_VIBE_STATES : CALM_VIBE_STATES;
  const normalized = activity === "active" ? (value - 0.17) / 0.83 : (value - 0.12) / 0.88;
  const index = Math.min(states.length - 1, Math.max(0, Math.floor(normalized * states.length)));
  return states[index];
}

export function isAnimationAllowed(
  state: MascotState,
  recording: boolean,
  reducedMotion: boolean,
  activity: MascotActivity
): boolean {
  if (state === "idle") return true;
  if (activity === "off" || reducedMotion) return false;
  if (!recording) return activity === "active" || state !== "litter";
  return ["blink", "ear", "tail", "look", "paw", "wash"].includes(state);
}

export function durationFor(state: MascotState): number {
  switch (state) {
    case "blink": return 700;
    case "ear": return 850;
    case "tail": return 1100;
    case "look": return 1200;
    case "paw": return 1000;
    case "wash": return 2800;
    case "stretch": return 3200;
    case "play": return 4000;
    case "walk": return 3400;
    case "coffee": return 4600;
    case "litter": return 5000;
    default: return 0;
  }
}
