# QA Cat Recorder v0.3.2 — Design Specification

**Date:** 2026-10-05  
**Status:** Approved design, implementation not started  
**Repository:** `kitkotcat/qa-buddy-recorder`  
**Target release:** v0.3.2 UX Polish

## 1. Product direction

QA Buddy Recorder is renamed to **QA Cat Recorder**.

The product should feel like a lightweight QA companion that stays beside the tested page, quietly collects technical evidence, and helps turn a reproduced issue into a structured QA artifact with minimal extra work.

Core product principle:

> Reproduce the issue once; the Recorder should capture as much useful evidence as possible without interrupting the QA flow.

The product remains local-first and privacy-first.

## 2. Goals

v0.3.2 should:

- replace the disappearing Chrome popup with a persistent working UI;
- reduce visual and cognitive load;
- keep the most important recording controls available while testing;
- preserve the existing RecorderState and evidence model where practical;
- add lightweight visual identity through the cat mascot and themes;
- make mascot animation more alive but less distracting during active recording;
- preserve existing user/session data during migration;
- keep the extension useful first and playful second.

## 3. Non-goals

This release does **not** add:

- Jira integration;
- YouGile integration;
- AI generation;
- cloud synchronization;
- backend storage;
- session history;
- full screenshot annotation editor;
- Chrome Web Store publication work;
- unrelated QA management functionality.

## 4. Naming and brand

### Product name

**QA Cat Recorder**

Use title case. Do not use `QA CAT Recorder` because `CAT` reads like an acronym rather than a brand name.

### UI header

Primary header:

```text
🐱 QA Cat Recorder        ● RECORDING
```

Remove:

- `QA CAT BUDDY` eyebrow as a dominant product label;
- `Инструмент для русскоязычных QA`;
- redundant product subtitles.

QA Buddy may remain a small ecosystem reference in README/documentation, not as the main UI identity.

### Repository

The current repository remains `qa-buddy-recorder` during implementation to avoid unnecessary migration risk. Repository renaming to `qa-cat-recorder` is a separate publication step after v0.3.2 is stable.

## 5. Primary UI architecture

### Current architecture

```text
Extension action
    ↓
Chrome popup
    ↓
Popup closes when focus moves back to the tested page
```

### Target architecture

```text
                    Chrome
                      │
               QA Cat Recorder
                      │
        ┌─────────────┴─────────────┐
        │                           │
   Side Panel                Cat Controller
        │                           │
        └─────────────┬─────────────┘
                      │
              Background Worker
                      │
                RecorderState
                      │
             chrome.storage.local
```

The **Side Panel** is the main application UI.

The **Cat Controller** is a small, draggable control injected into the tested page.

The old popup is not kept as a second full UI.

## 6. Chrome target

Target minimum Chrome version: **116**.

Reason:

- Side Panel is stable for extension UI;
- programmatic panel opening after an explicit user gesture is available in the required target range;
- avoiding compatibility logic for much older Chrome versions keeps the implementation smaller and clearer.

Edge support remains expected through Chromium compatibility where applicable.

## 7. Side Panel UX

### Primary navigation

Use five working sections:

1. **Сессия**
2. **Шаги**
3. **Evidence**
4. **Скриншоты**
5. **Отчёт**

Settings move to a compact `⚙` action in the header.

### Evidence

`Network` and `Console` become subviews within **Evidence**.

```text
Evidence
├── Network
└── Console
```

This keeps technical evidence grouped by user intent instead of exposing implementation categories as top-level navigation.

### Header

Compact header only:

```text
🐱 QA Cat Recorder        ● REC
```

No marketing sentence under the title.

### Session controls

During active recording, the primary control row remains immediately visible:

```text
📸 Screenshot     ⏸ Pause     ■ Stop
```

The user should not need to navigate to another section to stop or pause recording.

### After Stop

The primary next action is:

```text
[ Создать Bug Report ]
```

Secondary options:

```text
Test Case · Checklist
```

All three existing builders remain available, but Bug Report is visually primary because it best matches the Recorder workflow.

## 8. Cat Controller

### Purpose

The controller provides quick actions on the tested page without requiring the full Side Panel to remain visually prominent.

### Collapsed state

```text
🐱 ● 12
```

Displays:

- mascot/icon;
- recording status;
- current step count.

### Expanded state

```text
┌─────────────────────────┐
│ 🐱 QA Cat        ● REC  │
│ 12 шагов       02:14    │
│                         │
│  📸       ⏸       ■     │
│                         │
│ Открыть Recorder     →  │
└─────────────────────────┘
```

### Behaviour

The Cat Controller must:

- expand/collapse on user click;
- remain present while interacting with the tested page;
- be draggable;
- persist its last position;
- restore after page reload while a session is active;
- open the Side Panel from an explicit user gesture;
- avoid blocking common page controls;
- avoid collecting its own clicks as test steps;
- be excluded from Recorder screenshots where technically practical;
- remain compact during active recording.

### Style isolation

Use **Shadow DOM** for the injected controller to reduce CSS collisions with tested websites.

## 9. State architecture

There must be one source of truth.

Do not create separate persistent state models for Side Panel and Cat Controller.

```text
Background Worker
      │
 RecorderState
      │
chrome.storage.local
   ↙       ↘
Panel    Controller
```

The background/service worker owns persistent Recorder state.

The Side Panel and Cat Controller:

- render current state;
- subscribe/refresh when state changes;
- send actions to the background worker.

Existing message/action patterns should be reused where possible.

Expected actions include:

```text
START_RECORDING
TOGGLE_PAUSE
CAPTURE_SCREENSHOT
STOP_RECORDING
OPEN_PANEL
UPDATE_SETTINGS
```

## 10. Settings v3

Target settings model:

```ts
type RecorderTheme = "night" | "cafe" | "violet";
type MascotActivity = "off" | "calm" | "active";

type ControllerPosition = {
  x: number;
  y: number;
};

type RecorderSettingsV3 = {
  theme: RecorderTheme;
  mascotActivity: MascotActivity;
  controllerPosition: ControllerPosition | null;
  controllerCollapsed: boolean;
  slowRequestThresholdMs: number;
  reducedMotionOverride?: "system" | "on" | "off";
};
```

Default values:

```text
theme = night
mascotActivity = calm
controllerCollapsed = true
reducedMotionOverride = system
```

## 11. Themes

Only three built-in themes are included.

### Night QA — default

Visual direction:

- deep navy / graphite;
- cyan accent;
- cool slate surfaces;
- current technical character preserved.

### Cat Café

Visual direction:

- espresso/dark brown surfaces;
- warm graphite;
- cream text accents;
- caramel primary accent.

The theme must remain professional and readable, not cartoonish.

### Debug Violet

Visual direction:

- deep slate;
- violet accent;
- lavender secondary accent;
- high contrast technical feel.

### Theme implementation

Use CSS custom properties/tokens, not three separate component stylesheets.

Required token layer:

```css
--bg
--surface
--surface-soft
--border
--text
--muted
--accent
--accent-soft
--danger
--warning
```

Components must consume theme tokens instead of embedding theme-specific colors where practical.

## 12. Paw-pattern background

Add a subtle cat-paw visual pattern to selected empty background areas.

Requirements:

- opacity approximately 2–3.5%;
- SVG/CSS pattern preferred;
- must not appear underneath dense tables, logs, form inputs or critical status elements;
- must not reduce text contrast;
- must not become a repeating decorative wall.

Purpose: brand atmosphere, not decoration for its own sake.

## 13. Mascot v3 — visual details

Keep the existing pixel/CSS mascot approach and enrich it without adding a heavy animation dependency.

Add or improve:

- inner ear detail;
- small eye highlight;
- clearer cheeks/muzzle;
- more readable paws;
- light chest marking;
- tail stripes;
- QA collar;
- small `QA` tag.

The mascot must remain lightweight and secondary to the QA workflow.

## 14. Mascot v3 — animation model

Split animations into two categories.

### Micro animations

Examples:

- blink;
- ear movement;
- tail movement;
- look left/right;
- small paw movement.

Target interval when idle: **7–15 seconds**.

Typical duration: **0.4–1.5 seconds**.

### Vibe animations

Examples:

- wash;
- stretch;
- short walk;
- play with ball;
- coffee;
- litter easter egg in active mode only.

Target interval when not recording: **25–50 seconds**.

### During active recording

Allowed:

- blink;
- ear movement;
- tail movement;
- look;
- occasional wash.

Disabled during active recording:

- play;
- walk;
- litter;
- coffee;
- large stretch actions.

The mascot should become quieter while the user is reproducing a defect.

## 15. Coffee animation ☕

Add `coffee` as a vibe state.

Sequence:

```text
idle
 ↓
sit
 ↓
cup appears
 ↓
small steam pixels
 ↓
sip
 ↓
small tail movement
 ↓
cup disappears
 ↓
idle
```

Target duration: **4–5 seconds**.

Target probability: approximately **10–15% of vibe animations**.

Coffee must not run:

- during active recording;
- with reduced motion enabled;
- while the mascot is being dragged;
- when another mascot animation is active.

Optional polish: after a sufficiently long recording session ends, the next vibe animation may have an increased chance to be `coffee`.

No textual joke/toast is required; the animation should carry the moment visually.

## 16. Mascot activity setting

Replace multiple mascot-facing switches with a simpler user model:

```text
Выкл · Спокойный · Активный
```

### Off

No mascot animations or mascot UI beyond controls required by the current controller design.

### Calm

- micro animations;
- wash/stretch;
- limited vibe activity;
- no litter easter egg.

### Active

- full allowed vibe set;
- coffee;
- play;
- rare litter easter egg.

System `prefers-reduced-motion` must still be respected.

## 17. Privacy UX

Do not show a large permanent privacy card in the primary work area.

Use a compact indicator such as:

```text
🛡 Локальное хранение
```

Detailed privacy explanation belongs in Settings → Privacy.

Privacy behaviour remains unchanged:

- input/textarea values are not stored;
- password values are not captured;
- sensitive query params are redacted;
- console secret patterns are redacted before storage;
- screenshots are user-triggered;
- data remains local-only;
- no backend transmission is added.

## 18. Migration from current v0.3.1

Migration must be non-destructive.

### Settings mapping

```text
old mascotEnabled=false
→ mascotActivity="off"

old mascotEnabled=true + funMode=false
→ mascotActivity="calm"

old mascotEnabled=true + funMode=true
→ mascotActivity="active"

missing theme
→ theme="night"

missing controllerCollapsed
→ true
```

### Data preservation

The update must preserve existing:

- session state;
- steps;
- network evidence;
- console evidence;
- screenshots;
- Bug Report draft;
- Test Case draft;
- Checklist draft;
- slow request threshold;
- relevant mascot/controller position where it can be migrated sensibly.

No automatic session reset is allowed as part of migration.

## 19. Old popup migration

The final architecture must not maintain two full product UIs.

Target:

```text
Side Panel + Cat Controller
```

Not:

```text
Popup + Side Panel + Cat Controller
```

Implementation may temporarily keep popup code during migration, but the final v0.3.2 build should remove or reduce the old popup so that there is one full main UI to maintain.

## 20. Accessibility and motion

Requirements:

- keyboard-accessible Side Panel navigation;
- visible focus states;
- controls have accessible labels;
- theme contrast remains readable;
- system `prefers-reduced-motion` respected;
- mascot carries no required information;
- core Recorder operations remain usable when mascot is disabled;
- cat-controller expansion/collapse is keyboard accessible where technically possible.

## 21. Reliability requirements

- active recording survives Side Panel close/reopen;
- active recording survives tested page reload where current architecture already supports it;
- service worker restart must not destroy persisted state;
- Cat Controller must restore correctly after content script reinjection;
- controller actions must not double-record themselves as user steps;
- Side Panel and Controller must not display stale session state for prolonged periods;
- errors opening Side Panel must fail gracefully without stopping an active session.

## 22. Performance requirements

- no high-frequency permanent animation timer;
- mascot uses CSS/lightweight state transitions;
- paw-pattern is lightweight;
- Side Panel should open without noticeable delay;
- controller bundle should stay minimal;
- existing capped evidence behaviour remains;
- no new external UI/animation framework is required for v0.3.2.

## 23. UX priorities

Priority order for this release:

1. Side Panel persistence and usability;
2. reliable Cat Controller actions;
3. simpler navigation/header;
4. non-destructive migration;
5. themes and visual tokens;
6. mascot polish and coffee animation;
7. decorative paw-pattern.

If a visual feature conflicts with recording reliability, recording reliability wins.

## 24. Definition of Done

v0.3.2 is complete when all of the following are true:

### Product / naming

- product UI uses `QA Cat Recorder`;
- `Инструмент для русскоязычных QA` is removed;
- old dominant `QA CAT BUDDY` header treatment is removed or demoted;
- manifest/package/README version and naming are synchronized.

### Side Panel

- clicking the extension action opens the Side Panel;
- Side Panel remains usable while interacting with the tested page;
- main navigation is `Сессия / Шаги / Evidence / Скриншоты / Отчёт`;
- Settings is accessible from the header;
- active session controls stay easy to reach.

### Cat Controller

- controller is injected into supported pages;
- collapsed and expanded states work;
- controller is draggable;
- position persists;
- screenshot/pause/stop actions work;
- explicit user action can open the Side Panel;
- controller interactions are not recorded as tested-page steps.

### Themes

- Night QA works as default;
- Cat Café works;
- Debug Violet works;
- theme selection persists;
- text/control contrast remains acceptable;
- paw pattern is subtle and does not reduce readability.

### Mascot

- visual details are improved;
- micro animation cadence is visibly more alive than v0.3.1;
- recording mode is quieter;
- `coffee` animation works;
- reduced-motion path disables non-essential motion;
- mascot activity modes work.

### Migration

- existing v0.3.1 state migrates without data loss;
- old settings map to the new settings model;
- no automatic session reset occurs.

### Quality

- `npm ci` passes;
- `npm run build` passes;
- GitHub Actions build is green;
- manual Chrome smoke passes;
- no new obvious secret/privacy regression is introduced;
- README is updated to match the final implementation.

## 25. Manual smoke scope for v0.3.2

Minimum smoke before publication:

1. install clean unpacked build;
2. click extension icon → Side Panel opens;
3. start recording;
4. interact with tested page while Side Panel stays available;
5. verify Cat Controller appears;
6. collapse/expand controller;
7. drag controller and reload page;
8. click navigation, input field and page link → steps recorded correctly;
9. confirm controller clicks are not recorded as tested-page steps;
10. take screenshot from controller;
11. trigger 4xx/network evidence;
12. trigger console error;
13. pause/resume from controller;
14. stop from controller;
15. verify Session / Steps / Evidence / Screenshots;
16. create/edit Bug Report;
17. verify Test Case / Checklist remain available;
18. switch all three themes;
19. verify paw background readability;
20. verify Calm / Active / Off mascot settings;
21. observe micro animations;
22. verify coffee animation outside active recording;
23. verify reduced motion;
24. close/reopen Side Panel during a session;
25. restart extension/service worker if practical and verify persisted state;
26. verify no red errors in extension/service-worker console.

## 26. Future work after v0.3.2

Not part of this implementation plan:

- screenshot annotation tools;
- session history / IndexedDB strategy;
- Chrome Web Store packaging and listing;
- external issue tracker integrations;
- repository rename to `qa-cat-recorder`;
- public release decision.
