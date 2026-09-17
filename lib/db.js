const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'ctrl_alt_love',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

function mediaUrl(id, type) {
  return `/api/media?id=${id}&type=${encodeURIComponent(type)}`;
}

function trackPayload(row) {
  const id = Number(row.id);
  const hasAudio = Boolean(row.audio_data) || Boolean(row.audio_url);
  const hasPhoto = Boolean(row.photo_data) || Boolean(row.photo_url);
  const photoMime = row.photo_mime || '';
  return {
    id,
    title: row.title,
    artist: row.artist,
    audioUrl: hasAudio ? (row.audio_data ? mediaUrl(id, 'audio') : row.audio_url) : null,
    photoUrl: hasPhoto ? (row.photo_data ? mediaUrl(id, 'photo') : row.photo_url) : null,
    photoMime,
    isLiveVideo: String(photoMime).startsWith('video/'),
    createdAt: row.created_at,
  };
}

function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD || 'ctrlaltlove';
  const provided = req.headers['x-admin-password'] || '';
  return provided === expected;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }
  return false;
}

module.exports = {
  getPool,
  trackPayload,
  isAdmin,
  sendJson,
  handleCors,
};
