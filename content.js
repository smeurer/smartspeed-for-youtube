// SmartTube: Speed, Volume & Auto-Like for YouTube - Content Script

let currentChannelInfo = null;
let targetSpeed = 1.0;
let isSettingSpeed = false;
let targetVolume = 100;
let isSettingVolume = false;
let lastUrl = location.href;
let retryTimer = null;

// Helper to prevent "Extension context invalidated" errors when extension is reloaded
function isContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
}

// Track auto-liked video IDs in current session to prevent repeated triggers
let lastLikedVideoId = null;

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

// Extract active video ID from URL
function getCurrentVideoId() {
  if (!window.location.pathname.startsWith('/watch')) return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// 2. Playback Speed & Volume Application
async function updatePlaybackSettings() {
  if (!isContextValid()) return false;

  const channelInfo = getYouTubeChannelInfo();
  currentChannelInfo = channelInfo;

  let storage = {};
  try {
    storage = await new Promise((resolve) => {
      if (!isContextValid()) return resolve({});
      chrome.storage.local.get(['channelSpeeds', 'defaultSpeed', 'channelVolumes', 'defaultVolume'], (res) => {
        if (chrome.runtime?.lastError) return resolve({});
        resolve(res || {});
      });
    });
  } catch (err) {
    return false;
  }

  const channelSpeeds = storage.channelSpeeds || {};
  const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;
  const channelVolumes = storage.channelVolumes || {};
  const defaultVolume = storage.defaultVolume !== undefined ? parseInt(storage.defaultVolume) : 100;

  if (channelInfo && channelSpeeds[channelInfo.handle] !== undefined) {
    targetSpeed = parseFloat(channelSpeeds[channelInfo.handle]);
  } else if (channelInfo && channelInfo.channelId && channelSpeeds[channelInfo.channelId] !== undefined) {
    targetSpeed = parseFloat(channelSpeeds[channelInfo.channelId]);
  } else {
    targetSpeed = defaultSpeed;
  }

  if (channelInfo && channelVolumes[channelInfo.handle] !== undefined) {
    targetVolume = parseInt(channelVolumes[channelInfo.handle]);
  } else if (channelInfo && channelInfo.channelId && channelVolumes[channelInfo.channelId] !== undefined) {
    targetVolume = parseInt(channelVolumes[channelInfo.channelId]);
  } else {
    targetVolume = defaultVolume;
  }

  applySpeedToVideo(targetSpeed);
  applyVolumeToVideo(targetVolume);

  if (channelInfo && isContextValid()) {
    try {
      chrome.runtime.sendMessage({ type: 'CHANNEL_STATUS_CHANGED' }, () => {
        if (chrome.runtime?.lastError) {}
      });
    } catch (e) {}
  }

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

function applyVolumeToVideo(volumePercent) {
  const video = document.querySelector('video');
  if (!video) return;

  const targetVol = Math.max(0, Math.min(1, volumePercent / 100));
  if (Math.abs(video.volume - targetVol) > 0.01) {
    isSettingVolume = true;
    video.volume = targetVol;
    if (volumePercent > 0 && video.muted) {
      video.muted = false;
    }
    setTimeout(() => { isSettingVolume = false; }, 300);
  }
}

// 3. Auto-Like Logic
function findYouTubeLikeButton() {
  // Try modern YouTube segmented like button first
  const segmentedLikeBtn = document.querySelector('like-button-view-model button') ||
                           document.querySelector('#top-level-buttons-computed segmented-like-dislike-button-view-model button');
  if (segmentedLikeBtn) return segmentedLikeBtn;

  // Fallbacks for YouTube variants / mobile / older layouts
  const genericLikeBtn = document.querySelector('ytd-toggle-button-renderer #button[aria-label*="like" i]') ||
                         document.querySelector('button[aria-label*="like" i]') ||
                         document.querySelector('button[title*="like" i]');
  return genericLikeBtn;
}

function isVideoAlreadyLiked(likeButton) {
  if (!likeButton) return false;

  const ariaPressed = likeButton.getAttribute('aria-pressed');
  if (ariaPressed === 'true') return true;

  // Check child element with aria-pressed
  const pressedChild = likeButton.querySelector('[aria-pressed="true"]');
  if (pressedChild) return true;

  // Check parent container state
  const parentSegmented = likeButton.closest('segmented-like-dislike-button-view-model');
  if (parentSegmented && parentSegmented.querySelector('like-button-view-model [aria-pressed="true"]')) {
    return true;
  }

  return false;
}

async function checkAndApplyAutoLike() {
  if (!isContextValid()) return;

  const videoId = getCurrentVideoId();
  if (!videoId || lastLikedVideoId === videoId) return;

  const channelInfo = getYouTubeChannelInfo() || currentChannelInfo;
  if (!channelInfo) return;

  const video = document.querySelector('video');
  if (!video || !video.duration || isNaN(video.duration) || video.duration <= 0) return;

  let storage = {};
  try {
    storage = await new Promise((resolve) => {
      if (!isContextValid()) return resolve({});
      chrome.storage.local.get(['channelLikes', 'defaultAutoLike'], (res) => {
        if (chrome.runtime?.lastError) return resolve({});
        resolve(res || {});
      });
    });
  } catch (err) {
    return;
  }
  const channelLikes = storage.channelLikes || {};
  const defaultAutoLike = storage.defaultAutoLike || { enabled: false, mode: 'percent', value: 30 };

  let likeConfig = null;
  if (channelLikes[channelInfo.handle] !== undefined) {
    likeConfig = channelLikes[channelInfo.handle];
  } else if (channelInfo.channelId && channelLikes[channelInfo.channelId] !== undefined) {
    likeConfig = channelLikes[channelInfo.channelId];
  } else {
    likeConfig = defaultAutoLike;
  }

  if (!likeConfig || !likeConfig.enabled) return;

  const mode = likeConfig.mode || 'percent';
  const targetValue = parseFloat(likeConfig.value) || 30;

  let isThresholdMet = false;
  if (mode === 'percent') {
    const currentPercent = (video.currentTime / video.duration) * 100;
    isThresholdMet = currentPercent >= targetValue;
  } else if (mode === 'seconds') {
    isThresholdMet = video.currentTime >= targetValue;
  }

  if (!isThresholdMet) return;

  const likeButton = findYouTubeLikeButton();
  if (!likeButton) return;

  if (isVideoAlreadyLiked(likeButton)) {
    // Already liked, mark video as handled
    lastLikedVideoId = videoId;
    return;
  }

  // Execute Auto-Like click
  try {
    likeButton.click();
    lastLikedVideoId = videoId;
    console.log(`[SmartTube] Auto-Liked video ${videoId} for channel ${channelInfo.handle} at ${Math.round(video.currentTime)}s (${mode}: ${targetValue})`);
  } catch (err) {
    console.error('[SmartTube] Failed to click like button:', err);
  }
}

// 4. Retry loop when navigating or when channel info is pending DOM render
function startRetryLoop() {
  if (retryTimer) clearInterval(retryTimer);

  let attempts = 0;
  retryTimer = setInterval(async () => {
    attempts++;
    const found = await updatePlaybackSettings();
    if ((found && currentChannelInfo) || attempts >= 15) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }, 250);
}

function handleNavigation() {
  const newVideoId = getCurrentVideoId();
  if (newVideoId !== lastLikedVideoId) {
    // Reset like lock if video changed
    if (!location.href.includes(lastLikedVideoId)) {
      lastLikedVideoId = null;
    }
  }

  currentChannelInfo = null;
  updatePlaybackSettings();
  startRetryLoop();
}

// 5. Robust SPA Navigation & DOM Observers
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
      applyVolumeToVideo(targetVolume);
    }
  }, true);

  document.addEventListener('play', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      applySpeedToVideo(targetSpeed);
      applyVolumeToVideo(targetVolume);
    }
  }, true);

  document.addEventListener('timeupdate', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      checkAndApplyAutoLike();
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

// 6. Messaging interface for Extension Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isContextValid()) return false;

  if (message.type === 'GET_CURRENT_INFO') {
    const channelInfo = getYouTubeChannelInfo() || currentChannelInfo;
    try {
      if (!isContextValid()) return false;
      chrome.storage.local.get(['channelSpeeds', 'defaultSpeed', 'channelVolumes', 'defaultVolume', 'channelLikes', 'defaultAutoLike'], (storage) => {
        if (!isContextValid() || chrome.runtime?.lastError) return;
        const channelSpeeds = storage.channelSpeeds || {};
        const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;
        const channelVolumes = storage.channelVolumes || {};
        const defaultVolume = storage.defaultVolume !== undefined ? parseInt(storage.defaultVolume) : 100;
        const channelLikes = storage.channelLikes || {};
        const defaultAutoLike = storage.defaultAutoLike || { enabled: false, mode: 'percent', value: 30 };

        let speed = defaultSpeed;
        let isCustomSpeed = false;

        let volume = defaultVolume;
        let isCustomVolume = false;

        let likeConfig = defaultAutoLike;
        let isCustomLike = false;

        if (channelInfo) {
          if (channelSpeeds[channelInfo.handle] !== undefined) {
            speed = parseFloat(channelSpeeds[channelInfo.handle]);
            isCustomSpeed = true;
          } else if (channelInfo.channelId && channelSpeeds[channelInfo.channelId] !== undefined) {
            speed = parseFloat(channelSpeeds[channelInfo.channelId]);
            isCustomSpeed = true;
          }

          if (channelVolumes[channelInfo.handle] !== undefined) {
            volume = parseInt(channelVolumes[channelInfo.handle]);
            isCustomVolume = true;
          } else if (channelInfo.channelId && channelVolumes[channelInfo.channelId] !== undefined) {
            volume = parseInt(channelVolumes[channelInfo.channelId]);
            isCustomVolume = true;
          }

          if (channelLikes[channelInfo.handle] !== undefined) {
            likeConfig = channelLikes[channelInfo.handle];
            isCustomLike = true;
          } else if (channelInfo.channelId && channelLikes[channelInfo.channelId] !== undefined) {
            likeConfig = channelLikes[channelInfo.channelId];
            isCustomLike = true;
          }
        }

        try {
          sendResponse({
            isWatchPage: window.location.pathname.startsWith('/watch'),
            channelInfo: channelInfo,
            speed: speed,
            defaultSpeed: defaultSpeed,
            isCustomSpeed: isCustomSpeed,
            volume: volume,
            defaultVolume: defaultVolume,
            isCustomVolume: isCustomVolume,
            likeConfig: likeConfig,
            defaultAutoLike: defaultAutoLike,
            isCustomLike: isCustomLike,
            isCustom: isCustomSpeed || isCustomVolume || isCustomLike
          });
        } catch (e) {}
      });
    } catch (e) {}
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

  if (message.type === 'APPLY_VOLUME_IMMEDIATELY') {
    if (message.volume !== undefined) {
      targetVolume = parseInt(message.volume);
      applyVolumeToVideo(targetVolume);
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
