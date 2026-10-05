# QA Cat Recorder v0.3.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert QA Buddy Recorder v0.3.1 into QA Cat Recorder v0.3.2 with a persistent Chrome Side Panel, a compact draggable Cat Controller, simplified QA-first UX, three themes, and Mascot v3 without losing existing session data.

**Architecture:** The background service worker remains the single persistent source of truth for `RecorderState`. The Side Panel and injected Shadow-DOM Cat Controller are two views/controllers over the same state, synchronized through `chrome.storage.local` and runtime messages. Migration to the new settings model is non-destructive and recording reliability has priority over visual polish.

**Tech Stack:** Chrome Extension Manifest V3, Chrome Side Panel API, React 19, TypeScript 6, Vite 8, Chrome Storage/WebRequest APIs, CSS custom properties, Vitest for pure state/animation tests.

**Spec:** `docs/superpowers/specs/2026-10-05-qa-cat-recorder-v0.3.2-design.md`

## Global Constraints

- Product UI name is exactly **QA Cat Recorder**; do not use `QA CAT Recorder`.
- Remove the UI sentence `Инструмент для русскоязычных QA`.
- Target minimum Chrome version is **116**.
- Final main UI is **Side Panel + Cat Controller**; do not ship two full UIs.
- Repository remains `qa-buddy-recorder` during implementation.
- Existing session/evidence/drafts must migrate without automatic reset.
- Background worker is the only persistent source of truth.
- Data remains local-only; no backend/cloud/API integration is added.
- Do not capture input/textarea values or passwords.
- Keep existing query/console secret redaction behavior.
- No external UI or animation framework is added.
- Themes are exactly `night`, `cafe`, `violet`; Night QA is default.
- Mascot activity is exactly `off`, `calm`, `active`; Calm is default after a fresh install.
- `prefers-reduced-motion` is respected; non-essential mascot motion stops when reduced motion applies.
- Coffee is a non-recording vibe animation only, target duration 4–5 s and roughly 10–15% of vibe selections.
- Recording reliability wins over decorative features.

## Review Focus

- **Old active v0.3.1 session:** migration must preserve steps, network/console events, screenshots, all three drafts, target tab, timing fields and slow-request threshold while mapping old mascot settings.
- **Panel lifecycle:** closing/reopening Side Panel or restarting the service worker must not reset an active session or leave the panel stale.
- **Controller isolation:** clicks/inputs inside the Cat Controller must never be recorded as tested-page steps; normal page interactions immediately outside it must still record.
- **Unsupported page / Side Panel failure:** trying to start on a non-http(s) page or failing to open the panel must produce a user-facing error without destroying a valid persisted session.
- **Motion/interaction conflict:** while recording, dragging the controller, using reduced motion, or rapidly toggling pause must never trigger coffee/play/litter animations or duplicate recorder actions.

---

## File Map

### New files

- `sidepanel.html` — Vite entry document for the persistent main UI.
- `src/panel/main.tsx` — mounts the Side Panel React app.
- `src/panel/App.tsx` — Side Panel orchestration and state subscription.
- `src/panel/styles.css` — responsive Side Panel layout consuming theme tokens.
- `src/panel/components/PanelHeader.tsx` — compact product header/status/settings action.
- `src/panel/components/PrimaryControls.tsx` — start/screenshot/pause/stop controls.
- `src/panel/sections/SessionSection.tsx` — session summary and post-stop primary CTA.
- `src/panel/sections/StepsSection.tsx` — step list/manual-step/edit actions.
- `src/panel/sections/EvidenceSection.tsx` — Network/Console subviews.
- `src/panel/sections/ScreenshotsSection.tsx` — screenshot list/link/delete actions.
- `src/panel/sections/ReportSection.tsx` — Bug Report primary builder plus Test Case/Checklist secondary builders.
- `src/panel/components/SettingsPanel.tsx` — theme, mascot activity, slow threshold and privacy details.
- `src/shared/stateMigration.ts` — pure v0.3.1 → v0.3.2 state/settings normalization.
- `src/shared/stateMigration.test.ts` — migration/data-preservation tests.
- `src/shared/theme.ts` — theme names/defaults and safe normalization.
- `src/shared/theme.test.ts` — theme fallback tests.
- `src/mascot/animation.ts` — pure animation scheduling/selection rules.
- `src/mascot/animation.test.ts` — cadence, recording restrictions and coffee tests.

### Existing files to modify

- `package.json` / `package-lock.json` — v0.3.2, Vitest scripts/dependency.
- `vite.config.ts` — build `sidepanel.html` instead of the old popup entry.
- `public/manifest.json` — QA Cat branding, Side Panel permission/config, minimum Chrome version, remove `default_popup`.
- `src/scripts/types.d.ts` — schema/settings/controller/theme types for v0.3.2.
- `src/scripts/background.ts` — migration use, Side Panel opening, settings validation, state notifications.
- `src/scripts/content.ts` — replace wide toolbar with collapsed/expanded draggable Cat Controller.
- `src/mascot/Mascot.tsx` / `src/mascot/mascot.css` — visual details and animation rendering.
- `tsconfig.json` — include panel/mascot/shared UI code.
- `tsconfig.scripts.json` — include shared runtime migration code if imported by the worker.
- `.github/workflows/build.yml` — run tests before build and verify Side Panel output.
- `README.md` — final product name/architecture/features/install instructions.
- `docs/v0.3.1-backlog.md` — mark v0.3.2 transition appropriately after implementation.
- Remove final legacy files only after Side Panel parity: `popup.html`, `src/popup/**`.

---

### Task 1: State schema, migration and automated test foundation

**Files:**
- Create: `src/shared/stateMigration.ts`
- Create: `src/shared/stateMigration.test.ts`
- Create: `src/shared/theme.ts`
- Create: `src/shared/theme.test.ts`
- Modify: `src/scripts/types.d.ts`
- Modify: `src/scripts/background.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.scripts.json`

**Interfaces:**
- Produces: `migrateRecorderState(raw: unknown): RecorderState`, `normalizeRecorderTheme(value: unknown): RecorderTheme`.
- Produces settings fields: `theme`, `mascotActivity`, `controllerPosition`, `controllerCollapsed`, `slowRequestThresholdMs`, `reducedMotionOverride`.
- Later tasks consume the migrated `RecorderState` and exact settings names above.

- [ ] **Step 1: Add Vitest and test scripts**

Add `vitest` as a dev dependency and scripts `test: "vitest run"` and `test:watch: "vitest"`; refresh lockfile with `npm install`.

- [ ] **Step 2: Write failing migration tests**

Create tests asserting:
- old `mascotEnabled=false` → `mascotActivity="off"`;
- old `mascotEnabled=true, funMode=false` → `"calm"`;
- old `mascotEnabled=true, funMode=true` → `"active"`;
- missing theme → `"night"`;
- missing `controllerCollapsed` → `true`;
- invalid theme → `"night"`;
- existing session ID/status/target tab/timing, steps, evidence, screenshots and all drafts remain byte-for-byte equivalent in their meaningful fields;
- existing slow threshold is preserved and clamped to current supported bounds;
- current v0.3.2-shaped state is idempotent through migration.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- src/shared/stateMigration.test.ts src/shared/theme.test.ts`
Expected: FAIL because migration/theme modules do not yet exist.

- [ ] **Step 4: Implement schema/settings migration**

Implement `normalizeRecorderTheme(value: unknown): RecorderTheme` and `migrateRecorderState(raw: unknown): RecorderState`. Bump `RecorderState.schemaVersion` to **4** to represent the v0.3.2 state shape; preserve all non-settings data defined by the current schema.

- [ ] **Step 5: Route background load through migration**

Replace current ad-hoc `normalizeState` settings mapping with the tested migration function. `loadState()` must always return schema v4; `onInstalled` persists the migrated shape without clearing sessions.

- [ ] **Step 6: Run tests and type/build verification**

Run: `npm test && npm run build`
Expected: all tests PASS; build exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/shared src/scripts/types.d.ts src/scripts/background.ts tsconfig.scripts.json
git commit -m "test: добавить миграцию состояния Recorder v0.3.2"
```

---

### Task 2: Side Panel platform shell and Chrome action behavior

**Files:**
- Create: `sidepanel.html`
- Create: `src/panel/main.tsx`
- Create: `src/panel/App.tsx`
- Create: `src/panel/styles.css`
- Modify: `public/manifest.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `src/scripts/background.ts`

**Interfaces:**
- Consumes: schema-v4 `RecorderState` from Task 1.
- Produces: `OPEN_PANEL` background action and persistent Side Panel entry at `sidepanel.html`.

- [ ] **Step 1: Add a failing manifest/build verification script**

Before changing the manifest, run a shell check that expects `side_panel.default_path === "sidepanel.html"`, `minimum_chrome_version === "116"`, permission `sidePanel`, and no `action.default_popup`.
Expected: FAIL against v0.3.1 manifest.

- [ ] **Step 2: Add Side Panel manifest configuration**

Set product name/title to `QA Cat Recorder`, version `0.3.2`, `minimum_chrome_version: "116"`, add `sidePanel` permission and `side_panel: { "default_path": "sidepanel.html" }`; keep action title but remove `default_popup`.

- [ ] **Step 3: Configure action click behavior**

On extension install/startup, call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Add `OPEN_PANEL` handling that calls `chrome.sidePanel.open({ tabId })` only when triggered from an explicit user interaction path; return a graceful error instead of modifying session state on failure.

- [ ] **Step 4: Create minimal Side Panel React shell**

Mount a minimal `QA Cat Recorder` panel that loads `GET_STATE`, subscribes to `chrome.storage.onChanged`, and displays current status/session ID. No old popup feature removal yet.

- [ ] **Step 5: Switch Vite main entry to Side Panel**

Build `sidepanel.html`; keep old popup source files temporarily for reference but do not expose them from the manifest.

- [ ] **Step 6: Verify platform shell**

Run: `npm test && npm run build`
Then assert: `dist/sidepanel.html`, `dist/scripts/background.js`, `dist/scripts/content.js`, `dist/scripts/pageBridge.js` exist and manifest has the required Side Panel fields.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add sidepanel.html src/panel public/manifest.json vite.config.ts tsconfig.json src/scripts/background.ts
git commit -m "feat: перевести QA Cat Recorder на Side Panel"
```

---

### Task 3: QA-first Side Panel UX parity and simplification

**Files:**
- Create/Modify: `src/panel/components/PanelHeader.tsx`
- Create/Modify: `src/panel/components/PrimaryControls.tsx`
- Create/Modify: `src/panel/sections/SessionSection.tsx`
- Create/Modify: `src/panel/sections/StepsSection.tsx`
- Create/Modify: `src/panel/sections/EvidenceSection.tsx`
- Create/Modify: `src/panel/sections/ScreenshotsSection.tsx`
- Create/Modify: `src/panel/sections/ReportSection.tsx`
- Create/Modify: `src/panel/components/SettingsPanel.tsx`
- Modify: `src/panel/App.tsx`
- Modify: `src/panel/styles.css`
- Reference only until parity is reached: `src/popup/App.tsx`, `src/popup/styles.css`

**Interfaces:**
- Consumes: existing runtime message actions (`START_RECORDING`, `TOGGLE_PAUSE`, `CAPTURE_SCREENSHOT`, `STOP_RECORDING`, builder/update actions).
- Produces: navigation IDs `session | steps | evidence | screenshots | report`; Evidence subview `network | console`.

- [ ] **Step 1: Port behavior, not layout, from the popup**

Move existing command/state-subscription behavior into `src/panel/App.tsx` and keep all existing Recorder operations functional before visual simplification.

- [ ] **Step 2: Implement exact five-section navigation**

Top-level sections must be `Сессия`, `Шаги`, `Evidence`, `Скриншоты`, `Отчёт`. Settings opens from the header and is not a sixth top-level tab.

- [ ] **Step 3: Group Network and Console inside Evidence**

Preserve existing filters, duration/slow badges, sanitized messages and counts; add `Network | Console` subview switching without changing stored evidence.

- [ ] **Step 4: Keep active recording controls persistent**

When status is recording/paused, screenshot/pause/stop controls remain visible independent of selected section. Starting/new session remains available in the appropriate idle/stopped state.

- [ ] **Step 5: Make Bug Report the primary post-stop action**

After Stop, `Создать Bug Report` is primary. Test Case and Checklist remain available as secondary modes in Report; preserve reset/rebuild/copy/export functionality.

- [ ] **Step 6: Remove redundant header/privacy clutter**

Header is `QA Cat Recorder` + status + settings action. Do not render `QA CAT BUDDY` as dominant eyebrow and do not render `Инструмент для русскоязычных QA`. Replace the large privacy card with `🛡 Локальное хранение`; full explanation lives in Settings → Privacy.

- [ ] **Step 7: Review Focus verification — panel lifecycle**

Manual dev check: start a session, close Side Panel, interact with page, reopen panel. Expected: same session ID, increased steps, unchanged drafts/evidence except legitimate new events.

- [ ] **Step 8: Run automated/build verification**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/panel
git commit -m "feat: упростить Side Panel под QA-сценарий"
```

---

### Task 4: Persistent Cat Controller with self-interaction isolation

**Files:**
- Modify: `src/scripts/content.ts`
- Modify: `src/scripts/background.ts`
- Modify: `src/scripts/types.d.ts`
- Create: `src/shared/controller.ts`
- Create: `src/shared/controller.test.ts`

**Interfaces:**
- Produces: `isRecorderOwnedInteraction(path: EventTarget[]): boolean` (or equivalent pure helper), controller state fields `controllerPosition`, `controllerCollapsed`.
- Consumes: `OPEN_PANEL`, screenshot/pause/stop and settings update background actions.

- [ ] **Step 1: Write failing controller isolation/state tests**

Tests must pin:
- an event path containing Recorder controller host is classified as Recorder-owned;
- ordinary page paths are not;
- controller position normalization prevents negative persisted coordinates;
- collapsed state defaults true after migration.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm test -- src/shared/controller.test.ts`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Replace the current wide toolbar with collapsed/expanded controller**

Collapsed view shows cat/status/step count. Expanded view shows title/status, step count/time, screenshot/pause/stop and `Открыть Recorder`.

- [ ] **Step 4: Add drag persistence**

Use pointer events inside the existing Shadow DOM; clamp to viewport and persist `controllerPosition` through `UPDATE_SETTINGS`. Double-click or an explicit reset affordance may return to default position.

- [ ] **Step 5: Persist expand/collapse**

Toggle `controllerCollapsed` on user click; restore it after reload/content-script reinjection.

- [ ] **Step 6: Open Side Panel from controller**

Controller sends `OPEN_PANEL` after explicit user click; background opens for the sender tab. If opening fails, controller remains usable and active recording continues.

- [ ] **Step 7: Prevent self-recording**

Use composed-path/host isolation before clickable/field detection. Verify controller click, drag, pause, screenshot, stop and open-panel interactions never emit `RECORDER_EVENT`.

- [ ] **Step 8: Keep screenshot behavior reliable**

Before capture, temporarily hide controller host, allow the paint to settle, request screenshot, then restore host in `finally`; if this proves unreliable in Chrome smoke, prioritize successful capture and document controller visibility rather than breaking screenshots.

- [ ] **Step 9: Verify Review Focus cases**

Manual dev checks: controller click not recorded; neighboring page button is recorded; reload restores position/collapsed state; Side Panel-open failure does not reset session.

- [ ] **Step 10: Run tests/build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/scripts/content.ts src/scripts/background.ts src/scripts/types.d.ts src/shared/controller*
git commit -m "feat: добавить сворачиваемый Cat Controller"
```

---

### Task 5: Theme system, Cat Café/Debug Violet and paw pattern

**Files:**
- Modify: `src/shared/theme.ts`
- Modify: `src/shared/theme.test.ts`
- Modify: `src/panel/App.tsx`
- Modify: `src/panel/components/SettingsPanel.tsx`
- Modify: `src/panel/styles.css`
- Modify: `src/scripts/content.ts` (controller token mapping only if controller follows theme)

**Interfaces:**
- Consumes: `RecorderTheme = "night" | "cafe" | "violet"`.
- Produces: root `data-theme` contract and CSS tokens `--bg`, `--surface`, `--surface-soft`, `--border`, `--text`, `--muted`, `--accent`, `--accent-soft`, `--danger`, `--warning`.

- [ ] **Step 1: Extend theme tests**

Assert all three exact themes are accepted, arbitrary values normalize to `night`, and a missing theme normalizes to `night`.

- [ ] **Step 2: Replace major hard-coded panel colors with tokens**

Implement Night QA first and verify visual parity/readability before adding variants.

- [ ] **Step 3: Add Cat Café and Debug Violet token sets**

Do not duplicate component CSS. Persist theme through `UPDATE_SETTINGS` and apply it immediately without reload.

- [ ] **Step 4: Add subtle paw pattern**

Implement lightweight SVG/CSS pattern at 2–3.5% opacity only on empty/background areas; never place it beneath dense evidence lists, forms or critical statuses.

- [ ] **Step 5: Verify keyboard/focus and contrast manually**

Tab through primary controls/settings under all three themes; focus state must stay visible and text readable.

- [ ] **Step 6: Run tests/build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/theme* src/panel src/scripts/content.ts
git commit -m "style: добавить темы QA Cat Recorder"
```

---

### Task 6: Mascot v3 visual polish and animation scheduler

**Files:**
- Create: `src/mascot/animation.ts`
- Create: `src/mascot/animation.test.ts`
- Modify: `src/mascot/Mascot.tsx`
- Modify: `src/mascot/mascot.css`
- Modify: `src/panel/components/SettingsPanel.tsx`
- Modify: `src/panel/App.tsx`

**Interfaces:**
- Produces: `MascotActivity = "off" | "calm" | "active"`, animation state selection functions and `coffee` state.
- Suggested pure signatures: `pickMicroState(random: number): MascotState`, `pickVibeState(activity: MascotActivity, random: number): MascotState`, `isAnimationAllowed(state, recording, reducedMotion, activity): boolean`, `nextMicroDelay(random): number`, `nextVibeDelay(random): number`.

- [ ] **Step 1: Write failing animation-rule tests**

Pin exact rules:
- idle micro delay ∈ 7–15 s;
- non-recording vibe delay ∈ 25–50 s;
- recording never allows `play`, `walk`, `litter`, `coffee` or large stretch;
- reduced motion permits no non-essential animation;
- Calm never selects litter;
- Active may select litter rarely;
- coffee lies in approximately the specified 10–15% selection band via deterministic threshold boundaries;
- coffee duration is 4–5 s.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm test -- src/mascot/animation.test.ts`
Expected: FAIL because scheduler module does not exist.

- [ ] **Step 3: Extract scheduling from `Mascot.tsx`**

Remove random timing/selection logic from the component and consume the tested scheduler. Never keep a high-frequency permanent timer.

- [ ] **Step 4: Add micro states and recording quiet mode**

Implement blink/ear/tail/look/paw visuals; during recording schedule only allowed quiet states plus occasional wash.

- [ ] **Step 5: Add visual detail**

Add inner ears, eye highlights, clearer muzzle/cheeks, readable paws, chest marking, tail stripes, QA collar and small QA tag while keeping CSS/pixel rendering lightweight.

- [ ] **Step 6: Add coffee animation**

Render cup + steam + sip + small tail movement; no text toast. Coffee must cancel/avoid start when recording, reduced motion, dragging or another animation is active.

- [ ] **Step 7: Replace old mascot toggles in Settings**

Expose `Выкл · Спокойный · Активный`. Respect system reduced-motion by default; expose override only in an Advanced subsection if implemented.

- [ ] **Step 8: Run tests/build and observe cadence manually**

Run: `npm test && npm run build`
Expected: PASS. Manual observation must confirm micro activity is noticeable but not constant and recording mode is quieter.

- [ ] **Step 9: Commit**

```bash
git add src/mascot src/panel/components/SettingsPanel.tsx src/panel/App.tsx
git commit -m "feat: обновить mascot v3 и добавить coffee animation"
```

---

### Task 7: Remove legacy popup, synchronize branding/version and CI

**Files:**
- Delete: `popup.html`
- Delete: `src/popup/**`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/manifest.json`
- Modify: `.github/workflows/build.yml`
- Modify: `README.md`
- Modify: `docs/v0.3.1-backlog.md`

**Interfaces:**
- Consumes: completed Side Panel feature parity from Tasks 2–6.
- Produces: one-main-UI v0.3.2 repository and CI gate.

- [ ] **Step 1: Confirm no runtime/build references to popup remain**

Search for `popup.html`, `src/popup`, `QA Buddy Recorder`, `Инструмент для русскоязычных QA`. Before deletion, only intentional historical docs may still match.

- [ ] **Step 2: Delete old popup UI**

Remove `popup.html` and `src/popup/**` only after Side Panel has parity for start/session/steps/evidence/screenshots/builders/settings.

- [ ] **Step 3: Synchronize release metadata**

Set package/manifest version to `0.3.2`, product name/title/description to QA Cat Recorder, retain repository name. Refresh lockfile.

- [ ] **Step 4: Update CI**

CI sequence: `npm ci` → `npm test` → `npm run build` → verify `dist/sidepanel.html`, manifest and all three scripts. Do not verify `dist/popup.html`.

- [ ] **Step 5: Update README and backlog**

Document Side Panel, Cat Controller, themes, privacy, builders, mascot activity and v0.3.2 install/smoke flow. Do not claim future screenshot annotations/history/integrations.

- [ ] **Step 6: Run hygiene checks**

Run repository scans for tracked `.env`/key files, obvious secret-like text, `TODO/FIXME/debugger`, and stale product-name UI copy; investigate matches rather than blindly deleting intentional docs.

- [ ] **Step 7: Run full automated verification**

Run: `npm ci && npm test && npm run build`
Expected: tests PASS, build exits 0, required Side Panel artifacts exist.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "release: подготовить QA Cat Recorder v0.3.2"
```

---

### Task 8: Chrome manual smoke and release gate

**Files:**
- Modify only if defects found: owning source/test files from Tasks 1–7.
- Optional documentation update: `README.md` or release notes only after verified behavior.

**Interfaces:**
- Consumes: final unpacked `dist/` build.
- Produces: explicit PASS/FAIL release decision; does **not** make repository public.

- [ ] **Step 1: Build from a clean dependency install**

Run: `npm ci && npm test && npm run build`
Expected: all PASS/exit 0.

- [ ] **Step 2: Install clean unpacked extension in Chrome 116+**

Load `dist/` and verify no extension errors before starting the smoke.

- [ ] **Step 3: Execute the 26-point smoke from the approved spec**

Record PASS/FAIL for each item, especially panel persistence, controller isolation, all evidence types, three themes, mascot modes, coffee outside recording and reduced motion.

- [ ] **Step 4: Explicit Review Focus checks**

Additionally verify:
- migrate a preserved v0.3.1-like active state without data loss;
- close/reopen panel during active recording;
- controller actions create no tested-page steps;
- attempt start on a non-http(s) page and confirm graceful error/no state destruction;
- rapidly pause/resume while dragging controller with reduced motion enabled and confirm no duplicate actions/forbidden animations.

- [ ] **Step 5: Fix any release-blocking defect using TDD where automatable**

For each defect: add failing regression test where the logic can be isolated, verify RED, implement minimal fix, verify GREEN, then rerun the full automated suite and the affected smoke step.

- [ ] **Step 6: Final repository verification**

Run: `git status --short`, `npm test`, `npm run build`, and inspect `chrome://extensions`/service-worker console.
Expected: clean working tree, tests/build green, no red extension errors.

- [ ] **Step 7: Commit smoke-driven fixes if any**

Use focused Russian commit messages per defect; do not create an empty commit if no changes were required.

- [ ] **Step 8: Stop before publication**

Report `public-ready` status and remaining risks. Repository visibility change and repository rename are separate explicit user decisions outside v0.3.2 implementation.
