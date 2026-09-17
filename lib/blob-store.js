const { put, list, del } = require('@vercel/blob');
const { DEMO_TRACKS } = require('./demo-tracks');

const PREFIX = 'ctrl-alt-love/';
const MANIFEST = PREFIX + 'tracks.json';

async function readManifest() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const manifests = blobs
    .filter((item) => item.pathname.includes('tracks.json'))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const manifest = manifests[0];
  if (!manifest) {
    return { tracks: [], blobs };
  }
  const res = await fetch(manifest.url, { cache: 'no-store' });
  if (!res.ok) {
    return { tracks: [], blobs };
  }
  const data = await res.json();
  return { tracks: Array.isArray(data.tracks) ? data.tracks : [], blobs };
}

async function writeManifest(tracks) {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const oldManifests = blobs.filter((item) => item.pathname.includes('tracks.json'));
  await put(MANIFEST, JSON.stringify({ tracks }), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  });
  await Promise.all(oldManifests.map((item) => del(item.url).catch(() => null)));
}

async function listTracks() {
  const { tracks } = await readManifest();
  const uploaded = tracks.filter((track) => !track.isDemo);
  return [...uploaded, ...DEMO_TRACKS];
}

async function addTrack({ title, artist, audioBuffer, audioMime, photoBuffer, photoMime }) {
  const id = Date.now();
  const audio = await put(`${PREFIX}audio-${id}`, audioBuffer, {
    access: 'public',
    contentType: audioMime || 'audio/mpeg',
  });
  let photoUrl = null;
  let mime = photoMime || '';
  if (photoBuffer && photoBuffer.length) {
    const photo = await put(`${PREFIX}photo-${id}`, photoBuffer, {
      access: 'public',
      contentType: photoMime || 'image/jpeg',
    });
    photoUrl = photo.url;
  }
  const track = {
    id,
    title,
    artist,
    audioUrl: audio.url,
    photoUrl,
    photoMime: mime,
    isLiveVideo: String(mime).startsWith('video/'),
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  const { tracks } = await readManifest();
  tracks.unshift(track);
  await writeManifest(tracks);
  return track;
}

async function deleteTrack(id) {
  const { tracks } = await readManifest();
  const next = tracks.filter((track) => Number(track.id) !== Number(id));
  if (next.length === tracks.length) {
    return false;
  }
  await writeManifest(next);
  try {
    const { blobs } = await list({ prefix: `${PREFIX}audio-${id}`, limit: 10 });
    const { blobs: photos } = await list({ prefix: `${PREFIX}photo-${id}`, limit: 10 });
    await Promise.all([...blobs, ...photos].map((blob) => del(blob.url)));
  } catch (err) {
    // Keep the library consistent even if a media blob is already gone.
  }
  return true;
}

module.exports = { listTracks, addTrack, deleteTrack };
