const mysql = require('mysql2/promise');

let pool;

function mysqlUrl() {
  return process.env.DATABASE_URL || process.env.MYSQL_URL || '';
}

function mysqlHost() {
  return process.env.DB_HOST || '';
}

function mysqlEnabled() {
  if (mysqlUrl()) return true;
  const host = mysqlHost();
  if (process.env.VERCEL) {
    return Boolean(host) && host !== '127.0.0.1' && host !== 'localhost';
  }
  return true;
}

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function getPool() {
  if (!mysqlEnabled()) {
    throw new Error('Cloud database is not configured for Vercel.');
  }
  if (!pool) {
    const url = mysqlUrl();
    if (url) {
      pool = mysql.createPool(url);
    } else {
      pool = mysql.createPool({
        host: mysqlHost() || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'ctrl_alt_love',
        waitForConnections: true,
        connectionLimit: 5,
      });
    }
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
    lyrics: row.lyrics || '',
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

function vercelSetupError() {
  return (
    'This live site cannot use your XAMPP MySQL (127.0.0.1). ' +
    'In Vercel: Storage → Create Blob Store, then Redeploy. ' +
    'Or set DATABASE_URL / DB_HOST to a cloud MySQL (not localhost).'
  );
}

module.exports = {
  getPool,
  trackPayload,
  isAdmin,
  sendJson,
  handleCors,
  mysqlEnabled,
  blobEnabled,
  vercelSetupError,
};
