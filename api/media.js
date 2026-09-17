const { getPool, sendJson, handleCors } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const id = Number(url.searchParams.get('id') || 0);
    const type = url.searchParams.get('type');
    if (!id || !['audio', 'photo'].includes(type)) {
      sendJson(res, 400, { error: 'Bad request' });
      return;
    }

    const columnData = type === 'audio' ? 'audio_data' : 'photo_data';
    const columnMime = type === 'audio' ? 'audio_mime' : 'photo_mime';
    const columnUrl = type === 'audio' ? 'audio_url' : 'photo_url';
    const db = getPool();
    const [rows] = await db.query(
      `SELECT \`${columnData}\` AS data, \`${columnMime}\` AS mime, \`${columnUrl}\` AS url FROM tracks WHERE id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (!row.data || !row.data.length) {
      if (row.url) {
        res.statusCode = 302;
        res.setHeader('Location', row.url);
        res.end();
        return;
      }
      sendJson(res, 404, { error: 'No media' });
      return;
    }

    const buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    const mime = row.mime || (type === 'audio' ? 'audio/mpeg' : 'image/jpeg');
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buffer);
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Server error' });
  }
};
