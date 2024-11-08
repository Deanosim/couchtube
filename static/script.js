const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
const BUFFERING_TIMEOUT = 3500;
const CHANNELS_ENDPOINT = '/channels';
const CURRENT_VIDEO_ENDPOINT = '/current-video';
const SUBMIT_VIDEO_ENDPOINT = '/submit-list';
const INVALIDATE_VIDEO_ENDPOINT = '/invalidate-video';
const VOLUME_STEPS = 5;
const VOLUME_BAR_TIMEOUT = 2000;
const CHANNEL_NAME_TIMEOUT = 3000;
const INTERVAL_CHECK_MS = 1000;

const ICONS = {
  power: '/assets/icons/power.svg',
  volume_muted: '/assets/icons/volume_muted.svg',
  volume_high: '/assets/icons/volume_high.svg',
  expand: '/assets/icons/expand.svg',
  contract: '/assets/icons/contract.svg'
};

const loadYouTubeAPI = (onReady) => {
  const tag = document.createElement('script');
  tag.src = IFRAME_API_URL;
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = onReady;
};

const initializePlayer = (playerElementId, onReady, onStateChange, onError) => {
  return new YT.Player(playerElementId, {
    width: '100%',
    height: '100%',
    autoplay: 1,
    events: { onReady, onStateChange, onError },
    playerVars: {
      mute: 1,
      controls: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      rel: 0,
      enablejsapi: 1,
      autoplay: 1
    }
  });
};

const fetchChannels = async () => {
  const res = await fetch(CHANNELS_ENDPOINT);
  const data = await res.json();
  return data.channels || [];
};

const fetchCurrentVideo = async (channelId, videoId) => {
  const url = `${CURRENT_VIDEO_ENDPOINT}?channel-id=${channelId}${
    videoId ? `&video-id=${videoId}` : ''
  }`;
  const res = await fetch(url);
  const data = await res.json();
  return data.video || null;
};

const handleUnavailableVideo = async (state) => {
  const url = `${INVALIDATE_VIDEO_ENDPOINT}?video-id=${state.currentVideo.id}`;
  const res = await fetch(url, {
    method: 'DELETE'
  });
  const data = await res.json();

  if (data.success) {
    const { newChannel, newVideo } = await changeChannel(
      state.player,
      state.channels,
      state.currentChannel,
      1
    );
    state.currentChannel = newChannel;
    state.currentVideo = newVideo;
  }
};

const extractVideoId = (url) => {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
};

const showBuffering = () => {
  document.querySelector('#buffer-gif')?.classList.add('active');
};

const hideBuffering = () => {
  document.querySelector('#buffer-gif')?.classList.remove('active');
};

const deactiveBuffering = (state) => {
  const { player } = state;

  // make sure that the player is muted so that it does not play sound
  // when buffering is active
  player.mute();

  setTimeout(() => {
    hideBuffering();
    if (state.isInteracted && !state.isMuted) {
      // browsers prevent autoplay without user interaction
      // unmute if it was not muted before
      player.unMute();
      state.isMuted = false;
    }
    setControlIcon('control-power', ICONS.power, false);
  }, BUFFERING_TIMEOUT);
};

const setControlIcon = (iconId, iconSrc, isActive) => {
  const iconElement = document.querySelector(`#${iconId} .control-icon`);
  if (iconElement) {
    iconElement.src = iconSrc;
    iconElement.classList.toggle('red', isActive);
  }
};

const toggleMute = (player, isMuted) => {
  player[isMuted ? 'unMute' : 'mute']();
  setControlIcon(
    'control-mute',
    isMuted ? ICONS.volume_high : ICONS.volume_muted,
    !isMuted
  );
  return !isMuted;
};

const updateVideoLink = (state) => {
  const videoLinkContainer = document.querySelector('#video-link');
  const videoLinkTitle = document.querySelector('#video-link-title');

  if (state.currentVideoName) {
    videoLinkTitle.innerHTML = state.currentVideoName;
    videoLinkContainer.classList.add('active');
  } else {
    videoLinkContainer.classList.remove('active');
  }
};

const updateVolumeBar = (currentVolume) => {
  const volumeBar = document.querySelector('#volume-bar');
  if (!volumeBar) return;

  const maxBars = 100 / VOLUME_STEPS;
  const currentStep = Math.ceil(currentVolume / VOLUME_STEPS);

  volumeBar.classList.add('active');
  volumeBar.innerHTML = Array.from(
    { length: maxBars },
    (_, index) =>
      `<div class="volume-bar-step ${
        index < currentStep ? 'active' : ''
      }"></div>`
  ).join('');

  setTimeout(() => volumeBar.classList.remove('active'), VOLUME_BAR_TIMEOUT);
};

const updateChannelList = (state, channels) => {
  const channelList = document.querySelector('#channel-list');
  if (!channelList) return;

  const channelListItems = channels.map((channel) => {
    const channelListItem = document.createElement('div');
    channelListItem.classList.add('channel-list-item');
    channelListItem.innerHTML = `${channel.id.toString().padStart(2, '0')} - ${
      channel.name
    }`;
    channelListItem.addEventListener('click', async () => {
      const { newChannel, newVideo } = await jumpToChannel(
        state.player,
        state.channels,
        channel.id
      );

      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    });
    return channelListItem;
  });

  channelList.innerHTML = '';
  channelList.append(...channelListItems);
};

const toggleFullscreen = (playerElementId) => {
  const playerElement = document.getElementById(playerElementId);
  const requestFullScreen =
    playerElement.requestFullscreen ||
    playerElement.mozRequestFullScreen ||
    playerElement.webkitRequestFullScreen ||
    playerElement.msRequestFullscreen;
  if (requestFullScreen) {
    requestFullScreen.call(playerElement);
  }
};

const toggleControlGroup = (isMinimized) => {
  const controlGroup = document.querySelector('#controls');
  const minimizeIcon = document.querySelector(
    '#control-minimize .control-icon'
  );

  isMinimized = !isMinimized;
  controlGroup.classList.toggle('minimized', isMinimized);
  minimizeIcon.src = isMinimized ? ICONS.expand : ICONS.contract;

  return isMinimized;
};

const updateChannelName = (channel) => {
  const channelId = channel.id.toString().padStart(2, '0');
  const channelName = `${channel.name} - ${channelId}`;
  const channelNameElement = document.querySelector('#channel-name');
  if (channelNameElement) {
    channelNameElement.innerHTML = channelName;
    channelNameElement.classList.add('active');

    setTimeout(() => {
      channelNameElement.classList.remove('active');
    }, CHANNEL_NAME_TIMEOUT);
  }
};

const togglePlayPause = (player, isPlaying) => {
  isPlaying ? player.pauseVideo() : player.playVideo();
  setControlIcon('control-power', ICONS.power, !isPlaying);
  return !isPlaying;
};

// Switch to the next or previous channel
const changeChannel = async (player, channels, currentChannel, offset) => {
  const currentIndex = channels.findIndex(
    (channel) => channel.id === currentChannel.id
  );
  const newIndex = (currentIndex + offset + channels.length) % channels.length;
  const newChannel = channels[newIndex];
  const newVideo = await fetchCurrentVideo(newChannel.id);
  if (newVideo) {
    const videoId = extractVideoId(newVideo.url);
    if (videoId) {
      player.cueVideoById({ videoId, startSeconds: newVideo.segmentStart });
      player.mute();
      player.playVideo();
    }
  }
  return { newChannel, newVideo };
};

const jumpToChannel = async (player, channels, channelId) => {
  const newChannel = channels.find((channel) => channel.id === channelId);
  const newVideo = await fetchCurrentVideo(newChannel.id);
  if (newVideo) {
    const videoId = extractVideoId(newVideo.url);
    if (videoId) {
      player.cueVideoById({ videoId, startSeconds: newVideo.segmentStart });
      player.mute();
      player.playVideo();
    }
  }
  return { newChannel, newVideo };
};

const closeInfoModal = () => {
  const infoPopup = document.querySelector('#info-modal-container');
  infoPopup.classList.remove('active');
};

const toggleInfoModal = () => {
  const infoPopup = document.querySelector('#info-modal-container');
  infoPopup.classList.toggle('active');

  infoPopup.addEventListener('click', (event) => {
    if (event.target === infoPopup) {
      closeInfoModal();
    }
  });
};

const closeSettingsModal = () => {
  const settingsPopup = document.querySelector('#settings-modal-container');
  settingsPopup.classList.remove('active');
};

const toggleSettingsModal = () => {
  const settingsPopup = document.querySelector('#settings-modal-container');
  settingsPopup.classList.toggle('active');

  settingsPopup.addEventListener('click', (event) => {
    if (event.target === settingsPopup) {
      closeSettingsModal();
    }
  });
};

const submitVideoLink = async () => {
  const videoListInput = document.querySelector('#video-list-input');
  const videoListUrl = videoListInput.value;

  console.log(videoListUrl);

  const res = await fetch(SUBMIT_VIDEO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ videoListUrl })
  });
  const data = await res.json();
  if (data.success) {
    videoListInput.value = '';
    closeSettingsModal();
  }
};

const addEventListeners = (state) => {
  // Add Event Listeners for all buttons
  const controls = {
    power: () => {
      state.isPlaying = togglePlayPause(state.player, state.isPlaying);
    },
    mute: () => {
      state.isMuted = toggleMute(state.player, state.isMuted);
    },
    chup: async () => {
      const { newChannel, newVideo } = await changeChannel(
        state.player,
        state.channels,
        state.currentChannel,
        1
      );
      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    },
    chdown: async () => {
      const { newChannel, newVideo } = await changeChannel(
        state.player,
        state.channels,
        state.currentChannel,
        -1
      );
      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    },
    volup: () => {
      const currentVolume = state.player.getVolume();
      const newVolume = Math.min(currentVolume + VOLUME_STEPS, 100);
      state.player.setVolume(newVolume);
      updateVolumeBar(newVolume);
      state.player.unMute();
      state.isMuted = false;
    },
    voldown: () => {
      const currentVolume = state.player.getVolume();
      const newVolume = Math.max(currentVolume - VOLUME_STEPS, 0);
      state.player.setVolume(newVolume);
      updateVolumeBar(newVolume);
      state.player.unMute();
      state.isMuted = false;
    },
    fullscreen: () => {
      toggleFullscreen(playerElementId);
    },
    minimize: () => {
      state.isControlGroupMinimized = toggleControlGroup(
        state.isControlGroupMinimized
      );
    },
    info: () => {
      toggleInfoModal();
    },
    settings: () => {
      toggleSettingsModal();
    }
  };

  for (const [control, handler] of Object.entries(controls)) {
    document
      .querySelector(`#control-${control}`)
      ?.addEventListener('click', () => {
        handler();
        state.isInteracted = true;
      });
  }

  // other events
  document
    .querySelector('#info-modal-close-button')
    .addEventListener('click', () => {
      closeInfoModal();
    });

  document
    .querySelector('#settings-modal-close-button')
    .addEventListener('click', () => {
      closeSettingsModal();
    });

  document.querySelector('#video-link').addEventListener('click', () => {
    window.open(state.currentVideo.url, '_blank');
  });

  document.querySelector('#video-list-submit').addEventListener('click', () => {
    submitVideoLink();
  });
};

const initApp = async (playerElementId) => {
  const channels = await fetchChannels();
  const state = {
    player: null,
    isPlaying: false,
    isMuted: true,
    isControlGroupMinimized: false,
    currentChannel: channels[0] || null,
    currentVideo: null,
    channels,
    isInteracted: false,
    currentVideoName: ''
  };

  addEventListeners(state);
  updateChannelList(state, channels);

  const onReady = async () => {
    const initialVideo = await fetchCurrentVideo(state.currentChannel.id);
    if (initialVideo) {
      const videoId = extractVideoId(initialVideo.url);
      if (videoId) {
        state.player.cueVideoById({
          videoId,
          startSeconds: initialVideo.segmentStart
        });
        state.player.playVideo();
        state.currentVideo = initialVideo;
      }
    }
  };

  const onStateChange = ({ target, data }) => {
    state.isPlaying = data === YT.PlayerState.PLAYING;
    state.isMuted = target.isMuted();
    state.currentVideoName = target.getVideoData().title;

    updateVideoLink(state);

    if (state.isMuted) {
      setControlIcon('control-mute', ICONS.volume_muted, true);
    }

    if (data === YT.PlayerState.PLAYING && state.currentVideo) {
      deactiveBuffering(state);

      const intervalId = setInterval(async () => {
        const currentTime = state.player.getCurrentTime();
        if (currentTime >= state.currentVideo.segmentEnd) {
          clearInterval(intervalId);
          const { newChannel, newVideo } = await changeChannel(
            state.player,
            state.channels,
            state.currentChannel,
            1
          );
          state.currentChannel = newChannel;
          state.currentVideo = newVideo;
        }
      }, INTERVAL_CHECK_MS);
    } else if (
      data === YT.PlayerState.CUED ||
      data === YT.PlayerState.UNSTARTED
    ) {
      state.player.playVideo();
    } else {
      showBuffering();

      setControlIcon('control-power', ICONS.power, true);
    }
  };

  const onError = ({ data }) => {
    const errorCode = data;
    switch (errorCode) {
      case 100:
        console.error('Video is unavailable: removed or marked as private.');
        handleUnavailableVideo(state);
        break;
      case 101:
      case 150:
        console.error('Video cannot be embedded.');
        handleUnavailableVideo(state);
        break;
      default:
        console.error('An unknown error occurred with the video.');
        handleUnavailableVideo(state);
    }
  };

  loadYouTubeAPI(() => {
    state.player = initializePlayer(
      playerElementId,
      onReady,
      onStateChange,
      onError
    );
  });
};

initApp('player');
