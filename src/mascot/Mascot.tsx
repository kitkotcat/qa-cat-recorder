import { useEffect, useMemo, useRef, useState } from "react";
import "./mascot.css";

type MascotState = "idle" | "blink" | "wash" | "play" | "walk" | "litter";

type MascotPosition = {
  x: number;
  y: number;
};

type MascotProps = {
  enabled: boolean;
  reducedMotion: boolean;
  funMode: boolean;
  recording: boolean;
  position: MascotPosition | null;
  onPositionChange: (position: MascotPosition | null) => void;
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
  position,
  onPositionChange,
}: MascotProps) {
  const [state, setState] = useState<MascotState>("idle");
  const [localPosition, setLocalPosition] =
    useState<MascotPosition | null>(position);

  const timeoutRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    setLocalPosition(position);
  }, [position]);

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

  const clampPosition = (x: number, y: number): MascotPosition => {
    const width = 104;
    const height = 76;

    return {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, y)),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setLocalPosition(
      clampPosition(
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY
      )
    );
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;

    if (localPosition) {
      onPositionChange(localPosition);
    }
  };

  if (!enabled) return null;

  const style = localPosition
    ? {
        left: localPosition.x,
        top: localPosition.y,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <div
      className={`pixel-mascot state-${state} ${reducedMotion ? "reduced" : ""}`}
      aria-label={label}
      title="QA Buddy — перетащи мышкой, double click вернёт на место"
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
          <span className="ear ear-left" />
          <span className="ear ear-right" />
          <span className="head">
            <i className="eye eye-left" />
            <i className="eye eye-right" />
            <i className="nose" />
            <i className="whisker whisker-l1" />
            <i className="whisker whisker-l2" />
            <i className="whisker whisker-l3" />
            <i className="whisker whisker-r1" />
            <i className="whisker whisker-r2" />
            <i className="whisker whisker-r3" />
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
