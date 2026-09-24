(() => {
  const STORAGE_KEY = "qaBuddyRecorderState";
  const MAX_STEPS = 500;
  const MAX_NETWORK_EVENTS = 100;
  const MAX_CONSOLE_EVENTS = 50;
  const MAX_SCREENSHOTS = 5;
  const SENSITIVE_QUERY_KEY = /(token|auth|key|secret|password|session|code)/i;
  const requestStartedAt = new Map<string, number>();

  const defaultSettings = (): RecorderSettings => ({
    locale: "ru",
    mascotEnabled: true,
    reducedMotion: false,
    funMode: false,
    slowRequestThresholdMs: 2000,
  });

  const defaultBugReport = (): BugReportDraft => ({
    title: "",
    preconditions: "",
    actualResult: "",
    expectedResult: "",
    environment: "",
  });

  const defaultState = (): RecorderState => ({
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
    bugReport: defaultBugReport(),
    settings: defaultSettings(),
  });

  function normalizeState(raw?: Partial<RecorderState>): RecorderState {
    const base = defaultState();
    return {
      ...base,
      ...raw,
      schemaVersion: 2,
      steps: (raw?.steps ?? []).map((step) => ({
        ...step,
        note: step.note ?? "",
        important: step.important ?? false,
      })),
      networkEvents: raw?.networkEvents ?? [],
      consoleEvents: raw?.consoleEvents ?? [],
      screenshots: (raw?.screenshots ?? []).map((item) => ({
        ...item,
        attached: item.attached ?? true,
      })),
      bugReport: { ...base.bugReport, ...(raw?.bugReport ?? {}) },
      settings: { ...base.settings, ...(raw?.settings ?? {}) },
      finishedAt: raw?.finishedAt ?? null,
    };
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

  function pageLabel(url: string, locale: RecorderLocale): string {
    try {
      const parsed = new URL(url);
      const target = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
      return locale === "ru" ? `Открыть ${target}` : `Open ${target}`;
    } catch {
      return locale === "ru" ? "Открыть страницу" : "Open page";
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
      throw new Error(
        previous.settings.locale === "ru"
          ? "Открой обычную http/https страницу перед запуском записи."
          : "Open a regular http/https page before starting the recorder."
      );
    }

    const now = Date.now();
    const state: RecorderState = {
      ...defaultState(),
      status: "recording",
      sessionId: crypto.randomUUID(),
      targetTabId: tab.id,
      startedAt: now,
      settings: previous.settings,
      bugReport: {
        ...defaultBugReport(),
        environment: navigator.userAgent,
      },
      steps: [makeStep("page", pageLabel(tab.url, previous.settings.locale), tab.url)],
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
      if (state.status === "recording") state.pausedAt = now;
      state.finishedAt = now;
      state.status = "stopped";
      await saveState(state);
      notifyTarget(state);
    }

    return state;
  }

  async function clearSession(): Promise<RecorderState> {
    const previous = await loadState();
    const state = defaultState();
    state.settings = previous.settings;
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

  async function addManualStep(message: { label?: string }): Promise<RecorderState> {
    const state = await loadState();
    if (!state.sessionId || !message.label?.trim()) return state;

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
    message: { stepId?: string; note?: string; important?: boolean; delete?: boolean }
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
      throw new Error(
        state.settings.locale === "ru"
          ? "Сначала запусти запись."
          : "Start a recording session first."
      );
    }

    if (state.targetTabId === null) {
      throw new Error(
        state.settings.locale === "ru"
          ? "Тестируемая вкладка не найдена."
          : "Recorded tab was not found."
      );
    }

    const tab = await chrome.tabs.get(state.targetTabId);
    if (!tab.active) {
      throw new Error(
        state.settings.locale === "ru"
          ? "Вернись на тестируемую вкладку перед скриншотом."
          : "Return to the recorded tab before taking a screenshot."
      );
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
      },
    ].slice(-MAX_SCREENSHOTS);

    await saveState(state);
    return state;
  }

  async function updateScreenshot(
    message: { screenshotId?: string; attached?: boolean; delete?: boolean }
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
          ? { ...item, attached: message.attached ?? item.attached }
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
    const next = { ...state.settings, ...(message.settings ?? {}) };

    const threshold = Number(next.slowRequestThresholdMs);
    next.slowRequestThresholdMs = Number.isFinite(threshold)
      ? Math.min(30000, Math.max(250, Math.round(threshold)))
      : 2000;

    state.settings = next;
    await saveState(state);
    notifyTarget(state);
    return state;
  }

  async function updateBugReport(
    message: { bugReport?: Partial<BugReportDraft> }
  ): Promise<RecorderState> {
    const state = await loadState();
    state.bugReport = { ...state.bugReport, ...(message.bugReport ?? {}) };
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
      consoleEvent?: {
        level?: RecorderConsoleEvent["level"];
        message?: string;
        url?: string;
      };
    },
    sender: chrome.runtime.MessageSender
  ) {
    switch (message.type) {
      case "GET_STATE":
        return {
          state: await loadState(),
          isTargetTab:
            !sender.tab?.id ||
            sender.tab.id === (await loadState()).targetTabId,
        };
      case "START_RECORDING":
        return { state: await startRecording() };
      case "TOGGLE_PAUSE":
        return { state: await togglePause() };
      case "STOP_RECORDING":
        return { state: await stopRecording() };
      case "CLEAR_SESSION":
        return { state: await clearSession() };
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
      default:
        return { state: await loadState() };
    }
  }

  chrome.runtime.onInstalled.addListener(() => {
    void loadState().then((state) => void saveState(state));
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleMessage(message, sender)
      .then(sendResponse)
      .catch(async (error: unknown) => {
        sendResponse({
          state: await loadState(),
          error: error instanceof Error ? error.message : "Recorder error",
        });
      });
    return true;
  });
})();
