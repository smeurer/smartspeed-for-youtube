# AGENTS.md

## Project Overview
SmartTube: Speed, Volume & Auto-Like for YouTube (Chrome / Vivaldi Extension - Manifest V3).
Stores custom video playback speeds, volume levels (0-100%), and auto-like triggers per YouTube Channel ID / Handle in `chrome.storage.local` and applies them automatically upon video load/navigation/playback.

## Language & Documentation Guidelines
- **Documentation Language**: All documentation files (`README.md`, `AGENTS.md`, `walkthrough.md`, `implementation_plan.md`, etc.) MUST ALWAYS be written in **English**.

## Versioning Guidelines
- **Automatic Version Bump**: Whenever introducing a new feature, new UI functionality, or substantial structural change, ALWAYS increment/bump the extension version number in both `manifest.json` and `package.json` in sync (e.g. minor version bump `1.2.0` -> `1.3.0`).

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
- **Playback & Volume Control**: Direct manipulation of `HTMLMediaElement.playbackRate` and `HTMLMediaElement.volume` (with automatic un-muting when positive volume is set) on `document.querySelector('video')`.
- **Storage Schema**:
  - `channelSpeeds`: Map of channel handle -> float speed.
  - `defaultSpeed`: Float global default speed.
  - `channelVolumes`: Map of channel handle -> int volume (0-100).
  - `defaultVolume`: Int global default volume (0-100, default 100).
  - `channelLikes`: Map of channel handle -> `{ enabled, mode, value }`.
  - `defaultAutoLike`: Object `{ enabled, mode, value }`.
- **Auto-Like Execution**:
  - *Progress Monitoring*: `timeupdate` event listener calculates percentage (`currentTime / duration * 100`) or elapsed time in seconds.
  - *DOM Selector*: Modern YouTube segmented like button (`like-button-view-model button`, `#top-level-buttons-computed segmented-like-dislike-button-view-model button`).
  - *Safety Guard*: Checks `aria-pressed="true"` on button and parent container before invoking `.click()` to prevent un-liking videos.
  - *Idempotency*: Maintains `lastLikedVideoId` in memory to prevent duplicate triggers on video seek/rewind.
- **Extension Toolbar Icon & Tooltip**:
  - *Service Worker*: `background.js` listens to tab events (`onActivated`, `onUpdated`) and `CHANNEL_STATUS_CHANGED` messages.
  - *Badge Indicator*: Updates `chrome.action.setBadgeText(...)` and `chrome.action.setBadgeBackgroundColor(...)` (indigo accent `#6366f1`). Shows active custom playback speed (e.g., `1.5x`) or `SET` if custom volume/auto-like settings are applied.
  - *Dynamic Hover Tooltip*: Updates `chrome.action.setTitle(...)` with multi-line status showing active channel handle, speed, volume, and auto-like state.

## Internationalization (i18n) Guidelines
- **Mandatory for New Features**: All new UI components, user-facing labels, badges, buttons, tooltips, or dynamic status text MUST be internationalized using `chrome.i18n.getMessage(...)` and `_locales/`.
- **Supported Locales**: Both `_locales/en/messages.json` (Default) and `_locales/de/messages.json` MUST be updated in sync whenever new keys are added.
- **Validation Script**: Run `node scripts/check_i18n.js` (or `npm test`) whenever adding UI features to verify that no untranslated or missing keys exist across languages.
