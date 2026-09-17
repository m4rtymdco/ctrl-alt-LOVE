const { sendJson, handleCors } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    let password = '';
    try {
      password = JSON.parse(body || '{}').password || '';
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const expected = process.env.ADMIN_PASSWORD || 'ctrlaltlove';
    if (password !== expected) {
      sendJson(res, 401, { ok: false, error: 'Wrong password' });
      return;
    }
    sendJson(res, 200, { ok: true });
  });
};
