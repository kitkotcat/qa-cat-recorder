type RecorderStatus = "idle" | "recording" | "paused" | "stopped";
type RecorderLocale = "ru" | "en";

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

type BugReportDraft = {
  title: string;
  preconditions: string;
  actualResult: string;
  expectedResult: string;
  environment: string;
};

type RecorderSettings = {
  locale: RecorderLocale;
  mascotEnabled: boolean;
  reducedMotion: boolean;
  funMode: boolean;
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
