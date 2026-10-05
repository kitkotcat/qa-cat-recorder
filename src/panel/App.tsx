import { useEffect, useState } from "react";

type PanelState = {
  status: "idle" | "recording" | "paused" | "stopped";
  sessionId: string | null;
};

const emptyState: PanelState = { status: "idle", sessionId: null };

export default function App() {
  const [state, setState] = useState<PanelState>(emptyState);
  const [error, setError] = useState("");

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
      if (response?.error) setError(response.error);
      if (response?.state) setState(response.state as PanelState);
    });

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      const next = changes.qaBuddyRecorderState?.newValue;
      if (next) setState(next as PanelState);
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <main className="panel-shell">
      <header>
        <strong>🐱 QA Cat Recorder</strong>
        <span>{state.status.toUpperCase()}</span>
      </header>
      <section>
        <p>Side Panel подключён.</p>
        <small>Session: {state.sessionId ?? "—"}</small>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
