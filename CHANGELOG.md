# Changelog

## v0.3.2 — 2026-10-05

First public working release of QA Cat Recorder.

### Added
- Chrome Side Panel as the main workspace.
- Persistent floating QA controller with Screenshot, Pause/Resume and Stop.
- Recorded reproduction steps with safe form values.
- Automatic masking for passwords, OTP, tokens, API keys, PIN/CVV/security codes and payment-card numbers.
- Network evidence for 4xx/5xx, failed and slow requests.
- Console error evidence.
- Manual screenshots linked to recorded steps.
- Bug Report, Test Case and Checklist builders.
- Night QA, Cat Café and Debug Violet themes.
- QA Cat mascot with reduced-motion support.
- Local-only session storage and privacy controls.

### Fixed
- Long URLs no longer break Checklist layout.
- Floating controller stays fully available while the Side Panel is open or closed.
- Text-field interactions are recorded reliably on change/focusout instead of being lost during login flows.
- Night QA contrast and mascot visual polish.
