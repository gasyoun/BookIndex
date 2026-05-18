/**
 * @file multimedia.js
 * @description Renderers for the Video Archive and YouTube player integration
 */

import { APP_DATA } from '../core/state.js';

let ytPlayer = null;

function getYouTubeId(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://www.youtube.com/');
    const id = parsed.hostname === 'youtu.be'
      ? parsed.pathname.replace(/^\/+/, '')
      : parsed.searchParams.get('v');
    return /^[A-Za-z0-9_-]{6,32}$/.test(id || '') ? id : '';
  } catch (e) {
    return '';
  }
}

function renderTimecodeList(container, timecodes = []) {
  container.textContent = '';
  timecodes.forEach((tc) => {
    const secondsValue = Number(tc.time);
    const secondsSafe = Number.isFinite(secondsValue) ? Math.max(0, Math.floor(secondsValue)) : 0;
    const minutes = Math.floor(secondsSafe / 60);
    const seconds = String(secondsSafe % 60).padStart(2, '0');

    const item = document.createElement('div');
    item.className = 'video-modal-tc-item';
    item.addEventListener('click', () => seekVideo(secondsSafe));

    const time = document.createElement('div');
    time.className = 'video-modal-tc-time';
    time.textContent = `${minutes}:${seconds}`;

    const label = document.createElement('div');
    label.className = 'video-modal-tc-label';
    label.textContent = String(tc.label || '');

    item.appendChild(time);
    item.appendChild(label);
    container.appendChild(item);
  });
}

export function openVideoPlayer(videoId) {
  const v = (APP_DATA.video_catalog || []).find(x => x.id === videoId);
  if (!v) return;

  const modal = document.getElementById('video-player-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const ytId = getYouTubeId(v.url);
  if (!ytId) return;

  const tcList = document.getElementById('video-modal-tc-list');
  if (tcList) renderTimecodeList(tcList, v.timecodes || []);

  if (typeof YT !== 'undefined' && YT.Player) {
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(ytId);
    } else {
      ytPlayer = new YT.Player('yt-player-container', {
        height: '100%',
        width: '100%',
        videoId: ytId,
        playerVars: { 'autoplay': 1, 'modestbranding': 1 }
      });
    }
  } else {
    const container = document.getElementById('yt-player-container');
    if (container) {
      container.textContent = '';
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(ytId)}?autoplay=1`;
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
  }
}

export function seekVideo(seconds) {
  if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(seconds, true);
  }
}

export function renderVideoArchivePanel(container) {
  const videos = APP_DATA.video_catalog || [];
  container.textContent = '';

  const panel = document.createElement('div');
  panel.className = 'panel active video-panel';
  const inner = document.createElement('div');
  inner.className = 'video-inner';
  const title = document.createElement('h2');
  title.className = 'video-title';
  title.textContent = 'Видеоархив лекций А. А. Зализняка';
  const grid = document.createElement('div');
  grid.className = 'video-grid';

  videos.forEach((v) => {
    const ytId = getYouTubeId(v.url);
    const card = document.createElement('div');
    card.className = 'video-card';
    card.addEventListener('click', () => openVideoPlayer(v.id));

    const thumb = document.createElement('div');
    thumb.className = 'video-thumb';
    if (ytId) {
      thumb.style.backgroundImage = `url("https://img.youtube.com/vi/${encodeURIComponent(ytId)}/mqdefault.jpg")`;
    }

    const info = document.createElement('div');
    info.className = 'video-info';
    const videoTitle = document.createElement('div');
    videoTitle.className = 'video-title';
    videoTitle.textContent = String(v.title || '');

    info.appendChild(videoTitle);
    card.appendChild(thumb);
    card.appendChild(info);
    grid.appendChild(card);
  });

  inner.appendChild(title);
  inner.appendChild(grid);
  panel.appendChild(inner);
  container.appendChild(panel);
}
