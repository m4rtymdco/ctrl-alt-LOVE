<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
cal_cors();

$id = (int) ($_GET['id'] ?? 0);
$type = $_GET['type'] ?? '';
if ($id < 1 || !in_array($type, ['audio', 'photo'], true)) {
    http_response_code(400);
    echo 'Bad request';
    exit;
}

$columnData = $type === 'audio' ? 'audio_data' : 'photo_data';
$columnMime = $type === 'audio' ? 'audio_mime' : 'photo_mime';
$columnUrl = $type === 'audio' ? 'audio_url' : 'photo_url';

$db = cal_db();
$stmt = $db->prepare("SELECT `$columnData` AS data, `$columnMime` AS mime, `$columnUrl` AS url FROM tracks WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

if (!$row) {
    http_response_code(404);
    echo 'Not found';
    exit;
}

if (empty($row['data'])) {
    if (!empty($row['url'])) {
        header('Location: ' . $row['url']);
        exit;
    }
    http_response_code(404);
    echo 'No media';
    exit;
}

$mime = $row['mime'] ?: ($type === 'audio' ? 'audio/mpeg' : 'image/jpeg');
$data = $row['data'];
$length = strlen($data);

header('Content-Type: ' . $mime);
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=3600');

$range = $_SERVER['HTTP_RANGE'] ?? '';
if (preg_match('/bytes=(\d+)-(\d*)/', $range, $m)) {
    $start = (int) $m[1];
    $end = $m[2] !== '' ? (int) $m[2] : $length - 1;
    if ($start > $end || $start >= $length) {
        http_response_code(416);
        header("Content-Range: bytes */$length");
        exit;
    }
    $end = min($end, $length - 1);
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$length");
    header('Content-Length: ' . ($end - $start + 1));
    echo substr($data, $start, $end - $start + 1);
    exit;
}

header('Content-Length: ' . $length);
echo $data;
