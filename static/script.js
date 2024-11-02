const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
const BUFFERING_TIMEOUT = 3000;
const CHANNELS_ENDPOINT = '/channels';
const VOLUME_STEPS = 5;
const VOLUME_BAR_TIMEOUT = 2000;

const ICONS = {
  volume_muted: '/assets/icons/volume_muted.svg',
  volume_high: '/assets/icons/volume_high.svg'
};

class YouTubePlayer {
  constructor(playerElementId) {
    this.player = null;
    this.playerReady = false;
    this.playerElementId = playerElementId;
    this.channelsUrl = CHANNELS_ENDPOINT;
    this.channels = [];
    this.currentChannel = null;
    this.videoTitle = '';
    this.isPlaying = false;
    this.isMuted = true;
    this.hasInteracted = false;
    this.volumeBarTimeoutId = null;

    this.loadYouTubeAPI();
    this.loadChannels().then(() => {
      this.addControlListeners();
    });
  }

  loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = IFRAME_API_URL;
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => this.onYouTubeIframeAPIReady();
  }

  onYouTubeIframeAPIReady() {
    this.player = new YT.Player(this.playerElementId, {
      width: '100%',
      height: '100%',
      autoplay: 1,
      events: {
        onReady: (event) => this.onPlayerReady(event),
        onStateChange: (event) => this.onPlayerStateChange(event)
      },
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
  }

  onPlayerReady(event) {
    this.playerReady = true;
    if (this.channels.length > 0) {
      this.loadChannelVideo(this.channels[0]);
    } else {
      console.warn('No channels available to load.');
    }
  }

  onPlayerStateChange({ data, target }) {
    this.videoTitle = target.videoTitle || this.videoTitle;

    if (data === YT.PlayerState.UNSTARTED) {
      this.playVideo();
    }
  }

  async loadChannels() {
    try {
      const res = await fetch(this.channelsUrl);
      const data = await res.json();
      this.channels = data.channels || [];
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  }

  playVideo() {
    if (
      this.playerReady &&
      this.player.getPlayerState() !== YT.PlayerState.PLAYING
    ) {
      if (!this.hasInteracted) this.player.mute();

      this.showBuffering();

      setTimeout(() => {
        if (this.hasInteracted && !this.isMuted) this.player.unMute();
        this.hideBuffering();
        this.player.playVideo();
      }, BUFFERING_TIMEOUT);
    }
  }

  pauseVideo() {
    if (
      this.playerReady &&
      this.player.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      this.player.pauseVideo();
      this.showBuffering();
    }
  }

  toggleMute() {
    if (this.playerReady) {
      const muteButton = document.querySelector('#control-mute .control-icon');
      if (this.player.isMuted()) {
        this.player.unMute();
        this.isMuted = false;
        this.removeRedClassFromIcon('control-mute');
        muteButton.src = ICONS.volume_high;
      } else {
        this.player.mute();
        this.isMuted = true;
        this.addRedClassToIcon('control-mute');
        muteButton.src = ICONS.volume_muted;
      }
    }
  }

  loadChannelVideo(channel) {
    const videoUrl = channel.videos[0].url;
    const videoId = this.extractVideoId(videoUrl);
    if (videoId && this.playerReady) {
      this.pauseVideo();
      this.player.cueVideoById(videoId);
      this.playVideo();
      this.currentChannel = channel;
    } else {
      console.error('Player not ready or invalid video ID:', videoId);
    }
  }

  extractVideoId(url) {
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  }

  changeChannelByOffset(offset) {
    const currentIndex = this.channels.findIndex(
      (channel) => channel.id === this.currentChannel.id
    );
    const newIndex =
      (currentIndex + offset + this.channels.length) % this.channels.length;
    this.loadChannelVideo(this.channels[newIndex]);
  }

  nextChannel() {
    this.changeChannelByOffset(1);
  }

  previousChannel() {
    this.changeChannelByOffset(-1);
  }

  showBuffering() {
    document.querySelector('#buffer-gif')?.classList.add('active');
  }

  hideBuffering() {
    document.querySelector('#buffer-gif')?.classList.remove('active');
  }

  updateVolumeBar(currentVolume) {
    const volumeBar = document.querySelector('#volume-bar');
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

    clearTimeout(this.volumeBarTimeoutId);
    this.volumeBarTimeoutId = setTimeout(() => {
      volumeBar.classList.remove('active');
    }, VOLUME_BAR_TIMEOUT);
  }

  adjustVolume(increase) {
    if (this.playerReady && increase !== undefined) {
      const currentVolume = this.player.getVolume();
      const adjustment = increase ? VOLUME_STEPS : -VOLUME_STEPS;
      const newVolume = Math.min(Math.max(currentVolume + adjustment, 0), 100); // cap between 0 and 100

      this.player.setVolume(newVolume);
      this.updateVolumeBar(newVolume);
      this.player.unMute();
    }
  }

  volumeUp() {
    this.adjustVolume(true);
  }

  volumeDown() {
    this.adjustVolume(false);
  }

  addRedClassToIcon(iconId) {
    console.log(document.querySelector(`#${iconId} .control-icon`)?.firstChild);

    document.querySelector(`#${iconId} .control-icon`)?.classList.add('red');
  }

  removeRedClassFromIcon(iconId) {
    document.querySelector(`#${iconId} .control-icon`)?.classList.remove('red');
  }

  turnOff() {
    this.pauseVideo();
    this.addRedClassToIcon('control-power');
  }

  turnOn() {
    this.playVideo();
    this.removeRedClassFromIcon('control-power');
  }

  addControlListeners() {
    const controls = {
      power: () => {
        if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
          this.turnOff();
        } else {
          this.turnOn();
        }
      },
      chup: () => this.nextChannel(),
      chdown: () => this.previousChannel(),
      mute: () => this.toggleMute(),
      volup: () => this.volumeUp(),
      voldown: () => this.volumeDown()
    };

    for (const [control, handler] of Object.entries(controls)) {
      document
        .querySelector(`#control-${control}`)
        ?.addEventListener('click', handler);
    }

    document.querySelector('#controls')?.addEventListener('click', () => {
      this.hasInteracted = true;
    });
  }
}

const youtubePlayer = new YouTubePlayer('player');
