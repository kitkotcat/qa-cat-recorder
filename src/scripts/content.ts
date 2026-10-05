(() => {
  const HOST_ID = "qa-cat-recorder-root";
  let state: RecorderState | null = null;
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let lastUrl = location.href;
  let controllerActionInFlight = false;
  const dirtyFields = new Set<Element>();

  function active() {
    return state?.status === "recording" || state?.status === "paused";
  }

  function shouldShowController() {
    return Boolean(state?.sessionId) && (active() || state?.status === "stopped");
  }

  function describeElement(element: Element): string {
    const aria = element.getAttribute("aria-label")?.trim();
    const title = element.getAttribute("title")?.trim();
    const name = element.getAttribute("name")?.trim();
    const id = element.getAttribute("id")?.trim();
    const placeholder = element.getAttribute("placeholder")?.trim();
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

    return (
      aria ||
      title ||
      (text && text.length <= 80 ? text : "") ||
      placeholder ||
      name ||
      id ||
      element.tagName.toLowerCase()
    );
  }

  function clickableTarget(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;

    return target.closest(
      "button, a, [role='button'], input[type='button'], input[type='submit'], summary, label"
    );
  }

  function fieldTarget(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    return target.closest('input, textarea, select, [contenteditable="true"]');
  }

  function describeField(element: Element): string {
    const aria = element.getAttribute("aria-label")?.trim();
    if (aria) return aria;

    const labelledBy = element.getAttribute("aria-labelledby")?.trim();
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }

    const id = element.getAttribute("id")?.trim();
    if (id) {
      const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
      const label = document.querySelector(`label[for="${escapedId}"]`)?.textContent?.trim();
      if (label) return label;
    }

    const wrappingLabel = element.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
    if (wrappingLabel) return wrappingLabel.slice(0, 80);

    return (
      element.getAttribute("placeholder")?.trim() ||
      element.getAttribute("name")?.trim() ||
      id ||
      element.getAttribute("role")?.trim() ||
      "поле"
    );
  }

  function fieldKind(target: Element): "text" | "select" | "checkbox" | "radio" {
    if (target instanceof HTMLSelectElement) return "select";
    if (target instanceof HTMLInputElement && target.type === "checkbox") return "checkbox";
    if (target instanceof HTMLInputElement && target.type === "radio") return "radio";
    return "text";
  }

  function fieldValue(target: Element): string {
    if (target instanceof HTMLSelectElement) {
      return target.selectedOptions[0]?.textContent?.trim() || target.value;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
    return target.textContent?.trim() ?? "";
  }

  function fieldPrivacyMeta(target: Element, label: string) {
    return {
      type: target instanceof HTMLInputElement ? target.type : "",
      autocomplete: target.getAttribute("autocomplete") ?? "",
      name: target.getAttribute("name") ?? "",
      id: target.getAttribute("id") ?? "",
      label,
    };
  }

  function flushFieldCapture(target: Element) {
    if (!dirtyFields.has(target) || state?.status !== "recording") return;
    dirtyFields.delete(target);

    const label = describeField(target);
    const kind = fieldKind(target);
    const checked = target instanceof HTMLInputElement ? target.checked : undefined;
    const sensitive = QACatFieldPrivacy.isSensitive(fieldPrivacyMeta(target, label));
    const step = QACatFieldPrivacy.buildStep({
      label,
      kind,
      value: state.settings.captureSafeFieldValues && !sensitive ? fieldValue(target) : "",
      checked,
      captureSafeValues: state.settings.captureSafeFieldValues,
      sensitive,
    });
    sendStep("input", step);
  }

  function sendStep(
    type: RecorderStep["type"],
    label: string,
    url = location.href
  ) {
    if (state?.status !== "recording") return;

    void chrome.runtime.sendMessage({
      type: "RECORDER_EVENT",
      step: { type, label, url },
    });
  }

  function formatTime(): string {
    if (!state?.startedAt) return "00:00";

    const now =
      state.status === "paused" && state.pausedAt
        ? state.pausedAt
        : state.status === "stopped" && state.pausedAt
          ? state.pausedAt
          : Date.now();

    const ms = Math.max(
      0,
      now - state.startedAt - state.accumulatedPausedMs
    );

    const seconds = Math.floor(ms / 1000);

    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  }

  function removeController() {
    host?.remove();
    host = null;
    shadow = null;
  }

  function persistControllerSettings(settings: Record<string, unknown>) {
    void chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings });
  }

  function applyHostPosition() {
    if (!host || !state) return;
    const position = state.settings.controllerPosition;
    if (position) {
      host.style.left = `${Math.max(8, Math.min(window.innerWidth - 70, position.x))}px`;
      host.style.top = `${Math.max(8, Math.min(window.innerHeight - 70, position.y))}px`;
      host.style.right = "auto";
    } else {
      host.style.left = "auto";
      host.style.right = "18px";
      host.style.top = "18px";
    }
  }

  async function captureWithoutController() {
    if (!host) return chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
    const previous = host.style.visibility;
    host.style.visibility = "hidden";
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
    } finally {
      host.style.visibility = previous;
    }
  }

  function ensureController() {
    if (!shouldShowController()) {
      removeController();
      return;
    }

    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.style.all = "initial";
      host.style.position = "fixed";
      host.style.zIndex = "2147483647";
      document.documentElement.appendChild(host);
      applyHostPosition();

      shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          * { box-sizing:border-box; }
          .controller { color:#e2e8f0; font:12px/1.2 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; user-select:none; }
          .expanded { width:286px; padding:12px; border:1px solid rgba(34,211,238,.35); border-radius:16px; background:rgba(2,6,23,.96); box-shadow:0 18px 50px rgba(2,6,23,.4); backdrop-filter:blur(16px); }
          .drag { display:flex; align-items:center; gap:8px; cursor:grab; touch-action:none; }
          .drag:active { cursor:grabbing; }
          .cat { display:grid; width:34px; height:34px; place-items:center; border:1px solid rgba(34,211,238,.42); border-radius:11px; background:rgba(34,211,238,.09); font-size:19px; }
          .dot { width:7px; height:7px; border-radius:999px; background:#fb7185; }
          .paused .dot { background:#facc15; }
          .stopped .dot { background:#34d399; }
          .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
          .name { color:#f8fafc; font-weight:850; }
          .status { display:flex; align-items:center; gap:5px; color:#94a3b8; font-size:9px; font-weight:800; }
          .meta { display:flex; justify-content:space-between; margin:9px 0; color:#94a3b8; font-size:10px; }
          .actions { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
          button { min-height:34px; cursor:pointer; border:1px solid #334155; border-radius:10px; color:#cbd5e1; background:#0f172a; font:inherit; font-weight:850; }
          button:hover { border-color:#22d3ee; color:#67e8f9; }
          .open { width:100%; margin-top:7px; color:#67e8f9; background:rgba(34,211,238,.06); }
          .stop:hover { border-color:#fb7185; color:#fca5a5; }
          .hidden { display:none !important; }
        </style>
        <div class="controller" data-controller>
          <div class="expanded" data-expanded>
            <div class="head">
              <div class="drag" data-drag><span class="cat">🐱</span><span class="name">QA Cat</span></div>
              <span class="status"><span class="dot"></span><span data-status>REC</span></span>
            </div>
            <div class="meta"><span data-steps>0 шагов</span><span data-time>00:00</span></div>
            <div class="actions" data-actions>
              <button type="button" data-shot aria-label="Сделать скриншот">📸 Скрин</button>
              <button type="button" data-pause aria-label="Поставить на паузу">⏸ Пауза</button>
              <button type="button" class="stop" data-stop aria-label="Остановить запись">■ Стоп</button>
            </div>
            <button type="button" class="open" data-open>Открыть боковую панель →</button>
          </div>
        </div>
      `;

      let dragStart: { x: number; y: number; left: number; top: number; moved: boolean; pointerId: number } | null = null;
      shadow.querySelectorAll<HTMLElement>("[data-drag]").forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
          if (!host) return;
          const rect = host.getBoundingClientRect();
          dragStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved:false, pointerId:event.pointerId };
          handle.setPointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
        });
        handle.addEventListener("pointermove", (event) => {
          if (!host || !dragStart || dragStart.pointerId !== event.pointerId) return;
          const dx = event.clientX - dragStart.x;
          const dy = event.clientY - dragStart.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) dragStart.moved = true;
          const x = Math.max(8, Math.min(window.innerWidth - host.offsetWidth - 8, dragStart.left + dx));
          const y = Math.max(8, Math.min(window.innerHeight - host.offsetHeight - 8, dragStart.top + dy));
          host.style.left = `${x}px`; host.style.top = `${y}px`; host.style.right = "auto";
        });
        handle.addEventListener("pointerup", (event) => {
          if (!host || !dragStart || dragStart.pointerId !== event.pointerId) return;
          const moved = dragStart.moved;
          const rect = host.getBoundingClientRect();
          dragStart = null;
          if (moved) persistControllerSettings({ controllerPosition: { x: rect.left, y: rect.top } });
          event.preventDefault(); event.stopPropagation();
        });
      });

      async function runControllerAction(action: () => Promise<unknown>) {
        if (controllerActionInFlight) return;
        controllerActionInFlight = true;
        try {
          await action();
        } finally {
          controllerActionInFlight = false;
        }
      }

      shadow.querySelector("[data-shot]")?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        void runControllerAction(() => captureWithoutController());
      });
      shadow.querySelector("[data-pause]")?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        void runControllerAction(() => chrome.runtime.sendMessage({ type:"TOGGLE_PAUSE" }));
      });
      shadow.querySelector("[data-stop]")?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        void runControllerAction(() => chrome.runtime.sendMessage({ type:"STOP_RECORDING" }));
      });
      shadow.querySelector("[data-open]")?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        void runControllerAction(() => chrome.runtime.sendMessage({ type:"OPEN_PANEL" }));
      });
    }

    applyHostPosition();
    updateController();
  }

  function updateController() {
    if (!shadow || !state) return;
    const container = shadow.querySelector("[data-controller]");
    const expanded = shadow.querySelector("[data-expanded]");
    const status = shadow.querySelector("[data-status]");
    const steps = shadow.querySelector("[data-steps]");
    const time = shadow.querySelector("[data-time]");
    const pause = shadow.querySelector("[data-pause]");
    const actions = shadow.querySelector("[data-actions]");

    container?.classList.toggle("paused", state.status === "paused");
    container?.classList.toggle("stopped", state.status === "stopped");
    expanded?.classList.remove("hidden");
    if (status) status.textContent = state.status === "stopped" ? "ГОТОВО" : state.status === "paused" ? "PAUSE" : "REC";
    actions?.classList.toggle("hidden", state.status === "stopped");
    if (steps) steps.textContent = `${state.steps.length} шагов`;
    if (time) time.textContent = formatTime();
    if (pause) {
      pause.textContent = state.status === "paused" ? "▶ Продолжить" : "⏸ Пауза";
      pause.setAttribute("aria-label", state.status === "paused" ? "Продолжить запись" : "Поставить на паузу");
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      if (state?.status !== "recording") return;
      if (host && event.composedPath().includes(host)) return;

      const target = clickableTarget(event.target);
      if (!target) return;

      sendStep("click", `Нажать «${describeElement(target)}»`);
    },
    true
  );

  document.addEventListener(
    "input",
    (event) => {
      if (state?.status !== "recording") return;
      if (host && event.composedPath().includes(host)) return;
      const target = fieldTarget(event.target);
      if (!target) return;
      dirtyFields.add(target);
    },
    true
  );

  document.addEventListener(
    "change",
    (event) => {
      if (state?.status !== "recording") return;
      if (host && event.composedPath().includes(host)) return;
      const target = fieldTarget(event.target);
      if (!target) return;
      dirtyFields.add(target);
      flushFieldCapture(target);
    },
    true
  );

  document.addEventListener(
    "focusout",
    (event) => {
      const target = fieldTarget(event.target);
      if (!target) return;
      flushFieldCapture(target);
    },
    true
  );

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      state?.status !== "recording" ||
      event.data?.source !== "qa-buddy-recorder-page"
    ) {
      return;
    }

    const level = event.data.level as RecorderConsoleEvent["level"] | undefined;
    const message = event.data.message;

    if (
      !level ||
      !["error", "exception", "unhandledrejection"].includes(level) ||
      typeof message !== "string"
    ) {
      return;
    }

    void chrome.runtime.sendMessage({
      type: "RECORDER_CONSOLE",
      consoleEvent: {
        level,
        message,
        url: location.href,
      },
    });
  });

  window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      if (state?.status === "recording") {
        sendStep(
          "page",
          `Перейти на ${location.pathname || "/"}`
        );
      }
    }

    if (shouldShowController()) {
      updateController();
    }
  }, 800);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "STATE_UPDATED") return;
    state = message.state as RecorderState;
    ensureController();
  });

  void chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
    if (!response?.isTargetTab) return;
    state = response.state as RecorderState;
    ensureController();
  });
})();
