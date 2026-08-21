// SmartTube: Background Service Worker (Manifest V3)

const RED_ICONS = {
  '16': 'icons/icon16.png',
  '32': 'icons/icon32.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png'
};

const GRAY_ICONS = {
  '16': 'icons/icon16_gray.png',
  '32': 'icons/icon32_gray.png',
  '48': 'icons/icon48_gray.png',
  '128': 'icons/icon128_gray.png'
};

// Listen for tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateIconStatusForTab(activeInfo.tabId);
});

// Listen for tab updates (URL change, load completed)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateIconStatusForTab(tabId);
  }
});

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHANNEL_STATUS_CHANGED') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      updateIconStatusForTab(tabId);
    } else {
      // Refresh current active tab if message was sent from popup
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          updateIconStatusForTab(tabs[0].id);
        }
      });
    }
  }
});

async function updateIconStatusForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
      clearIconStatus(tabId);
      return;
    }

    // On YouTube: enable action (red icon) and query channel info
    chrome.action.enable(tabId);
    chrome.action.setIcon({ tabId, path: RED_ICONS });

    // Query active channel info from content script in tab
    chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_INFO' }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.channelInfo) {
        clearIconStatus(tabId);
        return;
      }

      const { isCustom, speed, isCustomSpeed, volume, isCustomVolume, likeConfig, isCustomLike, channelInfo } = response;

      // 1. Badge Text & Color
      if (isCustom) {
        let badgeText = '';
        if (isCustomSpeed && Math.abs(speed - 1.0) > 0.01) {
          badgeText = `${speed}x`;
        } else {
          badgeText = 'SET';
        }
        await chrome.action.setBadgeText({ tabId, text: badgeText });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff0000' }); // Red accent on YouTube
      } else {
        await chrome.action.setBadgeText({ tabId, text: '' });
      }

      // 2. Hover Tooltip (Title)
      const handle = channelInfo.handle || channelInfo.name || 'YouTube';
      const speedStr = `${speed}x${isCustomSpeed ? ' (Custom)' : ''}`;
      const volStr = `${volume}%${isCustomVolume ? ' (Custom)' : ''}`;

      let likeStr = 'Aus';
      if (likeConfig && likeConfig.enabled) {
        const unit = likeConfig.mode === 'percent' ? '%' : 's';
        likeStr = `${likeConfig.value}${unit}${isCustomLike ? ' (Custom)' : ''}`;
      }

      const tooltipTitle = `SmartTube: ${handle}\nSpeed: ${speedStr} | Vol: ${volStr} | Like: ${likeStr}`;
      await chrome.action.setTitle({ tabId, title: tooltipTitle });
    });
  } catch (err) {
    // Ignore invalid tab error on closed tabs
  }
}

function clearIconStatus(tabId) {
  // On non-YouTube pages: gray (disabled) icon, no badge, inactive tooltip
  chrome.action.setIcon({ tabId, path: GRAY_ICONS });
  chrome.action.setBadgeText({ tabId, text: '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#6a737d' });
  chrome.action.setTitle({ tabId, title: chrome.i18n.getMessage('disabledTooltip') });
}