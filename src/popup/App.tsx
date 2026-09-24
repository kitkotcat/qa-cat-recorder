import { useEffect, useMemo, useState } from "react";
import { translate, type Locale } from "../i18n";

type RecorderStatus = "idle" | "recording" | "paused" | "stopped";
type TabId = "summary" | "steps" | "network" | "console" | "screenshots";
type NetworkFilter = "all" | "4xx" | "5xx" | "err";

type RecorderStep = {
  id: string;
  type: "page" | "click" | "input" | "manual";
  label: string;
  url: string;
  timestamp: number;
  note?: string;
  important?: boolean;
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
  attached?: boolean;
};

type RecorderSettings = {
  locale: Locale;
  mascotEnabled: boolean;
  reducedMotion: boolean;
  funMode: boolean;
};

type BugReportDraft = {
  title: string;
  preconditions: string;
  actualResult: string;
  expectedResult: string;
  environment: string;
};

type RecorderState = {
  schemaVersion: 2;
  status: RecorderStatus;
  sessionId: string | null;
  targetTabId: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  pausedAt: number | null;
  accumulatedPausedMs: number;
  steps: RecorderStep[];
  networkEvents: RecorderNetworkEvent[];
  consoleEvents: RecorderConsoleEvent[];
  screenshots: RecorderScreenshot[];
  bugReport: BugReportDraft;
  settings: RecorderSettings;
};

const emptyState: RecorderState = {
  schemaVersion: 2,
  status: "idle",
  sessionId: null,
  targetTabId: null,
  startedAt: null,
  finishedAt: null,
  pausedAt: null,
  accumulatedPausedMs: 0,
  steps: [],
  networkEvents: [],
  consoleEvents: [],
  screenshots: [],
  bugReport: {
    title: "",
    preconditions: "",
    actualResult: "",
    expectedResult: "",
    environment: "",
  },
  settings: {
    locale: "ru",
    mascotEnabled: true,
    reducedMotion: false,
    funMode: false,
  },
};

function normalizeState(raw?: Partial<RecorderState>): RecorderState {
  return {
    ...emptyState,
    ...raw,
    steps: raw?.steps ?? [],
    networkEvents: raw?.networkEvents ?? [],
    consoleEvents: raw?.consoleEvents ?? [],
    screenshots: raw?.screenshots ?? [],
    bugReport: { ...emptyState.bugReport, ...(raw?.bugReport ?? {}) },
    settings: { ...emptyState.settings, ...(raw?.settings ?? {}) },
  };
}

async function command(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<RecorderState> {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.error) throw new Error(response.error);
  return normalizeState(response?.state);
}

function safeUrl(raw: string) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function formatClock(timestamp: number | null, locale: Locale) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleTimeString(
    locale === "ru" ? "ru-RU" : "en-US",
    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
  );
}

function formatDuration(state: RecorderState, now: number) {
  if (!state.startedAt) return "00:00";
  const end =
    state.status === "paused" && state.pausedAt
      ? state.pausedAt
      : state.status === "stopped"
        ? state.finishedAt ?? state.pausedAt ?? now
        : now;

  const elapsed = Math.max(
    0,
    end - state.startedAt - state.accumulatedPausedMs
  );
  const totalSeconds = Math.floor(elapsed / 1000);
  return `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(totalSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

function buildBugDraft(state: RecorderState, locale: Locale) {
  const ru = locale === "ru";
  const steps =
    state.steps.length > 0
      ? state.steps
          .map(
            (step, index) =>
              `${index + 1}. ${step.label}${step.note ? ` — ${step.note}` : ""}`
          )
          .join("\n")
      : ru
        ? "1. [Добавьте шаги воспроизведения]"
        : "1. [Add reproduction steps]";

  const network =
    state.networkEvents.length > 0
      ? state.networkEvents
          .slice(-10)
          .map(
            (event) =>
              `- ${event.method} ${event.statusCode ?? event.error ?? "ERR"} ${event.url}`
          )
          .join("\n")
      : ru
        ? "- Network issues не зафиксированы"
        : "- No network issues captured";

  const consoleErrors =
    state.consoleEvents.length > 0
      ? state.consoleEvents
          .slice(-10)
          .map((event) => `- [${event.level}] ${event.message}`)
          .join("\n")
      : ru
        ? "- Console errors не зафиксированы"
        : "- No console errors captured";

  return [
    ru ? "Название:" : "Title:",
    state.bugReport.title || (ru ? "[Опишите проблему]" : "[Describe the problem]"),
    "",
    ru ? "Окружение:" : "Environment:",
    state.bugReport.environment || navigator.userAgent,
    "",
    ru ? "Предусловия:" : "Preconditions:",
    state.bugReport.preconditions || "—",
    "",
    ru ? "Шаги воспроизведения:" : "Steps to reproduce:",
    steps,
    "",
    ru ? "Фактический результат:" : "Actual result:",
    state.bugReport.actualResult || "—",
    "",
    ru ? "Ожидаемый результат:" : "Expected result:",
    state.bugReport.expectedResult || "—",
    "",
    ru ? "Технические доказательства:" : "Technical evidence:",
    `${ru ? "Скриншоты" : "Screenshots"}: ${state.screenshots.filter((item) => item.attached !== false).length}`,
    "",
    "Network:",
    network,
    "",
    "Console:",
    consoleErrors,
  ].join("\n");
}

function downloadSession(state: RecorderState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qa-buddy-session-${state.sessionId ?? "draft"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function QACatLogo() {
  return (
    <svg viewBox="0 0 120 120" className="qa-logo" aria-label="QA Cat">
      <circle cx="60" cy="60" r="55" fill="#020617" stroke="#22d3ee" strokeWidth="3" />
      <path d="M30 45L35 18L53 36" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" />
      <path d="M90 45L85 18L67 36" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 46C35 30 85 30 90 46V72C90 92 77 103 60 103C43 103 30 92 30 72V46Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
      <circle cx="46" cy="59" r="5" fill="#f8fafc" />
      <circle cx="74" cy="59" r="5" fill="#f8fafc" />
      <circle cx="47" cy="60" r="2" fill="#020617" />
      <circle cx="73" cy="60" r="2" fill="#020617" />
      <path d="M55 70L60 74L65 70" fill="#22d3ee" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
      <path d="M52 85H68" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
      <path d="M31 71L13 66M31 78L11 80M89 71L107 66M89 78L109 80" stroke="#94a3b8" strokeWidth="2" />
    </svg>
  );
}

function App() {
  const [state, setState] = useState<RecorderState>(emptyState);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const locale = state.settings.locale;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  useEffect(() => {
    void command("GET_STATE").then(setState).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to load session");
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;
      const next = changes.qaBuddyRecorderState?.newValue;
      if (next) setState(normalizeState(next as Partial<RecorderState>));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const duration = useMemo(() => formatDuration(state, now), [state, now]);
  const isActive = state.status === "recording" || state.status === "paused";

  const filteredNetwork = state.networkEvents.filter((event) => {
    if (networkFilter === "all") return true;
    if (networkFilter === "err") return Boolean(event.error);
    if (networkFilter === "4xx")
      return Boolean(event.statusCode && event.statusCode >= 400 && event.statusCode < 500);
    return Boolean(event.statusCode && event.statusCode >= 500);
  });

  const run = async (
    type: string,
    payload: Record<string, unknown> = {}
  ) => {
    try {
      setError("");
      setNotice("");
      const next = await command(type, payload);
      setState(next);
      if (type === "CAPTURE_SCREENSHOT") setNotice(t("notice.screenshot"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recorder action failed");
    }
  };

  const setLocale = async (nextLocale: Locale) => {
    await run("UPDATE_SETTINGS", { settings: { locale: nextLocale } });
  };

  const copyText = async (text: string, noticeKey: "notice.copied" | "notice.bugCopied") => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t(noticeKey));
      setError("");
    } catch {
      setError(locale === "ru" ? "Не удалось скопировать данные." : "Unable to copy data.");
    }
  };

  const addManualStep = async () => {
    const label = window.prompt(
      locale === "ru" ? "Опиши шаг:" : "Describe the step:"
    );
    if (label?.trim()) await run("ADD_MANUAL_STEP", { label });
  };

  const addNote = async (step: RecorderStep) => {
    const note = window.prompt(
      locale === "ru" ? "Заметка к шагу:" : "Step note:",
      step.note ?? ""
    );
    if (note !== null) {
      await run("UPDATE_STEP", { stepId: step.id, note });
    }
  };

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "summary", label: t("tab.summary") },
    { id: "steps", label: t("tab.steps"), count: state.steps.length },
    { id: "network", label: t("tab.network"), count: state.networkEvents.length },
    { id: "console", label: t("tab.console"), count: state.consoleEvents.length },
    { id: "screenshots", label: t("tab.screenshots"), count: state.screenshots.length },
  ];

  const statusLabel =
    state.status === "recording"
      ? t("status.recording")
      : state.status === "paused"
        ? t("status.paused")
        : state.status === "stopped"
          ? t("status.stopped")
          : t("status.idle");

  const domain = state.steps[0]?.url ? safeUrl(state.steps[0].url)?.hostname ?? "—" : "—";

  return (
    <main className="popup-shell">
      <header className="brand">
        <div className="cat-badge"><QACatLogo /></div>
        <div className="brand-copy">
          <p className="eyebrow">{t("app.subtitle")}</p>
          <h1>Recorder</h1>
        </div>

        <div className="header-actions">
          <div className="language-switch" aria-label="Language">
            <button
              className={locale === "ru" ? "active" : ""}
              onClick={() => void setLocale("ru")}
            >
              RU
            </button>
            <button
              className={locale === "en" ? "active" : ""}
              onClick={() => void setLocale("en")}
            >
              EN
            </button>
          </div>
          <span className={`status-pill status-${state.status}`}>{statusLabel}</span>
        </div>
      </header>

      <section className="session-card">
        <div><span className="metric-label">{t("metric.steps")}</span><strong>{state.steps.length}</strong></div>
        <div><span className="metric-label">{t("metric.time")}</span><strong>{duration}</strong></div>
        <div><span className="metric-label">{t("metric.http")}</span><strong>{state.networkEvents.length}</strong></div>
        <div><span className="metric-label">{t("metric.console")}</span><strong>{state.consoleEvents.length}</strong></div>
      </section>

      <section className="controls">
        {!isActive ? (
          <button className="button button-primary" onClick={() => void run("START_RECORDING")}>
            ● {t("action.start")}
          </button>
        ) : (
          <>
            <button className="button button-secondary compact" onClick={() => void run("CAPTURE_SCREENSHOT")} title={t("action.screenshot")}>
              📸 {state.screenshots.length}
            </button>
            <button className="button button-secondary compact" onClick={() => void run("TOGGLE_PAUSE")}>
              {state.status === "paused" ? "▶" : "Ⅱ"}
            </button>
            <button className="button button-danger" onClick={() => void run("STOP_RECORDING")}>
              ■ {t("action.stop")}
            </button>
          </>
        )}
      </section>

      <nav className="tabs" aria-label="Recorder sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && <b>{tab.count}</b>}
          </button>
        ))}
      </nav>

      <section className="tab-content">
        {activeTab === "summary" && (
          <div className="panel">
            <div className="section-heading">
              <h2>{state.status === "stopped" ? t("summary.evidenceReady") : t("summary.title")}</h2>
              <span>{statusLabel}</span>
            </div>

            {!state.sessionId ? (
              <div className="empty-state">{t("summary.empty")}</div>
            ) : (
              <>
                <div className="summary-grid">
                  <div><span>{t("summary.domain")}</span><strong>{domain}</strong></div>
                  <div><span>{t("summary.started")}</span><strong>{formatClock(state.startedAt, locale)}</strong></div>
                  <div><span>{t("summary.finished")}</span><strong>{formatClock(state.finishedAt, locale)}</strong></div>
                  <div><span>{t("metric.time")}</span><strong>{duration}</strong></div>
                </div>

                {state.status === "stopped" && (
                  <div className="result-actions">
                    <button
                      className="button button-primary"
                      onClick={() => void copyText(buildBugDraft(state, locale), "notice.bugCopied")}
                    >
                      {t("action.copyBug")}
                    </button>
                    <button className="button button-secondary" onClick={() => downloadSession(state)}>
                      {t("action.exportJson")}
                    </button>
                    <button className="button button-ghost result-clear" onClick={() => void run("CLEAR_SESSION")}>
                      {t("action.clear")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "steps" && (
          <div className="panel">
            <div className="section-heading">
              <h2>{t("steps.title")}</h2>
              <button className="link-button" onClick={() => void addManualStep()} disabled={!state.sessionId}>
                {t("action.addManual")}
              </button>
            </div>

            {state.steps.length === 0 ? (
              <div className="empty-state">{t("steps.empty")}</div>
            ) : (
              <ol className="step-list">
                {state.steps.map((step, index) => (
                  <li className={step.important ? "step-row important" : "step-row"} key={step.id}>
                    <span className="step-index">{index + 1}</span>
                    <div className="row-main">
                      <strong>{step.label}</strong>
                      <small>
                        {new Date(step.timestamp).toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US")} · {safeUrl(step.url)?.hostname ?? "manual"}
                      </small>
                      {step.note && <em>{step.note}</em>}
                    </div>
                    <div className="row-actions">
                      <button
                        title={t("action.important")}
                        className={step.important ? "mini-button active" : "mini-button"}
                        onClick={() => void run("UPDATE_STEP", { stepId: step.id, important: !step.important })}
                      >
                        ★
                      </button>
                      <button className="mini-button" title={t("action.note")} onClick={() => void addNote(step)}>✎</button>
                      <button className="mini-button danger" title={t("action.delete")} onClick={() => void run("UPDATE_STEP", { stepId: step.id, delete: true })}>×</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {activeTab === "network" && (
          <div className="panel">
            <div className="section-heading">
              <h2>{t("network.title")}</h2>
              <div className="filter-row">
                {(["all", "4xx", "5xx", "err"] as NetworkFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={networkFilter === filter ? "filter active" : "filter"}
                    onClick={() => setNetworkFilter(filter)}
                  >
                    {t(`filter.${filter}` as Parameters<typeof translate>[1])}
                  </button>
                ))}
              </div>
            </div>

            {filteredNetwork.length === 0 ? (
              <div className="empty-state">{t("network.empty")}</div>
            ) : (
              <div className="evidence-list">
                {filteredNetwork.map((event) => {
                  const url = safeUrl(event.url);
                  return (
                    <div className="evidence-row" key={event.id}>
                      <span className="evidence-code">{event.statusCode ?? "ERR"}</span>
                      <div className="row-main">
                        <strong>{event.method} {url?.pathname ?? event.url}</strong>
                        <small>{url?.hostname ?? event.error} · {formatClock(event.timestamp, locale)}</small>
                      </div>
                      <button className="mini-button" onClick={() => void copyText(`${event.method} ${event.statusCode ?? event.error ?? "ERR"} ${event.url}`, "notice.copied")}>⧉</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "console" && (
          <div className="panel">
            <div className="section-heading"><h2>{t("console.title")}</h2><span>{state.consoleEvents.length}</span></div>
            {state.consoleEvents.length === 0 ? (
              <div className="empty-state">{t("console.empty")}</div>
            ) : (
              <div className="evidence-list">
                {state.consoleEvents.map((event) => (
                  <div className="evidence-row" key={event.id}>
                    <span className="evidence-code evidence-console">JS</span>
                    <div className="row-main">
                      <strong>{event.level}</strong>
                      <small>{event.message}</small>
                    </div>
                    <button className="mini-button" onClick={() => void copyText(event.message, "notice.copied")}>⧉</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "screenshots" && (
          <div className="panel">
            <div className="section-heading"><h2>{t("screenshots.title")}</h2><span>{state.screenshots.length}/5</span></div>
            {state.screenshots.length === 0 ? (
              <div className="empty-state">{t("screenshots.empty")}</div>
            ) : (
              <div className="screenshot-grid">
                {state.screenshots.map((shot) => (
                  <article className={shot.attached === false ? "shot detached" : "shot"} key={shot.id}>
                    <a href={shot.dataUrl} target="_blank" rel="noreferrer">
                      <img src={shot.dataUrl} alt={`Screenshot ${formatClock(shot.timestamp, locale)}`} />
                    </a>
                    <div className="shot-meta">
                      <span>{formatClock(shot.timestamp, locale)}</span>
                      <div>
                        <button
                          className={shot.attached === false ? "mini-button" : "mini-button active"}
                          title={shot.attached === false ? t("action.attach") : t("action.detach")}
                          onClick={() => void run("UPDATE_SCREENSHOT", { screenshotId: shot.id, attached: shot.attached === false })}
                        >
                          ✓
                        </button>
                        <button className="mini-button danger" title={t("action.delete")} onClick={() => void run("UPDATE_SCREENSHOT", { screenshotId: shot.id, delete: true })}>×</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="privacy-note">
        <span aria-hidden="true">🛡</span>
        <p><strong>{t("privacy.title")}</strong> {t("privacy.text")}</p>
      </aside>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

export default App;
