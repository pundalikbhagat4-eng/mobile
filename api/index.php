<?php
declare(strict_types=1);

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'API configuration is missing. Copy config.example.php to config.php and configure the database.']);
    exit;
}
$config = require $configPath;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['allowed_origin']);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$secureCookie = !empty($config['session_secure']);
session_set_cookie_params([
    'httponly' => true,
    'secure' => $secureCookie,
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        respond(['error' => 'Request body must be valid JSON.'], 400);
    }
    return $data;
}

function db(array $config): PDO
{
    return new PDO($config['dsn'], $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function actorId(): ?int
{
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function requireLogin(): int
{
    $id = actorId();
    if ($id === null) {
        respond(['error' => 'Sign in is required.'], 401);
    }
    return $id;
}

function requirePermission(PDO $pdo, string $permission): int
{
    $userId = requireLogin();
    $statement = $pdo->prepare(
        'SELECT 1 FROM users u
         JOIN role_permissions rp ON rp.role_id = u.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE u.id = ? AND u.is_active = 1 AND p.permission_key = ?'
    );
    $statement->execute([$userId, $permission]);
    if (!$statement->fetchColumn()) {
        respond(['error' => 'You do not have permission to perform this action.'], 403);
    }
    return $userId;
}

function requireCsrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        respond(['error' => 'The security token is missing or expired. Refresh and try again.'], 419);
    }
}

function audit(PDO $pdo, ?int $userId, string $action, string $entity, ?int $entityId, array $details = []): void
{
    $statement = $pdo->prepare(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $userId,
        $action,
        $entity,
        $entityId,
        $details ? json_encode($details, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) : null,
    ]);
}

function validDateRange(mixed $checkIn, mixed $checkOut): bool
{
    if (!is_string($checkIn) || !is_string($checkOut)) {
        return false;
    }
    $start = DateTimeImmutable::createFromFormat('!Y-m-d', $checkIn);
    $end = DateTimeImmutable::createFromFormat('!Y-m-d', $checkOut);
    return $start !== false && $end !== false
        && $start->format('Y-m-d') === $checkIn
        && $end->format('Y-m-d') === $checkOut
        && $end > $start;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
$path = preg_replace('#^api/?#', '', $path);
$path = $path === '' ? '/' : '/' . $path;

if ($path === '/health' && $method === 'GET') {
    respond(['status' => 'ok']);
}

try {
    $pdo = db($config);

    if ($path === '/auth/login' && $method === 'POST') {
        $data = input();
        $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = $data['password'] ?? '';
        if (!$email || !is_string($password) || $password === '') {
            respond(['error' => 'Enter a valid email address and password.'], 422);
        }
        $query = $pdo->prepare(
            'SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.name AS role
             FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1'
        );
        $query->execute([$email]);
        $user = $query->fetch();
        if (!$user || !(int) $user['is_active'] || !password_verify($password, $user['password_hash'])) {
            respond(['error' => 'Email or password is incorrect.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
        audit($pdo, (int) $user['id'], 'login', 'users', (int) $user['id']);
        $permissionsQuery = $pdo->prepare(
            'SELECT p.permission_key FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = (
               SELECT role_id FROM users WHERE id = ?
             ) ORDER BY p.permission_key'
        );
        $permissionsQuery->execute([$user['id']]);
        respond([
            'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
            'permissions' => array_column($permissionsQuery->fetchAll(), 'permission_key'),
            'csrfToken' => $_SESSION['csrf_token'],
        ]);
    }

    if ($path === '/auth/session' && $method === 'GET') {
        $userId = actorId();
        if ($userId === null) {
            respond(['user' => null]);
        }
        $query = $pdo->prepare(
            'SELECT u.id, u.name, u.email, r.name AS role, u.is_active
             FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?'
        );
        $query->execute([$userId]);
        $user = $query->fetch();
        if (!$user || !(int) $user['is_active']) {
            $_SESSION = [];
            session_destroy();
            respond(['user' => null], 401);
        }
        $permissionsQuery = $pdo->prepare(
            'SELECT p.permission_key FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id
             JOIN users u ON u.role_id = rp.role_id WHERE u.id = ? ORDER BY p.permission_key'
        );
        $permissionsQuery->execute([$userId]);
        respond([
            'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
            'permissions' => array_column($permissionsQuery->fetchAll(), 'permission_key'),
            'csrfToken' => $_SESSION['csrf_token'] ?? null,
        ]);
    }

    if ($path === '/auth/logout' && $method === 'POST') {
        requireLogin();
        requireCsrf();
        audit($pdo, actorId(), 'logout', 'users', actorId());
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    if ($path === '/contact' && $method === 'POST') {
        $data = input();
        $name = trim((string) ($data['name'] ?? ''));
        $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $message = trim((string) ($data['message'] ?? ''));
        if ($name === '' || strlen($name) > 120 || !$email || strlen($email) > 190 || strlen($message) > 5000) {
            respond(['error' => 'Enter a name and valid email, with a message under 5,000 characters.'], 422);
        }
        $insert = $pdo->prepare(
            'INSERT INTO contact_messages (name, email, message, created_by, updated_by) VALUES (?, ?, ?, ?, ?)'
        );
        $userId = actorId();
        $insert->execute([$name, $email, $message ?: null, $userId, $userId]);
        $id = (int) $pdo->lastInsertId();
        audit($pdo, $userId, 'create', 'contact_messages', $id);
        respond(['id' => $id], 201);
    }

    if ($path === '/room-types' && $method === 'GET') {
        requirePermission($pdo, 'rooms.create');
        $rows = $pdo->query(
            'SELECT id, name, description, priority, base_price, max_guests
             FROM room_types WHERE is_active = 1 ORDER BY priority, name'
        )->fetchAll();
        respond(['room_types' => $rows]);
    }

    if ($path === '/rooms' && $method === 'POST') {
        $userId = requirePermission($pdo, 'rooms.create');
        requireCsrf();
        $data = input();
        $roomNumber = trim((string) ($data['room_number'] ?? ''));
        $roomTypeId = filter_var($data['room_type_id'] ?? null, FILTER_VALIDATE_INT);
        $floor = trim((string) ($data['floor'] ?? ''));
        $bedConfiguration = trim((string) ($data['bed_configuration'] ?? ''));
        $status = $data['status'] ?? 'available';
        $booleanFields = ['has_wifi', 'has_ac', 'has_fridge', 'has_balcony'];
        if ($roomNumber === '' || strlen($roomNumber) > 20 || !$roomTypeId
            || strlen($floor) > 30 || strlen($bedConfiguration) > 80
            || !in_array($status, ['available','cleaning','maintenance'], true)) {
            respond(['error' => 'Enter a room number (up to 20 characters), choose a room type, and use valid floor, bed, and readiness details.'], 422);
        }
        foreach ($booleanFields as $field) {
            if (isset($data[$field]) && !in_array($data[$field], [0, 1, true, false], true)) {
                respond(['error' => "The {$field} setting must be on or off."], 422);
            }
        }
        $roomTypeQuery = $pdo->prepare('SELECT id FROM room_types WHERE id = ? AND is_active = 1');
        $roomTypeQuery->execute([$roomTypeId]);
        if (!$roomTypeQuery->fetchColumn()) {
            respond(['error' => 'That room type is no longer active. Refresh the form and choose another type.'], 422);
        }
        try {
            $pdo->beginTransaction();
            $insert = $pdo->prepare(
                'INSERT INTO rooms
                 (room_number, room_type_id, floor, status, bed_configuration,
                  has_wifi, has_ac, has_fridge, has_balcony, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $roomNumber, $roomTypeId, $floor ?: null, $status, $bedConfiguration ?: null,
                (int) (bool) ($data['has_wifi'] ?? true),
                (int) (bool) ($data['has_ac'] ?? true),
                (int) (bool) ($data['has_fridge'] ?? false),
                (int) (bool) ($data['has_balcony'] ?? false),
                $userId, $userId,
            ]);
            $id = (int) $pdo->lastInsertId();
            audit($pdo, $userId, 'create', 'rooms', $id, ['room_number' => $roomNumber]);
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception->getCode() === '23000') {
                respond(['error' => "Room {$roomNumber} already exists. Enter a different room number."], 409);
            }
            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        respond(['id' => $id, 'room_number' => $roomNumber, 'room_type_id' => $roomTypeId, 'status' => $status], 201);
    }

    if ($path === '/rooms' && $method === 'GET') {
        requirePermission($pdo, 'rooms.view');
        $rows = $pdo->query(
            "SELECT r.id, r.room_number, r.floor,
                    CASE
                      WHEN r.status IN ('cleaning','maintenance','inactive') THEN r.status
                      WHEN EXISTS (
                        SELECT 1 FROM reservations b WHERE b.room_id = r.id AND b.status = 'checked_in'
                          AND b.check_in <= CURRENT_DATE() AND b.check_out > CURRENT_DATE()
                      ) THEN 'occupied'
                      ELSE r.status
                    END AS status,
                    (SELECT g.name FROM reservations b JOIN guests g ON g.id = b.guest_id
                     WHERE b.room_id = r.id AND b.status = 'checked_in'
                       AND b.check_in <= CURRENT_DATE() AND b.check_out > CURRENT_DATE()
                     ORDER BY b.check_in LIMIT 1) AS current_guest,
                    (SELECT b.check_out FROM reservations b
                     WHERE b.room_id = r.id AND b.status = 'checked_in'
                       AND b.check_in <= CURRENT_DATE() AND b.check_out > CURRENT_DATE()
                     ORDER BY b.check_in LIMIT 1) AS current_check_out,
                    r.has_wifi, r.has_ac, r.has_fridge,
                    r.bed_configuration, r.has_balcony, rt.name AS room_type, rt.base_price, rt.priority
             FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
             WHERE r.is_active = 1 ORDER BY r.room_number"
        )->fetchAll();
        respond(['rooms' => $rows]);
    }

    if ($path === '/bookings' && $method === 'GET') {
        $userId = requirePermission($pdo, 'bookings.view');
        $isGuest = ($_SESSION['role'] ?? null) === 'guest';
        $query = $pdo->prepare(
            "SELECT b.id, b.booking_reference, b.status, b.source, b.source_name, b.check_in, b.check_out,
                    b.nightly_rate, b.discount_amount, b.total_amount, b.guest_remarks, b.staff_remarks,
                    g.name AS guest_name, g.email AS guest_email, g.phone AS guest_phone,
                    r.id AS room_id, r.room_number, rt.name AS room_type,
                    COALESCE(SUM(pay.amount), 0) AS amount_paid,
                    (SELECT n.note FROM guest_notes n WHERE n.reservation_id = b.id AND n.visibility = 'guest'
                     ORDER BY n.created_at DESC, n.id DESC LIMIT 1) AS latest_guest_note
             FROM reservations b JOIN guests g ON g.id = b.guest_id
             JOIN rooms r ON r.id = b.room_id JOIN room_types rt ON rt.id = r.room_type_id
             LEFT JOIN booking_payments pay ON pay.reservation_id = b.id
             WHERE (? = 0 OR g.user_id = ?)
             GROUP BY b.id ORDER BY b.check_in DESC, b.id DESC"
        );
        $query->execute([$isGuest ? 1 : 0, $userId]);
        $rows = $query->fetchAll();
        respond(['bookings' => $rows]);
    }

    if (preg_match('#^/bookings/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $userId = requirePermission($pdo, 'bookings.update');
        requireCsrf();
        $data = input();
        $fields = [];
        $values = [];
        foreach (['status', 'staff_remarks', 'guest_remarks', 'discount_amount'] as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = $field . ' = ?';
                $values[] = $data[$field];
            }
        }
        if (!$fields) {
            respond(['error' => 'No editable booking fields were supplied.'], 422);
        }
        if (isset($data['status']) && !in_array($data['status'], ['pending','confirmed','checked_in','checked_out','cancelled','no_show'], true)) {
            respond(['error' => 'The supplied booking status is not valid.'], 422);
        }
        $bookingQuery = $pdo->prepare('SELECT room_id FROM reservations WHERE id = ?');
        $bookingQuery->execute([(int) $match[1]]);
        $bookingRoomId = $bookingQuery->fetchColumn();
        if (!$bookingRoomId) {
            respond(['error' => 'Booking was not found.'], 404);
        }
        $values[] = $userId;
        $values[] = (int) $match[1];
        $update = $pdo->prepare('UPDATE reservations SET ' . implode(', ', $fields) . ', updated_by = ? WHERE id = ?');
        $update->execute($values);
        if ($update->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM reservations WHERE id = ?');
            $check->execute([(int) $match[1]]);
            if (!$check->fetchColumn()) {
                respond(['error' => 'Booking was not found.'], 404);
            }
        }
        if (($data['status'] ?? null) === 'checked_in') {
            $pdo->prepare("UPDATE rooms SET status = 'occupied', updated_by = ? WHERE id = ?")->execute([$userId, $bookingRoomId]);
            audit($pdo, $userId, 'update', 'rooms', (int) $bookingRoomId, ['status' => 'occupied']);
        } elseif (($data['status'] ?? null) === 'checked_out') {
            $pdo->prepare("UPDATE rooms SET status = 'cleaning', updated_by = ? WHERE id = ?")->execute([$userId, $bookingRoomId]);
            audit($pdo, $userId, 'update', 'rooms', (int) $bookingRoomId, ['status' => 'cleaning']);
        } elseif (in_array($data['status'] ?? null, ['cancelled','no_show'], true)) {
            $pdo->prepare("UPDATE rooms SET status = 'available', updated_by = ? WHERE id = ? AND status <> 'maintenance'")->execute([$userId, $bookingRoomId]);
            audit($pdo, $userId, 'update', 'rooms', (int) $bookingRoomId, ['status' => 'available']);
        }
        audit($pdo, $userId, 'update', 'reservations', (int) $match[1], array_keys($data));
        respond(['ok' => true]);
    }

    if (preg_match('#^/rooms/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $userId = requirePermission($pdo, 'rooms.update');
        requireCsrf();
        $data = input();
        $allowedStatuses = ['available','occupied','cleaning','maintenance','inactive'];
        if (!isset($data['status']) || !in_array($data['status'], $allowedStatuses, true)) {
            respond(['error' => 'A valid room status is required.'], 422);
        }
        $update = $pdo->prepare('UPDATE rooms SET status = ?, updated_by = ? WHERE id = ? AND is_active = 1');
        $update->execute([$data['status'], $userId, (int) $match[1]]);
        if ($update->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM rooms WHERE id = ? AND is_active = 1');
            $check->execute([(int) $match[1]]);
            if (!$check->fetchColumn()) {
                respond(['error' => 'Room was not found.'], 404);
            }
        }
        audit($pdo, $userId, 'update', 'rooms', (int) $match[1], ['status' => $data['status']]);
        respond(['ok' => true]);
    }

    if ($path === '/bookings' && $method === 'POST') {
        $userId = actorId();
        if ($userId !== null) {
            requirePermission($pdo, 'bookings.create');
            requireCsrf();
        }
        $data = input();
        $name = trim((string) ($data['name'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $roomId = filter_var($data['room_id'] ?? null, FILTER_VALIDATE_INT);
        $roomType = isset($data['room_type']) ? trim((string) $data['room_type']) : '';
        $checkIn = $data['check_in'] ?? null;
        $checkOut = $data['check_out'] ?? null;
        if ($name === '' || strlen($name) > 120 || $phone === '' || strlen($phone) > 30 || !$email
            || (!$roomId && ($roomType === '' || strlen($roomType) > 100)) || !validDateRange($checkIn, $checkOut)) {
            respond(['error' => 'Name, valid email and phone, room, and a valid stay are required.'], 422);
        }
        if ($checkIn < date('Y-m-d')) {
            respond(['error' => 'Check-in cannot be in the past.'], 422);
        }
        if (($_SESSION['role'] ?? null) === 'guest') {
            $guestAccount = $pdo->prepare('SELECT name, email, phone FROM users WHERE id = ? AND is_active = 1');
            $guestAccount->execute([$userId]);
            $account = $guestAccount->fetch();
            if (!$account || strcasecmp((string) $email, (string) $account['email']) !== 0) {
                respond(['error' => 'A guest account can only request stays for its own email address.'], 403);
            }
            $name = $account['name'];
            $phone = (string) $account['phone'];
        }
        $pdo->beginTransaction();
        try {
            if (!$roomId) {
                $roomQuery = $pdo->prepare(
                    "SELECT r.id, r.room_number, r.status, r.room_type_id, rt.base_price FROM rooms r
                     JOIN room_types rt ON rt.id = r.room_type_id
                     WHERE rt.name = ? AND r.is_active = 1
                     ORDER BY r.room_number FOR UPDATE"
                );
                $roomQuery->execute([$roomType]);
                $matchingRooms = $roomQuery->fetchAll();
                $room = null;
                $hasBookableRoom = false;
                foreach ($matchingRooms as $candidate) {
                    if (in_array($candidate['status'], ['available','occupied'], true)) {
                        $hasBookableRoom = true;
                        $candidateOverlap = $pdo->prepare(
                            "SELECT id FROM reservations WHERE room_id = ? AND status IN ('pending','confirmed','checked_in')
                             AND check_in < ? AND check_out > ? LIMIT 1"
                        );
                        $candidateOverlap->execute([$candidate['id'], $checkOut, $checkIn]);
                        if (!$candidateOverlap->fetchColumn()) {
                            $room = $candidate;
                            $roomId = (int) $candidate['id'];
                            break;
                        }
                    }
                }
                if (!$room) {
                    $pdo->rollBack();
                    if (!$matchingRooms) {
                        respond(['error' => "We don't have any active {$roomType} rooms right now. Please choose another room type or contact the hotel."], 409);
                    }
                    if (!$hasBookableRoom) {
                        respond(['error' => "No {$roomType} rooms are currently marked ready to book. Please choose another room type or ask reception to check room readiness."], 409);
                    }
                    respond(['error' => "No {$roomType} rooms are free for those dates. Please choose different dates or another room type."], 409);
                }
            } else {
                $roomQuery = $pdo->prepare(
                    "SELECT r.id, r.room_number, r.status, r.room_type_id, rt.base_price FROM rooms r
                     JOIN room_types rt ON rt.id = r.room_type_id
                     WHERE r.id = ? AND r.is_active = 1 FOR UPDATE"
                );
                $roomQuery->execute([$roomId]);
                $room = $roomQuery->fetch();
                if (!$room) {
                    $pdo->rollBack();
                    respond(['error' => 'This room is no longer active. Refresh the room list and try again.'], 404);
                }
                if (!in_array($room['status'], ['available','occupied'], true)) {
                    $pdo->rollBack();
                    $status = str_replace('_', ' ', (string) $room['status']);
                    respond(['error' => "Room {$room['room_number']} is marked {$status} and cannot be booked yet. Change its status to Available when it is ready, or choose another room."], 409);
                }
            }
            $overlap = $pdo->prepare(
                "SELECT id FROM reservations WHERE room_id = ? AND status IN ('pending','confirmed','checked_in')
                 AND check_in < ? AND check_out > ? LIMIT 1"
            );
            $overlap->execute([$roomId, $checkOut, $checkIn]);
            if ($overlap->fetchColumn()) {
                $pdo->rollBack();
                if (isset($room['room_number'])) {
                    respond(['error' => "Room {$room['room_number']} is already booked for some of those dates. Choose different dates or another room."], 409);
                }
                respond(['error' => 'That room is already booked for some of those dates. Please choose different dates or another room.'], 409);
            }
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        $nights = (int) (new DateTimeImmutable($checkIn))->diff(new DateTimeImmutable($checkOut))->days;
        $rate = (float) $room['base_price'];
        $discount = $userId !== null ? max(0, min((float) ($data['discount_amount'] ?? 0), $rate * $nights)) : 0;
        $total = max(0, $rate * $nights - $discount);
        $source = $userId !== null && in_array($data['source'] ?? '', ['direct','walk_in','ota','phone','other'], true)
            ? $data['source'] : 'direct';
        try {
            $guestQuery = $pdo->prepare(
                'SELECT id FROM guests WHERE email = ? AND phone = ? LIMIT 1'
            );
            $guestQuery->execute([$email, $phone]);
            $guestId = $guestQuery->fetchColumn();
            if (!$guestId) {
                $insertGuest = $pdo->prepare(
                    'INSERT INTO guests (name, email, phone, created_by, updated_by) VALUES (?, ?, ?, ?, ?)'
                );
                $insertGuest->execute([$name, $email, $phone, $userId, $userId]);
                $guestId = (int) $pdo->lastInsertId();
            } else {
                $guestId = (int) $guestId;
                $pdo->prepare('UPDATE guests SET name = ?, updated_by = ? WHERE id = ?')->execute([$name, $userId, $guestId]);
            }
            if (($_SESSION['role'] ?? null) === 'guest') {
                $pdo->prepare('UPDATE guests SET user_id = ? WHERE id = ? AND user_id IS NULL')->execute([$userId, $guestId]);
            }
            $reference = 'SR-' . strtoupper(bin2hex(random_bytes(4)));
            $status = $userId !== null && ($_SESSION['role'] ?? null) !== 'guest' ? 'confirmed' : 'pending';
            $insert = $pdo->prepare(
                'INSERT INTO reservations
                 (booking_reference, guest_id, room_id, source, source_name, status, check_in, check_out,
                  adults, children, nightly_rate, discount_amount, total_amount, guest_remarks, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $reference, $guestId, $roomId, $source,
                $source === 'ota' ? substr(trim((string) ($data['source_name'] ?? 'OTA')), 0, 100) : null,
                $status, $checkIn, $checkOut, min(20, max(1, (int) ($data['adults'] ?? 1))),
                min(20, max(0, (int) ($data['children'] ?? 0))), $rate, $discount, $total,
                isset($data['guest_remarks']) ? substr(trim((string) $data['guest_remarks']), 0, 5000) : null,
                $userId, $userId,
            ]);
            $reservationId = (int) $pdo->lastInsertId();
            audit($pdo, $userId, 'create', 'reservations', $reservationId, ['source' => $source, 'reference' => $reference]);
            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
        respond(['id' => $reservationId, 'reference' => $reference, 'status' => $status, 'total_amount' => $total], 201);
    }

    if (preg_match('#^/bookings/(\d+)/payments$#', $path, $match) && $method === 'POST') {
        $userId = requirePermission($pdo, 'bookings.update');
        requireCsrf();
        $data = input();
        $amount = filter_var($data['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        $methodName = $data['method'] ?? '';
        if ($amount === false || $amount <= 0 || !in_array($methodName, ['cash','online','card','bank_transfer','ota','other'], true)) {
            respond(['error' => 'A positive payment amount and valid payment method are required.'], 422);
        }
        $reservationQuery = $pdo->prepare('SELECT total_amount FROM reservations WHERE id = ?');
        $reservationQuery->execute([(int) $match[1]]);
        $totalAmount = $reservationQuery->fetchColumn();
        if ($totalAmount === false) {
            respond(['error' => 'Booking was not found.'], 404);
        }
        $paidQuery = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM booking_payments WHERE reservation_id = ?');
        $paidQuery->execute([(int) $match[1]]);
        $alreadyPaid = (float) $paidQuery->fetchColumn();
        if ((float) $amount + $alreadyPaid > (float) $totalAmount) {
            respond(['error' => 'Payment cannot exceed the remaining booking balance.'], 422);
        }
        $insert = $pdo->prepare(
            'INSERT INTO booking_payments (reservation_id, method, amount, reference, remarks, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            (int) $match[1], $methodName, $amount,
            isset($data['reference']) ? substr(trim((string) $data['reference']), 0, 120) : null,
            isset($data['remarks']) ? substr(trim((string) $data['remarks']), 0, 255) : null,
            $userId, $userId,
        ]);
        $paymentId = (int) $pdo->lastInsertId();
        audit($pdo, $userId, 'create', 'booking_payments', $paymentId, ['reservation_id' => (int) $match[1], 'method' => $methodName, 'amount' => (float) $amount]);
        respond(['id' => $paymentId], 201);
    }

    if (preg_match('#^/bookings/(\d+)/notes$#', $path, $match) && $method === 'GET') {
        $userId = requirePermission($pdo, 'guests.message');
        $bookingQuery = $pdo->prepare(
            'SELECT b.guest_id FROM reservations b WHERE b.id = ?'
        );
        $bookingQuery->execute([(int) $match[1]]);
        $guestId = $bookingQuery->fetchColumn();
        if (!$guestId) {
            respond(['error' => 'Booking was not found.'], 404);
        }
        $isGuest = ($_SESSION['role'] ?? null) === 'guest';
        if ($isGuest) {
            $scope = $pdo->prepare('SELECT id FROM guests WHERE id = ? AND user_id = ?');
            $scope->execute([(int) $guestId, $userId]);
            if (!$scope->fetchColumn()) {
                respond(['error' => 'Booking was not found.'], 404);
            }
        }
        $notesQuery = $pdo->prepare(
            'SELECT n.id, n.note, n.visibility, n.created_at, u.name AS author
             FROM guest_notes n LEFT JOIN users u ON u.id = n.created_by
             WHERE n.reservation_id = ? AND (? = 0 OR n.visibility = ?)
             ORDER BY n.created_at, n.id'
        );
        $notesQuery->execute([(int) $match[1], $isGuest ? 1 : 0, 'guest']);
        respond(['notes' => $notesQuery->fetchAll()]);
    }

    if (preg_match('#^/bookings/(\d+)/notes$#', $path, $match) && $method === 'POST') {
        $userId = requirePermission($pdo, 'guests.message');
        requireCsrf();
        $data = input();
        $note = trim((string) ($data['note'] ?? ''));
        if ($note === '' || strlen($note) > 2000) {
            respond(['error' => 'A note of 1 to 2,000 characters is required.'], 422);
        }
        $bookingQuery = $pdo->prepare('SELECT guest_id FROM reservations WHERE id = ?');
        $bookingQuery->execute([(int) $match[1]]);
        $guestId = $bookingQuery->fetchColumn();
        if (!$guestId) {
            respond(['error' => 'Booking was not found.'], 404);
        }
        $isGuest = ($_SESSION['role'] ?? null) === 'guest';
        if ($isGuest) {
            $scope = $pdo->prepare('SELECT id FROM guests WHERE id = ? AND user_id = ?');
            $scope->execute([(int) $guestId, $userId]);
            if (!$scope->fetchColumn()) {
                respond(['error' => 'Booking was not found.'], 404);
            }
        }
        $visibility = $isGuest ? 'guest' : ($data['visibility'] ?? 'staff');
        if (!in_array($visibility, ['guest','staff'], true)) {
            respond(['error' => 'The note visibility is not valid.'], 422);
        }
        $insert = $pdo->prepare(
            'INSERT INTO guest_notes (guest_id, reservation_id, note, visibility, created_by)
             VALUES (?, ?, ?, ?, ?)'
        );
        $insert->execute([(int) $guestId, (int) $match[1], $note, $visibility, $userId]);
        $noteId = (int) $pdo->lastInsertId();
        audit($pdo, $userId, 'create', 'guest_notes', $noteId, ['reservation_id' => (int) $match[1]]);
        respond(['id' => $noteId], 201);
    }

    if ($path === '/expenses' && $method === 'GET') {
        requirePermission($pdo, 'expenses.manage');
        $rows = $pdo->query(
            'SELECT e.id, e.expense_date, e.amount, e.payment_method, e.vendor, e.description,
                    c.name AS category, e.created_by, e.created_at, e.updated_by, e.updated_at
             FROM expenses e JOIN expense_categories c ON c.id = e.category_id
             ORDER BY e.expense_date DESC, e.id DESC'
        )->fetchAll();
        $categories = $pdo->query('SELECT id, name FROM expense_categories WHERE is_active = 1 ORDER BY name')->fetchAll();
        respond(['expenses' => $rows, 'categories' => $categories]);
    }

    if ($path === '/expenses' && $method === 'POST') {
        $userId = requirePermission($pdo, 'expenses.manage');
        requireCsrf();
        $data = input();
        $categoryId = filter_var($data['category_id'] ?? null, FILTER_VALIDATE_INT);
        $amount = filter_var($data['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        $expenseDate = $data['expense_date'] ?? null;
        $paymentMethod = $data['payment_method'] ?? 'cash';
        $description = trim((string) ($data['description'] ?? ''));
        if (!$categoryId || $amount === false || $amount <= 0 || !is_string($expenseDate)
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate) || $description === '' || strlen($description) > 500
            || !in_array($paymentMethod, ['cash','online','card','bank_transfer','other'], true)) {
            respond(['error' => 'A category, positive amount, valid date, payment method, and description are required.'], 422);
        }
        $categoryCheck = $pdo->prepare('SELECT id FROM expense_categories WHERE id = ? AND is_active = 1');
        $categoryCheck->execute([$categoryId]);
        if (!$categoryCheck->fetchColumn()) {
            respond(['error' => 'The selected expense category does not exist.'], 422);
        }
        $insert = $pdo->prepare(
            'INSERT INTO expenses (category_id, amount, expense_date, payment_method, vendor, description, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            $categoryId, $amount, $expenseDate, $paymentMethod,
            isset($data['vendor']) ? substr(trim((string) $data['vendor']), 0, 150) : null,
            $description, $userId, $userId,
        ]);
        $id = (int) $pdo->lastInsertId();
        audit($pdo, $userId, 'create', 'expenses', $id, ['amount' => (float) $amount]);
        respond(['id' => $id], 201);
    }

    if ($path === '/reports/revenue.csv' && $method === 'GET') {
        $userId = requirePermission($pdo, 'revenue.view');
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');
        $channel = $_GET['channel'] ?? 'all';
        if (!in_array($channel, ['all','cash','online','pending','ota','walk_in'], true)) {
            respond(['error' => 'Choose a valid revenue channel.'], 422);
        }
        if (!is_string($from) || !is_string($to) || !validDateRange($from, date('Y-m-d', strtotime($to . ' +1 day')))) {
            respond(['error' => 'Choose a valid report date range.'], 422);
        }
        $statement = $pdo->prepare(
            "SELECT b.check_in, b.booking_reference, g.name AS guest_name, b.source, b.source_name,
                    b.total_amount, COALESCE(SUM(pay.amount), 0) AS paid_amount,
                    COALESCE(SUM(CASE WHEN pay.method = 'cash' THEN pay.amount ELSE 0 END), 0) AS cash_paid,
                    COALESCE(SUM(CASE WHEN pay.method IN ('online','card','bank_transfer') THEN pay.amount ELSE 0 END), 0) AS online_paid,
                    GREATEST(b.total_amount - COALESCE(SUM(pay.amount), 0), 0) AS pending_amount
             FROM reservations b JOIN guests g ON g.id = b.guest_id
             LEFT JOIN booking_payments pay ON pay.reservation_id = b.id
             WHERE b.check_in BETWEEN ? AND ? AND b.status NOT IN ('cancelled','no_show')
             GROUP BY b.id
             HAVING (? = 'all'
                OR (? = 'cash' AND cash_paid > 0)
                OR (? = 'online' AND online_paid > 0)
                OR (? = 'pending' AND pending_amount > 0)
                OR (? = 'ota' AND b.source = 'ota')
                OR (? = 'walk_in' AND b.source = 'walk_in'))
             ORDER BY b.check_in, b.id"
        );
        $statement->execute([$from, $to, $channel, $channel, $channel, $channel, $channel, $channel]);
        audit($pdo, $userId, 'export', 'revenue_report', null, ['from' => $from, 'to' => $to, 'channel' => $channel]);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="serein-revenue-' . $from . '-to-' . $to . '-' . $channel . '.csv"');
        $output = fopen('php://output', 'wb');
        if ($output === false) {
            respond(['error' => 'The report could not be generated.'], 500);
        }
        fwrite($output, "\xEF\xBB\xBF");
        fputcsv($output, ['Stay date','Booking reference','Guest','Source','Platform','Total','Paid','Cash paid','Online paid','Pending']);
        foreach ($statement->fetchAll() as $row) {
            fputcsv($output, [
                $row['check_in'], $row['booking_reference'], $row['guest_name'], $row['source'],
                $row['source_name'], $row['total_amount'], $row['paid_amount'], $row['cash_paid'],
                $row['online_paid'], $row['pending_amount'],
            ]);
        }
        fclose($output);
        exit;
    }

    if ($path === '/users' && $method === 'GET') {
        requirePermission($pdo, 'users.view');
        $rows = $pdo->query(
            'SELECT u.id, u.name, u.email, u.phone, u.is_active, r.name AS role,
                    u.created_at, u.updated_at
             FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.name'
        )->fetchAll();
        respond(['users' => $rows]);
    }

    if ($path === '/roles' && $method === 'GET') {
        requirePermission($pdo, 'users.view');
        $rows = $pdo->query(
            'SELECT r.id, r.name, r.description, r.is_system,
                    COALESCE(GROUP_CONCAT(p.permission_key ORDER BY p.permission_key SEPARATOR ","), "") AS permission_keys
             FROM roles r
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             GROUP BY r.id ORDER BY r.name'
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['permission_keys'] = $row['permission_keys'] === '' ? [] : explode(',', $row['permission_keys']);
        }
        unset($row);
        $permissions = $pdo->query('SELECT id, permission_key, label, module FROM permissions ORDER BY module, label')->fetchAll();
        respond(['roles' => $rows, 'permissions' => $permissions]);
    }

    if ($path === '/roles' && $method === 'POST') {
        $userId = requirePermission($pdo, 'settings.manage');
        requireCsrf();
        $data = input();
        $name = trim((string) ($data['name'] ?? ''));
        $permissionIds = $data['permission_ids'] ?? [];
        if (!preg_match('/^[a-z][a-z0-9_]{2,59}$/', $name) || !is_array($permissionIds)) {
            respond(['error' => 'Choose a role identifier using lowercase letters, numbers, and underscores.'], 422);
        }
        $permissionIds = array_values(array_unique(array_filter(
            array_map('intval', $permissionIds),
            static fn (int $id): bool => $id > 0
        )));
        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare('INSERT INTO roles (name, description, created_by) VALUES (?, ?, ?)');
            $insert->execute([$name, substr(trim((string) ($data['description'] ?? '')), 0, 255) ?: null, $userId]);
            $roleId = (int) $pdo->lastInsertId();
            if ($permissionIds) {
                $placeholder = implode(',', array_fill(0, count($permissionIds), '?'));
                $check = $pdo->prepare('SELECT COUNT(*) FROM permissions WHERE id IN (' . $placeholder . ')');
                $check->execute($permissionIds);
                if ((int) $check->fetchColumn() !== count($permissionIds)) {
                    $pdo->rollBack();
                    respond(['error' => 'One or more selected permissions do not exist.'], 422);
                }
                $assign = $pdo->prepare('INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by) VALUES (?, ?, ?, ?)');
                foreach ($permissionIds as $permissionId) {
                    $assign->execute([$roleId, $permissionId, $userId, $userId]);
                }
            }
            audit($pdo, $userId, 'create', 'roles', $roleId, ['permissions' => $permissionIds]);
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception->getCode() === '23000') {
                respond(['error' => 'A role with that name already exists.'], 409);
            }
            throw $exception;
        }
        respond(['id' => $roleId], 201);
    }

    if (preg_match('#^/roles/(\d+)/permissions$#', $path, $match) && $method === 'PATCH') {
        $userId = requirePermission($pdo, 'settings.manage');
        requireCsrf();
        $data = input();
        $roleId = (int) $match[1];
        $permissionIds = $data['permission_ids'] ?? null;
        if (!is_array($permissionIds)) {
            respond(['error' => 'permission_ids must be an array.'], 422);
        }
        $roleQuery = $pdo->prepare('SELECT name FROM roles WHERE id = ?');
        $roleQuery->execute([$roleId]);
        $roleName = $roleQuery->fetchColumn();
        if (!$roleName) {
            respond(['error' => 'Role was not found.'], 404);
        }
        if ($roleName === 'super_admin') {
            respond(['error' => 'The built-in super administrator role cannot be edited.'], 422);
        }
        $permissionIds = array_values(array_unique(array_filter(
            array_map('intval', $permissionIds),
            static fn (int $id): bool => $id > 0
        )));
        $placeholder = $permissionIds ? implode(',', array_fill(0, count($permissionIds), '?')) : '';
        if ($permissionIds) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM permissions WHERE id IN (' . $placeholder . ')');
            $check->execute($permissionIds);
            if ((int) $check->fetchColumn() !== count($permissionIds)) {
                respond(['error' => 'One or more selected permissions do not exist.'], 422);
            }
        }
        $actorRoleQuery = $pdo->prepare('SELECT role_id FROM users WHERE id = ?');
        $actorRoleQuery->execute([$userId]);
        $actorRoleId = (int) $actorRoleQuery->fetchColumn();
        if ($actorRoleId === $roleId) {
            $manageQuery = $pdo->prepare("SELECT id FROM permissions WHERE permission_key = 'settings.manage'");
            $manageQuery->execute();
            if (!in_array((int) $manageQuery->fetchColumn(), $permissionIds, true)) {
                respond(['error' => 'You cannot remove your own role’s settings permission.'], 422);
            }
        }
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM role_permissions WHERE role_id = ?')->execute([$roleId]);
            if ($permissionIds) {
                $assign = $pdo->prepare('INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by) VALUES (?, ?, ?, ?)');
                foreach ($permissionIds as $permissionId) {
                    $assign->execute([$roleId, $permissionId, $userId, $userId]);
                }
            }
            $pdo->prepare('UPDATE roles SET updated_by = ? WHERE id = ?')->execute([$userId, $roleId]);
            audit($pdo, $userId, 'update', 'roles', $roleId, ['permissions' => $permissionIds]);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        respond(['ok' => true]);
    }

    if ($path === '/users' && $method === 'POST') {
        $userId = requirePermission($pdo, 'users.create');
        requireCsrf();
        $data = input();
        $name = trim((string) ($data['name'] ?? ''));
        $email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = $data['password'] ?? '';
        $roleId = filter_var($data['role_id'] ?? null, FILTER_VALIDATE_INT);
        if ($name === '' || strlen($name) > 120 || !$email || !is_string($password) || strlen($password) < 12 || !$roleId) {
            respond(['error' => 'Name, email, role, and a password of at least 12 characters are required.'], 422);
        }
        $roleCheck = $pdo->prepare('SELECT id, name FROM roles WHERE id = ?');
        $roleCheck->execute([$roleId]);
        $role = $roleCheck->fetch();
        if (!$role) {
            respond(['error' => 'The selected role does not exist.'], 422);
        }
        $phone = trim((string) ($data['phone'] ?? ''));
        if ($role['name'] === 'guest' && ($phone === '' || strlen($phone) > 30)) {
            respond(['error' => 'A phone number is required to link a guest account to a guest record.'], 422);
        }
        $insert = $pdo->prepare(
            'INSERT INTO users (role_id, name, email, phone, password_hash, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $pdo->beginTransaction();
        try {
            $insert->execute([$roleId, $name, $email, $phone ?: null, password_hash($password, PASSWORD_DEFAULT), $userId, $userId]);
            $newUserId = (int) $pdo->lastInsertId();
            if ($role['name'] === 'guest') {
                $guestQuery = $pdo->prepare('SELECT id, user_id FROM guests WHERE email = ? LIMIT 1');
                $guestQuery->execute([$email]);
                $guest = $guestQuery->fetch();
                if ($guest && $guest['user_id'] !== null) {
                    $pdo->rollBack();
                    respond(['error' => 'That guest already has a linked login.'], 409);
                }
                if ($guest) {
                    $pdo->prepare('UPDATE guests SET user_id = ?, name = ?, phone = ?, updated_by = ? WHERE id = ?')
                        ->execute([$newUserId, $name, $phone, $userId, $guest['id']]);
                } else {
                    $pdo->prepare('INSERT INTO guests (user_id, name, email, phone, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
                        ->execute([$newUserId, $name, $email, $phone, $userId, $userId]);
                }
            }
            audit($pdo, $userId, 'create', 'users', $newUserId);
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception->getCode() === '23000') {
                respond(['error' => 'A user with that email address already exists.'], 409);
            }
            throw $exception;
        }
        respond(['id' => $newUserId], 201);
    }

    if (preg_match('#^/users/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $userId = requirePermission($pdo, 'users.update');
        requireCsrf();
        $targetId = (int) $match[1];
        $data = input();
        $fields = [];
        $values = [];
        if (array_key_exists('is_active', $data)) {
            if (!in_array($data['is_active'], [0, 1, true, false], true)) {
                respond(['error' => 'is_active must be a boolean value.'], 422);
            }
            if ($targetId === $userId && !$data['is_active']) {
                respond(['error' => 'You cannot deactivate your own account.'], 422);
            }
            $fields[] = 'is_active = ?';
            $values[] = (int) (bool) $data['is_active'];
        }
        if (isset($data['role_id'])) {
            $roleCheck = $pdo->prepare('SELECT id FROM roles WHERE id = ?');
            $roleCheck->execute([(int) $data['role_id']]);
            if (!$roleCheck->fetchColumn()) {
                respond(['error' => 'The selected role does not exist.'], 422);
            }
            $fields[] = 'role_id = ?';
            $values[] = (int) $data['role_id'];
        }
        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ($name === '' || strlen($name) > 120) {
                respond(['error' => 'Name must contain 1 to 120 characters.'], 422);
            }
            $fields[] = 'name = ?';
            $values[] = $name;
        }
        if (!$fields) {
            respond(['error' => 'No editable user fields were supplied.'], 422);
        }
        $values[] = $userId;
        $values[] = $targetId;
        $update = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ', updated_by = ? WHERE id = ?');
        $update->execute($values);
        if ($update->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM users WHERE id = ?');
            $check->execute([$targetId]);
            if (!$check->fetchColumn()) {
                respond(['error' => 'User was not found.'], 404);
            }
        }
        audit($pdo, $userId, 'update', 'users', $targetId, array_keys($data));
        respond(['ok' => true]);
    }

    respond(['error' => 'Endpoint not found.'], 404);
} catch (Throwable $exception) {
    error_log('[Serein API] ' . $exception->getMessage());
    respond(['error' => 'The request could not be completed. Check the server logs and try again.'], 500);
}
