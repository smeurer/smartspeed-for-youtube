# AGENTS.md

## Project Overview
SmartTube: Speed & Auto-Like for YouTube (Chrome / Vivaldi Extension - Manifest V3).
Stores custom video playback speeds and auto-like triggers per YouTube Channel ID / Handle in `chrome.storage.local` and applies them automatically upon video load/navigation/playback.

## Language & Documentation Guidelines
- **Documentation Language**: All documentation files (`README.md`, `AGENTS.md`, `walkthrough.md`, `implementation_plan.md`, etc.) MUST ALWAYS be written in **English**.

## Technical Architecture Insights
- **Target Browser Engine**: Chromium (Vivaldi, Google Chrome, Brave, Edge).
- **Extension Standard**: Manifest V3.
- **UI Approach (MVP)**: Clean Popup UI only (`popup.html` / `popup.js`). No DOM overlays or buttons injected into YouTube pages.
- **YouTube SPA Navigation Handling**:
  - *Critical Insight*: Custom page events like `yt-navigate-finish` dispatched in YouTube's main world window do NOT trigger listeners in isolated world content scripts.
  - *Solution*: Track `location.href` changes, observe `<title>` / `<video>` mutations via `MutationObserver`, listen to `loadstart`/`play`/`timeupdate` video events, and run polling/retry loops until channel metadata renders.
- **Channel Detection Priority**:
  - *Critical Insight*: `<head>` meta tags (`<link itemprop="name">`) are static and do NOT update on YouTube SPA video navigation.
  - *Solution*: Always prioritize dynamic DOM elements inside `ytd-watch-metadata #channel-name a` or `ytd-video-owner-renderer #channel-name a` using `innerText` over static meta tags.
- **Playback Control**: Direct manipulation of `HTMLMediaElement.playbackRate` on `document.querySelector('video')`.
- **Auto-Like Execution**:
  - *Progress Monitoring*: `timeupdate` event listener calculates percentage (`currentTime / duration * 100`) or elapsed time in seconds.
  - *DOM Selector*: Modern YouTube segmented like button (`like-button-view-model button`, `#top-level-buttons-computed segmented-like-dislike-button-view-model button`).
  - *Safety Guard*: Checks `aria-pressed="true"` on button and parent container before invoking `.click()` to prevent un-liking videos.
  - *Idempotency*: Maintains `lastLikedVideoId` in memory to prevent duplicate triggers on video seek/rewind.
- **Vivaldi Extension Toolbar Behavior**:
  - *Insight*: Vivaldi's custom React-based UI handles extension action icons dynamically and may periodically toggle icon visibility, extension popup button state, or tint toolbar icons depending on active tab matches, address bar customization, or theme scaling.

## Internationalization (i18n) Guidelines
- **Mandatory for New Features**: All new UI components, user-facing labels, badges, buttons, tooltips, or dynamic status text MUST be internationalized using `chrome.i18n.getMessage(...)` and `_locales/`.
- **Supported Locales**: Both `_locales/en/messages.json` (Default) and `_locales/de/messages.json` MUST be updated in sync whenever new keys are added.
- **Validation Script**: Run `node scripts/check_i18n.js` (or `npm test`) whenever adding UI features to verify that no untranslated or missing keys exist across languages.
