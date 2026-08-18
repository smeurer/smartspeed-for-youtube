// SmartSpeed for YouTube - Content Script

let currentChannelInfo = null;
let targetSpeed = 1.0;
let isSettingSpeed = false;
let lastUrl = location.href;
let retryTimer = null;

// 1. Channel Detection Logic
function getYouTubeChannelInfo() {
  if (!window.location.pathname.startsWith('/watch')) {
    return null;
  }

  // Priority 1: Dynamic DOM elements in watch metadata container (updated live on SPA navigation)
  const channelAnchor = document.querySelector('ytd-watch-metadata #channel-name a') ||
                        document.querySelector('#owner #channel-name a') ||
                        document.querySelector('ytd-video-owner-renderer #channel-name a') ||
                        document.querySelector('ytd-channel-name #text a') ||
                        document.querySelector('#upload-info #channel-name a') ||
                        document.querySelector('#channel-name a');

  let handle = '';
  let name = '';

  if (channelAnchor) {
    // Extract clean text name (innerText split by newline ignores badge text)
    const rawText = channelAnchor.innerText || channelAnchor.textContent || '';
    name = rawText.split('\n')[0].trim();

    // Extract handle or channel ID from href
    const href = channelAnchor.getAttribute('href') || '';
    if (href.startsWith('/@')) {
      handle = href.substring(1); // e.g. "@HeldderSteine"
    } else if (href.includes('/channel/')) {
      handle = href.split('/channel/')[1]?.split('/')[0] || '';
    } else if (href.includes('/c/')) {
      handle = href.split('/c/')[1]?.split('/')[0] || '';
    } else if (href.startsWith('/')) {
      handle = href.substring(1);
    }
  }

  // Priority 2: Fallback to Meta tags ONLY if live DOM elements are not rendered yet
  if (!name || !handle) {
    const metaChannelName = document.querySelector('link[itemprop="name"]')?.getAttribute('content');
    const metaChannelId = document.querySelector('meta[itemprop="channelId"]')?.getAttribute('content');

    if (!name && metaChannelName) name = metaChannelName;
    if (!handle && metaChannelId) handle = metaChannelId;
  }

  // Normalize handle format
  if (handle && !handle.startsWith('UC') && !handle.startsWith('@')) {
    handle = '@' + handle;
  }

  if (!handle && !name) {
    return null;
  }

  return {
    handle: handle || name,
    name: name || handle,
    channelId: (handle.startsWith('UC') ? handle : '')
  };
}

// 2. Playback Speed Application
async function updatePlaybackSpeed() {
  const channelInfo = getYouTubeChannelInfo();
  currentChannelInfo = channelInfo;

  const storage = await chrome.storage.local.get(['channelSpeeds', 'defaultSpeed']);
  const channelSpeeds = storage.channelSpeeds || {};
  const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;

  if (channelInfo && channelSpeeds[channelInfo.handle] !== undefined) {
    targetSpeed = parseFloat(channelSpeeds[channelInfo.handle]);
  } else if (channelInfo && channelInfo.channelId && channelSpeeds[channelInfo.channelId] !== undefined) {
    targetSpeed = parseFloat(channelSpeeds[channelInfo.channelId]);
  } else {
    targetSpeed = defaultSpeed;
  }

  applySpeedToVideo(targetSpeed);
  return channelInfo !== null;
}

function applySpeedToVideo(speed) {
  const video = document.querySelector('video');
  if (!video) return;

  if (Math.abs(video.playbackRate - speed) > 0.01) {
    isSettingSpeed = true;
    video.playbackRate = speed;
    setTimeout(() => { isSettingSpeed = false; }, 300);
  }
}

// 3. Retry loop when navigating or when channel info is pending DOM render
function startRetryLoop() {
  if (retryTimer) clearInterval(retryTimer);

  let attempts = 0;
  retryTimer = setInterval(async () => {
    attempts++;
    const found = await updatePlaybackSpeed();
    if ((found && currentChannelInfo) || attempts >= 15) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }, 250);
}

function handleNavigation() {
  currentChannelInfo = null;
  updatePlaybackSpeed();
  startRetryLoop();
}

// 4. Robust SPA Navigation & DOM Observers
function initAutoSpeedController() {
  // Initial run
  handleNavigation();

  // Watch URL changes (250ms poller + popstate)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleNavigation();
    }
  }, 250);

  window.addEventListener('popstate', () => {
    lastUrl = location.href;
    handleNavigation();
  });

  // Watch Document Title mutations (YouTube updates title on SPA navigation)
  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => {
      if (location.href.includes('/watch')) {
        handleNavigation();
      }
    });
    titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
  }

  // Watch Video player events
  document.addEventListener('loadstart', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      handleNavigation();
    }
  }, true);

  document.addEventListener('loadedmetadata', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      applySpeedToVideo(targetSpeed);
    }
  }, true);

  document.addEventListener('play', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      applySpeedToVideo(targetSpeed);
    }
  }, true);

  document.addEventListener('ratechange', (e) => {
    if (e.target && e.target.tagName === 'VIDEO' && !isSettingSpeed) {
      // Re-enforce target speed if YouTube player resets it externally
      if (Math.abs(e.target.playbackRate - targetSpeed) > 0.01) {
        applySpeedToVideo(targetSpeed);
      }
    }
  }, true);
}

// 5. Messaging interface for Extension Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_INFO') {
    const channelInfo = getYouTubeChannelInfo() || currentChannelInfo;
    chrome.storage.local.get(['channelSpeeds', 'defaultSpeed'], (storage) => {
      const channelSpeeds = storage.channelSpeeds || {};
      const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;
      
      let speed = defaultSpeed;
      let isCustom = false;

      if (channelInfo) {
        if (channelSpeeds[channelInfo.handle] !== undefined) {
          speed = parseFloat(channelSpeeds[channelInfo.handle]);
          isCustom = true;
        } else if (channelInfo.channelId && channelSpeeds[channelInfo.channelId] !== undefined) {
          speed = parseFloat(channelSpeeds[channelInfo.channelId]);
          isCustom = true;
        }
      }

      sendResponse({
        isWatchPage: window.location.pathname.startsWith('/watch'),
        channelInfo: channelInfo,
        speed: speed,
        defaultSpeed: defaultSpeed,
        isCustom: isCustom
      });
    });
    return true; // Keep sendResponse async channel open
  }

  if (message.type === 'APPLY_SPEED_IMMEDIATELY') {
    if (message.speed !== undefined) {
      targetSpeed = parseFloat(message.speed);
      applySpeedToVideo(targetSpeed);
    }
    sendResponse({ success: true });
    return true;
  }
});

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutoSpeedController);
} else {
  initAutoSpeedController();
}
