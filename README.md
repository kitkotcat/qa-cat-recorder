# QA Buddy Recorder 🐱

**QA Buddy Recorder** is the browser-extension companion to **QA Cat Buddy**.

The main QA Buddy app helps with QA learning and documentation. The Recorder captures a manual reproduction flow in the browser and turns it into structured QA evidence.

## Project family

- **QA Cat Buddy** — bug reports, test cases, checklists, interview training and QA learning
- **QA Buddy Recorder** — Chrome / Edge recorder for reproduction steps and technical evidence

Both repositories are developed as one QA Buddy ecosystem.

## MVP

- Start / pause / resume / stop recording
- Capture page opens and navigation
- Capture clicks on common interactive controls
- Capture field changes without storing entered values
- Floating QA Buddy recording toolbar
- Persistent session state with `chrome.storage.local`
- Up to 500 steps per session

## Privacy first

Typed field values are intentionally not stored. The recorder saves only the action and a safe field label / name / type.

## Stack

- Chrome Extension Manifest V3
- React
- TypeScript
- Vite
- Chrome Storage API

## Run locally

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated `dist` folder.

## Roadmap

- Screenshots attached to steps
- Network request capture
- 4xx / 5xx and suspicious-request filters
- Console error capture
- Automatic bug-report generation
- Markdown / JSON export
- Sensitive-data masking rules
- Integration back into QA Cat Buddy
