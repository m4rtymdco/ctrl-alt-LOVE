<?php
/**
 * XAMPP MySQL defaults. For Vercel, Node reads the same names from env vars.
 * If you host MySQL in the cloud, update these locally too so both apps share data.
 */
return [
    'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('DB_PORT') ?: '3306',
    'db_name' => getenv('DB_NAME') ?: 'ctrl_alt_love',
    'db_user' => getenv('DB_USER') ?: 'root',
    'db_pass' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
    'admin_password' => getenv('ADMIN_PASSWORD') ?: 'ctrlaltlove',
];
