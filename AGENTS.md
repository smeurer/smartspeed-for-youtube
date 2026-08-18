# AGENTS.md

## Project Overview
SmartSpeed for YouTube (Chrome / Vivaldi Extension - Manifest V3).
Stores custom video playback speeds per YouTube Channel ID / Handle in `chrome.storage.local` / `chrome.storage.sync` and applies them automatically upon video load/navigation.

## Language & Documentation Guidelines
- **Documentation Language**: All documentation files (`README.md`, `AGENTS.md`, `walkthrough.md`, `implementation_plan.md`, etc.) MUST ALWAYS be written in **English**.

## Technical Architecture Insights
- **Target Browser Engine**: Chromium (Vivaldi, Google Chrome, Brave, Edge).
- **Extension Standard**: Manifest V3.
- **UI Approach (MVP)**: Clean Popup UI only (`popup.html` / `popup.js`). No DOM overlays or buttons injected into YouTube pages.
- **YouTube SPA Navigation Handling**:
  - *Critical Insight*: Custom page events like `yt-navigate-finish` dispatched in YouTube's main world window do NOT trigger listeners in isolated world content scripts.
  - *Solution*: Track `location.href` changes, observe `<title>` / `<video>` mutations via `MutationObserver`, listen to `loadstart`/`play` video events, and run polling/retry loops until channel metadata renders.
- **Channel Detection Priority**:
  - *Critical Insight*: `<head>` meta tags (`<link itemprop="name">`) are static and do NOT update on YouTube SPA video navigation.
  - *Solution*: Always prioritize dynamic DOM elements inside `ytd-watch-metadata #channel-name a` or `ytd-video-owner-renderer #channel-name a` using `innerText` over static meta tags.
- **Playback Control**: Direct manipulation of `HTMLMediaElement.playbackRate` on `document.querySelector('video')`.

## Internationalization (i18n) Guidelines
- **Mandatory for New Features**: All new UI components, user-facing labels, badges, buttons, tooltips, or dynamic status text MUST be internationalized using `chrome.i18n.getMessage(...)` and `_locales/`.
- **Supported Locales**: Both `_locales/en/messages.json` (Default) and `_locales/de/messages.json` MUST be updated in sync whenever new keys are added.
- **Validation Script**: Run `node scripts/check_i18n.js` (or `npm test`) whenever adding UI features to verify that no untranslated or missing keys exist across languages.

