# QA Buddy Recorder 🐱

[Русский](#русский) · [English](#english)

**QA Buddy Recorder** — browser extension для ручного QA, который записывает шаги воспроизведения, собирает технические evidence и помогает быстро подготовить структурированный bug report.

Репозиторий является частью экосистемы **QA Buddy**.

---

## Русский

### Статус

**Version:** v0.2.0  
**Status:** MVP / active development  
**Browser:** Chrome / Edge, Manifest V3  
**CI:** GitHub Actions build

### Что умеет Recorder

- Start / Pause / Resume / Stop recording session
- запись page navigation и пользовательских кликов
- фиксация изменений полей без сохранения введённых значений
- floating toolbar поверх тестируемой страницы
- ручной screenshot текущей вкладки
- автоматический capture HTTP **4xx / 5xx**
- автоматический capture network errors
- capture `console.error`, uncaught exceptions и unhandled promise rejections
- redaction чувствительных query params и типовых secret patterns
- итоговый Recorded Session summary
- Copy bug draft
- Export session to JSON
- хранение session state в `chrome.storage.local`

### Privacy

Recorder разработан по принципу **privacy first**:

- значения из input / textarea не сохраняются;
- screenshots создаются только после явного нажатия 📸;
- чувствительные query params маскируются перед сохранением;
- common secret patterns маскируются в console evidence.

### Tech stack

- Chrome Extension Manifest V3
- React
- TypeScript
- Vite
- Chrome Storage API
- Chrome WebRequest API
- GitHub Actions

### Структура проекта

```text
qa-buddy-recorder/
├── .github/
│   └── workflows/
│       └── build.yml
├── public/
│   └── manifest.json
├── src/
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   └── scripts/
│       ├── background.ts
│       ├── content.ts
│       ├── pageBridge.ts
│       └── types.d.ts
├── popup.html
├── package.json
├── tsconfig.json
├── tsconfig.scripts.json
├── vite.config.ts
└── README.md
```

### Локальная сборка

```bash
npm install
npm run build
```

После build готовое unpacked extension находится в:

```text
dist/
```

### Установка в Chrome

1. Открыть `chrome://extensions`
2. Включить **Developer mode**
3. Нажать **Load unpacked**
4. Выбрать папку `dist`
5. Открыть обычную `http/https` страницу
6. Запустить **QA Buddy Recorder**

### Smoke flow

```text
Start recording
→ выполнить тестовый сценарий
→ сделать screenshot при необходимости
→ получить 4xx/5xx или JS error
→ Stop
→ Copy bug draft / Export JSON
```

### Связь с QA Buddy

**QA Buddy** — основное приложение для QA documentation и обучения.  
**QA Buddy Recorder** — companion browser extension для сбора reproduction steps и technical evidence.

Main project: https://github.com/kitkotcat/qa-buddy

### Roadmap

- screenshots, привязанные к конкретным steps
- slow request detection
- расширенная network metadata
- улучшенный console stack capture
- editable Actual / Expected result
- Markdown export
- direct handoff recorded session → QA Buddy Bug Report
- Chrome Web Store packaging

---

## English

### Status

**Version:** v0.2.0  
**Status:** MVP / active development  
**Browser:** Chrome / Edge, Manifest V3  
**CI:** GitHub Actions build

### What QA Buddy Recorder does

- Start / Pause / Resume / Stop a recording session
- Capture page navigation and user clicks
- Track field changes without storing typed values
- Show a floating toolbar on the tested page
- Capture a visible-tab screenshot on demand
- Automatically collect HTTP **4xx / 5xx**
- Automatically collect network errors
- Capture `console.error`, uncaught exceptions and unhandled promise rejections
- Redact sensitive query parameters and common secret patterns
- Show a Recorded Session summary
- Copy a structured bug-report draft
- Export the recorded session to JSON
- Persist session state in `chrome.storage.local`

### Privacy

The Recorder follows a **privacy-first** approach:

- input and textarea values are not stored;
- screenshots are created only after an explicit 📸 action;
- sensitive query parameters are redacted before storage;
- common secret patterns are redacted from console evidence.

### Tech stack

- Chrome Extension Manifest V3
- React
- TypeScript
- Vite
- Chrome Storage API
- Chrome WebRequest API
- GitHub Actions

### Local build

```bash
npm install
npm run build
```

The unpacked extension is generated in:

```text
dist/
```

### Install in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` directory
5. Open a regular `http/https` page
6. Start **QA Buddy Recorder**

### Smoke flow

```text
Start recording
→ reproduce the scenario
→ take a screenshot when useful
→ trigger an HTTP or JavaScript error
→ Stop
→ Copy bug draft / Export JSON
```

### QA Buddy ecosystem

**QA Buddy** is the main QA documentation and learning app.  
**QA Buddy Recorder** is its companion browser extension for reproduction steps and technical evidence.

Main project: https://github.com/kitkotcat/qa-buddy

### Roadmap

- screenshots linked to individual steps
- slow-request detection
- richer network metadata
- improved console stack capture
- editable Actual / Expected result
- Markdown export
- direct recorded-session handoff to QA Buddy
- Chrome Web Store packaging
