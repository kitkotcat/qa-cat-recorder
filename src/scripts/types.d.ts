type RecorderStatus = "idle" | "recording" | "paused" | "stopped";
type RecorderLocale = "ru" | "en";
type BuilderMode = "bug" | "testcase" | "checklist";

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
  locale: RecorderLocale;
  mascotEnabled: boolean;
  reducedMotion: boolean;
  funMode: boolean;
  slowRequestThresholdMs: number;
  mascotPosition: MascotPosition | null;
};

type RecorderState = {
  schemaVersion: 3;
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
