# SmartTube: Speed, Volume & Auto-Like for YouTube

A modern browser extension (Manifest V3) for Chromium-based browsers (Vivaldi, Google Chrome, Brave, Edge) that automatically manages custom video playback speeds, volume levels, and intelligent auto-liking per YouTube channel.

## Key Features

- **Channel-based Playback Speeds**: Automatically set custom speeds per YouTube channel (e.g., `1.3x` for podcasts/talks, `1.0x` for music videos).
- **Channel-based Volume Levels**: Automatically set custom volume levels (0% – 100%) per YouTube channel (e.g. quieter for loud channels, louder for quiet creators).
- **Automated Intelligent Auto-Like**: Automatically like videos from selected channels after reaching a custom duration/percentage threshold (e.g. after watching 30% of the video or 60 seconds).
- **Live Icon Status Badge & Tooltip**: Displays an active status badge (e.g. `1.5x`) on the extension icon when custom channel rules are active, and provides a detailed hover tooltip summarizing current channel, speed, volume, and auto-like settings.
- **Manifest V3 Compliant**: Built natively for modern Chromium extension standards with a background service worker.
- **Clean Popup UI**: Configure global defaults and channel-specific rules directly from the extension popup.
- **Robust SPA Navigation Handling**: Seamlessly detects video and channel changes on YouTube without requiring full page reloads.
- **Internationalized (i18n)**: Fully localized in English (`en`) and German (`de`), automatically adjusting to your browser's language setting.

---

## Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/smarttube-speed-and-autolike.git
   ```
2. Open your browser's extension management page:
   - **Vivaldi**: `vivaldi://extensions`
   - **Chrome / Brave / Edge**: `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the project directory.

---

## Usage

1. Navigate to any YouTube video (e.g., `youtube.com/watch?v=...`).
2. Click the **SmartTube** extension icon in your browser toolbar.
3. Configure your desired playback speed and/or Auto-Like trigger rules for the channel.
4. Click **Save Channel Rules**.
5. Future videos from this channel will automatically apply your speed and auto-like settings!

---

## Testing & i18n Validation

To verify that all user-facing strings are properly internationalized and synchronized between languages:

```bash
npm test
```
or
```bash
node scripts/check_i18n.js
```
