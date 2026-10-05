# QA Cat Recorder 🐱

**QA Cat Recorder** — Chrome/Edge extension для ручного QA, который помогает один раз воспроизвести проблему и автоматически собрать полезный контекст: steps, screenshots, Network/Console evidence и черновики QA-артефактов.

Проект ориентирован на быстрый рабочий flow: **минимум лишних действий во время тестирования, максимум полезного evidence после воспроизведения**.

## Статус

- **Version:** v0.3.2
- **Status:** public beta / first working release
- **Browsers:** Chrome 116+ / Chromium-based Edge
- **Manifest:** V3
- **Storage:** local-only, `chrome.storage.local`
- **CI:** GitHub Actions — tests + build

## Основной UX

### Side Panel

Главный интерфейс работает через постоянный Chrome Side Panel и не закрывается при обычном взаимодействии с тестируемой страницей.

Основные разделы:

- **Сессия**
- **Шаги**
- **Evidence** — Network / Console
- **Скриншоты**
- **Отчёт**

Настройки открываются отдельно через `⚙`.

### Cat Controller

Во время активной записи на тестируемой странице остаётся полноценный floating controller:

- step counter, timer и recording status;
- screenshot;
- pause / resume;
- stop;
- открыть Side Panel;
- drag & drop;
- сохранение позиции;
- остаётся доступным вместе с открытым Side Panel.

Controller работает внутри Shadow DOM, чтобы меньше зависеть от CSS тестируемого сайта. Его собственные клики не должны попадать в recorded steps.

## Что собирает Recorder

### Steps

- page navigation;
- clicks;
- input / textarea — с безопасными значениями, если это включено в Settings;
- select / checkbox / radio — как осмысленные пользовательские действия;
- password / OTP / token / API key / PIN / CVV / card number — всегда маскируются;
- manual steps;
- notes;
- important flag;
- удаление ошибочно записанного шага.

### Network evidence

- HTTP 4xx / 5xx;
- network errors;
- method;
- endpoint;
- resource type;
- request duration;
- slow request detection с настраиваемым threshold.

### Console evidence

- `console.error`;
- uncaught exceptions;
- unhandled promise rejections;
- sanitized message и source URL.

### Screenshots

- только по явному действию пользователя;
- связываются с последним recorded step;
- можно исключить из итогового report;
- controller временно скрывается на время capture, чтобы не попадать в screenshot, где это поддерживается браузером.

## QA Builders

После завершения сессии основное действие — **Создать Bug Report**.

Также доступны:

- **Test Case Builder**;
- **Checklist Builder**.

Builders используют данные recorded session и позволяют редактировать результат перед копированием/экспортом.

Поддерживаются:

- copy;
- Markdown export;
- JSON session export;
- reset draft без удаления raw evidence;
- rebuild draft из текущих steps.

## Темы

В v0.3.2 доступны три встроенные темы:

- **Night QA** — default;
- **Cat Café**;
- **Debug Violet**.

UI построен на CSS custom properties. На пустых фоновых областях используется очень лёгкий paw-pattern, который не должен мешать чтению evidence и форм.

## QA Cat mascot ☕

Mascot остаётся вторичным элементом интерфейса и не должен мешать тестированию.

Режимы:

- **Выкл**;
- **Спокойный**;
- **Активный**.

Micro animations происходят чаще, чем в v0.3.1, но во время активной записи кот становится заметно спокойнее.

Поддерживаются состояния:

- blink;
- ear / tail / look / paw;
- wash;
- stretch;
- play;
- walk;
- редкий litter easter egg в Active mode;
- **coffee animation ☕**.

Coffee/play/walk/litter не запускаются во время активной записи. `prefers-reduced-motion` учитывается автоматически, с возможностью override в настройках.

## Privacy first

Recorder работает local-only.

- безопасные значения форм могут локально сохраняться в Steps по настройке пользователя;
- password / OTP / token / API key / PIN / CVV / card-number values автоматически маскируются до отправки шага в background;
- чувствительные query params маскируются;
- common secret patterns маскируются в console evidence;
- screenshots создаются только вручную;
- данные не отправляются на backend;
- cloud sync / analytics / AI API в v0.3.2 отсутствуют.

## Tech stack

- Chrome Extension Manifest V3
- Chrome Side Panel API
- React 19
- TypeScript
- Vite
- Vitest
- Chrome Storage API
- Chrome WebRequest API
- Shadow DOM
- GitHub Actions

## Локальная сборка

```bash
npm ci
npm test
npm run build
```

Готовое unpacked extension находится в:

```text
dist/
```

## Установка в Chrome

1. Открыть `chrome://extensions`.
2. Включить **Developer mode**.
3. Нажать **Load unpacked**.
4. Выбрать папку `dist`.
5. Нажать на иконку **QA Cat Recorder** — откроется Side Panel.
6. Открыть обычную `http/https` страницу и запустить запись.

## Короткий smoke flow

```text
Открыть Side Panel
→ Start recording
→ проверить Cat Controller
→ выполнить clicks / navigation / input change
→ Screenshot
→ получить 4xx/5xx или Console error
→ Pause / Resume
→ Stop
→ проверить Steps / Evidence / Screenshots
→ Создать Bug Report
→ проверить Test Case / Checklist
```

Перед public release дополнительно проверяются:

- закрытие/повторное открытие Side Panel во время session;
- page reload с активной записью;
- controller не записывает собственные действия;
- все 3 темы;
- mascot Off / Calm / Active;
- reduced motion;
- coffee animation вне recording;
- отсутствие красных ошибок в `chrome://extensions` / service worker console.

## QA Buddy ecosystem

[QA Buddy](https://github.com/kitkotcat/qa-buddy) — отдельный QA portfolio project для практики web/API/backend testing и QA documentation.

QA Cat Recorder развивается как самостоятельный companion tool для ручного тестирования и сбора evidence.

## Privacy

Политика конфиденциальности: [PRIVACY.md](./PRIVACY.md).

## License

MIT — см. [LICENSE](./LICENSE).

## Roadmap после v0.3.2

Не входит в текущий release:

- screenshot annotations;
- session history / IndexedDB;
- Jira / YouGile integrations;
- cloud sync / AI report generation.

---

### English summary

**QA Cat Recorder** is a privacy-first Chrome/Edge extension for manual QA. It keeps a persistent Side Panel next to the tested page, records reproduction steps, collects Network/Console evidence and screenshots, and helps prepare Bug Report, Test Case and Checklist drafts.
