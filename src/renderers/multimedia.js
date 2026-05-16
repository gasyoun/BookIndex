/**
 * @file multimedia.js
 * @description Renderers for the Video Archive and YouTube player integration
 */

import { APP_DATA } from '../core/state.js';
import { escapeHtml } from '../utils/dom.js';

let ytPlayer = null;

export function openVideoPlayer(videoId) {
  const v = (APP_DATA.video_catalog || []).find(x => x.id === videoId);
  if (!v) return;

  const modal = document.getElementById('video-player-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const ytId = v.url.split('v=')[1];
  const tcList = document.getElementById('video-modal-tc-list');
  if (tcList) {
    tcList.innerHTML = v.timecodes.map(tc => {
      const minutes = Math.floor(tc.time / 60);
      const seconds = String(tc.time % 60).padStart(2, '0');
      return `<div class="video-modal-tc-item" onclick="seekVideo(${tc.time})">
        <div style="font-weight:700; color:#80deea;">${minutes}:${seconds}</div>
        <div style="font-size:0.85rem; color:#ccc;">${escapeHtml(tc.label)}</div>
      </div>`;
    }).join('');
  }

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
      container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
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
  let html = `<div class="panel active video-panel"><div class="video-inner">
    <h2 class="video-title">Видеоархив лекций А. А. Зализняка</h2>
    <div class="video-grid">`;

  videos.forEach(v => {
    const ytId = v.url.split('v=')[1];
    html += `
      <div class="video-card" onclick="openVideoPlayer('${v.id}')">
        <div class="video-thumb" style="background-image:url(https://img.youtube.com/vi/${ytId}/mqdefault.jpg);"></div>
        <div class="video-info">
          <div class="video-title">${escapeHtml(v.title)}</div>
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}
