import { useEffect, useMemo, useRef, useState } from "react";
import "./mascot.css";

type MascotState = "idle" | "blink" | "wash" | "play" | "walk" | "litter";

type MascotProps = {
  enabled: boolean;
  reducedMotion: boolean;
  funMode: boolean;
  recording: boolean;
};

const STANDARD_STATES: MascotState[] = ["blink", "wash", "play", "walk"];

function nextDelay(recording: boolean) {
  const min = recording ? 28000 : 18000;
  const max = recording ? 70000 : 52000;
  return min + Math.floor(Math.random() * (max - min));
}

function pickState(funMode: boolean, recording: boolean): MascotState {
  if (recording) {
    return Math.random() > 0.55 ? "blink" : "wash";
  }

  if (funMode && Math.random() < 0.08) {
    return "litter";
  }

  return STANDARD_STATES[Math.floor(Math.random() * STANDARD_STATES.length)];
}

function durationFor(state: MascotState) {
  switch (state) {
    case "play":
      return 4200;
    case "walk":
      return 3600;
    case "litter":
      return 5200;
    case "wash":
      return 3000;
    case "blink":
      return 1000;
    default:
      return 1800;
  }
}

export default function Mascot({
  enabled,
  reducedMotion,
  funMode,
  recording,
}: MascotProps) {
  const [state, setState] = useState<MascotState>("idle");
  const timeoutRef = useRef<number | null>(null);

  const label = useMemo(() => {
    if (state === "wash") return "QA Buddy умывается";
    if (state === "play") return "QA Buddy играет с мячиком";
    if (state === "walk") return "QA Buddy гуляет";
    if (state === "litter") return "QA Buddy ушёл в лоток";
    return "QA Buddy";
  }, [state]);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      setState("idle");
      return;
    }

    let cancelled = false;

    const schedule = () => {
      timeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;

        const selected = pickState(funMode, recording);
        setState(selected);

        timeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          setState("idle");
          schedule();
        }, durationFor(selected));
      }, nextDelay(recording));
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, reducedMotion, funMode, recording]);

  if (!enabled) return null;

  return (
    <div
      className={`pixel-mascot state-${state} ${reducedMotion ? "reduced" : ""}`}
      aria-label={label}
      title={label}
    >
      <div className="pixel-stage">
        <div className="pixel-cat">
          <span className="ear ear-left" />
          <span className="ear ear-right" />
          <span className="head">
            <i className="eye eye-left" />
            <i className="eye eye-right" />
            <i className="nose" />
          </span>
          <span className="body" />
          <span className="tail" />
          <span className="paw paw-left" />
          <span className="paw paw-right" />
        </div>

        <div className="pixel-ball" aria-hidden="true" />
        <div className="pixel-litter" aria-hidden="true">
          <span className="litter-fill" />
        </div>
      </div>
    </div>
  );
}
