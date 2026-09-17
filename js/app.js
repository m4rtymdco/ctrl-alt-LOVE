(function () {
  const app = document.getElementById('app');
  const modeBadge = document.getElementById('modeBadge');
  const trackList = document.getElementById('trackList');
  const livePhotoContainer = document.getElementById('livePhotoContainer');
  const livePhoto = document.getElementById('livePhoto');
  const liveVideo = document.getElementById('liveVideo');
  const placeholder = document.getElementById('placeholder');
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const nowPlayingArtist = document.getElementById('nowPlayingArtist');
  const playBtn = document.getElementById('playBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const addTrackBtn = document.getElementById('addTrackBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const loginOverlay = document.getElementById('loginOverlay');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const confirmModalBtn = document.getElementById('confirmModalBtn');
  const cancelLoginBtn = document.getElementById('cancelLoginBtn');
  const confirmLoginBtn = document.getElementById('confirmLoginBtn');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const trackTitleInput = document.getElementById('trackTitleInput');
  const trackArtistInput = document.getElementById('trackArtistInput');
  const audioFileInput = document.getElementById('audioFileInput');
  const imageFileInput = document.getElementById('imageFileInput');
  const seekBar = document.getElementById('seekBar');
  const currentTimeEl = document.getElementById('currentTime');
  const durationTimeEl = document.getElementById('durationTime');
  const statusLine = document.getElementById('statusLine');

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'metadata';

  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;
  let isAdmin = false;
  let adminPassword = '';
  let seeking = false;

  function apiBase() {
    const host = window.location.hostname;
    const port = window.location.port;
    const isApache = (host === 'localhost' || host === '127.0.0.1') && (port === '' || port === '80' || port === '443' || port === '8080');
    return isApache ? 'php' : '/api';
  }

  function endpoint(name) {
    const base = apiBase();
    if (base === 'php') {
      return 'php/' + name + '.php';
    }
    return '/api/' + name;
  }

  function setStatus(message, isError) {
    statusLine.textContent = message || '';
    statusLine.classList.toggle('error', Boolean(isError));
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  async function loadTracks() {
    setStatus('Loading library…');
    try {
      const res = await fetch(endpoint('tracks'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load tracks');
      tracks = data.tracks || [];
      renderTrackList();
      if (currentTrackIndex === -1 && tracks.length > 0) {
        selectTrack(0, false);
      }
      setStatus('');
    } catch (err) {
      tracks = [];
      renderTrackList();
      setStatus(err.message + ' — start Apache + MySQL in XAMPP, then import database/schema.sql.', true);
    }
  }

  function renderTrackList() {
    if (tracks.length === 0) {
      trackList.innerHTML = `<div style="color: #B3B3B3; text-align: center; padding: 40px 10px; font-size: 0.9rem;">No tracks yet.<br>${isAdmin ? 'Click + to add.' : 'Switch to admin to add.'}</div>`;
      return;
    }

    trackList.innerHTML = tracks.map((track, index) => {
      const activeClass = index === currentTrackIndex ? 'active' : '';
      const thumbContent = track.photoUrl
        ? (track.isLiveVideo
          ? `<video src="${track.photoUrl}" muted></video>`
          : `<img src="${track.photoUrl}" alt="cover">`)
        : '🎵';
      return `
        <div class="track-item ${activeClass}" data-index="${index}">
          <div class="track-thumb">${thumbContent}</div>
          <div class="track-info">
            <div class="track-title">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.artist)}</div>
          </div>
          <div class="admin-actions">
            <button class="delete-track" data-id="${track.id}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.track-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-track')) return;
        selectTrack(parseInt(item.dataset.index, 10), true);
      });
    });

    document.querySelectorAll('.delete-track').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTrack(Number(btn.dataset.id));
      });
    });
  }

  function selectTrack(index, autoPlay) {
    if (index < 0 || index >= tracks.length) return;
    const track = tracks[index];
    currentTrackIndex = index;
    audio.src = track.audioUrl;
    audio.load();
    updateNowPlayingUI(track);
    updateLivePhoto(track);
    renderTrackList();
    if (autoPlay) playTrack();
    else pauseTrack();
  }

  function updateNowPlayingUI(track) {
    nowPlayingTitle.textContent = track.title || 'Unknown';
    nowPlayingArtist.textContent = track.artist || 'Unknown artist';
  }

  function updateLivePhoto(track) {
    livePhoto.style.display = 'none';
    liveVideo.style.display = 'none';
    liveVideo.pause();
    liveVideo.removeAttribute('src');

    if (track.photoUrl && track.isLiveVideo) {
      liveVideo.src = track.photoUrl;
      liveVideo.style.display = 'block';
      placeholder.style.display = 'none';
      if (isPlaying) liveVideo.play().catch(() => {});
      return;
    }

    if (track.photoUrl) {
      livePhoto.src = track.photoUrl;
      livePhoto.style.display = 'block';
      placeholder.style.display = 'none';
      return;
    }

    placeholder.style.display = 'flex';
  }

  function playTrack() {
    if (currentTrackIndex === -1) {
      if (tracks.length > 0) selectTrack(0, true);
      return;
    }
    audio.play().then(() => {
      isPlaying = true;
      playBtn.textContent = '⏸';
      livePhotoContainer.classList.add('playing');
      setStatus('');
      if (liveVideo.style.display === 'block') {
        liveVideo.play().catch(() => {});
      }
    }).catch((err) => {
      if (err && (err.name === 'AbortError' || /interrupted/i.test(err.message || ''))) return;
      setStatus('Playback blocked or file missing: ' + err.message, true);
    });
  }

  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    playBtn.textContent = '▶';
    livePhotoContainer.classList.remove('playing');
    liveVideo.pause();
  }

  function togglePlayPause() {
    if (currentTrackIndex === -1) {
      if (tracks.length > 0) selectTrack(0, true);
      return;
    }
    if (isPlaying) pauseTrack();
    else playTrack();
  }

  function playPrev() {
    if (!tracks.length) return;
    const next = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    selectTrack(next, true);
  }

  function playNext() {
    if (!tracks.length) return;
    const next = currentTrackIndex >= tracks.length - 1 ? 0 : currentTrackIndex + 1;
    selectTrack(next, true);
  }

  async function deleteTrack(id) {
    if (!isAdmin) return;
    try {
      const res = await fetch(endpoint('tracks') + '?id=' + id, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setStatus('');
      const wasCurrent = tracks[currentTrackIndex] && tracks[currentTrackIndex].id === id;
      tracks = tracks.filter((t) => t.id !== id);
      if (wasCurrent) {
        currentTrackIndex = -1;
        audio.pause();
        audio.removeAttribute('src');
        pauseTrack();
        nowPlayingTitle.textContent = 'No track selected';
        nowPlayingArtist.textContent = '—';
        livePhoto.style.display = 'none';
        liveVideo.style.display = 'none';
        placeholder.style.display = 'flex';
      }
      renderTrackList();
      if (currentTrackIndex >= tracks.length) currentTrackIndex = tracks.length - 1;
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function setAdminMode(enabled) {
    isAdmin = enabled;
    if (isAdmin) {
      app.classList.add('admin-mode');
      modeBadge.textContent = '🛡️ Admin';
      modeBadge.classList.add('admin');
    } else {
      app.classList.remove('admin-mode');
      modeBadge.textContent = '👤 User';
      modeBadge.classList.remove('admin');
      adminPassword = '';
    }
    renderTrackList();
  }

  function openModal() {
    if (!isAdmin) return;
    trackTitleInput.value = '';
    trackArtistInput.value = '';
    audioFileInput.value = '';
    imageFileInput.value = '';
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  async function addTrackFromModal() {
    const title = trackTitleInput.value.trim();
    const artist = trackArtistInput.value.trim();
    const audioFile = audioFileInput.files[0];
    const imageFile = imageFileInput.files[0];

    if (!title || !artist) {
      alert('Title and artist are required.');
      return;
    }
    if (!audioFile) {
      alert('Please select an audio file.');
      return;
    }

    const form = new FormData();
    form.append('title', title);
    form.append('artist', artist);
    form.append('audio', audioFile);
    if (imageFile) form.append('photo', imageFile);

    confirmModalBtn.disabled = true;
    confirmModalBtn.textContent = 'Saving…';
    try {
      const res = await fetch(endpoint('tracks'), {
        method: 'POST',
        headers: { 'X-Admin-Password': adminPassword },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add track');
      closeModal();
      if (data.track) {
        tracks = [data.track, ...tracks.filter((item) => item.id !== data.track.id && !item.isDemo)];
        currentTrackIndex = 0;
        renderTrackList();
        selectTrack(0, false);
      }
      await loadTracks();
    } catch (err) {
      setStatus(err.message, true);
      alert(err.message);
    } finally {
      confirmModalBtn.disabled = false;
      confirmModalBtn.textContent = 'Add track';
    }
  }

  async function loginAdmin() {
    const password = adminPasswordInput.value;
    try {
      const res = await fetch(endpoint('admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      adminPassword = password;
      setAdminMode(true);
      loginOverlay.classList.remove('active');
      adminPasswordInput.value = '';
    } catch (err) {
      alert(err.message);
    }
  }

  modeBadge.addEventListener('click', () => {
    if (isAdmin) {
      setAdminMode(false);
      return;
    }
    loginOverlay.classList.add('active');
    adminPasswordInput.focus();
  });

  playBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);
  addTrackBtn.addEventListener('click', openModal);
  cancelModalBtn.addEventListener('click', closeModal);
  confirmModalBtn.addEventListener('click', addTrackFromModal);
  cancelLoginBtn.addEventListener('click', () => loginOverlay.classList.remove('active'));
  confirmLoginBtn.addEventListener('click', loginAdmin);
  adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginAdmin();
  });
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) loginOverlay.classList.remove('active');
  });

  seekBar.addEventListener('input', () => {
    seeking = true;
  });
  seekBar.addEventListener('change', () => {
    if (audio.duration) {
      audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
    }
    seeking = false;
  });

  audio.addEventListener('timeupdate', () => {
    if (!seeking && audio.duration) {
      seekBar.value = String((audio.currentTime / audio.duration) * 100);
    }
    currentTimeEl.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => {
    durationTimeEl.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', playNext);
  audio.addEventListener('pause', () => {
    isPlaying = false;
    playBtn.textContent = '▶';
    livePhotoContainer.classList.remove('playing');
    liveVideo.pause();
  });
  audio.addEventListener('play', () => {
    isPlaying = true;
    playBtn.textContent = '⏸';
    livePhotoContainer.classList.add('playing');
    if (liveVideo.style.display === 'block') liveVideo.play().catch(() => {});
  });
  audio.addEventListener('error', () => {
    setStatus('Could not play this audio file.', true);
  });

  setAdminMode(false);
  loadTracks();
})();
