import { migrateRecorderState } from "../shared/stateMigration.js";
import { normalizeControllerPosition } from "../shared/controller.js";
import { normalizeRecorderTheme } from "../shared/theme.js";

(() => {
  const STORAGE_KEY = "qaBuddyRecorderState";
  const MAX_STEPS = 500;
  const MAX_NETWORK_EVENTS = 100;
  const MAX_CONSOLE_EVENTS = 50;
  const MAX_SCREENSHOTS = 5;
  const SENSITIVE_QUERY_KEY = /(token|auth|key|secret|password|session|code)/i;
  const requestStartedAt = new Map<string, number>();

  const defaultEnvironment = (): EnvironmentInfo => ({
    url: "",
    domain: "",
    browser: "",
    os: "",
    viewport: "",
    language: "ru",
    capturedAt: null,
  });

  const defaultSettings = (): RecorderSettings => ({
    theme: "night",
    mascotActivity: "calm",
    controllerPosition: null,
    controllerCollapsed: true,
    slowRequestThresholdMs: 2000,
    reducedMotionOverride: "system",
    locale: "ru",
    mascotEnabled: true,
    reducedMotion: false,
    funMode: false,
    mascotPosition: null,
  });

  const defaultBugReport = (): BugReportDraft => ({
    title: "",
    preconditions: "",
    actualResult: "",
    expectedResult: "",
    environment: "",
    severity: "Major",
    priority: "Medium",
  });

  const defaultTestCase = (): TestCaseDraft => ({
    title: "",
    module: "",
    preconditions: "",
    testData: "",
    steps: [],
    expectedResult: "",
    priority: "Medium",
    caseType: "Positive",
    tags: "",
  });

  const defaultChecklist = (): ChecklistDraft => ({
    title: "",
    items: [],
  });

  const defaultState = (): RecorderState => ({
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
    environment: defaultEnvironment(),
    bugReport: defaultBugReport(),
    testCase: defaultTestCase(),
    checklist: defaultChecklist(),
    settings: defaultSettings(),
  });

  function normalizeState(raw?: Partial<RecorderState>): RecorderState {
    const base = defaultState();
    const merged = {
      ...base,
      ...raw,
      environment: { ...base.environment, ...(raw?.environment ?? {}) },
      bugReport: { ...base.bugReport, ...(raw?.bugReport ?? {}) },
      testCase: { ...base.testCase, ...(raw?.testCase ?? {}), steps: raw?.testCase?.steps ?? [] },
      checklist: { ...base.checklist, ...(raw?.checklist ?? {}), items: raw?.checklist?.items ?? [] },
      settings: { ...base.settings, ...(raw?.settings ?? {}) },
    };
    return migrateRecorderState(merged) as RecorderState;
  }

  async function loadState(): Promise<RecorderState> {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeState(data[STORAGE_KEY] as Partial<RecorderState> | undefined);
  }

  async function saveState(state: RecorderState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  function safeUrl(rawUrl: string): string {
    try {
      const url = new URL(rawUrl);
      url.hash = "";

      for (const key of Array.from(url.searchParams.keys())) {
        if (SENSITIVE_QUERY_KEY.test(key)) {
          url.searchParams.set(key, "[redacted]");
        }
      }

      return url.toString().slice(0, 1200);
    } catch {
      return rawUrl.slice(0, 1200);
    }
  }

  function browserFromUserAgent(userAgent: string): string {
    const edge = userAgent.match(/Edg\/([\d.]+)/);
    if (edge) return `Edge ${edge[1]}`;

    const chrome = userAgent.match(/Chrome\/([\d.]+)/);
    if (chrome) return `Chrome ${chrome[1]}`;

    const firefox = userAgent.match(/Firefox\/([\d.]+)/);
    if (firefox) return `Firefox ${firefox[1]}`;

    const safari = userAgent.match(/Version\/([\d.]+).*Safari/);
    if (safari) return `Safari ${safari[1]}`;

    return "Не определён";
  }

  function osFromUserAgent(userAgent: string): string {
    if (/Mac OS X/i.test(userAgent)) {
      const version = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replaceAll("_", ".");
      return version ? `macOS ${version}` : "macOS";
    }

    if (/Windows NT/i.test(userAgent)) return "Windows";
    if (/Android/i.test(userAgent)) return "Android";
    if (/Linux/i.test(userAgent)) return "Linux";
    return "Не определена";
  }

  function environmentText(environment: EnvironmentInfo): string {
    return [
      `URL: ${environment.url || "—"}`,
      `Browser: ${environment.browser || "—"}`,
      `OS: ${environment.os || "—"}`,
      `Viewport: ${environment.viewport || "—"}`,
      `Locale: ${environment.language || "—"}`,
    ].join("\n");
  }

  async function collectEnvironment(
    tab: chrome.tabs.Tab
  ): Promise<EnvironmentInfo> {
    const userAgent = navigator.userAgent;

    let domain = "";
    try {
      domain = tab.url ? new URL(tab.url).hostname : "";
    } catch {
      domain = "";
    }

    return {
      url: safeUrl(tab.url ?? ""),
      domain,
      browser: browserFromUserAgent(userAgent),
      os: osFromUserAgent(userAgent),
      viewport:
        typeof tab.width === "number" && typeof tab.height === "number"
          ? `${tab.width}×${tab.height}`
          : "—",
      language: navigator.language || "ru",
      capturedAt: Date.now(),
    };
  }

  function pageLabel(url: string): string {
    try {
      const parsed = new URL(url);
      const target = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
      return `Открыть ${target}`;
    } catch {
      return "Открыть страницу";
    }
  }

  function makeStep(
    type: RecorderStep["type"],
    label: string,
    url: string
  ): RecorderStep {
    return {
      id: crypto.randomUUID(),
      type,
      label: label.slice(0, 180),
      url: safeUrl(url),
      timestamp: Date.now(),
      note: "",
      important: false,
    };
  }

  function checklistFromSteps(steps: RecorderStep[]): ChecklistItem[] {
    return steps.map((step) => ({
      id: crypto.randomUUID(),
      text: step.label,
      checked: false,
    }));
  }

  function rebuildDraft(
    state: RecorderState,
    mode: BuilderMode
  ): RecorderState {
    const domain = state.environment.domain || "проверяемого функционала";
    const stepLabels = state.steps.map((step) => step.label);

    if (mode === "bug") {
      state.bugReport = {
        ...defaultBugReport(),
        title: state.bugReport.title || "",
        environment: environmentText(state.environment),
      };
    }

    if (mode === "testcase") {
      state.testCase = {
        ...defaultTestCase(),
        title: `Проверка ${domain}`,
        module: domain,
        steps: stepLabels,
      };
    }

    if (mode === "checklist") {
      state.checklist = {
        title: `Чек-лист: ${domain}`,
        items: checklistFromSteps(state.steps),
      };
    }

    return state;
  }

  function resetDraft(
    state: RecorderState,
    mode: BuilderMode
  ): RecorderState {
    if (mode === "bug") state.bugReport = defaultBugReport();
    if (mode === "testcase") state.testCase = defaultTestCase();
    if (mode === "checklist") state.checklist = defaultChecklist();
    return state;
  }

  function contentState(state: RecorderState): RecorderState {
    return {
      ...state,
      networkEvents: [],
      consoleEvents: [],
      screenshots: [],
    };
  }

  function notifyTarget(state: RecorderState): void {
    if (state.targetTabId === null) return;

    chrome.tabs.sendMessage(
      state.targetTabId,
      { type: "STATE_UPDATED", state: contentState(state) },
      () => void chrome.runtime.lastError
    );
  }

  async function startRecording(): Promise<RecorderState> {
    const previous = await loadState();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
      throw new Error("Открой обычную http/https страницу перед запуском записи.");
    }

    const now = Date.now();
    const environment = await collectEnvironment(tab);

    const state: RecorderState = {
      ...defaultState(),
      status: "recording",
      sessionId: crypto.randomUUID(),
      targetTabId: tab.id,
      startedAt: now,
      settings: {
        ...previous.settings,
        locale: "ru",
      },
      environment,
      bugReport: {
        ...defaultBugReport(),
        environment: environmentText(environment),
      },
      steps: [makeStep("page", pageLabel(tab.url), tab.url)],
    };

    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function togglePause(): Promise<RecorderState> {
    const state = await loadState();
    const now = Date.now();

    if (state.status === "recording") {
      state.status = "paused";
      state.pausedAt = now;
    } else if (state.status === "paused") {
      state.accumulatedPausedMs += state.pausedAt ? now - state.pausedAt : 0;
      state.pausedAt = null;
      state.status = "recording";
    }

    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function stopRecording(): Promise<RecorderState> {
    const state = await loadState();

    if (state.status === "recording" || state.status === "paused") {
      const now = Date.now();

      if (state.status === "recording") {
        state.pausedAt = now;
      }

      state.finishedAt = now;
      state.status = "stopped";

      if (state.testCase.steps.length === 0) {
        rebuildDraft(state, "testcase");
      }

      if (state.checklist.items.length === 0) {
        rebuildDraft(state, "checklist");
      }

      if (!state.bugReport.environment) {
        state.bugReport.environment = environmentText(state.environment);
      }

      await saveState(state);
      notifyTarget(state);
    }

    return state;
  }

  async function newSession(): Promise<RecorderState> {
    const previous = await loadState();
    const state = defaultState();

    state.settings = {
      ...previous.settings,
      locale: "ru",
    };

    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function addStep(
    message: { step?: Partial<RecorderStep> },
    sender: chrome.runtime.MessageSender
  ): Promise<RecorderState> {
    const state = await loadState();

    if (
      state.status !== "recording" ||
      !sender.tab?.id ||
      sender.tab.id !== state.targetTabId ||
      !message.step?.type ||
      !message.step.label ||
      !message.step.url
    ) {
      return state;
    }

    const incoming = makeStep(
      message.step.type,
      message.step.label,
      message.step.url
    );

    const previous = state.steps[state.steps.length - 1];
    const isDuplicate =
      previous &&
      previous.type === incoming.type &&
      previous.label === incoming.label &&
      previous.url === incoming.url &&
      incoming.timestamp - previous.timestamp < 600;

    if (!isDuplicate) {
      state.steps = [...state.steps, incoming].slice(-MAX_STEPS);
      await saveState(state);
      notifyTarget(state);
    }

    return state;
  }

  async function addManualStep(
    message: { label?: string }
  ): Promise<RecorderState> {
    const state = await loadState();

    if (!state.sessionId || !message.label?.trim()) {
      return state;
    }

    let url = "";
    if (state.targetTabId !== null) {
      try {
        const tab = await chrome.tabs.get(state.targetTabId);
        url = tab.url ?? "";
      } catch {
        url = "";
      }
    }

    state.steps = [
      ...state.steps,
      makeStep("manual", message.label.trim(), url),
    ].slice(-MAX_STEPS);

    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function updateStep(
    message: {
      stepId?: string;
      note?: string;
      important?: boolean;
      delete?: boolean;
    }
  ): Promise<RecorderState> {
    const state = await loadState();
    if (!message.stepId) return state;

    if (message.delete) {
      state.steps = state.steps.filter((step) => step.id !== message.stepId);
    } else {
      state.steps = state.steps.map((step) =>
        step.id === message.stepId
          ? {
              ...step,
              note: message.note ?? step.note,
              important: message.important ?? step.important,
            }
          : step
      );
    }

    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function addConsoleEvent(
    message: {
      consoleEvent?: {
        level?: RecorderConsoleEvent["level"];
        message?: string;
        url?: string;
      };
    },
    sender: chrome.runtime.MessageSender
  ): Promise<RecorderState> {
    const state = await loadState();
    const event = message.consoleEvent;

    if (
      state.status !== "recording" ||
      !sender.tab?.id ||
      sender.tab.id !== state.targetTabId ||
      !event?.level ||
      !event.message
    ) {
      return state;
    }

    state.consoleEvents = [
      ...state.consoleEvents,
      {
        id: crypto.randomUUID(),
        level: event.level,
        message: event.message.slice(0, 500),
        url: safeUrl(event.url ?? sender.tab.url ?? ""),
        timestamp: Date.now(),
      },
    ].slice(-MAX_CONSOLE_EVENTS);

    await saveState(state);
    return state;
  }

  async function captureScreenshot(): Promise<RecorderState> {
    const state = await loadState();

    if (state.status !== "recording" && state.status !== "paused") {
      throw new Error("Сначала запусти запись.");
    }

    if (state.targetTabId === null) {
      throw new Error("Тестируемая вкладка не найдена.");
    }

    const tab = await chrome.tabs.get(state.targetTabId);

    if (!tab.active) {
      throw new Error("Вернись на тестируемую вкладку перед скриншотом.");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 70,
    });

    state.screenshots = [
      ...state.screenshots,
      {
        id: crypto.randomUUID(),
        dataUrl,
        url: safeUrl(tab.url ?? ""),
        timestamp: Date.now(),
        attached: true,
        stepId: state.steps.at(-1)?.id ?? null,
      },
    ].slice(-MAX_SCREENSHOTS);

    await saveState(state);
    return state;
  }

  async function updateScreenshot(
    message: {
      screenshotId?: string;
      attached?: boolean;
      delete?: boolean;
      stepId?: string | null;
    }
  ): Promise<RecorderState> {
    const state = await loadState();
    if (!message.screenshotId) return state;

    if (message.delete) {
      state.screenshots = state.screenshots.filter(
        (item) => item.id !== message.screenshotId
      );
    } else {
      state.screenshots = state.screenshots.map((item) =>
        item.id === message.screenshotId
          ? {
              ...item,
              attached: message.attached ?? item.attached,
              stepId:
                message.stepId !== undefined
                  ? message.stepId
                  : item.stepId,
            }
          : item
      );
    }

    await saveState(state);
    return state;
  }

  async function updateSettings(
    message: { settings?: Partial<RecorderSettings> }
  ): Promise<RecorderState> {
    const state = await loadState();
    const next = {
      ...state.settings,
      ...(message.settings ?? {}),
      locale: "ru" as RecorderLocale,
    };

    const threshold = Number(next.slowRequestThresholdMs);
    next.slowRequestThresholdMs = Number.isFinite(threshold)
      ? Math.min(30000, Math.max(250, Math.round(threshold)))
      : 2000;

    if (next.mascotPosition) {
      next.mascotPosition = {
        x: Math.max(0, Math.round(next.mascotPosition.x)),
        y: Math.max(0, Math.round(next.mascotPosition.y)),
      };
    }

    next.theme = normalizeRecorderTheme(next.theme);
    next.controllerPosition = normalizeControllerPosition(next.controllerPosition);
    next.controllerCollapsed = Boolean(next.controllerCollapsed);

    state.settings = next;
    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function updateBugReport(
    message: { bugReport?: Partial<BugReportDraft> }
  ): Promise<RecorderState> {
    const state = await loadState();
    state.bugReport = {
      ...state.bugReport,
      ...(message.bugReport ?? {}),
    };
    await saveState(state);
    return state;
  }

  async function updateTestCase(
    message: { testCase?: Partial<TestCaseDraft> }
  ): Promise<RecorderState> {
    const state = await loadState();
    state.testCase = {
      ...state.testCase,
      ...(message.testCase ?? {}),
      steps: message.testCase?.steps ?? state.testCase.steps,
    };
    await saveState(state);
    return state;
  }

  async function updateChecklist(
    message: { checklist?: Partial<ChecklistDraft> }
  ): Promise<RecorderState> {
    const state = await loadState();
    state.checklist = {
      ...state.checklist,
      ...(message.checklist ?? {}),
      items: message.checklist?.items ?? state.checklist.items,
    };
    await saveState(state);
    return state;
  }

  async function resetBuilder(
    message: { mode?: BuilderMode }
  ): Promise<RecorderState> {
    const state = await loadState();
    const mode = message.mode ?? "bug";
    resetDraft(state, mode);
    await saveState(state);
    return state;
  }

  async function rebuildBuilder(
    message: { mode?: BuilderMode }
  ): Promise<RecorderState> {
    const state = await loadState();
    const mode = message.mode ?? "bug";
    rebuildDraft(state, mode);
    await saveState(state);
    return state;
  }

  async function appendNetworkEvent(
    event: Omit<RecorderNetworkEvent, "id" | "timestamp">,
    tabId: number
  ): Promise<void> {
    const state = await loadState();
    if (state.status !== "recording" || state.targetTabId !== tabId) return;

    state.networkEvents = [
      ...state.networkEvents,
      {
        ...event,
        id: crypto.randomUUID(),
        url: safeUrl(event.url),
        timestamp: Date.now(),
      },
    ].slice(-MAX_NETWORK_EVENTS);

    await saveState(state);
  }

  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0 || !/^https?:/i.test(details.url)) return;

      if (requestStartedAt.size > 2000) {
        requestStartedAt.clear();
      }

      requestStartedAt.set(details.requestId, details.timeStamp);
    },
    { urls: ["<all_urls>"] }
  );

  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (details.tabId < 0 || !/^https?:/i.test(details.url)) return;

      const startedAt = requestStartedAt.get(details.requestId);
      requestStartedAt.delete(details.requestId);

      const durationMs =
        typeof startedAt === "number"
          ? Math.max(0, Math.round(details.timeStamp - startedAt))
          : undefined;

      void loadState().then((state) => {
        if (
          state.status !== "recording" ||
          state.targetTabId !== details.tabId
        ) {
          return;
        }

        const slow =
          typeof durationMs === "number" &&
          durationMs >= state.settings.slowRequestThresholdMs;

        if (details.statusCode < 400 && !slow) return;

        return appendNetworkEvent(
          {
            method: details.method,
            url: details.url,
            statusCode: details.statusCode,
            durationMs,
            slow,
            resourceType: String(details.type),
          },
          details.tabId
        );
      });
    },
    { urls: ["<all_urls>"] }
  );

  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      if (
        details.tabId < 0 ||
        details.error === "net::ERR_ABORTED" ||
        !/^https?:/i.test(details.url)
      ) {
        return;
      }

      const startedAt = requestStartedAt.get(details.requestId);
      requestStartedAt.delete(details.requestId);

      const durationMs =
        typeof startedAt === "number"
          ? Math.max(0, Math.round(details.timeStamp - startedAt))
          : undefined;

      void appendNetworkEvent(
        {
          method: details.method,
          url: details.url,
          error: details.error,
          durationMs,
          slow: false,
          resourceType: String(details.type),
        },
        details.tabId
      );
    },
    { urls: ["<all_urls>"] }
  );

  async function openSidePanel(sender: chrome.runtime.MessageSender): Promise<void> {
    const tabId = sender.tab?.id;
    if (!tabId) throw new Error("Не удалось определить вкладку для Side Panel.");
    await chrome.sidePanel.open({ tabId });
  }

  async function configureSidePanel(): Promise<void> {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  async function handleMessage(
    message: {
      type?: string;
      step?: Partial<RecorderStep>;
      label?: string;
      stepId?: string;
      note?: string;
      important?: boolean;
      delete?: boolean;
      screenshotId?: string;
      attached?: boolean;
      settings?: Partial<RecorderSettings>;
      bugReport?: Partial<BugReportDraft>;
      testCase?: Partial<TestCaseDraft>;
      checklist?: Partial<ChecklistDraft>;
      mode?: BuilderMode;
      consoleEvent?: {
        level?: RecorderConsoleEvent["level"];
        message?: string;
        url?: string;
      };
    },
    sender: chrome.runtime.MessageSender
  ) {
    switch (message.type) {
      case "OPEN_PANEL":
        await openSidePanel(sender);
        return { state: await loadState() };
      case "GET_STATE": {
        const state = await loadState();
        return {
          state,
          isTargetTab:
            !sender.tab?.id ||
            sender.tab.id === state.targetTabId,
        };
      }
      case "START_RECORDING":
        return { state: await startRecording() };
      case "TOGGLE_PAUSE":
        return { state: await togglePause() };
      case "STOP_RECORDING":
        return { state: await stopRecording() };
      case "NEW_SESSION":
      case "CLEAR_SESSION":
        return { state: await newSession() };
      case "CAPTURE_SCREENSHOT":
        return { state: await captureScreenshot() };
      case "RECORDER_EVENT":
        return { state: await addStep(message, sender) };
      case "RECORDER_CONSOLE":
        return { state: await addConsoleEvent(message, sender) };
      case "ADD_MANUAL_STEP":
        return { state: await addManualStep(message) };
      case "UPDATE_STEP":
        return { state: await updateStep(message) };
      case "UPDATE_SCREENSHOT":
        return { state: await updateScreenshot(message) };
      case "UPDATE_SETTINGS":
        return { state: await updateSettings(message) };
      case "UPDATE_BUG_REPORT":
        return { state: await updateBugReport(message) };
      case "UPDATE_TEST_CASE":
        return { state: await updateTestCase(message) };
      case "UPDATE_CHECKLIST":
        return { state: await updateChecklist(message) };
      case "RESET_BUILDER":
        return { state: await resetBuilder(message) };
      case "REBUILD_BUILDER":
        return { state: await rebuildBuilder(message) };
      default:
        return { state: await loadState() };
    }
  }

  chrome.runtime.onInstalled.addListener(() => {
    void configureSidePanel();
    void loadState().then((state) => void saveState(state));
  });

  chrome.runtime.onStartup.addListener(() => {
    void configureSidePanel();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleMessage(message, sender)
      .then(sendResponse)
      .catch(async (error: unknown) => {
        sendResponse({
          state: await loadState(),
          error:
            error instanceof Error
              ? error.message
              : "Ошибка Recorder",
        });
      });

    return true;
  });
})();
