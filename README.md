# QA Buddy Recorder 🐱

**QA Buddy Recorder** — browser extension для ручного QA, которая помогает фиксировать шаги воспроизведения, собирать technical evidence и собирать черновики QA-артефактов во время тестовой сессии.

Проект ориентирован прежде всего на **русскоязычных QA** и является частью экосистемы [QA Buddy](https://github.com/kitkotcat/qa-buddy).

## Статус

- **Version:** v0.3.1
- **Status:** active development / portfolio project
- **Browsers:** Chrome / Edge, Manifest V3
- **Storage:** local-only, `chrome.storage.local`
- **CI:** GitHub Actions build

## Что умеет Recorder

### Recording & evidence

- Start / Pause / Resume / Stop recording session;
- запись page navigation и пользовательских кликов;
- фиксация изменений полей без сохранения введённых значений;
- floating toolbar поверх тестируемой страницы;
- ручной screenshot текущей вкладки;
- привязка screenshot к последнему recorded step;
- автоматический capture HTTP **4xx / 5xx**;
- capture network errors;
- capture `console.error`, uncaught exceptions и unhandled promise rejections;
- отображение request duration и slow requests;
- итоговая сводка recorded session.

### QA Builders

В v0.3.1 доступны три режима:

- **Bug Report Builder**;
- **Test Case Builder**;
- **Checklist Builder**.

Поддерживаются:

- переключение между builders;
- редактирование draft;
- пересборка draft из текущих steps/evidence;
- сброс только draft без удаления raw evidence;
- создание новой сессии;
- Markdown export для QA-артефактов;
- JSON export recorded session.

### Environment metadata

Recorder автоматически собирает технический контекст сессии:

- URL / domain;
- browser;
- OS;
- viewport;
- locale.

## Privacy first

Recorder работает локально и не отправляет записанные данные на внешний backend.

Основные правила:

- значения из `input` / `textarea` не сохраняются;
- password values не должны попадать в session data;
- screenshots создаются только после явного действия пользователя;
- чувствительные query params маскируются перед сохранением;
- типовые secret patterns маскируются в console evidence;
- steps, Network/Console metadata и screenshots хранятся локально в `chrome.storage.local`.

## Browser permissions

Расширение использует Manifest V3 permissions, необходимые для работы recorder-сценария:

- `storage` — локальное состояние сессии и settings;
- `activeTab` / `tabs` — работа с текущей тестируемой вкладкой;
- `webRequest` — сбор network metadata;
- `clipboardWrite` — копирование QA drafts;
- `<all_urls>` — возможность запускать Recorder на тестируемых web-страницах.

Перед публикацией в Chrome Web Store permissions будут отдельно пересмотрены по принципу minimum required permissions.

## RU-first UX и mascot

Интерфейс v0.3.1 ориентирован на русскоязычного QA. Английские термины сохраняются там, где это стандартная профессиональная терминология: `Bug Report`, `Test Case`, `Checklist`, `Network`, `Console`, `HTTP`, `JSON`, `Markdown`.

В интерфейсе также есть lightweight pixel mascot:

- увеличенный QA-кот с хвостом и усами;
- несколько animation states;
- Drag & Drop;
- сохранение позиции;
- возможность отключить mascot;
- reduced-motion mode.

## QA-фокус проекта

Проект используется не только как разработка расширения, но и как QA-практика:

- формализация требований и acceptance criteria;
- smoke / regression checks recorder flow;
- проверка privacy-sensitive scenarios;
- negative testing для network / console evidence;
- проверка session persistence;
- проверка reset / rebuild / new session logic;
- проверка RU-first UX;
- CI build verification.

Техническая спецификация: [`docs/v0.3-spec.md`](docs/v0.3-spec.md)  
Статус v0.3.1 и следующий backlog: [`docs/v0.3.1-backlog.md`](docs/v0.3.1-backlog.md)

## Tech stack

- Chrome Extension Manifest V3
- React
- TypeScript
- Vite
- Chrome Storage API
- Chrome WebRequest API
- GitHub Actions

## Локальная сборка

Требуется Node.js 22+.

```bash
npm ci
npm run build
```

Готовое unpacked extension будет создано в:

```text
dist/
```

## Установка в Chrome

1. Открыть `chrome://extensions`.
2. Включить **Developer mode**.
3. Нажать **Load unpacked**.
4. Выбрать папку `dist`.
5. Открыть обычную `http/https` страницу.
6. Запустить **QA Buddy Recorder**.

## Базовый smoke flow

```text
Start recording
→ выполнить тестовый сценарий
→ проверить записанные steps
→ сделать screenshot
→ получить 4xx/5xx или JS error
→ Stop
→ проверить evidence
→ открыть Bug Report / Test Case / Checklist Builder
→ Copy / Export
→ New session
```

## Структура проекта

```text
qa-buddy-recorder/
├── .github/workflows/build.yml
├── docs/
│   ├── v0.3-spec.md
│   └── v0.3.1-backlog.md
├── public/
│   └── manifest.json
├── src/
│   ├── i18n/
│   ├── mascot/
│   ├── popup/
│   └── scripts/
├── package.json
├── package-lock.json
├── popup.html
├── tsconfig.json
├── tsconfig.scripts.json
└── vite.config.ts
```

## Что ещё в работе

Следующие улучшения не заявляются как готовая функциональность:

- step reorder и дополнительные filters;
- session tags и session history;
- screenshot-step reassignment;
- IndexedDB для screenshot blobs;
- richer network / console metadata;
- direct handoff recorded session → QA Buddy;
- Chrome Web Store packaging.

## English summary

**QA Buddy Recorder** is a privacy-first Chrome/Edge extension for manual QA. It records reproduction steps, captures network/console evidence and screenshots, and helps prepare Bug Report, Test Case and Checklist drafts. The current version is **v0.3.1** and is primarily designed for Russian-speaking QA engineers.

## Author

Katy Peshkun  
GitHub: [@kitkotcat](https://github.com/kitkotcat)
