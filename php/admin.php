<?php
require_once __DIR__ . '/helpers.php';
cal_cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cal_json(['error' => 'Method not allowed'], 405);
}

$raw = json_decode(file_get_contents('php://input'), true) ?: [];
$password = $raw['password'] ?? ($_POST['password'] ?? '');
$config = require __DIR__ . '/config.php';

if (!hash_equals((string) $config['admin_password'], (string) $password)) {
    cal_json(['ok' => false, 'error' => 'Wrong password'], 401);
}

cal_json(['ok' => true]);
