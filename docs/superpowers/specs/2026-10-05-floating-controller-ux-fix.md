# QA Cat Recorder — Floating Controller UX Fix

## Status
Approved for implementation after review.

## Context
In v0.3.2 the Side Panel lifecycle and floating Cat Controller are connected, but the current compact state is too minimal for active recording. When the Side Panel is closed, the QA user must still be able to control the recording immediately without reopening the panel.

## Goal
Restore the floating controller as a useful working toolbar when the Side Panel is closed, while keeping the compact chip only as an optional manually-collapsed state.

## UX principle
When Side Panel is open, it is the primary workspace. When Side Panel is closed during an active session, the floating controller becomes the primary control surface.

## Required states

### 1. Side Panel open + recording/paused
- Floating controller may stay compact.
- Compact view shows: QA Cat icon, recording state, step count.
- No requirement to duplicate all controls while the Side Panel is visible.

### 2. Side Panel closed + recording
The floating controller automatically expands and must show:
- QA Cat Recorder label;
- REC state;
- step count;
- elapsed session time;
- Screenshot action;
- Pause action;
- Stop action;
- Open Side Panel action.

### 3. Side Panel closed + paused
Same expanded controller, with:
- PAUSE state;
- Screenshot action;
- Resume action instead of Pause;
- Stop action;
- Open Side Panel action.

### 4. Side Panel closed + stopped
The controller remains available in a lightweight completed state:
- QA Cat icon;
- status `ГОТОВО`;
- Open Side Panel action.

Recording-only actions are hidden.

### 5. Idle / no session
No floating controller is required.

## Manual collapse behavior
Compact mode must not be treated as the same thing as "Side Panel is open".

Introduce a separate concept for user intent, e.g.:
- `panelOpen: boolean` — runtime lifecycle state, not persisted as user preference;
- `controllerManuallyCollapsed: boolean` — user preference for the floating controller.

Rules:
- Side Panel open -> controller can collapse automatically.
- Side Panel closed + active session -> controller expands automatically unless the user explicitly collapses it after the panel has closed.
- Manual collapse remains valid until the user expands it again or a new session starts.
- Opening the Side Panel must not overwrite the user's long-term preference accidentally.

## Floating controller layout

### Expanded / recording
```text
┌──────────────────────────────┐
│ 🐱 QA Cat Recorder     ● REC │
│ 12 шагов              02:14  │
│                              │
│ 📸 Скрин   ⏸ Пауза   ■ Стоп │
│                              │
│ Открыть боковую панель    →  │
└──────────────────────────────┘
```

### Expanded / paused
```text
┌──────────────────────────────┐
│ 🐱 QA Cat Recorder   PAUSE   │
│ 12 шагов              02:14  │
│                              │
│ 📸 Скрин  ▶ Продолжить ■ Стоп│
│                              │
│ Открыть боковую панель    →  │
└──────────────────────────────┘
```

### Stopped
```text
┌──────────────────────┐
│ 🐱 QA Cat     ГОТОВО │
│ Открыть панель     → │
└──────────────────────┘
```

## Interaction requirements
- Controller is draggable.
- Drag position persists.
- Controller must remain inside the visible viewport.
- All controller interactions are excluded from recorded test steps.
- Screenshot capture must hide the controller during capture and restore it afterward.
- Clicking `Открыть боковую панель` opens Side Panel for the current target tab.
- Opening Side Panel collapses the controller to compact mode.
- Closing Side Panel during recording or pause expands the controller automatically.

## Functional behavior

### Screenshot
- Available in recording and paused states.
- Uses the existing screenshot flow.
- Controller is not visible in the captured image.

### Pause / Resume
- Recording -> Pause.
- Paused -> Resume.
- UI state changes immediately after background state confirmation.

### Stop
- Stops the current session.
- Expanded active toolbar transitions to completed `ГОТОВО` state.
- No duplicate stop command is allowed.

### Open Side Panel
- Must be triggered by explicit user click.
- Failure to open Side Panel must not stop or reset the active session.

## State / architecture requirements
- Background service worker remains source of truth for session state.
- Side Panel lifecycle is tracked through a long-lived Chrome runtime Port.
- `port.onDisconnect` indicates the Side Panel is closed.
- Do not store `panelOpen` in chrome.storage as persistent product state.
- Do not overload `controllerCollapsed` to represent both lifecycle and user preference.
- Keep active recording state intact across Side Panel close/reopen.

## Non-goals
This change does not include:
- keyboard shortcuts;
- screenshot annotations;
- video recording;
- session replay;
- cloud sync;
- Jira/YouGile integrations;
- AI report generation;
- redesign of Side Panel navigation;
- new Chrome permissions.

## Acceptance criteria
1. Start recording from Side Panel.
2. Close Side Panel.
3. Expanded floating controller appears automatically.
4. Controller shows Screenshot, Pause/Resume, Stop and Open Side Panel.
5. Screenshot works and does not capture the controller itself.
6. Pause changes state to paused and button changes to Resume.
7. Resume returns state to recording.
8. Stop transitions controller to `ГОТОВО` and removes active recording controls.
9. Open Side Panel reopens the panel and controller becomes compact.
10. Closing Side Panel again during active recording expands the controller again.
11. User can manually collapse and expand the floating controller.
12. Controller interactions do not appear in recorded Steps.
13. Controller position survives page interaction/re-render.
14. New Session clears the old controller from the previous target tab.
15. No session data is lost when Side Panel is closed or reopened.

## Regression checks
- Existing Side Panel remains usable.
- Checklist layout fix remains intact.
- Night QA contrast remains intact.
- Cat Controller `ГОТОВО` behavior after Stop remains intact.
- Cat Controller does not duplicate actions when rapidly clicking Pause/Stop.
- Mascot animations remain independent of controller lifecycle.

## Chrome smoke
1. Reload unpacked extension.
2. Open an http/https page.
3. Open QA Cat Recorder Side Panel.
4. Start recording.
5. Close Side Panel.
6. Verify expanded floating toolbar.
7. Click Screenshot.
8. Click Pause.
9. Click Resume.
10. Open Side Panel from floating controller.
11. Close Side Panel again.
12. Verify expanded controller returns.
13. Stop from floating controller.
14. Verify `ГОТОВО` state.
15. Start New Session and verify previous controller is removed.
16. Check `chrome://extensions` and service worker console for errors.

## Definition of Done
- All acceptance criteria pass manually in Chrome.
- Automated controller lifecycle tests cover Side Panel open/close behavior.
- Existing test suite passes.
- Production build succeeds.
- No new permissions are introduced.
- Smoke build folder is refreshed for final manual QA.
