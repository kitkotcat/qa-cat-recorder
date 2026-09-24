(() => {
  const STORAGE_KEY = "qaBuddyRecorderState";
  const MAX_STEPS = 500;
  const MAX_NETWORK_EVENTS = 100;
  const MAX_CONSOLE_EVENTS = 50;
  const MAX_SCREENSHOTS = 5;
  const SENSITIVE_QUERY_KEY = /(token|auth|key|secret|password|session|code)/i;

  const defaultState = (): RecorderState => ({
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
  });

  function normalizeState(raw?: Partial<RecorderState>): RecorderState {
    return {
      ...defaultState(),
      ...raw,
      steps: raw?.steps ?? [],
      networkEvents: raw?.networkEvents ?? [],
      consoleEvents: raw?.consoleEvents ?? [],
      screenshots: raw?.screenshots ?? [],
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
    };
  }

  function pageLabel(url: string): string {
    try {
      const parsed = new URL(url);
      return `Open ${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
      return "Open page";
    }
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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
      throw new Error("Open a regular http/https page before starting the recorder.");
    }

    const now = Date.now();
    const state: RecorderState = {
      ...defaultState(),
      status: "recording",
      sessionId: crypto.randomUUID(),
      targetTabId: tab.id,
      startedAt: now,
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
      if (state.status === "recording") {
        state.pausedAt = Date.now();
      }

      state.status = "stopped";
      await saveState(state);
      notifyTarget(state);
    }

    return state;
  }

  async function clearSession(): Promise<RecorderState> {
    const state = defaultState();
    await saveState(state);
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

    const item: RecorderConsoleEvent = {
      id: crypto.randomUUID(),
      level: event.level,
      message: event.message.slice(0, 500),
      url: safeUrl(event.url ?? sender.tab.url ?? ""),
      timestamp: Date.now(),
    };

    state.consoleEvents = [...state.consoleEvents, item].slice(-MAX_CONSOLE_EVENTS);
    await saveState(state);
    return state;
  }

  async function captureScreenshot(): Promise<RecorderState> {
    const state = await loadState();

    if (
      state.status !== "recording" &&
      state.status !== "paused"
    ) {
      throw new Error("Start a recording session before taking a screenshot.");
    }

    if (state.targetTabId === null) {
      throw new Error("Recorded tab was not found.");
    }

    const tab = await chrome.tabs.get(state.targetTabId);

    if (!tab.active) {
      throw new Error("Return to the recorded tab before taking a screenshot.");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 70,
    });

    const screenshot: RecorderScreenshot = {
      id: crypto.randomUUID(),
      dataUrl,
      url: safeUrl(tab.url ?? ""),
      timestamp: Date.now(),
    };

    state.screenshots = [...state.screenshots, screenshot].slice(-MAX_SCREENSHOTS);
    await saveState(state);
    return state;
  }

  async function appendNetworkEvent(
    event: Omit<RecorderNetworkEvent, "id" | "timestamp">,
    tabId: number
  ): Promise<void> {
    const state = await loadState();

    if (
      state.status !== "recording" ||
      state.targetTabId !== tabId
    ) {
      return;
    }

    const item: RecorderNetworkEvent = {
      ...event,
      id: crypto.randomUUID(),
      url: safeUrl(event.url),
      timestamp: Date.now(),
    };

    state.networkEvents = [...state.networkEvents, item].slice(-MAX_NETWORK_EVENTS);
    await saveState(state);
  }

  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (
        details.tabId < 0 ||
        details.statusCode < 400 ||
        !/^https?:/i.test(details.url)
      ) {
        return;
      }

      void appendNetworkEvent(
        {
          method: details.method,
          url: details.url,
          statusCode: details.statusCode,
        },
        details.tabId
      );
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

      void appendNetworkEvent(
        {
          method: details.method,
          url: details.url,
          error: details.error,
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
      consoleEvent?: {
        level?: RecorderConsoleEvent["level"];
        message?: string;
        url?: string;
      };
    },
    sender: chrome.runtime.MessageSender
  ) {
    switch (message.type) {
      case "GET_STATE": {
        const state = await loadState();
        return {
          state,
          isTargetTab:
            !sender.tab?.id || sender.tab.id === state.targetTabId,
        };
      }
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
      default:
        return { state: await loadState() };
    }
  }

  chrome.runtime.onInstalled.addListener(() => {
    void loadState().then((state) => {
      if (!state.sessionId) {
        void saveState(defaultState());
      }
    });
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
              : "Recorder error",
        });
      });

    return true;
  });
})();
