# Chrome Web Store release notes — QA Cat Recorder v0.3.2

## Product name
QA Cat Recorder

## Short description
Privacy-first QA recorder for reproduction steps, screenshots, Network/Console evidence and QA drafts.

## Detailed description
QA Cat Recorder helps manual QA engineers reproduce an issue once and keep the useful evidence around it.

During an explicit recording session it can capture page navigation, clicks and form interactions, keep safe test values in steps, mask sensitive fields, collect failed/slow network requests and JavaScript errors, and save screenshots on demand.

After the session, QA Cat Recorder can turn the recorded flow into editable Bug Report, Test Case and Checklist drafts.

Key points:
- persistent Chrome Side Panel;
- floating recording controller with Screenshot, Pause/Resume and Stop;
- safe form values with automatic masking of passwords, OTP, tokens, API keys, PIN/CVV and card numbers;
- Network and Console evidence;
- local screenshots;
- Bug Report / Test Case / Checklist builders;
- local-only storage;
- no account, backend, analytics, cloud sync or AI service.

## Single purpose
QA Cat Recorder is a manual software-testing recorder that captures reproduction steps and technical QA evidence during an explicit test session and helps convert that session into QA documentation.

## Permission justifications

### storage
Stores the current QA session, settings, screenshots and generated drafts locally in the user's browser profile.

### activeTab / tabs
Identifies the user-selected test tab, opens the Side Panel for that tab, reads basic tab context needed for environment information, and captures the active tested tab on explicit screenshot actions.

### sidePanel
Provides the persistent QA workspace next to the tested page.

### webRequest
Collects failed, 4xx/5xx and slow request metadata during an active recording session for QA evidence.

### clipboardWrite
Copies generated Bug Report, Test Case and Checklist text when the user explicitly requests Copy.

### host access: <all_urls>
The recorder must be able to capture QA steps and technical evidence on whichever http/https site the user chooses to test. Recording starts only after explicit user action.

## Privacy disclosures
- Website content / user activity: yes, only during an explicit recording session.
- Form data: safe values may be stored locally when enabled; sensitive values are masked before storage.
- Authentication information: raw passwords/tokens/OTP are not intentionally stored; matching fields are masked.
- Web history: page URLs/navigation are stored locally as part of the current QA session.
- User-provided content: screenshots and manually added notes may be stored locally.
- Data sale: no.
- Advertising: no.
- Analytics: no.
- Remote backend/cloud sync: no.

Privacy policy: `PRIVACY.md` in the public repository.

## Store assets checklist
- 128×128 icon: `public/icons/icon-128.png`
- 48×48 icon: `public/icons/icon-48.png`
- 32×32 icon: `public/icons/icon-32.png`
- 16×16 icon: `public/icons/icon-16.png`
- At least one real product screenshot: required in Chrome Web Store Developer Dashboard.

## Recommended screenshots
1. Side Panel — active recording with Steps.
2. Floating controller on a tested page.
3. Evidence tab with Network / Console.
4. Finished Test Case or Bug Report builder.
5. Settings showing safe-values privacy control.

## Submission note
Use the release ZIP built from the contents of `dist/` so `manifest.json` is at the root of the archive.
