const fs = require('fs');
const { IncomingForm } = require('formidable');
const { DEMO_TRACKS } = require('../lib/demo-tracks');
const blobStore = require('../lib/blob-store');
const {
  getPool,
  trackPayload,
  isAdmin,
  sendJson,
  handleCors,
  mysqlEnabled,
  blobEnabled,
  vercelSetupError,
} = require('../lib/db');

module.exports.config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

async function parseForm(req) {
  const form = new IncomingForm({ maxFileSize: 8 * 1024 * 1024, multiples: false });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

function fieldValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function fileValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function listMysql() {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT id, title, artist, audio_url, photo_url, photo_mime, created_at,
            (audio_data IS NOT NULL AND LENGTH(audio_data) > 0) AS audio_data,
            (photo_data IS NOT NULL AND LENGTH(photo_data) > 0) AS photo_data
     FROM tracks
     ORDER BY id DESC`
  );
  return rows.map(trackPayload);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (mysqlEnabled()) {
        try {
          sendJson(res, 200, { tracks: await listMysql() });
          return;
        } catch (err) {
          if (!process.env.VERCEL) throw err;
        }
      }
      if (blobEnabled()) {
        sendJson(res, 200, { tracks: await blobStore.listTracks() });
        return;
      }
      sendJson(res, 200, { tracks: DEMO_TRACKS });
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'Admin password required' });
        return;
      }
      const url = new URL(req.url, 'http://localhost');
      const id = Number(url.searchParams.get('id') || 0);
      if (!id) {
        sendJson(res, 400, { error: 'Missing id' });
        return;
      }
      if (mysqlEnabled()) {
        const db = getPool();
        const [result] = await db.query('DELETE FROM tracks WHERE id = ?', [id]);
        if (!result.affectedRows) {
          sendJson(res, 404, { error: 'Track not found' });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }
      if (blobEnabled()) {
        const ok = await blobStore.deleteTrack(id);
        if (!ok) {
          sendJson(res, 404, { error: 'Track not found' });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 503, { error: vercelSetupError() });
      return;
    }

    if (req.method === 'POST') {
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'Admin password required' });
        return;
      }

      const { fields, files } = await parseForm(req);
      const title = fieldValue(fields.title);
      const artist = fieldValue(fields.artist);
      const audioFile = fileValue(files.audio);
      const photoFile = fileValue(files.photo);

      if (!title || !artist) {
        sendJson(res, 400, { error: 'Title and artist are required' });
        return;
      }
      if (!audioFile || !audioFile.filepath) {
        sendJson(res, 400, { error: 'Audio file is required' });
        return;
      }

      const audioData = fs.readFileSync(audioFile.filepath);
      const audioMime = audioFile.mimetype || 'audio/mpeg';
      let photoData = null;
      let photoMime = null;
      if (photoFile && photoFile.filepath) {
        photoData = fs.readFileSync(photoFile.filepath);
        photoMime = photoFile.mimetype || 'image/jpeg';
      }

      if (mysqlEnabled()) {
        const db = getPool();
        const [result] = await db.query(
          'INSERT INTO tracks (title, artist, audio_mime, audio_data, photo_mime, photo_data, audio_url, photo_url) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)',
          [title, artist, audioMime, audioData, photoMime, photoData]
        );
        sendJson(res, 201, {
          track: trackPayload({
            id: result.insertId,
            title,
            artist,
            audio_url: null,
            photo_url: null,
            photo_mime: photoMime,
            created_at: new Date().toISOString(),
            audio_data: 1,
            photo_data: photoData ? 1 : 0,
          }),
        });
        return;
      }

      if (blobEnabled()) {
        const track = await blobStore.addTrack({
          title,
          artist,
          audioBuffer: audioData,
          audioMime,
          photoBuffer: photoData,
          photoMime,
        });
        sendJson(res, 201, { track });
        return;
      }

      sendJson(res, 503, { error: vercelSetupError() });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const message = /ECONNREFUSED|127\.0\.0\.1|localhost/i.test(err.message || '')
      ? vercelSetupError()
      : err.message || 'Server error';
    sendJson(res, 500, { error: message });
  }
};
