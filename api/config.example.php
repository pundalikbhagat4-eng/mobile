<?php
declare(strict_types=1);

return [
    'dsn' => getenv('HOTEL_DB_DSN') ?: '',
    'db_user' => getenv('HOTEL_DB_USER') ?: '',
    'db_password' => getenv('HOTEL_DB_PASSWORD') ?: '',
    'allowed_origin' => getenv('HOTEL_ALLOWED_ORIGIN') ?: 'http://localhost:5173',
    'session_secure' => getenv('HOTEL_SESSION_SECURE') === '1',
];
