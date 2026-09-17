const { put, list, del, get } = require('@vercel/blob');
const { DEMO_TRACKS } = require('./demo-tracks');

const PREFIX = 'ctrl-alt-love/';
const MANIFEST = PREFIX + 'tracks.json';

function blobAuth(extra) {
  const options = { ...extra };
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (token) options.token = token;
  if (storeId) options.storeId = storeId;
  if (oidcToken) options.oidcToken = oidcToken;
  return options;
}

function mediaProxyUrl(pathname) {
  return '/api/media?path=' + encodeURIComponent(pathname);
}

async function readManifest() {
  const empty = { tracks: [], hiddenDemoIds: [] };
  const { blobs } = await list(blobAuth({ prefix: PREFIX, limit: 1000 }));
  const manifests = blobs
    .filter((item) => item.pathname.includes('tracks.json'))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const manifest = manifests[0];
  if (!manifest) {
    return empty;
  }
  const file = await get(manifest.pathname, blobAuth({ access: 'private', useCache: false }));
  if (!file || file.statusCode !== 200) {
    return empty;
  }
  const data = JSON.parse(await new Response(file.stream).text());
  return {
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    hiddenDemoIds: Array.isArray(data.hiddenDemoIds) ? data.hiddenDemoIds.map(Number) : [],
  };
}

async function writeManifest({ tracks, hiddenDemoIds }) {
  const { blobs } = await list(blobAuth({ prefix: PREFIX, limit: 1000 }));
  const oldManifests = blobs.filter((item) => item.pathname.includes('tracks.json'));
  await put(
    MANIFEST,
    JSON.stringify({ tracks, hiddenDemoIds }),
    blobAuth({
      access: 'private',
      addRandomSuffix: true,
      contentType: 'application/json',
    })
  );
  await Promise.all(oldManifests.map((item) => del(item.url, blobAuth({})).catch(() => null)));
}

function withProxyUrls(track) {
  return {
    ...track,
    audioUrl: track.audioPath ? mediaProxyUrl(track.audioPath) : track.audioUrl,
    photoUrl: track.photoPath ? mediaProxyUrl(track.photoPath) : track.photoUrl,
  };
}

async function listTracks() {
  const { tracks, hiddenDemoIds } = await readManifest();
  const uploaded = tracks.filter((track) => !track.isDemo).map(withProxyUrls);
  const demos = DEMO_TRACKS.filter((track) => !hiddenDemoIds.includes(Number(track.id)));
  return [...uploaded, ...demos];
}

async function addTrack({ title, artist, audioBuffer, audioMime, photoBuffer, photoMime }) {
  const id = Date.now();
  const audioPath = `${PREFIX}audio-${id}`;
  await put(audioPath, audioBuffer, blobAuth({
    access: 'private',
    contentType: audioMime || 'audio/mpeg',
  }));
  let photoPath = null;
  let mime = photoMime || '';
  if (photoBuffer && photoBuffer.length) {
    photoPath = `${PREFIX}photo-${id}`;
    await put(photoPath, photoBuffer, blobAuth({
      access: 'private',
      contentType: photoMime || 'image/jpeg',
    }));
  }
  const track = {
    id,
    title,
    artist,
    audioPath,
    photoPath,
    photoMime: mime,
    isLiveVideo: String(mime).startsWith('video/'),
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  const manifest = await readManifest();
  manifest.tracks.unshift(track);
  await writeManifest(manifest);
  return withProxyUrls(track);
}

async function deleteTrack(id) {
  const numericId = Number(id);
  const manifest = await readManifest();
  const isDemo = DEMO_TRACKS.some((track) => Number(track.id) === numericId);
  if (isDemo) {
    if (manifest.hiddenDemoIds.includes(numericId)) {
      return false;
    }
    manifest.hiddenDemoIds.push(numericId);
    await writeManifest(manifest);
    return true;
  }

  const next = manifest.tracks.filter((track) => Number(track.id) !== numericId);
  if (next.length === manifest.tracks.length) {
    return false;
  }
  await writeManifest({ tracks: next, hiddenDemoIds: manifest.hiddenDemoIds });
  try {
    const { blobs } = await list(blobAuth({ prefix: `${PREFIX}audio-${numericId}`, limit: 10 }));
    const { blobs: photos } = await list(blobAuth({ prefix: `${PREFIX}photo-${numericId}`, limit: 10 }));
    await Promise.all([...blobs, ...photos].map((blob) => del(blob.url, blobAuth({}))));
  } catch (err) {
    // Keep the library consistent even if a media blob is already gone.
  }
  return true;
}

async function readPrivateFile(pathname) {
  if (!pathname || pathname.includes('..')) {
    return null;
  }
  const file = await get(pathname, blobAuth({ access: 'private', useCache: true }));
  if (!file || file.statusCode !== 200) {
    return null;
  }
  const buffer = Buffer.from(await new Response(file.stream).arrayBuffer());
  return {
    buffer,
    contentType: file.blob.contentType || 'application/octet-stream',
  };
}

module.exports = { listTracks, addTrack, deleteTrack, readPrivateFile };
