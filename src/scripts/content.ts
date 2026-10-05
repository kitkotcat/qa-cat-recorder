(() => {
  const HOST_ID = "qa-cat-recorder-root";
  let state: RecorderState | null = null;
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let lastUrl = location.href;

  function active() {
    return state?.status === "recording" || state?.status === "paused";
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
    return target.closest("input, textarea, select");
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
    if (!active()) {
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
          .collapsed { display:flex; align-items:center; gap:7px; padding:7px 9px; border:1px solid rgba(34,211,238,.35); border-radius:999px; background:rgba(2,6,23,.95); box-shadow:0 12px 36px rgba(2,6,23,.35); backdrop-filter:blur(14px); }
          .expanded { width:224px; padding:10px; border:1px solid rgba(34,211,238,.35); border-radius:16px; background:rgba(2,6,23,.96); box-shadow:0 18px 50px rgba(2,6,23,.4); backdrop-filter:blur(16px); }
          .drag { display:flex; align-items:center; gap:8px; cursor:grab; touch-action:none; }
          .drag:active { cursor:grabbing; }
          .cat { display:grid; width:34px; height:34px; place-items:center; border:1px solid rgba(34,211,238,.42); border-radius:11px; background:rgba(34,211,238,.09); font-size:19px; }
          .dot { width:7px; height:7px; border-radius:999px; background:#fb7185; }
          .paused .dot { background:#facc15; }
          .count { color:#94a3b8; font-weight:800; }
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
          <div class="collapsed hidden" data-collapsed>
            <div class="drag" data-drag><span class="cat">🐱</span></div>
            <span class="dot"></span><span class="count" data-compact-count>0</span>
          </div>
          <div class="expanded" data-expanded>
            <div class="head">
              <div class="drag" data-drag><span class="cat">🐱</span><span class="name">QA Cat</span></div>
              <span class="status"><span class="dot"></span><span data-status>REC</span></span>
            </div>
            <div class="meta"><span data-steps>0 шагов</span><span data-time>00:00</span></div>
            <div class="actions">
              <button type="button" data-shot aria-label="Сделать скриншот">📸</button>
              <button type="button" data-pause aria-label="Поставить на паузу">Ⅱ</button>
              <button type="button" class="stop" data-stop aria-label="Остановить запись">■</button>
            </div>
            <button type="button" class="open" data-open>Открыть Recorder →</button>
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
          else persistControllerSettings({ controllerCollapsed: !state?.settings.controllerCollapsed });
          event.preventDefault(); event.stopPropagation();
        });
      });

      shadow.querySelector("[data-shot]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void captureWithoutController(); });
      shadow.querySelector("[data-pause]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void chrome.runtime.sendMessage({ type:"TOGGLE_PAUSE" }); });
      shadow.querySelector("[data-stop]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void chrome.runtime.sendMessage({ type:"STOP_RECORDING" }); });
      shadow.querySelector("[data-open]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void chrome.runtime.sendMessage({ type:"OPEN_PANEL" }); });
    }

    applyHostPosition();
    updateController();
  }

  function updateController() {
    if (!shadow || !state) return;
    const container = shadow.querySelector("[data-controller]");
    const collapsed = shadow.querySelector("[data-collapsed]");
    const expanded = shadow.querySelector("[data-expanded]");
    const status = shadow.querySelector("[data-status]");
    const steps = shadow.querySelector("[data-steps]");
    const compactCount = shadow.querySelector("[data-compact-count]");
    const time = shadow.querySelector("[data-time]");
    const pause = shadow.querySelector("[data-pause]");

    container?.classList.toggle("paused", state.status === "paused");
    collapsed?.classList.toggle("hidden", !state.settings.controllerCollapsed);
    expanded?.classList.toggle("hidden", state.settings.controllerCollapsed);
    if (status) status.textContent = state.status === "paused" ? "PAUSE" : "REC";
    if (steps) steps.textContent = `${state.steps.length} шагов`;
    if (compactCount) compactCount.textContent = String(state.steps.length);
    if (time) time.textContent = formatTime();
    if (pause) {
      pause.textContent = state.status === "paused" ? "▶" : "Ⅱ";
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
    "change",
    (event) => {
      if (state?.status !== "recording") return;

      const target = fieldTarget(event.target);
      if (!target) return;

      const fieldType =
        target instanceof HTMLInputElement && target.type
          ? ` (${target.type})`
          : "";

      sendStep(
        "input",
        `Изменить поле «${describeElement(target)}»${fieldType}`
      );
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

    if (active()) {
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
