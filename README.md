# SmartSpeed for YouTube

A browser extension (Manifest V3) for Chromium-based browsers (Vivaldi, Google Chrome, Brave, Edge) that automatically saves and applies custom video playback speeds per YouTube channel.

## Key Features

- **Channel-based Playback Speeds**: Automatically set custom speeds per YouTube channel (e.g., `1.3x` for podcasts/talks, `1.0x` for music videos).
- **Manifest V3 Compliant**: Built natively for modern Chromium extension standards.
- **Clean Popup UI**: Manage default and channel-specific speeds directly from the extension popup without intrusive UI overlays injected into YouTube's webpage.
- **Robust SPA Navigation Handling**: Seamlessly detects video and channel changes on YouTube without requiring full page reloads.

---

## Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/smartspeed-for-youtube.git
   ```
2. Open your browser's extension management page:
   - **Vivaldi**: `vivaldi://extensions`
   - **Chrome / Brave / Edge**: `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the project directory.

---

## Usage

1. Navigate to any YouTube video (e.g., `youtube.com/watch?v=...`).
2. Click the **SmartSpeed** extension icon in your browser toolbar.
3. Choose your target playback speed (e.g., `1.3x`) and click **Save Channel Speed**.
4. Future videos from this channel will automatically play at your chosen speed!
