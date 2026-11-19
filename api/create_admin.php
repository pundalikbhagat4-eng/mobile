<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    fwrite(STDERR, "Missing api/config.php. Copy config.example.php and configure the database first.\n");
    exit(1);
}

$name = trim((string) getenv('HOTEL_ADMIN_NAME'));
$email = filter_var(getenv('HOTEL_ADMIN_EMAIL') ?: '', FILTER_VALIDATE_EMAIL);
$password = getenv('HOTEL_ADMIN_PASSWORD') ?: '';
if ($name === '' || strlen($name) > 120 || !$email || strlen($password) < 12) {
    fwrite(STDERR, "Set HOTEL_ADMIN_NAME, HOTEL_ADMIN_EMAIL, and HOTEL_ADMIN_PASSWORD (12+ characters) for this one-time command.\n");
    exit(1);
}

$config = require $configPath;
try {
    $pdo = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $roleQuery = $pdo->prepare("SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1");
    $roleQuery->execute();
    $roleId = $roleQuery->fetchColumn();
    if (!$roleId) {
        throw new RuntimeException('Run database/schema.sql before creating an administrator.');
    }
    $existing = $pdo->prepare('SELECT id FROM users WHERE role_id = ? LIMIT 1');
    $existing->execute([$roleId]);
    if ($existing->fetchColumn()) {
        throw new RuntimeException('A super administrator already exists; refusing to create another with this installer.');
    }
    $insert = $pdo->prepare(
        'INSERT INTO users (role_id, name, email, password_hash) VALUES (?, ?, ?, ?)'
    );
    $insert->execute([(int) $roleId, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    fwrite(STDOUT, 'Created the initial super administrator (user ID ' . $pdo->lastInsertId() . ").\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Administrator setup failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
