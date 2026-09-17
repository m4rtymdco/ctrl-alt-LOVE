<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
cal_cors();

$method = $_SERVER['REQUEST_METHOD'];
$db = cal_db();

function cal_save_upload(array $file, string $folder): ?array
{
    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return null;
    }
    $root = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $folder;
    if (!is_dir($root) && !mkdir($root, 0777, true) && !is_dir($root)) {
        return null;
    }
    $ext = pathinfo($file['name'] ?? '', PATHINFO_EXTENSION);
    $ext = $ext ? preg_replace('/[^a-zA-Z0-9]/', '', $ext) : 'bin';
    $name = uniqid('track_', true) . '.' . $ext;
    $dest = $root . DIRECTORY_SEPARATOR . $name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        return null;
    }
    $script = dirname($_SERVER['SCRIPT_NAME'] ?? '/php');
    $base = rtrim(str_replace('\\', '/', $script), '/');
    if (substr($base, -4) === '/php') {
        $base = substr($base, 0, -4);
    }
    return [
        'url' => $base . '/uploads/' . $folder . '/' . $name,
        'mime' => $file['type'] ?: null,
    ];
}

if ($method === 'GET') {
    $result = $db->query(
        'SELECT id, title, artist, audio_url, photo_url, photo_mime, created_at,
                (audio_data IS NOT NULL AND LENGTH(audio_data) > 0) AS audio_data,
                (photo_data IS NOT NULL AND LENGTH(photo_data) > 0) AS photo_data
         FROM tracks
         ORDER BY id DESC'
    );
    $tracks = [];
    while ($row = $result->fetch_assoc()) {
        $tracks[] = cal_track_payload($row);
    }
    cal_json(['tracks' => $tracks]);
}

if ($method === 'DELETE') {
    cal_require_admin();
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1) {
        cal_json(['error' => 'Missing id'], 400);
    }
    $stmt = $db->prepare('DELETE FROM tracks WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    if ($stmt->affected_rows < 1) {
        cal_json(['error' => 'Track not found'], 404);
    }
    cal_json(['ok' => true]);
}

if ($method === 'POST') {
    cal_require_admin();
    $title = trim($_POST['title'] ?? '');
    $artist = trim($_POST['artist'] ?? '');
    if ($title === '' || $artist === '') {
        cal_json(['error' => 'Title and artist are required'], 400);
    }
    if (empty($_FILES['audio']['tmp_name'])) {
        cal_json(['error' => 'Audio file is required'], 400);
    }

    $audio = cal_save_upload($_FILES['audio'], 'audio');
    if (!$audio) {
        cal_json(['error' => 'Could not save audio file. Check uploads/ permissions.'], 500);
    }
    $photo = !empty($_FILES['photo']['tmp_name']) ? cal_save_upload($_FILES['photo'], 'photos') : null;

    $audioUrl = $audio['url'];
    $audioMime = $audio['mime'];
    $photoUrl = $photo['url'] ?? null;
    $photoMime = $photo['mime'] ?? null;

    $stmt = $db->prepare(
        'INSERT INTO tracks (title, artist, audio_mime, audio_url, photo_mime, photo_url)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('ssssss', $title, $artist, $audioMime, $audioUrl, $photoMime, $photoUrl);
    if (!$stmt->execute()) {
        cal_json(['error' => 'Could not save track: ' . $stmt->error], 500);
    }

    $id = (int) $stmt->insert_id;
    cal_json([
        'track' => cal_track_payload([
            'id' => $id,
            'title' => $title,
            'artist' => $artist,
            'audio_url' => $audioUrl,
            'photo_url' => $photoUrl,
            'photo_mime' => $photoMime,
            'created_at' => date('Y-m-d H:i:s'),
            'audio_data' => '',
            'photo_data' => '',
        ]),
    ], 201);
}

cal_json(['error' => 'Method not allowed'], 405);
