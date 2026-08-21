// SmartTube: Speed & Auto-Like - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  applyLocalization();
  await initPopup();
});

// Localization helper
function applyLocalization() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      if (el.tagName === 'INPUT' && el.type === 'placeholder') {
        el.placeholder = msg;
      } else {
        el.innerText = msg;
      }
    }
  });
}

// UI Elements
const activeChannelName = document.getElementById('active-channel-name');
const activeChannelHandle = document.getElementById('active-channel-handle');
const activeChannelBadge = document.getElementById('active-channel-badge');

const speedSlider = document.getElementById('speed-slider');
const currentSpeedLabel = document.getElementById('current-speed-label');
const presetButtons = document.querySelectorAll('.btn-preset');

const autoLikeToggle = document.getElementById('auto-like-toggle');
const likeThresholdGroup = document.getElementById('like-threshold-group');
const likeModeSelect = document.getElementById('like-mode-select');
const likeValueSlider = document.getElementById('like-value-slider');
const likeValueLabel = document.getElementById('like-value-label');

const btnSaveChannel = document.getElementById('btn-save-channel');
const btnResetChannel = document.getElementById('btn-reset-channel');

const defaultSpeedSlider = document.getElementById('default-speed-slider');
const defaultSpeedValue = document.getElementById('default-speed-value');

const defaultLikeToggle = document.getElementById('default-like-toggle');
const defaultLikeThresholdGroup = document.getElementById('default-like-threshold-group');
const defaultLikeSlider = document.getElementById('default-like-slider');
const defaultLikeLabel = document.getElementById('default-like-label');

const savedChannelsList = document.getElementById('saved-channels-list');
const savedCountBadge = document.getElementById('saved-count-badge');

// State
let activeChannel = null;
let currentTabId = null;

async function initPopup() {
  setupEventListeners();
  await loadGlobalDefaults();
  await refreshActiveTabInfo();
  await renderSavedChannelsList();
}

function setupEventListeners() {
  // Speed Slider & Presets
  speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(2);
    updateSpeedDisplay(val);
    applySpeedToActiveTab(val);
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.getAttribute('data-speed')).toFixed(2);
      speedSlider.value = speed;
      updateSpeedDisplay(speed);
      applySpeedToActiveTab(speed);
    });
  });

  // Like Toggle & Mode Select
  autoLikeToggle.addEventListener('change', () => {
    toggleThresholdGroupUI(likeThresholdGroup, autoLikeToggle.checked);
  });

  likeModeSelect.addEventListener('change', () => {
    updateSliderRangeForMode(likeValueSlider, likeModeSelect.value);
    updateThresholdDisplay(likeValueSlider.value, likeModeSelect.value, likeValueLabel);
  });

  likeValueSlider.addEventListener('input', () => {
    updateThresholdDisplay(likeValueSlider.value, likeModeSelect.value, likeValueLabel);
  });

  // Save / Reset Buttons
  btnSaveChannel.addEventListener('click', saveActiveChannelRules);
  btnResetChannel.addEventListener('click', resetActiveChannelRules);

  // Global Default Speed
  defaultSpeedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(2);
    defaultSpeedValue.innerText = `${val}x`;
    chrome.storage.local.set({ defaultSpeed: val });
  });

  // Global Default Auto-Like
  defaultLikeToggle.addEventListener('change', () => {
    toggleThresholdGroupUI(defaultLikeThresholdGroup, defaultLikeToggle.checked);
    saveGlobalDefaultAutoLike();
  });

  defaultLikeSlider.addEventListener('input', () => {
    updateThresholdDisplay(defaultLikeSlider.value, 'percent', defaultLikeLabel);
    saveGlobalDefaultAutoLike();
  });
}

function toggleThresholdGroupUI(groupElement, enabled) {
  if (enabled) {
    groupElement.classList.remove('disabled');
  } else {
    groupElement.classList.add('disabled');
  }
}

function updateSliderRangeForMode(slider, mode) {
  if (mode === 'percent') {
    slider.min = 5;
    slider.max = 90;
    slider.step = 5;
    if (parseInt(slider.value) > 90) slider.value = 30;
  } else if (mode === 'seconds') {
    slider.min = 10;
    slider.max = 300;
    slider.step = 10;
    if (parseInt(slider.value) < 10) slider.value = 60;
  }
}

function updateThresholdDisplay(val, mode, labelElement) {
  if (mode === 'percent') {
    labelElement.innerText = `${val}%`;
  } else {
    labelElement.innerText = `${val}s`;
  }
}

function updateSpeedDisplay(val) {
  const numVal = parseFloat(val);
  currentSpeedLabel.innerText = `${numVal.toFixed(2)}x`;

  presetButtons.forEach(btn => {
    const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
    if (Math.abs(btnSpeed - numVal) < 0.02) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function applySpeedToActiveTab(speed) {
  if (!currentTabId) return;
  chrome.tabs.sendMessage(currentTabId, {
    type: 'APPLY_SPEED_IMMEDIATELY',
    speed: speed
  }, () => {
    if (chrome.runtime.lastError) {
      // Ignore tab message errors if content script not listening
    }
  });
}

async function loadGlobalDefaults() {
  const storage = await chrome.storage.local.get(['defaultSpeed', 'defaultAutoLike']);
  const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;
  const defaultAutoLike = storage.defaultAutoLike || { enabled: false, mode: 'percent', value: 30 };

  defaultSpeedSlider.value = defaultSpeed;
  defaultSpeedValue.innerText = `${defaultSpeed.toFixed(2)}x`;

  defaultLikeToggle.checked = !!defaultAutoLike.enabled;
  toggleThresholdGroupUI(defaultLikeThresholdGroup, defaultLikeToggle.checked);
  defaultLikeSlider.value = defaultAutoLike.value || 30;
  updateThresholdDisplay(defaultLikeSlider.value, defaultAutoLike.mode || 'percent', defaultLikeLabel);
}

function saveGlobalDefaultAutoLike() {
  const config = {
    enabled: defaultLikeToggle.checked,
    mode: 'percent',
    value: parseInt(defaultLikeSlider.value)
  };
  chrome.storage.local.set({ defaultAutoLike: config });
}

async function refreshActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
    renderNoActiveVideoState();
    return;
  }

  currentTabId = tab.id;

  chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_INFO' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.channelInfo) {
      renderNoActiveVideoState();
      return;
    }

    renderActiveChannelState(response);
  });
}

function renderNoActiveVideoState() {
  activeChannelName.innerText = chrome.i18n.getMessage('noVideoLoaded');
  activeChannelHandle.innerText = chrome.i18n.getMessage('openWatchPage');

  activeChannelBadge.innerText = chrome.i18n.getMessage('badgeNoVideo');
  activeChannelBadge.className = 'badge badge-inactive';

  btnSaveChannel.disabled = true;
  btnResetChannel.disabled = true;
}

function renderActiveChannelState(data) {
  activeChannel = data.channelInfo;

  activeChannelName.innerText = activeChannel.name || activeChannel.handle;
  activeChannelHandle.innerText = activeChannel.handle;

  if (data.isCustom) {
    activeChannelBadge.innerText = chrome.i18n.getMessage('badgeSaved');
    activeChannelBadge.className = 'badge badge-saved';
  } else {
    activeChannelBadge.innerText = chrome.i18n.getMessage('badgeActive');
    activeChannelBadge.className = 'badge badge-active';
  }

  // Speed
  const speed = parseFloat(data.speed) || 1.0;
  speedSlider.value = speed;
  updateSpeedDisplay(speed);

  // Auto-Like
  const likeConfig = data.likeConfig || { enabled: false, mode: 'percent', value: 30 };
  autoLikeToggle.checked = !!likeConfig.enabled;
  toggleThresholdGroupUI(likeThresholdGroup, autoLikeToggle.checked);

  likeModeSelect.value = likeConfig.mode || 'percent';
  updateSliderRangeForMode(likeValueSlider, likeModeSelect.value);
  likeValueSlider.value = likeConfig.value || (likeModeSelect.value === 'percent' ? 30 : 60);
  updateThresholdDisplay(likeValueSlider.value, likeModeSelect.value, likeValueLabel);

  btnSaveChannel.disabled = false;
  btnResetChannel.disabled = false;
}

async function saveActiveChannelRules() {
  if (!activeChannel) return;

  const handle = activeChannel.handle;
  const speedVal = parseFloat(speedSlider.value);
  const likeConfig = {
    enabled: autoLikeToggle.checked,
    mode: likeModeSelect.value,
    value: parseInt(likeValueSlider.value)
  };

  const storage = await chrome.storage.local.get(['channelSpeeds', 'channelLikes']);
  const channelSpeeds = storage.channelSpeeds || {};
  const channelLikes = storage.channelLikes || {};

  channelSpeeds[handle] = speedVal;
  channelLikes[handle] = likeConfig;

  await chrome.storage.local.set({ channelSpeeds, channelLikes });

  activeChannelBadge.innerText = chrome.i18n.getMessage('badgeSaved');
  activeChannelBadge.className = 'badge badge-saved';

  applySpeedToActiveTab(speedVal);
  await renderSavedChannelsList();
}

async function resetActiveChannelRules() {
  if (!activeChannel) return;

  const handle = activeChannel.handle;
  const storage = await chrome.storage.local.get(['channelSpeeds', 'channelLikes', 'defaultSpeed', 'defaultAutoLike']);
  const channelSpeeds = storage.channelSpeeds || {};
  const channelLikes = storage.channelLikes || {};

  delete channelSpeeds[handle];
  delete channelLikes[handle];

  await chrome.storage.local.set({ channelSpeeds, channelLikes });

  activeChannelBadge.innerText = chrome.i18n.getMessage('badgeActive');
  activeChannelBadge.className = 'badge badge-active';

  // Apply default speed
  const defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;
  speedSlider.value = defaultSpeed;
  updateSpeedDisplay(defaultSpeed);
  applySpeedToActiveTab(defaultSpeed);

  // Apply default auto-like
  const defaultAutoLike = storage.defaultAutoLike || { enabled: false, mode: 'percent', value: 30 };
  autoLikeToggle.checked = !!defaultAutoLike.enabled;
  toggleThresholdGroupUI(likeThresholdGroup, autoLikeToggle.checked);
  likeModeSelect.value = defaultAutoLike.mode || 'percent';
  updateSliderRangeForMode(likeValueSlider, likeModeSelect.value);
  likeValueSlider.value = defaultAutoLike.value || 30;
  updateThresholdDisplay(likeValueSlider.value, likeModeSelect.value, likeValueLabel);

  await renderSavedChannelsList();
}

async function renderSavedChannelsList() {
  const storage = await chrome.storage.local.get(['channelSpeeds', 'channelLikes']);
  const channelSpeeds = storage.channelSpeeds || {};
  const channelLikes = storage.channelLikes || {};

  // Combine unique handles
  const handles = Array.from(new Set([...Object.keys(channelSpeeds), ...Object.keys(channelLikes)]));
  savedCountBadge.innerText = handles.length;

  savedChannelsList.innerHTML = '';

  if (handles.length === 0) {
    savedChannelsList.innerHTML = `<div class="empty-state" data-i18n="emptySavedChannels">${chrome.i18n.getMessage('emptySavedChannels')}</div>`;
    return;
  }

  handles.forEach((handle) => {
    const speed = channelSpeeds[handle];
    const likeConfig = channelLikes[handle];

    const item = document.createElement('div');
    item.className = 'saved-item';

    let badgesHtml = '';
    if (speed !== undefined) {
      badgesHtml += `<span class="pill-badge">${parseFloat(speed).toFixed(2)}x</span>`;
    }
    if (likeConfig && likeConfig.enabled) {
      const unit = likeConfig.mode === 'percent' ? '%' : 's';
      badgesHtml += `<span class="pill-badge pill-badge-like">👍 ${likeConfig.value}${unit}</span>`;
    }

    item.innerHTML = `
      <div class="saved-item-info">
        <span class="saved-item-handle">${handle}</span>
        <div class="saved-item-badges">${badgesHtml}</div>
      </div>
      <button class="btn-delete-item" title="${chrome.i18n.getMessage('deleteItemTitle')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    item.querySelector('.btn-delete-item').addEventListener('click', async () => {
      delete channelSpeeds[handle];
      delete channelLikes[handle];
      await chrome.storage.local.set({ channelSpeeds, channelLikes });

      if (activeChannel && activeChannel.handle === handle) {
        await refreshActiveTabInfo();
      }
      await renderSavedChannelsList();
    });

    savedChannelsList.appendChild(item);
  });
}
