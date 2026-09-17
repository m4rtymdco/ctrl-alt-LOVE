<?php
function cal_cors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function cal_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function cal_is_admin(): bool
{
    $config = require __DIR__ . '/config.php';
    $provided = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
    return hash_equals((string) $config['admin_password'], (string) $provided);
}

function cal_require_admin(): void
{
    if (!cal_is_admin()) {
        cal_json(['error' => 'Admin password required'], 401);
    }
}

function cal_media_url(int $id, string $type): string
{
    $script = dirname($_SERVER['SCRIPT_NAME'] ?? '/php');
    $base = rtrim(str_replace('\\', '/', $script), '/');
    if (substr($base, -4) === '/php') {
        $base = substr($base, 0, -4);
    }
    return $base . '/php/media.php?id=' . $id . '&type=' . rawurlencode($type);
}

function cal_track_payload(array $row): array
{
    $id = (int) $row['id'];
    $hasAudio = !empty($row['audio_data']) || !empty($row['audio_url']);
    $hasPhoto = !empty($row['photo_data']) || !empty($row['photo_url']);
    $photoMime = $row['photo_mime'] ?: '';

    return [
        'id' => $id,
        'title' => $row['title'],
        'artist' => $row['artist'],
        'audioUrl' => $hasAudio ? (empty($row['audio_data']) ? $row['audio_url'] : cal_media_url($id, 'audio')) : null,
        'photoUrl' => $hasPhoto ? (empty($row['photo_data']) ? $row['photo_url'] : cal_media_url($id, 'photo')) : null,
        'photoMime' => $photoMime,
        'isLiveVideo' => strpos($photoMime, 'video/') === 0,
        'createdAt' => $row['created_at'],
    ];
}
