const { IncomingForm } = require('formidable');
const fs = require('fs');
const { getPool, trackPayload, isAdmin, sendJson, handleCors } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (handleCors(req, res)) return;

  try {
    const db = getPool();

    if (req.method === 'GET') {
      const [rows] = await db.query(
        `SELECT id, title, artist, audio_url, photo_url, photo_mime, created_at,
                (audio_data IS NOT NULL AND LENGTH(audio_data) > 0) AS audio_data,
                (photo_data IS NOT NULL AND LENGTH(photo_data) > 0) AS photo_data
         FROM tracks
         ORDER BY id DESC`
      );
      sendJson(res, 200, { tracks: rows.map(trackPayload) });
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
      const [result] = await db.query('DELETE FROM tracks WHERE id = ?', [id]);
      if (!result.affectedRows) {
        sendJson(res, 404, { error: 'Track not found' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST') {
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'Admin password required' });
        return;
      }

      const form = new IncomingForm({ maxFileSize: 50 * 1024 * 1024, multiples: false });
      const { fields, files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
      });

      const title = String(fields.title || '').trim();
      const artist = String(fields.artist || '').trim();
      const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
      const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;

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

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Server error' });
  }
};
