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
