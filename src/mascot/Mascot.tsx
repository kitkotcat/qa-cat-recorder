import { useEffect, useMemo, useRef, useState } from "react";
import {
  durationFor,
  isAnimationAllowed,
  nextMicroDelay,
  nextVibeDelay,
  pickMicroState,
  pickVibeState,
  type MascotActivity,
  type MascotState,
} from "./animation";
import "./mascot.css";

type MascotPosition = { x: number; y: number };
type ReducedMotionOverride = "system" | "on" | "off";

type MascotProps = {
  activity: MascotActivity;
  reducedMotionOverride: ReducedMotionOverride;
  recording: boolean;
  position: MascotPosition | null;
  onPositionChange: (position: MascotPosition | null) => void;
};

export default function Mascot({
  activity,
  reducedMotionOverride,
  recording,
  position,
  onPositionChange,
}: MascotProps) {
  const [state, setState] = useState<MascotState>("idle");
  const [localPosition, setLocalPosition] = useState<MascotPosition | null>(position);
  const [systemReduced, setSystemReduced] = useState(false);
  const stateRef = useRef<MascotState>("idle");
  const endTimer = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const reducedMotion =
    reducedMotionOverride === "on" ||
    (reducedMotionOverride === "system" && systemReduced);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setLocalPosition(position);
  }, [position]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (endTimer.current !== null) {
      window.clearTimeout(endTimer.current);
      endTimer.current = null;
    }
    stateRef.current = "idle";
    setState("idle");

    if (activity === "off" || reducedMotion) {
      return;
    }

    let cancelled = false;
    let microTimer: number | null = null;
    let vibeTimer: number | null = null;

    const animate = (candidate: MascotState) => {
      if (
        cancelled ||
        draggingRef.current ||
        stateRef.current !== "idle" ||
        !isAnimationAllowed(candidate, recording, reducedMotion, activity)
      ) {
        return;
      }
      stateRef.current = candidate;
      setState(candidate);
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      endTimer.current = window.setTimeout(() => {
        stateRef.current = "idle";
        setState("idle");
      }, durationFor(candidate));
    };

    const scheduleMicro = () => {
      microTimer = window.setTimeout(() => {
        animate(pickMicroState());
        scheduleMicro();
      }, nextMicroDelay());
    };

    const scheduleVibe = () => {
      vibeTimer = window.setTimeout(() => {
        if (!recording) animate(pickVibeState(activity));
        else animate("wash");
        scheduleVibe();
      }, nextVibeDelay());
    };

    scheduleMicro();
    scheduleVibe();

    return () => {
      cancelled = true;
      if (microTimer !== null) window.clearTimeout(microTimer);
      if (vibeTimer !== null) window.clearTimeout(vibeTimer);
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    };
  }, [activity, recording, reducedMotion]);

  const label = useMemo(() => {
    const labels: Partial<Record<MascotState, string>> = {
      wash: "QA Cat умывается",
      play: "QA Cat играет с мячиком",
      walk: "QA Cat гуляет",
      litter: "QA Cat ушёл в лоток",
      coffee: "QA Cat пьёт кофе",
      stretch: "QA Cat потягивается",
    };
    return labels[state] ?? "QA Cat";
  }, [state]);

  const clampPosition = (x: number, y: number): MascotPosition => ({
    x: Math.max(8, Math.min(window.innerWidth - 112, x)),
    y: Math.max(8, Math.min(window.innerHeight - 84, y)),
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setLocalPosition(clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    draggingRef.current = false;
    if (localPosition) onPositionChange(localPosition);
  };

  if (activity === "off") return null;

  const style = localPosition
    ? { left: localPosition.x, top: localPosition.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <div
      className={`pixel-mascot state-${state} ${reducedMotion ? "reduced" : ""}`}
      aria-label={label}
      title="QA Cat — перетащи мышкой, double click вернёт на место"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onDoubleClick={() => {
        setLocalPosition(null);
        onPositionChange(null);
      }}
    >
      <div className="pixel-stage">
        <div className="pixel-cat">
          <span className="ear ear-left"><i className="ear-inner" /></span>
          <span className="ear ear-right"><i className="ear-inner" /></span>
          <span className="head">
            <i className="eye eye-left"><b /></i>
            <i className="eye eye-right"><b /></i>
            <i className="forehead-mark" />
            <i className="nose" />
            <i className="mouth" />
            <i className="cheek cheek-left" />
            <i className="cheek cheek-right" />
            <i className="whisker whisker-l1" /><i className="whisker whisker-l2" /><i className="whisker whisker-l3" />
            <i className="whisker whisker-r1" /><i className="whisker whisker-r2" /><i className="whisker whisker-r3" />
          </span>
          <span className="body"><i className="chest" /><i className="collar" /><i className="qa-tag">QA</i></span>
          <span className="tail"><i className="tail-stripe stripe-one" /><i className="tail-stripe stripe-two" /></span>
          <span className="paw paw-left" /><span className="paw paw-right" />
        </div>
        <div className="pixel-ball" aria-hidden="true" />
        <div className="pixel-coffee" aria-hidden="true"><span className="cup" /><span className="steam steam-one" /><span className="steam steam-two" /></div>
        <div className="pixel-litter" aria-hidden="true"><span className="litter-fill" /></div>
      </div>
    </div>
  );
}
