# QA Cat Recorder — Privacy Policy

_Last updated: October 5, 2026_

QA Cat Recorder is a local-first browser extension for manual software testing. It records reproduction steps and technical evidence only while the user explicitly runs a recording session.

## Data processed

Depending on the user's actions and settings, QA Cat Recorder may process:

- visited page URLs and page navigation during an active recording session;
- clicks and form-field interactions;
- safe form values when **Save safe values** is enabled;
- screenshots created only after an explicit screenshot action;
- failed or slow network request metadata;
- JavaScript error metadata;
- browser, operating-system, viewport and locale metadata needed for QA reports.

## Sensitive form data

QA Cat Recorder automatically masks fields that look sensitive, including passwords, authentication tokens, API keys, one-time codes, PIN/CVV/security-code fields and payment-card numbers.

Sensitive values are masked in the page content script before a recorded step is sent to the extension background process. A second sanitization layer is also applied before recorded steps are stored.

Users can disable storage of safe form values in Recorder Settings. Sensitive fields remain masked regardless of this setting.

## Storage and transmission

Session data is stored locally using `chrome.storage.local` in the user's browser profile.

QA Cat Recorder does not operate a backend service for session data, does not sync recorded sessions to the cloud, does not use analytics, and does not send recorded QA data to an AI service.

Exported Markdown or JSON files leave browser storage only when the user explicitly exports them.

## Permissions

QA Cat Recorder requests browser permissions required for its core QA workflow, including local storage, Side Panel access, tab context, screenshots, and network-request metadata. Host access is used so a recording session can work on the site selected by the user.

## Data sharing and sale

QA Cat Recorder does not sell user data and does not share recorded session data with advertisers or data brokers.

QA Cat Recorder uses handled user data only to provide and improve the extension’s single QA-recording purpose. User data is not used for personalized advertising, creditworthiness, lending, or other purposes unrelated to the extension’s core functionality. This use follows the Chrome Web Store User Data Policy and Limited Use requirements.

## Data deletion

Users can start a new session to replace the current recorded session. Removing the extension from Chrome removes extension-local data according to Chrome's extension storage behavior.

## Contact

For questions or issues, use the public GitHub repository issue tracker for QA Cat Recorder.
