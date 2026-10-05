# QA Cat Recorder — Chrome Web Store

## Store listing

**Название:** QA Cat Recorder

**Категория:** Developer Tools

**Язык:** Русский

**Краткое описание:**
Privacy-first QA recorder: steps, safe test data, screenshots, Network/Console evidence and QA drafts.

**Главная страница:**
https://github.com/kitkotcat/qa-cat-recorder

**Поддержка:**
https://github.com/kitkotcat/qa-cat-recorder/issues

## Privacy — single purpose

QA Cat Recorder помогает QA-инженеру записать сценарий ручного тестирования на выбранном веб-сайте, собрать технические evidence (шаги, скриншоты, Network/Console metadata) и подготовить черновики Bug Report, Test Case и Checklist.

## Permission justifications

### storage
Используется для локального хранения текущей QA-сессии, шагов, настроек, Network/Console metadata, скриншотов и черновиков QA-артефактов в `chrome.storage.local`. Данные не отправляются на backend.

### activeTab
Используется для работы с текущей вкладкой пользователя и для `chrome.tabs.captureVisibleTab()` при явном действии «Скрин». Screenshot создаётся только по команде пользователя.

### webRequest
Используется во время активной записи для фиксации metadata неуспешных и медленных HTTP/HTTPS-запросов: method, URL, status/error, resource type и duration. Request/response body не считываются.

### clipboardWrite
Используется только по явному действию пользователя для копирования готового Bug Report, Test Case, Checklist или другого сформированного текста в clipboard.

### sidePanel
Используется для основного интерфейса QA Cat Recorder в Chrome Side Panel и для его открытия по действию пользователя.

### host permissions: http://*/* и https://*/*
Нужны, чтобы пользователь мог запустить запись на выбранном HTTP/HTTPS-сайте, а content scripts могли фиксировать шаги, form interactions и Console errors именно во время QA-сессии. Доступ не используется на `chrome://`, `file://` и других схемах.

## Data usage

Отметить:
- **Personally identifiable information** — safe form values могут содержать имя, email или username, если пользователь включил сохранение safe values.
- **Web history** — URL и навигация по страницам во время активной QA-сессии.
- **User activity** — clicks, form interactions и действия пользователя в записываемом сценарии.
- **Website content** — только данные, необходимые для QA-сценария: видимый screenshot по явной команде пользователя, labels элементов, safe form values и JavaScript error messages.

Не отмечать:
- Authentication information
- Financial and payment information
- Health information
- Location
- Personal communications

Пароли, OTP, tokens/API keys, PIN/CVV/security codes и payment-card values маскируются и не сохраняются в открытом виде.

## Data handling declarations

- Данные не продаются.
- Данные не используются для рекламы.
- Данные не передаются data brokers.
- QA-сессии не отправляются на внешний backend.
- Analytics и AI API отсутствуют.
- Данные хранятся локально в `chrome.storage.local`.
- Export выполняется только по явному действию пользователя.
- Privacy Policy: https://github.com/kitkotcat/qa-cat-recorder/blob/main/PRIVACY.md
- Подтверждаем соответствие Chrome Web Store User Data Policy / Limited Use.

## Submit checklist

1. Store listing заполнен на русском языке.
2. Загружены icon, минимум один реальный screenshot и обязательный promo 440x280.
3. Privacy / single purpose заполнен.
4. Для каждой permission добавлено точное обоснование.
5. Data usage соответствует фактической обработке данных.
6. Privacy Policy URL публично открывается.
7. Загружен свежий `qa-cat-recorder-v0.3.2-chrome-web-store.zip`.
8. Выполнен финальный smoke.
9. Нажать Submit for review.
