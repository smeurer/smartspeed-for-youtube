// SmartSpeed for YouTube - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const activeChannelBadge = document.getElementById('active-channel-badge');
  const activeChannelName = document.getElementById('active-channel-name');
  const activeChannelHandle = document.getElementById('active-channel-handle');
  const currentSpeedLabel = document.getElementById('current-speed-label');
  const speedSlider = document.getElementById('speed-slider');
  const presetButtons = document.querySelectorAll('.btn-preset');
  const btnSaveChannel = document.getElementById('btn-save-channel');
  const btnResetChannel = document.getElementById('btn-reset-channel');
  
  const defaultSpeedValue = document.getElementById('default-speed-value');
  const defaultSpeedSlider = document.getElementById('default-speed-slider');
  
  const savedCountBadge = document.getElementById('saved-count-badge');
  const savedChannelsList = document.getElementById('saved-channels-list');

  let activeChannel = null;
  let activeTabId = null;

  // 1. Initial Storage Load
  const storage = await chrome.storage.local.get(['channelSpeeds', 'defaultSpeed']);
  let channelSpeeds = storage.channelSpeeds || {};
  let defaultSpeed = parseFloat(storage.defaultSpeed) || 1.0;

  defaultSpeedSlider.value = defaultSpeed;
  defaultSpeedValue.textContent = defaultSpeed.toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1') + 'x';

  renderSavedChannelsList(channelSpeeds);

  // 2. Query Active Tab for YouTube Info
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.url && activeTab.url.includes('youtube.com/watch')) {
    activeTabId = activeTab.id;
    
    // Request current channel info from content script
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_CURRENT_INFO' });
      if (response && response.channelInfo) {
        activeChannel = response.channelInfo;
        const currentSpeed = response.speed || defaultSpeed;

        activeChannelBadge.textContent = response.isCustom ? 'Gespeichert' : 'Aktiv';
        activeChannelBadge.className = 'badge badge-active';
        activeChannelName.textContent = activeChannel.name || activeChannel.handle;
        activeChannelHandle.textContent = activeChannel.handle;

        setSpeedDisplay(currentSpeed);

        btnSaveChannel.disabled = false;
        btnResetChannel.disabled = !response.isCustom;
      }
    } catch (err) {
      console.log('Content script not responding or not ready yet:', err);
    }
  }

  // 3. UI Helpers
  function setSpeedDisplay(speed) {
    const formatted = parseFloat(speed).toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1') + 'x';
    currentSpeedLabel.textContent = formatted;
    speedSlider.value = speed;

    presetButtons.forEach(btn => {
      const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
      if (Math.abs(btnSpeed - parseFloat(speed)) < 0.01) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function renderSavedChannelsList(speeds) {
    const keys = Object.keys(speeds);
    savedCountBadge.textContent = keys.length;

    if (keys.length === 0) {
      savedChannelsList.innerHTML = '<div class="empty-state">Noch keine Kanäle gespeichert.</div>';
      return;
    }

    savedChannelsList.innerHTML = '';
    keys.sort().forEach(handle => {
      const item = document.createElement('div');
      item.className = 'saved-item';

      const speedVal = parseFloat(speeds[handle]).toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1') + 'x';

      item.innerHTML = `
        <div class="saved-item-info">
          <span class="saved-item-handle" title="${handle}">${handle}</span>
        </div>
        <div class="saved-item-right">
          <span class="saved-item-speed">${speedVal}</span>
          <button class="btn-delete-item" data-handle="${handle}" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      item.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
        const handleToDelete = e.currentTarget.getAttribute('data-handle');
        delete channelSpeeds[handleToDelete];
        await chrome.storage.local.set({ channelSpeeds });
        renderSavedChannelsList(channelSpeeds);

        // If current active channel was deleted, update controls
        if (activeChannel && activeChannel.handle === handleToDelete) {
          activeChannelBadge.textContent = 'Aktiv';
          btnResetChannel.disabled = true;
          setSpeedDisplay(defaultSpeed);
          notifyActiveTab(defaultSpeed);
        }
      });

      savedChannelsList.appendChild(item);
    });
  }

  async function notifyActiveTab(speed) {
    if (activeTabId) {
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          type: 'APPLY_SPEED_IMMEDIATELY',
          speed: speed
        });
      } catch (e) {
        // Tab might be closed or refreshed
      }
    }
  }

  // 4. Event Listeners
  speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setSpeedDisplay(val);
    if (activeChannel) {
      notifyActiveTab(val);
    }
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.getAttribute('data-speed'));
      setSpeedDisplay(val);
      if (activeChannel) {
        notifyActiveTab(val);
      }
    });
  });

  btnSaveChannel.addEventListener('click', async () => {
    if (!activeChannel) return;
    const speed = parseFloat(speedSlider.value);
    channelSpeeds[activeChannel.handle] = speed;
    await chrome.storage.local.set({ channelSpeeds });

    activeChannelBadge.textContent = 'Gespeichert';
    btnResetChannel.disabled = false;

    renderSavedChannelsList(channelSpeeds);
    notifyActiveTab(speed);
  });

  btnResetChannel.addEventListener('click', async () => {
    if (!activeChannel) return;
    delete channelSpeeds[activeChannel.handle];
    await chrome.storage.local.set({ channelSpeeds });

    activeChannelBadge.textContent = 'Aktiv';
    btnResetChannel.disabled = true;

    setSpeedDisplay(defaultSpeed);
    renderSavedChannelsList(channelSpeeds);
    notifyActiveTab(defaultSpeed);
  });

  defaultSpeedSlider.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    defaultSpeed = val;
    defaultSpeedValue.textContent = val.toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1') + 'x';
    await chrome.storage.local.set({ defaultSpeed });

    // If active channel has no custom speed set, update its current speed
    if (activeChannel && channelSpeeds[activeChannel.handle] === undefined) {
      setSpeedDisplay(val);
      notifyActiveTab(val);
    }
  });
});
