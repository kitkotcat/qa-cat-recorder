import { useEffect, useMemo, useState } from "react";

type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

type RecorderStep = {
  id: string;
  type: "page" | "click" | "input";
  label: string;
  url: string;
  timestamp: number;
};

type RecorderNetworkEvent = {
  id: string;
  method: string;
  url: string;
  statusCode?: number;
  error?: string;
  timestamp: number;
};

type RecorderConsoleEvent = {
  id: string;
  level: "error" | "exception" | "unhandledrejection";
  message: string;
  url: string;
  timestamp: number;
};

type RecorderScreenshot = {
  id: string;
  dataUrl: string;
  url: string;
  timestamp: number;
};

type RecorderState = {
  status: RecorderStatus;
  sessionId: string | null;
  targetTabId: number | null;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPausedMs: number;
  steps: RecorderStep[];
  networkEvents: RecorderNetworkEvent[];
  consoleEvents: RecorderConsoleEvent[];
  screenshots: RecorderScreenshot[];
};

const emptyState: RecorderState = {
  status: "idle",
  sessionId: null,
  targetTabId: null,
  startedAt: null,
  pausedAt: null,
  accumulatedPausedMs: 0,
  steps: [],
  networkEvents: [],
  consoleEvents: [],
  screenshots: [],
};

function formatDuration(state: RecorderState, now: number) {
  if (!state.startedAt) return "00:00";

  const end =
    state.status === "paused" && state.pausedAt
      ? state.pausedAt
      : state.status === "stopped"
        ? state.pausedAt ?? now
        : now;

  const elapsed = Math.max(
    0,
    end - state.startedAt - state.accumulatedPausedMs
  );

  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

async function command(type: string): Promise<RecorderState> {
  const response = await chrome.runtime.sendMessage({ type });

  if (response?.error) {
    throw new Error(response.error);
  }

  return {
    ...emptyState,
    ...response?.state,
    steps: response?.state?.steps ?? [],
    networkEvents: response?.state?.networkEvents ?? [],
    consoleEvents: response?.state?.consoleEvents ?? [],
    screenshots: response?.state?.screenshots ?? [],
  };
}

function buildBugDraft(state: RecorderState): string {
  const steps =
    state.steps.length > 0
      ? state.steps
          .map((step, index) => `${index + 1}. ${step.label}`)
          .join("\n")
      : "1. [Add reproduction steps]";

  const network =
    state.networkEvents.length > 0
      ? state.networkEvents
          .slice(-10)
          .map((event) =>
            `- ${event.method} ${event.statusCode ?? event.error ?? "error"} ${event.url}`
          )
          .join("\n")
      : "- No HTTP/network errors captured";

  const consoleErrors =
    state.consoleEvents.length > 0
      ? state.consoleEvents
          .slice(-10)
          .map((event) => `- [${event.level}] ${event.message}`)
          .join("\n")
      : "- No console errors captured";

  return [
    "Title:",
    "[Describe the problem]",
    "",
    "Environment:",
    navigator.userAgent,
    "",
    "Preconditions:",
    "[Add preconditions if needed]",
    "",
    "Steps to reproduce:",
    steps,
    "",
    "Actual result:",
    "[Describe what happened]",
    "",
    "Expected result:",
    "[Describe expected behaviour]",
    "",
    "Technical evidence:",
    `Screenshots: ${state.screenshots.length}`,
    "",
    "Network:",
    network,
    "",
    "Console:",
    consoleErrors,
  ].join("\n");
}

function downloadSession(state: RecorderState) {
  const blob = new Blob(
    [JSON.stringify(state, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qa-buddy-session-${state.sessionId ?? "draft"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [state, setState] = useState<RecorderState>(emptyState);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void command("GET_STATE")
      .then(setState)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load session");
      });

    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      const next = changes.qaBuddyRecorderState?.newValue;
      if (!next) return;

      setState({
        ...emptyState,
        ...(next as Partial<RecorderState>),
        steps: next.steps ?? [],
        networkEvents: next.networkEvents ?? [],
        consoleEvents: next.consoleEvents ?? [],
        screenshots: next.screenshots ?? [],
      });
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const duration = useMemo(
    () => formatDuration(state, now),
    [state, now]
  );
  const isActive =
    state.status === "recording" || state.status === "paused";
  const recentSteps = state.steps.slice(-3).reverse();
  const recentNetwork = state.networkEvents.slice(-3).reverse();
  const recentConsole = state.consoleEvents.slice(-2).reverse();

  const run = async (type: string) => {
    try {
      setError("");
      setNotice("");
      setState(await command(type));

      if (type === "CAPTURE_SCREENSHOT") {
        setNotice("Screenshot saved");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Recorder action failed"
      );
    }
  };

  const copyBugDraft = async () => {
    try {
      await navigator.clipboard.writeText(buildBugDraft(state));
      setNotice("Bug draft copied");
      setError("");
    } catch {
      setError("Unable to copy bug draft");
    }
  };

  return (
    <main className="popup-shell">
      <header className="brand">
        <div className="cat-badge" aria-hidden="true">🐱</div>
        <div>
          <p className="eyebrow">QA CAT BUDDY</p>
          <h1>Recorder</h1>
        </div>
        <span className={`status-pill status-${state.status}`}>
          {state.status === "recording"
            ? "● REC"
            : state.status === "paused"
              ? "PAUSED"
              : state.status === "stopped"
                ? "DONE"
                : "READY"}
        </span>
      </header>

      <section className="session-card">
        <div>
          <span className="metric-label">Steps</span>
          <strong>{state.steps.length}</strong>
        </div>
        <div>
          <span className="metric-label">Time</span>
          <strong>{duration}</strong>
        </div>
        <div>
          <span className="metric-label">HTTP</span>
          <strong>{state.networkEvents.length}</strong>
        </div>
        <div>
          <span className="metric-label">Console</span>
          <strong>{state.consoleEvents.length}</strong>
        </div>
      </section>

      <section className="controls">
        {!isActive ? (
          <button
            className="button button-primary"
            onClick={() => void run("START_RECORDING")}
          >
            <span>●</span> Start recording
          </button>
        ) : (
          <>
            <button
              className="button button-secondary"
              onClick={() => void run("CAPTURE_SCREENSHOT")}
              title="Save visible tab screenshot"
            >
              📸 {state.screenshots.length}
            </button>
            <button
              className="button button-secondary"
              onClick={() => void run("TOGGLE_PAUSE")}
            >
              {state.status === "paused" ? "▶" : "Ⅱ"}
            </button>
            <button
              className="button button-danger"
              onClick={() => void run("STOP_RECORDING")}
            >
              ■ Stop
            </button>
          </>
        )}
      </section>

      {state.status === "stopped" && (
        <section className="result-card">
          <div>
            <p className="eyebrow">RECORDED SESSION</p>
            <h2>Evidence is ready</h2>
            <p className="result-copy">
              {state.steps.length} steps · {state.networkEvents.length} network issues ·{" "}
              {state.consoleEvents.length} console errors · {state.screenshots.length} screenshots
            </p>
          </div>

          <div className="result-actions">
            <button
              className="button button-primary"
              onClick={() => void copyBugDraft()}
            >
              Copy bug draft
            </button>
            <button
              className="button button-secondary"
              onClick={() => downloadSession(state)}
            >
              Export JSON
            </button>
            <button
              className="button button-ghost result-clear"
              onClick={() => void run("CLEAR_SESSION")}
            >
              Clear session
            </button>
          </div>
        </section>
      )}

      <section className="steps-panel">
        <div className="section-heading">
          <h2>Latest steps</h2>
          <span>{state.steps.length}/500</span>
        </div>

        {recentSteps.length === 0 ? (
          <div className="empty-state">
            Start recording, then reproduce the issue in the current tab.
          </div>
        ) : (
          <ol>
            {recentSteps.map((step) => (
              <li key={step.id}>
                <span className={`step-icon step-${step.type}`}>
                  {step.type === "page"
                    ? "↗"
                    : step.type === "input"
                      ? "⌨"
                      : "↖"}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{new URL(step.url).hostname}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {(recentNetwork.length > 0 || recentConsole.length > 0) && (
        <section className="evidence-panel">
          <div className="section-heading">
            <h2>Suspicious evidence</h2>
            <span>auto-captured</span>
          </div>

          {recentNetwork.map((event) => (
            <div className="evidence-row" key={event.id}>
              <span className="evidence-code">
                {event.statusCode ?? "ERR"}
              </span>
              <div>
                <strong>{event.method} {new URL(event.url).pathname}</strong>
                <small>{event.error ?? new URL(event.url).hostname}</small>
              </div>
            </div>
          ))}

          {recentConsole.map((event) => (
            <div className="evidence-row" key={event.id}>
              <span className="evidence-code evidence-console">JS</span>
              <div>
                <strong>{event.level}</strong>
                <small>{event.message}</small>
              </div>
            </div>
          ))}
        </section>
      )}

      <aside className="privacy-note">
        <span aria-hidden="true">🛡</span>
        <p>
          <strong>Privacy first.</strong> Typed field values are not recorded.
          Sensitive query parameters and common secret patterns are redacted.
          Screenshots are captured only when you press 📸.
        </p>
      </aside>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

export default App;
