(() => {
  const HOST_ID = "qa-buddy-recorder-root";
  let state: RecorderState | null = null;
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let lastUrl = location.href;

  function active() {
    return state?.status === "recording" || state?.status === "paused";
  }

  function ru() {
    return state?.settings.locale !== "en";
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

  function removeToolbar() {
    host?.remove();
    host = null;
    shadow = null;
  }

  function ensureToolbar() {
    if (!active()) {
      removeToolbar();
      return;
    }

    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.style.all = "initial";
      host.style.position = "fixed";
      host.style.zIndex = "2147483647";
      host.style.top = "18px";
      host.style.right = "18px";
      document.documentElement.appendChild(host);
      shadow = host.attachShadow({ mode: "open" });

      shadow.innerHTML = `
        <style>
          * { box-sizing: border-box; }
          .bar {
            min-width: 390px;
            display: grid;
            grid-template-columns: 40px 1fr auto auto auto;
            align-items: center;
            gap: 9px;
            padding: 10px 11px;
            border: 1px solid rgba(34, 211, 238, .32);
            border-radius: 18px;
            color: #e2e8f0;
            background: rgba(2, 6, 23, .94);
            box-shadow: 0 20px 60px rgba(2, 6, 23, .38), 0 0 28px rgba(34, 211, 238, .08);
            backdrop-filter: blur(16px);
            font: 13px/1.2 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .cat {
            width: 40px;
            height: 40px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(34, 211, 238, .45);
            border-radius: 13px;
            background: rgba(34, 211, 238, .10);
            font-size: 21px;
          }
          .title { min-width: 0; }
          .name { display:block; color:#f8fafc; font-size:13px; font-weight:800; }
          .meta { display:flex; align-items:center; gap:7px; margin-top:4px; color:#94a3b8; font-size:10px; }
          .dot { width:7px; height:7px; border-radius:999px; background:#fb7185; box-shadow:0 0 0 4px rgba(251,113,133,.1); }
          .paused .dot { background:#facc15; box-shadow:0 0 0 4px rgba(250,204,21,.1); }
          button {
            width:38px; height:38px; display:grid; place-items:center; cursor:pointer;
            border:1px solid #334155; border-radius:12px; color:#cbd5e1; background:#0f172a;
            font:inherit; font-weight:900;
          }
          button:hover { border-color:#22d3ee; color:#67e8f9; }
          .stop:hover { border-color:#fb7185; color:#fca5a5; }
        </style>
        <div class="bar">
          <div class="cat" aria-hidden="true">🐱</div>
          <div class="title">
            <span class="name">QA Buddy Recorder</span>
            <span class="meta">
              <span class="dot"></span>
              <span data-status>REC</span>
              <span>•</span>
              <span data-steps>0</span>
              <span>•</span>
              <span data-time>00:00</span>
            </span>
          </div>
          <button type="button" data-shot>📸</button>
          <button type="button" data-pause>Ⅱ</button>
          <button type="button" class="stop" data-stop>■</button>
        </div>
      `;

      shadow.querySelector("[data-shot]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
      });

      shadow.querySelector("[data-pause]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" });
      });

      shadow.querySelector("[data-stop]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
      });
    }

    updateToolbar();
  }

  function updateToolbar() {
    if (!shadow || !state) return;

    const bar = shadow.querySelector(".bar");
    const status = shadow.querySelector("[data-status]");
    const steps = shadow.querySelector("[data-steps]");
    const time = shadow.querySelector("[data-time]");
    const pause = shadow.querySelector("[data-pause]");
    const shot = shadow.querySelector("[data-shot]");
    const stop = shadow.querySelector("[data-stop]");

    bar?.classList.toggle("paused", state.status === "paused");
    if (status) {
      status.textContent =
        state.status === "paused"
          ? ru() ? "ПАУЗА" : "PAUSED"
          : ru() ? "ЗАПИСЬ" : "REC";
    }
    if (steps) {
      steps.textContent = ru()
        ? `${state.steps.length} шагов`
        : `${state.steps.length} steps`;
    }
    if (time) time.textContent = formatTime();

    if (pause) {
      pause.textContent = state.status === "paused" ? "▶" : "Ⅱ";
      pause.setAttribute(
        "aria-label",
        state.status === "paused"
          ? ru() ? "Продолжить запись" : "Resume recording"
          : ru() ? "Поставить на паузу" : "Pause recording"
      );
    }
    shot?.setAttribute("aria-label", ru() ? "Сделать скриншот" : "Take screenshot");
    stop?.setAttribute("aria-label", ru() ? "Остановить запись" : "Stop recording");
  }

  document.addEventListener(
    "click",
    (event) => {
      if (state?.status !== "recording") return;
      if (host && event.composedPath().includes(host)) return;

      const target = clickableTarget(event.target);
      if (!target) return;
      const name = describeElement(target);
      sendStep("click", ru() ? `Нажать «${name}»` : `Click "${name}"`);
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
      const name = describeElement(target);

      sendStep(
        "input",
        ru()
          ? `Изменить поле «${name}»${fieldType}`
          : `Change field "${name}"${fieldType}`
      );
    },
    true
  );

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      state?.status !== "recording" ||
      event.data?.source !== "qa-buddy-recorder-page"
    ) return;

    const level = event.data.level as RecorderConsoleEvent["level"] | undefined;
    const message = event.data.message;

    if (
      !level ||
      !["error", "exception", "unhandledrejection"].includes(level) ||
      typeof message !== "string"
    ) return;

    void chrome.runtime.sendMessage({
      type: "RECORDER_CONSOLE",
      consoleEvent: { level, message, url: location.href },
    });
  });

  window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (state?.status === "recording") {
        sendStep(
          "page",
          ru()
            ? `Перейти на ${location.pathname || "/"}`
            : `Navigate to ${location.pathname || "/"}`
        );
      }
    }
    if (active()) updateToolbar();
  }, 800);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "STATE_UPDATED") return;
    state = message.state as RecorderState;
    ensureToolbar();
  });

  void chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
    if (!response?.isTargetTab) return;
    state = response.state as RecorderState;
    ensureToolbar();
  });
})();
