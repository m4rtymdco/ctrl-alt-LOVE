<?php
function cal_db(): mysqli
{
    static $conn = null;
    if ($conn instanceof mysqli) {
        return $conn;
    }

    $config = require __DIR__ . '/config.php';
    $conn = new mysqli(
        $config['db_host'],
        $config['db_user'],
        $config['db_pass'],
        $config['db_name'],
        (int) $config['db_port']
    );

    if ($conn->connect_error) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Database connection failed. Import database/schema.sql in phpMyAdmin.']);
        exit;
    }

    $conn->set_charset('utf8mb4');
    return $conn;
}
