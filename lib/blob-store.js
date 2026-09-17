const { put, list, del, get } = require('@vercel/blob');
const { DEMO_TRACKS } = require('./demo-tracks');

const PREFIX = 'ctrl-alt-love/';
const MANIFEST = PREFIX + 'library.json';

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

function emptyManifest() {
  return { tracks: [], hiddenDemoIds: DEMO_TRACKS.map((track) => Number(track.id)) };
}

async function parseManifestFile(file) {
  if (!file || file.statusCode !== 200) return null;
  const data = JSON.parse(await new Response(file.stream).text());
  return {
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    hiddenDemoIds: Array.isArray(data.hiddenDemoIds)
      ? data.hiddenDemoIds.map(Number)
      : emptyManifest().hiddenDemoIds,
  };
}

async function readManifest() {
  try {
    const file = await get(MANIFEST, blobAuth({ access: 'private', useCache: false }));
    const parsed = await parseManifestFile(file);
    if (parsed) return parsed;
  } catch (err) {
    // Fall through to list() for older random-suffix files.
  }

  try {
    const { blobs } = await list(blobAuth({ prefix: PREFIX, limit: 1000 }));
    const manifests = blobs
      .filter((item) => /library\.json|tracks\.json/.test(item.pathname))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    if (manifests[0]) {
      const file = await get(manifests[0].pathname, blobAuth({ access: 'private', useCache: false }));
      const parsed = await parseManifestFile(file);
      if (parsed) return parsed;
    }
  } catch (err) {
    // Empty library until a successful write.
  }

  return emptyManifest();
}

async function writeManifest(manifest) {
  await put(
    MANIFEST,
    JSON.stringify({
      tracks: manifest.tracks || [],
      hiddenDemoIds: manifest.hiddenDemoIds || emptyManifest().hiddenDemoIds,
    }),
    blobAuth({
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
  );
}

function withProxyUrls(track) {
  return {
    ...track,
    audioUrl: track.audioPath ? mediaProxyUrl(track.audioPath) : track.audioUrl,
    photoUrl: track.photoPath ? mediaProxyUrl(track.photoPath) : track.photoUrl,
  };
}

async function listTracks() {
  const { tracks } = await readManifest();
  return tracks.filter((track) => !track.isDemo).map(withProxyUrls);
}

async function addTrack({ title, artist, lyrics, audioBuffer, audioMime, photoBuffer, photoMime }) {
  const id = Date.now();
  const audioPath = `${PREFIX}audio-${id}`;
  await put(audioPath, audioBuffer, blobAuth({
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: audioMime || 'audio/mpeg',
  }));
  let photoPath = null;
  let mime = photoMime || '';
  if (photoBuffer && photoBuffer.length) {
    photoPath = `${PREFIX}photo-${id}`;
    await put(photoPath, photoBuffer, blobAuth({
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: photoMime || 'image/jpeg',
    }));
  }
  const track = {
    id,
    title,
    artist,
    lyrics: lyrics || '',
    audioPath,
    photoPath,
    photoMime: mime,
    isLiveVideo: String(mime).startsWith('video/'),
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  const manifest = await readManifest();
  manifest.tracks = [track, ...manifest.tracks.filter((item) => Number(item.id) !== id && !item.isDemo)];
  await writeManifest(manifest);
  return withProxyUrls(track);
}

async function deleteTrack(id) {
  const numericId = Number(id);
  const manifest = await readManifest();
  const isDemo = DEMO_TRACKS.some((track) => Number(track.id) === numericId);
  if (isDemo) {
    if (!manifest.hiddenDemoIds.includes(numericId)) {
      manifest.hiddenDemoIds.push(numericId);
    }
    await writeManifest(manifest);
    return true;
  }

  const next = manifest.tracks.filter((track) => Number(track.id) !== numericId);
  if (next.length === manifest.tracks.length) {
    return false;
  }
  await writeManifest({ tracks: next, hiddenDemoIds: manifest.hiddenDemoIds });
  try {
    await Promise.all([
      del(`${PREFIX}audio-${numericId}`, blobAuth({})).catch(() => null),
      del(`${PREFIX}photo-${numericId}`, blobAuth({})).catch(() => null),
    ]);
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
