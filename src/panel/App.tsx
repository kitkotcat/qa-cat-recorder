import { useEffect, useMemo, useState } from "react";
import Mascot from "../mascot/Mascot";

type RecorderStatus = "idle" | "recording" | "paused" | "stopped";
type TabId = "summary" | "steps" | "network" | "screenshots" | "report" | "settings";
type EvidenceView = "network" | "console";
type BuilderMode = "bug" | "testcase" | "checklist";
type NetworkFilter = "all" | "4xx" | "5xx" | "err" | "slow";

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
  durationMs?: number;
  slow?: boolean;
  resourceType?: string;
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
  stepId?: string | null;
};

type EnvironmentInfo = {
  url: string;
  domain: string;
  browser: string;
  os: string;
  viewport: string;
  language: string;
  capturedAt: number | null;
};

type BugReportDraft = {
  title: string;
  preconditions: string;
  actualResult: string;
  expectedResult: string;
  environment: string;
  severity: "Blocker" | "Critical" | "Major" | "Minor" | "Trivial";
  priority: "High" | "Medium" | "Low";
};

type TestCaseDraft = {
  title: string;
  module: string;
  preconditions: string;
  testData: string;
  steps: string[];
  expectedResult: string;
  priority: "High" | "Medium" | "Low";
  caseType: "Positive" | "Negative" | "Edge";
  tags: string;
};

type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

type ChecklistDraft = {
  title: string;
  items: ChecklistItem[];
};

type MascotPosition = {
  x: number;
  y: number;
};

type RecorderSettings = {
  theme: "night" | "cafe" | "violet";
  mascotActivity: "off" | "calm" | "active";
  controllerPosition: MascotPosition | null;
  controllerCollapsed: boolean;
  slowRequestThresholdMs: number;
  reducedMotionOverride: "system" | "on" | "off";
  mascotPosition: MascotPosition | null;
};

type RecorderState = {
  schemaVersion: 4;
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
  environment: EnvironmentInfo;
  bugReport: BugReportDraft;
  testCase: TestCaseDraft;
  checklist: ChecklistDraft;
  settings: RecorderSettings;
};

const emptyState: RecorderState = {
  schemaVersion: 4,
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
  environment: {
    url: "",
    domain: "",
    browser: "",
    os: "",
    viewport: "",
    language: "ru",
    capturedAt: null,
  },
  bugReport: {
    title: "",
    preconditions: "",
    actualResult: "",
    expectedResult: "",
    environment: "",
    severity: "Major",
    priority: "Medium",
  },
  testCase: {
    title: "",
    module: "",
    preconditions: "",
    testData: "",
    steps: [],
    expectedResult: "",
    priority: "Medium",
    caseType: "Positive",
    tags: "",
  },
  checklist: {
    title: "",
    items: [],
  },
  settings: {
    theme: "night",
    mascotActivity: "calm",
    controllerPosition: null,
    controllerCollapsed: true,
    slowRequestThresholdMs: 2000,
    reducedMotionOverride: "system",
    mascotPosition: null,
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
    environment: { ...emptyState.environment, ...(raw?.environment ?? {}) },
    bugReport: { ...emptyState.bugReport, ...(raw?.bugReport ?? {}) },
    testCase: {
      ...emptyState.testCase,
      ...(raw?.testCase ?? {}),
      steps: raw?.testCase?.steps ?? [],
    },
    checklist: {
      ...emptyState.checklist,
      ...(raw?.checklist ?? {}),
      items: raw?.checklist?.items ?? [],
    },
    settings: {
      ...emptyState.settings,
      ...(raw?.settings ?? {}),
      theme: raw?.settings?.theme ?? "night",
      mascotActivity: raw?.settings?.mascotActivity ?? "calm",
      controllerPosition: raw?.settings?.controllerPosition ?? null,
      controllerCollapsed: raw?.settings?.controllerCollapsed ?? true,
      reducedMotionOverride: raw?.settings?.reducedMotionOverride ?? "system",
      mascotPosition: raw?.settings?.mascotPosition ?? null,
    },
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

function formatClock(timestamp: number | null) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

function buildBugDraft(state: RecorderState) {
  const steps = state.steps.length
    ? state.steps
        .map(
          (step, index) =>
            `${index + 1}. ${step.label}${step.note ? ` — ${step.note}` : ""}`
        )
        .join("\n")
    : "1. [Добавьте шаги воспроизведения]";

  const network = state.networkEvents.length
    ? state.networkEvents
        .slice(-10)
        .map(
          (event) =>
            `- ${event.method} ${event.statusCode ?? event.error ?? "ERR"} ${event.url}${
              typeof event.durationMs === "number"
                ? ` · ${event.durationMs} ms${event.slow ? " · SLOW" : ""}`
                : ""
            }`
        )
        .join("\n")
    : "- Network issues не зафиксированы";

  const consoleErrors = state.consoleEvents.length
    ? state.consoleEvents
        .slice(-10)
        .map((event) => `- [${event.level}] ${event.message}`)
        .join("\n")
    : "- Console errors не зафиксированы";

  return [
    "Название:",
    state.bugReport.title || "[Опишите проблему]",
    "",
    `Severity: ${state.bugReport.severity}`,
    `Priority: ${state.bugReport.priority}`,
    "",
    "Окружение:",
    state.bugReport.environment || "—",
    "",
    "Предусловия:",
    state.bugReport.preconditions || "—",
    "",
    "Шаги воспроизведения:",
    steps,
    "",
    "Фактический результат:",
    state.bugReport.actualResult || "—",
    "",
    "Ожидаемый результат:",
    state.bugReport.expectedResult || "—",
    "",
    "Технические доказательства:",
    `Скриншоты: ${state.screenshots.filter((item) => item.attached !== false).length}`,
    "",
    "Network:",
    network,
    "",
    "Console:",
    consoleErrors,
  ].join("\n");
}

function buildTestCaseDraft(state: RecorderState) {
  const steps = state.testCase.steps.length
    ? state.testCase.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join("\n")
    : "1. [Добавьте шаги]";

  return [
    "Test Case:",
    state.testCase.title || "[Название проверки]",
    "",
    `Module / Feature: ${state.testCase.module || "—"}`,
    `Type: ${state.testCase.caseType}`,
    `Priority: ${state.testCase.priority}`,
    `Tags: ${state.testCase.tags || "—"}`,
    "",
    "Предусловия:",
    state.testCase.preconditions || "—",
    "",
    "Тестовые данные:",
    state.testCase.testData || "—",
    "",
    "Шаги:",
    steps,
    "",
    "Ожидаемый результат:",
    state.testCase.expectedResult || "—",
  ].join("\n");
}

function buildChecklistDraft(state: RecorderState) {
  const items = state.checklist.items.length
    ? state.checklist.items
        .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
        .join("\n")
    : "- [ ] [Добавьте пункт]";

  return [
    `# ${state.checklist.title || "Чек-лист"}`,
    "",
    items,
  ].join("\n");
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function QACatLogo() {
  return (
    <svg viewBox="0 0 120 120" className="qa-logo" aria-label="QA Cat Recorder">
      <circle cx="60" cy="60" r="55" fill="#020617" stroke="#22d3ee" strokeWidth="3" />
      <path d="M30 45L35 18L53 36" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" />
      <path d="M90 45L85 18L67 36" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 46C35 30 85 30 90 46V72C90 92 77 103 60 103C43 103 30 92 30 72V46Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
      <circle cx="46" cy="59" r="5" fill="#f8fafc" />
      <circle cx="74" cy="59" r="5" fill="#f8fafc" />
      <circle cx="47" cy="60" r="2" fill="#020617" />
      <circle cx="73" cy="60" r="2" fill="#020617" />
      <path d="M55 70L60 74L65 70" fill="#22d3ee" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 71L13 66M31 78L11 80M89 71L107 66M89 78L109 80" stroke="#94a3b8" strokeWidth="2" />
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<RecorderState>(emptyState);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [builderMode, setBuilderMode] = useState<BuilderMode>("bug");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [evidenceView, setEvidenceView] = useState<EvidenceView>("network");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void command("GET_STATE")
      .then(setState)
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить состояние Recorder"
        );
      });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      const next = changes.qaBuddyRecorderState?.newValue;

      if (next) {
        setState(normalizeState(next as Partial<RecorderState>));
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const panelPort = chrome.runtime.connect({ name: "side-panel-lifecycle" });
    return () => panelPort.disconnect();
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
    state.status === "recording" ||
    state.status === "paused";

  const filteredNetwork = state.networkEvents.filter((event) => {
    if (networkFilter === "all") return true;
    if (networkFilter === "err") return Boolean(event.error);
    if (networkFilter === "slow") return Boolean(event.slow);

    if (networkFilter === "4xx") {
      return Boolean(
        event.statusCode &&
          event.statusCode >= 400 &&
          event.statusCode < 500
      );
    }

    return Boolean(
      event.statusCode &&
        event.statusCode >= 500
    );
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

      if (type === "CAPTURE_SCREENSHOT") {
        setNotice("Скриншот сохранён");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка Recorder"
      );
    }
  };

  const copyText = async (
    text: string,
    message = "Скопировано"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
      setError("");
    } catch {
      setError("Не удалось скопировать данные");
    }
  };

  const confirmNewSession = async () => {
    if (
      state.sessionId &&
      !window.confirm(
        "Начать новую сессию? Текущие steps, evidence и drafts будут удалены."
      )
    ) {
      return;
    }

    await run("NEW_SESSION");
    setBuilderMode("bug");
    setActiveTab("summary");
  };

  const resetBuilder = async () => {
    if (!window.confirm("Сбросить только текущий draft? Raw evidence останется.")) {
      return;
    }

    await run("RESET_BUILDER", { mode: builderMode });
  };

  const rebuildBuilder = async () => {
    await run("REBUILD_BUILDER", { mode: builderMode });
    setNotice("Draft пересобран из текущих steps");
  };

  const updateSetting = async (
    settings: Partial<RecorderSettings>
  ) => {
    await run("UPDATE_SETTINGS", { settings });
  };

  const updateBugField = (
    field: keyof BugReportDraft,
    value: string
  ) => {
    setState((current) => ({
      ...current,
      bugReport: {
        ...current.bugReport,
        [field]: value,
      },
    }));
  };

  const saveBugReport = async () => {
    await run("UPDATE_BUG_REPORT", {
      bugReport: state.bugReport,
    });
  };

  const updateTestCaseField = (
    field: keyof TestCaseDraft,
    value: string | string[]
  ) => {
    setState((current) => ({
      ...current,
      testCase: {
        ...current.testCase,
        [field]: value,
      },
    }));
  };

  const saveTestCase = async () => {
    await run("UPDATE_TEST_CASE", {
      testCase: state.testCase,
    });
  };

  const updateChecklist = async (
    checklist: ChecklistDraft
  ) => {
    setState((current) => ({
      ...current,
      checklist,
    }));

    await run("UPDATE_CHECKLIST", {
      checklist,
    });
  };

  const addChecklistItem = async () => {
    const text = window.prompt("Новый пункт чек-листа:");
    if (!text?.trim()) return;

    await updateChecklist({
      ...state.checklist,
      items: [
        ...state.checklist.items,
        {
          id: crypto.randomUUID(),
          text: text.trim(),
          checked: false,
        },
      ],
    });
  };

  const addManualStep = async () => {
    const label = window.prompt("Опиши шаг:");
    if (label?.trim()) {
      await run("ADD_MANUAL_STEP", { label });
    }
  };

  const addStepNote = async (step: RecorderStep) => {
    const note = window.prompt(
      "Заметка к шагу:",
      step.note ?? ""
    );

    if (note !== null) {
      await run("UPDATE_STEP", {
        stepId: step.id,
        note,
      });
    }
  };

  const statusLabel =
    state.status === "recording"
      ? "● ЗАПИСЬ"
      : state.status === "paused"
        ? "ПАУЗА"
        : state.status === "stopped"
          ? "ГОТОВО"
          : "ГОТОВ";

  const tabs: Array<{
    id: TabId;
    label: string;
    count?: number;
  }> = [
    { id: "summary", label: "Сессия" },
    { id: "steps", label: "Шаги", count: state.steps.length },
    { id: "network", label: "Evidence", count: state.networkEvents.length + state.consoleEvents.length },
    { id: "screenshots", label: "Скриншоты", count: state.screenshots.length },
    { id: "report", label: "Отчёт" },
  ];

  return (
    <main className="panel-shell" data-theme={state.settings.theme}>
      <header className="brand">
        <div className="cat-badge"><QACatLogo /></div>
        <div className="brand-copy"><h1>QA Cat Recorder</h1></div>
        <div className="header-actions">
          <span className={`status-pill status-${state.status}`}>{statusLabel}</span>
          <button className="settings-button" onClick={() => setActiveTab(activeTab === "settings" ? "summary" : "settings")} aria-label="Настройки">
            {activeTab === "settings" ? "←" : "⚙"}
          </button>
        </div>
      </header>

      <section className="session-card">
        <div>
          <span className="metric-label">ШАГИ</span>
          <strong>{state.steps.length}</strong>
        </div>
        <div>
          <span className="metric-label">ВРЕМЯ</span>
          <strong>{duration}</strong>
        </div>
        <div>
          <span className="metric-label">HTTP</span>
          <strong>{state.networkEvents.length}</strong>
        </div>
        <div>
          <span className="metric-label">CONSOLE</span>
          <strong>{state.consoleEvents.length}</strong>
        </div>
      </section>

      <section className="controls">
        {!isActive ? (
          <>
            <button
              className="button button-primary"
              onClick={() => void run("START_RECORDING")}
            >
              ● Начать запись
            </button>

            {state.sessionId && (
              <button
                className="button button-secondary compact-wide"
                onClick={() => void confirmNewSession()}
              >
                Новая сессия
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="button button-secondary compact"
              onClick={() => void run("CAPTURE_SCREENSHOT")}
              title="Сделать скриншот"
            >
              📸 {state.screenshots.length}
            </button>

            <button
              className="button button-secondary compact"
              onClick={() => void run("TOGGLE_PAUSE")}
              title={state.status === "paused" ? "Продолжить" : "Пауза"}
            >
              {state.status === "paused" ? "▶" : "Ⅱ"}
            </button>

            <button
              className="button button-danger"
              onClick={() => void run("STOP_RECORDING")}
            >
              ■ Стоп
            </button>
          </>
        )}
      </section>

      <nav className="tabs" aria-label="Разделы Recorder">
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
        {(activeTab === "summary" || activeTab === "report") && (
          <div className="panel">
            {!state.sessionId ? (
              <div className="empty-state">
                Запусти запись и воспроизведи тестовый сценарий.
              </div>
            ) : (
              <>
                <div className="summary-grid">
                  <div>
                    <span>ДОМЕН</span>
                    <strong>{state.environment.domain || "—"}</strong>
                  </div>
                  <div>
                    <span>НАЧАЛО</span>
                    <strong>{formatClock(state.startedAt)}</strong>
                  </div>
                  <div>
                    <span>ЗАВЕРШЕНИЕ</span>
                    <strong>{formatClock(state.finishedAt)}</strong>
                  </div>
                  <div>
                    <span>VIEWPORT</span>
                    <strong>{state.environment.viewport || "—"}</strong>
                  </div>
                </div>

                <div className="environment-card">
                  <div><span>URL</span><strong>{state.environment.url || "—"}</strong></div>
                  <div><span>Browser</span><strong>{state.environment.browser || "—"}</strong></div>
                  <div><span>OS</span><strong>{state.environment.os || "—"}</strong></div>
                  <div><span>Locale</span><strong>{state.environment.language || "—"}</strong></div>
                </div>

                {activeTab === "summary" && state.status === "stopped" && (
                  <div className="post-stop-actions">
                    <button className="button button-primary" onClick={() => { setBuilderMode("bug"); setActiveTab("report"); }}>Создать Bug Report</button>
                    <button className="button button-secondary" onClick={() => { setBuilderMode("testcase"); setActiveTab("report"); }}>Test Case</button>
                    <button className="button button-secondary" onClick={() => { setBuilderMode("checklist"); setActiveTab("report"); }}>Checklist</button>
                  </div>
                )}

                {activeTab === "report" && state.status !== "stopped" && (
                  <div className="empty-state">Заверши запись, чтобы подготовить QA-артефакт.</div>
                )}

                {activeTab === "report" && state.status === "stopped" && (
                  <>
                    <div className="builder-switch">
                      <button className={builderMode === "bug" ? "active" : ""} onClick={() => setBuilderMode("bug")}>
                        Bug Report
                      </button>
                      <button className={builderMode === "testcase" ? "active" : ""} onClick={() => setBuilderMode("testcase")}>
                        Test Case
                      </button>
                      <button className={builderMode === "checklist" ? "active" : ""} onClick={() => setBuilderMode("checklist")}>
                        Checklist
                      </button>
                    </div>

                    {builderMode === "bug" && (
                      <div className="builder-card">
                        <div className="builder-head">
                          <div>
                            <p className="eyebrow">BUG REPORT</p>
                            <h2>Черновик бага</h2>
                          </div>
                          <div className="evidence-chips">
                            <span>👣 {state.steps.length}</span>
                            <span>🌐 {state.networkEvents.length}</span>
                            <span>⚠ {state.consoleEvents.length}</span>
                            <span>📸 {state.screenshots.length}</span>
                          </div>
                        </div>

                        <label>
                          <span>Название</span>
                          <input
                            value={state.bugReport.title}
                            onChange={(event) => updateBugField("title", event.target.value)}
                            onBlur={() => void saveBugReport()}
                            placeholder="Коротко опиши проблему"
                          />
                        </label>

                        <div className="field-grid">
                          <label>
                            <span>Severity</span>
                            <select
                              value={state.bugReport.severity}
                              onChange={(event) => updateBugField("severity", event.target.value)}
                              onBlur={() => void saveBugReport()}
                            >
                              <option>Blocker</option>
                              <option>Critical</option>
                              <option>Major</option>
                              <option>Minor</option>
                              <option>Trivial</option>
                            </select>
                          </label>

                          <label>
                            <span>Priority</span>
                            <select
                              value={state.bugReport.priority}
                              onChange={(event) => updateBugField("priority", event.target.value)}
                              onBlur={() => void saveBugReport()}
                            >
                              <option>High</option>
                              <option>Medium</option>
                              <option>Low</option>
                            </select>
                          </label>
                        </div>

                        <label>
                          <span>Предусловия</span>
                          <textarea
                            value={state.bugReport.preconditions}
                            onChange={(event) => updateBugField("preconditions", event.target.value)}
                            onBlur={() => void saveBugReport()}
                          />
                        </label>

                        <label>
                          <span>Фактический результат</span>
                          <textarea
                            value={state.bugReport.actualResult}
                            onChange={(event) => updateBugField("actualResult", event.target.value)}
                            onBlur={() => void saveBugReport()}
                          />
                        </label>

                        <label>
                          <span>Ожидаемый результат</span>
                          <textarea
                            value={state.bugReport.expectedResult}
                            onChange={(event) => updateBugField("expectedResult", event.target.value)}
                            onBlur={() => void saveBugReport()}
                          />
                        </label>

                        <label>
                          <span>Окружение</span>
                          <textarea
                            value={state.bugReport.environment}
                            onChange={(event) => updateBugField("environment", event.target.value)}
                            onBlur={() => void saveBugReport()}
                          />
                        </label>

                        <div className="builder-actions">
                          <button className="button button-primary" onClick={() => void copyText(buildBugDraft(state), "Bug Report скопирован")}>
                            Скопировать
                          </button>
                          <button className="button button-secondary" onClick={() => downloadFile(buildBugDraft(state), `qa-cat-bug-${state.sessionId}.md`, "text/markdown")}>
                            Markdown
                          </button>
                        </div>
                      </div>
                    )}

                    {builderMode === "testcase" && (
                      <div className="builder-card">
                        <div className="builder-head">
                          <div>
                            <p className="eyebrow">TEST CASE</p>
                            <h2>Test Case Builder</h2>
                          </div>
                          <span className="hint">steps берутся из recorded session</span>
                        </div>

                        <label>
                          <span>Название</span>
                          <input value={state.testCase.title} onChange={(event) => updateTestCaseField("title", event.target.value)} onBlur={() => void saveTestCase()} />
                        </label>

                        <div className="field-grid">
                          <label>
                            <span>Module / Feature</span>
                            <input value={state.testCase.module} onChange={(event) => updateTestCaseField("module", event.target.value)} onBlur={() => void saveTestCase()} />
                          </label>
                          <label>
                            <span>Type</span>
                            <select value={state.testCase.caseType} onChange={(event) => updateTestCaseField("caseType", event.target.value)} onBlur={() => void saveTestCase()}>
                              <option>Positive</option>
                              <option>Negative</option>
                              <option>Edge</option>
                            </select>
                          </label>
                        </div>

                        <label>
                          <span>Предусловия</span>
                          <textarea value={state.testCase.preconditions} onChange={(event) => updateTestCaseField("preconditions", event.target.value)} onBlur={() => void saveTestCase()} />
                        </label>

                        <label>
                          <span>Тестовые данные</span>
                          <textarea value={state.testCase.testData} onChange={(event) => updateTestCaseField("testData", event.target.value)} onBlur={() => void saveTestCase()} />
                        </label>

                        <label>
                          <span>Шаги</span>
                          <textarea
                            value={state.testCase.steps.join("\n")}
                            onChange={(event) => updateTestCaseField("steps", event.target.value.split("\n").filter(Boolean))}
                            onBlur={() => void saveTestCase()}
                          />
                        </label>

                        <label>
                          <span>Ожидаемый результат</span>
                          <textarea value={state.testCase.expectedResult} onChange={(event) => updateTestCaseField("expectedResult", event.target.value)} onBlur={() => void saveTestCase()} />
                        </label>

                        <div className="field-grid">
                          <label>
                            <span>Priority</span>
                            <select value={state.testCase.priority} onChange={(event) => updateTestCaseField("priority", event.target.value)} onBlur={() => void saveTestCase()}>
                              <option>High</option>
                              <option>Medium</option>
                              <option>Low</option>
                            </select>
                          </label>
                          <label>
                            <span>Tags</span>
                            <input value={state.testCase.tags} onChange={(event) => updateTestCaseField("tags", event.target.value)} onBlur={() => void saveTestCase()} placeholder="smoke, auth, regression" />
                          </label>
                        </div>

                        <div className="builder-actions">
                          <button className="button button-primary" onClick={() => void copyText(buildTestCaseDraft(state), "Test Case скопирован")}>
                            Скопировать
                          </button>
                          <button className="button button-secondary" onClick={() => downloadFile(buildTestCaseDraft(state), `qa-cat-test-case-${state.sessionId}.md`, "text/markdown")}>
                            Markdown
                          </button>
                        </div>
                      </div>
                    )}

                    {builderMode === "checklist" && (
                      <div className="builder-card">
                        <div className="builder-head">
                          <div>
                            <p className="eyebrow">CHECKLIST</p>
                            <h2>Checklist Builder</h2>
                          </div>
                          <button className="link-button" onClick={() => void addChecklistItem()}>
                            + пункт
                          </button>
                        </div>

                        <label>
                          <span>Название</span>
                          <input
                            value={state.checklist.title}
                            onChange={(event) =>
                              setState((current) => ({
                                ...current,
                                checklist: {
                                  ...current.checklist,
                                  title: event.target.value,
                                },
                              }))
                            }
                            onBlur={() => void updateChecklist(state.checklist)}
                          />
                        </label>

                        <div className="checklist-items">
                          {state.checklist.items.map((item) => (
                            <label className="checklist-item" key={item.id}>
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={(event) =>
                                  void updateChecklist({
                                    ...state.checklist,
                                    items: state.checklist.items.map((current) =>
                                      current.id === item.id
                                        ? { ...current, checked: event.target.checked }
                                        : current
                                    ),
                                  })
                                }
                              />
                              <span>{item.text}</span>
                              <button
                                type="button"
                                className="mini-button danger"
                                onClick={() =>
                                  void updateChecklist({
                                    ...state.checklist,
                                    items: state.checklist.items.filter((current) => current.id !== item.id),
                                  })
                                }
                              >
                                ×
                              </button>
                            </label>
                          ))}
                        </div>

                        <div className="builder-actions">
                          <button className="button button-primary" onClick={() => void copyText(buildChecklistDraft(state), "Checklist скопирован")}>
                            Скопировать
                          </button>
                          <button className="button button-secondary" onClick={() => downloadFile(buildChecklistDraft(state), `qa-cat-checklist-${state.sessionId}.md`, "text/markdown")}>
                            Markdown
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="draft-toolbar">
                      <button onClick={() => void rebuildBuilder()}>↻ Пересобрать draft</button>
                      <button onClick={() => void resetBuilder()}>Сбросить draft</button>
                      <button onClick={() => downloadFile(JSON.stringify(state, null, 2), `qa-cat-session-${state.sessionId}.json`, "application/json")}>
                        Экспорт JSON
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "steps" && (
          <div className="panel">
            <div className="section-heading">
              <h2>Все шаги</h2>
              <button className="link-button" onClick={() => void addManualStep()} disabled={!state.sessionId}>
                + Добавить вручную
              </button>
            </div>

            {state.steps.length === 0 ? (
              <div className="empty-state">Шагов пока нет.</div>
            ) : (
              <ol className="step-list">
                {state.steps.map((step, index) => (
                  <li className={step.important ? "step-row important" : "step-row"} key={step.id}>
                    <span className="step-index">{index + 1}</span>
                    <div className="row-main">
                      <strong>{step.label}</strong>
                      <small>{formatClock(step.timestamp)} · {safeUrl(step.url)?.hostname ?? "manual"}</small>
                      {step.note && <em>{step.note}</em>}
                    </div>
                    <div className="row-actions">
                      <button className={step.important ? "mini-button active" : "mini-button"} onClick={() => void run("UPDATE_STEP", { stepId: step.id, important: !step.important })}>★</button>
                      <button className="mini-button" onClick={() => void addStepNote(step)}>✎</button>
                      <button className="mini-button danger" onClick={() => void run("UPDATE_STEP", { stepId: step.id, delete: true })}>×</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {activeTab === "network" && (
          <div className="evidence-switch">
            <button className={evidenceView === "network" ? "active" : ""} onClick={() => setEvidenceView("network")}>Network <b>{state.networkEvents.length}</b></button>
            <button className={evidenceView === "console" ? "active" : ""} onClick={() => setEvidenceView("console")}>Console <b>{state.consoleEvents.length}</b></button>
          </div>
        )}

        {activeTab === "network" && evidenceView === "network" && (
          <div className="panel">
            <div className="section-heading">
              <h2>Network evidence</h2>
              <div className="filter-row">
                {(["all", "4xx", "5xx", "err", "slow"] as NetworkFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={networkFilter === filter ? "filter active" : "filter"}
                    onClick={() => setNetworkFilter(filter)}
                  >
                    {filter === "all" ? "Все" : filter.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="network-summary">
              <span>Slow threshold <strong>{state.settings.slowRequestThresholdMs} ms</strong></span>
              <span>Slow <strong>{state.networkEvents.filter((event) => event.slow).length}</strong></span>
            </div>

            {filteredNetwork.length === 0 ? (
              <div className="empty-state">Проблемных requests не зафиксировано.</div>
            ) : (
              <div className="evidence-list">
                {filteredNetwork.map((event) => {
                  const url = safeUrl(event.url);

                  return (
                    <div className={event.slow ? "evidence-row slow" : "evidence-row"} key={event.id}>
                      <span className="evidence-code">{event.statusCode ?? "ERR"}</span>
                      <div className="row-main">
                        <strong>{event.method} {url?.pathname ?? event.url}</strong>
                        <small>
                          {url?.hostname ?? event.error}
                          {typeof event.durationMs === "number" ? ` · ${event.durationMs} ms` : ""}
                          {event.resourceType ? ` · ${event.resourceType}` : ""}
                        </small>
                        {event.slow && <span className="slow-badge">Медленный request</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "network" && evidenceView === "console" && (
          <div className="panel">
            <div className="section-heading">
              <h2>Console evidence</h2>
              <span>{state.consoleEvents.length}</span>
            </div>

            {state.consoleEvents.length === 0 ? (
              <div className="empty-state">JavaScript errors не зафиксированы.</div>
            ) : (
              <div className="evidence-list">
                {state.consoleEvents.map((event) => (
                  <div className="evidence-row" key={event.id}>
                    <span className="evidence-code evidence-console">JS</span>
                    <div className="row-main">
                      <strong>{event.level}</strong>
                      <small>{event.message}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "screenshots" && (
          <div className="panel">
            <div className="section-heading">
              <h2>Скриншоты</h2>
              <span>{state.screenshots.length}/5</span>
            </div>

            {state.screenshots.length === 0 ? (
              <div className="empty-state">Скриншотов пока нет.</div>
            ) : (
              <div className="screenshot-grid">
                {state.screenshots.map((shot) => {
                  const linkedIndex = shot.stepId
                    ? state.steps.findIndex((step) => step.id === shot.stepId)
                    : -1;

                  return (
                    <article className={shot.attached === false ? "shot detached" : "shot"} key={shot.id}>
                      <a href={shot.dataUrl} target="_blank" rel="noreferrer">
                        <img src={shot.dataUrl} alt={`Screenshot ${formatClock(shot.timestamp)}`} />
                      </a>
                      <div className="shot-meta">
                        <span>
                          {formatClock(shot.timestamp)}
                          {linkedIndex >= 0 ? ` · step #${linkedIndex + 1}` : ""}
                        </span>
                        <div>
                          <button className={shot.attached === false ? "mini-button" : "mini-button active"} onClick={() => void run("UPDATE_SCREENSHOT", { screenshotId: shot.id, attached: shot.attached === false })}>✓</button>
                          <button className="mini-button danger" onClick={() => void run("UPDATE_SCREENSHOT", { screenshotId: shot.id, delete: true })}>×</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="panel settings-panel">
            <div className="section-heading">
              <h2>Настройки Recorder</h2>
              <span>v0.3.2</span>
            </div>

            <section className="settings-section theme-settings">
              <div>
                <strong>Тема</strong>
                <small>Выбери спокойный стиль рабочего пространства.</small>
              </div>
              <select
                value={state.settings.theme}
                onChange={(event) => void updateSetting({ theme: event.target.value as RecorderSettings["theme"] })}
              >
                <option value="night">Night QA</option>
                <option value="cafe">Cat Café</option>
                <option value="violet">Debug Violet</option>
              </select>
            </section>

            <section className="settings-section settings-threshold">
              <div>
                <strong>Slow request threshold</strong>
                <small>Успешные requests медленнее порога попадут в Network evidence.</small>
              </div>
              <select
                value={state.settings.slowRequestThresholdMs}
                onChange={(event) => void updateSetting({ slowRequestThresholdMs: Number(event.target.value) })}
              >
                <option value={1000}>1 000 ms</option>
                <option value={1500}>1 500 ms</option>
                <option value={2000}>2 000 ms</option>
                <option value={3000}>3 000 ms</option>
                <option value={5000}>5 000 ms</option>
              </select>
            </section>

            <section className="settings-section mascot-settings">
              <div>
                <strong>QA Cat</strong>
                <small>Активность кота не влияет на запись evidence.</small>
              </div>
              <select value={state.settings.mascotActivity} onChange={(event) => void updateSetting({ mascotActivity: event.target.value as RecorderSettings["mascotActivity"] })}>
                <option value="off">Выкл</option>
                <option value="calm">Спокойный</option>
                <option value="active">Активный</option>
              </select>
            </section>

            <section className="settings-section motion-settings">
              <div>
                <strong>Анимации</strong>
                <small>По умолчанию учитывается системный reduced motion.</small>
              </div>
              <select value={state.settings.reducedMotionOverride} onChange={(event) => void updateSetting({ reducedMotionOverride: event.target.value as RecorderSettings["reducedMotionOverride"] })}>
                <option value="system">Системные</option>
                <option value="on">Уменьшить</option>
                <option value="off">Разрешить</option>
              </select>
            </section>

            <aside className="settings-privacy">
              <strong>Хранение данных</strong>
              <p>
                Steps, Network/Console metadata и screenshots хранятся локально в chrome.storage.local.
                Ничего не отправляется на backend.
              </p>
            </aside>
          </div>
        )}
      </section>

      <aside className="privacy-note">🛡 Локальное хранение</aside>

      <Mascot
        activity={state.settings.mascotActivity}
        reducedMotionOverride={state.settings.reducedMotionOverride}
        recording={state.status === "recording"}
        position={state.settings.mascotPosition}
        onPositionChange={(mascotPosition) => void updateSetting({ mascotPosition })}
      />

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
