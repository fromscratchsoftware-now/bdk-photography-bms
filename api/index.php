<?php

declare(strict_types=1);

// Minimal PHP API for SiteGround deployment (Node is not available).
// Matches the currently-used web UI endpoints under /api/*.

function load_dotenv(string $path): void {
  if (!file_exists($path)) {
    return;
  }
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if (!is_array($lines)) {
    return;
  }

  foreach ($lines as $line) {
    $trimmed = trim($line);
    if ($trimmed === "" || str_starts_with($trimmed, "#")) {
      continue;
    }
    $pos = strpos($trimmed, "=");
    if ($pos === false) {
      continue;
    }
    $key = trim(substr($trimmed, 0, $pos));
    $value = trim(substr($trimmed, $pos + 1));
    if ($key === "" || $value === "") {
      continue;
    }
    // Strip surrounding quotes if present.
    if ((str_starts_with($value, "\"") && str_ends_with($value, "\"")) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
      $value = substr($value, 1, -1);
    }
    // Do not override server-provided environment variables.
    if (getenv($key) !== false) {
      continue;
    }
    putenv($key . "=" . $value);
    $_ENV[$key] = $value;
  }
}

// Load optional runtime config from the repo root. This file is gitignored and blocked from web access via .htaccess.
load_dotenv(__DIR__ . "/../.env");

function json_response(int $status, $payload): void {
  http_response_code($status);
  header("Content-Type: application/json; charset=utf-8");
  // Shared hosting often enables aggressive proxy caching. Never cache API responses.
  header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
  header("Pragma: no-cache");
  header("Expires: 0");
  header("X-Content-Type-Options: nosniff");
  echo json_encode($payload, JSON_UNESCAPED_SLASHES);
  exit;
}

function normalize_mobile_number(string $mobile): string {
  $trimmed = trim($mobile);
  // Keep digits only; simplifies matching and avoids format drift.
  $digits = preg_replace('/\\D+/', '', $trimmed);
  return is_string($digits) ? $digits : "";
}

function read_json_body(): array {
  $raw = file_get_contents("php://input");
  if ($raw === false || $raw === "") {
    return [];
  }
  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid JSON body"]);
  }
  return $decoded;
}

function get_header_value(string $name): ?string {
  $key = "HTTP_" . strtoupper(str_replace("-", "_", $name));
  if (isset($_SERVER[$key]) && is_string($_SERVER[$key]) && $_SERVER[$key] !== "") {
    return $_SERVER[$key];
  }
  return null;
}

function get_authorization_header(): ?string {
  $direct = get_header_value("Authorization");
  if ($direct) {
    return $direct;
  }
  // Some hosting setups forward Authorization via this alternate key.
  if (isset($_SERVER["REDIRECT_HTTP_AUTHORIZATION"]) && is_string($_SERVER["REDIRECT_HTTP_AUTHORIZATION"]) && $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] !== "") {
    return $_SERVER["REDIRECT_HTTP_AUTHORIZATION"];
  }
  return null;
}

function base64url_encode(string $data): string {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
}

function base64url_decode(string $data): string {
  $decoded = strtr($data, "-_", "+/");
  $pad = strlen($decoded) % 4;
  if ($pad > 0) {
    $decoded .= str_repeat("=", 4 - $pad);
  }
  $raw = base64_decode($decoded, true);
  return $raw === false ? "" : $raw;
}

function jwt_secret(): string {
  $secret = (string)(getenv("BDK_JWT_SECRET") ?: (getenv("JWT_SECRET") ?: ""));
  if (strlen($secret) < 32) {
    json_response(500, ["error" => "ConfigError", "message" => "Set BDK_JWT_SECRET (>=32 chars) in .env"]);
  }
  return $secret;
}

function jwt_ttl_seconds(): int {
  $raw = (string)(getenv("BDK_JWT_TTL_SECONDS") ?: "");
  $ttl = $raw !== "" ? (int)$raw : 43200; // 12h
  return $ttl > 0 ? $ttl : 43200;
}

function jwt_sign(string $userId): string {
  $header = ["alg" => "HS256", "typ" => "JWT"];
  $now = time();
  $payload = ["sub" => $userId, "iat" => $now, "exp" => $now + jwt_ttl_seconds()];

  $encodedHeader = base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
  $encodedPayload = base64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
  $unsigned = $encodedHeader . "." . $encodedPayload;
  $signature = hash_hmac("sha256", $unsigned, jwt_secret(), true);
  return $unsigned . "." . base64url_encode($signature);
}

function jwt_verify(string $token): array {
  $parts = explode(".", $token);
  if (count($parts) !== 3) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }
  [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
  $unsigned = $encodedHeader . "." . $encodedPayload;
  $expectedSignature = hash_hmac("sha256", $unsigned, jwt_secret(), true);
  $signature = base64url_decode($encodedSignature);
  if ($signature === "" || !hash_equals($expectedSignature, $signature)) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $payloadRaw = base64url_decode($encodedPayload);
  $payload = json_decode($payloadRaw, true);
  if (!is_array($payload) || !isset($payload["sub"]) || !is_string($payload["sub"])) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $exp = isset($payload["exp"]) ? (int)$payload["exp"] : 0;
  if ($exp > 0 && time() > $exp) {
    json_response(401, ["error" => "HttpError", "message" => "Token expired"]);
  }

  return $payload;
}

function should_use_mysql(): bool {
  $backend = strtolower((string)(getenv("BDK_STORAGE") ?: ""));
  if ($backend === "mysql") {
    return true;
  }
  if ($backend === "file") {
    return false;
  }

  // Auto-detect when DB config exists.
  $host = getenv("BDK_DB_HOST") ?: "";
  $name = getenv("BDK_DB_NAME") ?: "";
  $user = getenv("BDK_DB_USER") ?: "";
  return $host !== "" && $name !== "" && $user !== "";
}

function mysql_pdo(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $host = (string)(getenv("BDK_DB_HOST") ?: "");
  $port = (string)(getenv("BDK_DB_PORT") ?: "3306");
  $name = (string)(getenv("BDK_DB_NAME") ?: "");
  $user = (string)(getenv("BDK_DB_USER") ?: "");
  $pass = (string)(getenv("BDK_DB_PASS") ?: "");

  if ($host === "" || $name === "" || $user === "") {
    json_response(500, [
      "error" => "ConfigError",
      "message" => "MySQL is enabled but BDK_DB_HOST/BDK_DB_NAME/BDK_DB_USER are not fully configured"
    ]);
  }

  $dsn = "mysql:host=" . $host . ";port=" . $port . ";dbname=" . $name . ";charset=utf8mb4";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  // Keep DB timestamps consistent across environments.
  $pdo->exec("SET time_zone = '+00:00'");

  return $pdo;
}

function mysql_ensure_state_table(PDO $pdo): void {
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS bdk_state_store (" .
      "id TINYINT UNSIGNED NOT NULL PRIMARY KEY," .
      "state_json JSON NOT NULL," .
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" .
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function phase1_db_fetch_one(PDO $pdo, string $sql, array $params): ?array {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $row = $stmt->fetch();
  return is_array($row) ? $row : null;
}

function phase1_db_fetch_all(PDO $pdo, string $sql, array $params): array {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();
  return is_array($rows) ? $rows : [];
}

function phase1_db_execute(PDO $pdo, string $sql, array $params): int {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  return (int)$stmt->rowCount();
}

function phase1_audit_log(PDO $pdo, ?string $actorUserId, string $action, string $entityType, ?string $entityId, $before, $after, ?string $notes = null): void {
  $beforeJson = $before === null ? null : json_encode($before, JSON_UNESCAPED_SLASHES);
  $afterJson = $after === null ? null : json_encode($after, JSON_UNESCAPED_SLASHES);

  $stmt = $pdo->prepare(
    "INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_json, after_json, notes) " .
    "VALUES (:id, :actor_user_id, :action, :entity_type, :entity_id, :before_json, :after_json, :notes)"
  );
  $stmt->execute([
    ":id" => create_id("audit"),
    ":actor_user_id" => $actorUserId,
    ":action" => $action,
    ":entity_type" => $entityType,
    ":entity_id" => $entityId,
    ":before_json" => $beforeJson,
    ":after_json" => $afterJson,
    ":notes" => $notes,
  ]);
}

function phase1_load_assignments(PDO $pdo, string $userId): array {
  return phase1_db_fetch_all(
    $pdo,
    "SELECT a.id, a.shop_id, a.is_primary, a.assigned_at, a.unassigned_at, a.notes, a.created_at, a.updated_at, " .
      "s.name AS shop_name, s.code AS shop_code " .
    "FROM user_shop_assignment a " .
    "JOIN shops s ON s.id = a.shop_id " .
    "WHERE a.user_id = :user_id AND a.unassigned_at IS NULL " .
    "ORDER BY a.is_primary DESC, a.assigned_at DESC",
    [":user_id" => $userId]
  );
}

function phase1_find_user_by_phone(PDO $pdo, string $phone): ?array {
  return phase1_db_fetch_one(
    $pdo,
    "SELECT u.id, u.full_name, u.phone, u.password_hash, u.role_id, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
    "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.phone = :phone LIMIT 1",
    [":phone" => $phone]
  );
}

function phase1_find_user_by_id(PDO $pdo, string $userId): ?array {
  return phase1_db_fetch_one(
    $pdo,
    "SELECT u.id, u.full_name, u.phone, u.password_hash, u.role_id, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
    "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1",
    [":id" => $userId]
  );
}

function phase1_public_user(array $user, array $assignments): array {
  return [
    "id" => (string)$user["id"],
    "fullName" => (string)$user["full_name"],
    "mobileNumber" => (string)$user["phone"],
    "role" => (string)$user["role_name"],
    "notes" => $user["notes"] ?? null,
    "createdAt" => (string)$user["created_at"],
    "updatedAt" => (string)$user["updated_at"],
    "shops" => array_map(function ($row) {
      return [
        "shopId" => (string)($row["shop_id"] ?? ""),
        "code" => (string)($row["shop_code"] ?? ""),
        "name" => (string)($row["shop_name"] ?? ""),
        "isPrimary" => (bool)($row["is_primary"] ?? false),
      ];
    }, $assignments),
  ];
}

function phase1_require_auth(PDO $pdo): array {
  $authHeader = get_authorization_header();
  if (!$authHeader) {
    json_response(401, ["error" => "HttpError", "message" => "Missing Authorization header"]);
  }

  $token = "";
  if (stripos($authHeader, "Bearer ") === 0) {
    $token = trim(substr($authHeader, 7));
  }
  if ($token === "") {
    json_response(401, ["error" => "HttpError", "message" => "Invalid Authorization header"]);
  }

  $payload = jwt_verify($token);
  $userId = (string)($payload["sub"] ?? "");
  if ($userId === "") {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $user = phase1_find_user_by_id($pdo, $userId);
  if (!$user || (int)($user["is_active"] ?? 0) !== 1) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid user"]);
  }

  $assignments = phase1_load_assignments($pdo, (string)$user["id"]);
  return ["user" => $user, "assignments" => $assignments];
}

function phase1_require_role(string $roleName, array $allowed): void {
  if (!in_array($roleName, $allowed, true)) {
    json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
  }
}

function phase1_assigned_shop_ids(array $assignments): array {
  $shopIds = [];
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      $shopIds[] = $shopId;
    }
  }
  // Preserve order but dedupe.
  $seen = [];
  $unique = [];
  foreach ($shopIds as $id) {
    if (isset($seen[$id])) {
      continue;
    }
    $seen[$id] = true;
    $unique[] = $id;
  }
  return $unique;
}

function phase1_primary_shop_id(array $assignments): string {
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    if ((int)($row["is_primary"] ?? 0) !== 1) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      return $shopId;
    }
  }
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      return $shopId;
    }
  }
  return "";
}

function phase1_require_shop_access(string $roleName, array $assignments, string $shopId): void {
  if ($roleName === "ADMIN") {
    return;
  }
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    if (($row["shop_id"] ?? null) === $shopId) {
      return;
    }
  }
  json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
}

function phase1_handle(string $method, string $route): void {
  $pdo = mysql_pdo();

  if ($method === "GET" && $route === "health") {
    json_response(200, ["status" => "ok", "service" => "bdk-api", "timestamp" => now_iso(), "mode" => "phase1"]);
  }

  if ($method === "POST" && $route === "auth/login") {
    $body = read_json_body();
    $mobile = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
    $password = isset($body["password"]) && is_string($body["password"]) ? $body["password"] : "";

    if ($mobile === "" || $password === "") {
      json_response(400, ["error" => "ValidationError", "message" => "mobileNumber and password are required"]);
    }

    $user = phase1_find_user_by_phone($pdo, $mobile);
    if (!$user || (int)($user["is_active"] ?? 0) !== 1) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    $hash = (string)($user["password_hash"] ?? "");
    if ($hash === "" || !password_verify($password, $hash)) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    $assignments = phase1_load_assignments($pdo, (string)$user["id"]);
    $token = jwt_sign((string)$user["id"]);
    json_response(200, ["data" => ["token" => $token, "user" => phase1_public_user($user, $assignments)]]);
  }

  $auth = phase1_require_auth($pdo);
  $authUser = $auth["user"];
  $roleName = (string)($authUser["role_name"] ?? "");
  $assignments = $auth["assignments"];

  if ($method === "GET" && $route === "auth/me") {
    json_response(200, ["data" => phase1_public_user($authUser, $assignments)]);
  }

  if ($method === "GET" && $route === "shops") {
    if ($roleName === "ADMIN") {
      $rows = phase1_db_fetch_all($pdo, "SELECT id, name, code, notes, created_at, updated_at FROM shops ORDER BY name ASC", []);
      $shops = array_map(function ($row) {
        return [
          "id" => (string)($row["id"] ?? ""),
          "name" => (string)($row["name"] ?? ""),
          "code" => (string)($row["code"] ?? ""),
          "notes" => $row["notes"] ?? null,
          "createdAt" => (string)($row["created_at"] ?? ""),
          "updatedAt" => (string)($row["updated_at"] ?? ""),
        ];
      }, $rows);
      json_response(200, ["data" => $shops]);
    }

    $shops = [];
    foreach ($assignments as $row) {
      $shops[] = [
        "id" => (string)($row["shop_id"] ?? ""),
        "name" => (string)($row["shop_name"] ?? ""),
        "code" => (string)($row["shop_code"] ?? ""),
      ];
    }
    json_response(200, ["data" => $shops]);
  }

  if ($method === "GET" && $route === "users") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    if ($roleName === "ADMIN") {
      $rows = phase1_db_fetch_all(
        $pdo,
        "SELECT u.id, u.full_name, u.phone, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
        "FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC",
        []
      );
      $users = array_map(function ($row) use ($pdo) {
        $assignments = phase1_load_assignments($pdo, (string)$row["id"]);
        return phase1_public_user($row, $assignments);
      }, $rows);
      json_response(200, ["data" => $users]);
    }

    // Manager: only sales users in the manager's shops.
    $shopIds = [];
    foreach ($assignments as $row) {
      $shopId = (string)($row["shop_id"] ?? "");
      if ($shopId !== "") {
        $shopIds[] = $shopId;
      }
    }
    if (count($shopIds) < 1) {
      json_response(200, ["data" => []]);
    }

    $placeholders = [];
    $params = [];
    foreach ($shopIds as $idx => $shopId) {
      $key = ":shop_" . (string)$idx;
      $placeholders[] = $key;
      $params[$key] = $shopId;
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT DISTINCT u.id, u.full_name, u.phone, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
      "FROM users u " .
      "JOIN roles r ON r.id = u.role_id " .
      "JOIN user_shop_assignment a ON a.user_id = u.id AND a.unassigned_at IS NULL " .
      "WHERE r.name = 'SALES' AND a.shop_id IN (" . implode(", ", $placeholders) . ") " .
      "ORDER BY u.created_at DESC",
      $params
    );

    $users = array_map(function ($row) use ($pdo) {
      $assignments = phase1_load_assignments($pdo, (string)$row["id"]);
      return phase1_public_user($row, $assignments);
    }, $rows);

    json_response(200, ["data" => $users]);
  }

  if ($method === "GET" && $route === "expense-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories ORDER BY name ASC",
      []
    );
    $categories = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $categories]);
  }

  if ($method === "POST" && $route === "expense-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $notes = isset($body["notes"]) && is_string($body["notes"]) ? trim($body["notes"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($name === "") {
      json_response(400, ["error" => "ValidationError", "message" => "name is required"]);
    }

    $id = create_id("expcat");

    try {
      $stmt = $pdo->prepare("INSERT INTO expense_categories (id, name, is_active, notes) VALUES (:id, :name, :is_active, :notes)");
      $stmt->execute([
        ":id" => $id,
        ":name" => $name,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => $notes !== "" ? $notes : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Expense category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create expense category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created expense category"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "expense_category", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^expense-categories\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Expense category not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $updates[] = "name = :name";
      $params[":name"] = $value;
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE expense_categories SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Expense category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update expense category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated expense category"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "name" => (string)$existing["name"],
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "expense_category", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "product-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories ORDER BY name ASC",
      []
    );
    $categories = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $categories]);
  }

  if ($method === "POST" && $route === "product-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $notes = isset($body["notes"]) && is_string($body["notes"]) ? trim($body["notes"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($name === "") {
      json_response(400, ["error" => "ValidationError", "message" => "name is required"]);
    }

    $id = create_id("prodcat");

    try {
      $stmt = $pdo->prepare("INSERT INTO product_categories (id, name, is_active, notes) VALUES (:id, :name, :is_active, :notes)");
      $stmt->execute([
        ":id" => $id,
        ":name" => $name,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => $notes !== "" ? $notes : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Product category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create product category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created product category"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "product_category", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^product-categories\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Product category not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $updates[] = "name = :name";
      $params[":name"] = $value;
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE product_categories SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Product category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update product category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated product category"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "name" => (string)$existing["name"],
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "product_category", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "products") {
    phase1_require_role($roleName, ["ADMIN"]);
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id " .
      "ORDER BY p.name ASC",
      []
    );
    $products = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "skuCode" => (string)($row["sku_code"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "categoryId" => (string)($row["category_id"] ?? ""),
        "categoryName" => (string)($row["category_name"] ?? ""),
        "productType" => (string)($row["product_type"] ?? ""),
        "unitOfMeasure" => (string)($row["unit_of_measure"] ?? ""),
        "costPrice" => $row["cost_price"] === null ? null : (int)$row["cost_price"],
        "sellingPrice" => (int)($row["selling_price"] ?? 0),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
        "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $products]);
  }

  if ($method === "POST" && $route === "products") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $skuCode = isset($body["skuCode"]) && is_string($body["skuCode"]) ? trim($body["skuCode"]) : "";
    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $categoryId = isset($body["categoryId"]) && is_string($body["categoryId"]) ? trim($body["categoryId"]) : "";
    $productType = isset($body["productType"]) && is_string($body["productType"]) ? trim($body["productType"]) : "";
    $unitOfMeasure = isset($body["unitOfMeasure"]) && is_string($body["unitOfMeasure"]) ? trim($body["unitOfMeasure"]) : "";
    $sellingPrice = isset($body["sellingPrice"]) ? (int)$body["sellingPrice"] : 0;
    $costPrice = array_key_exists("costPrice", $body) ? ($body["costPrice"] === null ? null : (int)$body["costPrice"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;
    $boardSizeCode = array_key_exists("boardSizeCode", $body) && is_string($body["boardSizeCode"]) ? trim($body["boardSizeCode"]) : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($skuCode === "" || $name === "" || $categoryId === "" || $unitOfMeasure === "" || $sellingPrice < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "skuCode, name, categoryId, unitOfMeasure, and sellingPrice are required"]);
    }
    if ($productType !== "BOARD" && $productType !== "NON_BOARD") {
      json_response(400, ["error" => "ValidationError", "message" => "productType must be BOARD or NON_BOARD"]);
    }
    if ($costPrice !== null && $costPrice < 0) {
      json_response(400, ["error" => "ValidationError", "message" => "costPrice must be >= 0"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $yieldMap = ["A4C" => 48, "A3C" => 24, "A2C" => 12];
    $yieldPerSheet = null;

    if ($productType === "BOARD") {
      if ($boardSizeCode === null || !isset($yieldMap[$boardSizeCode])) {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be A4C, A3C, or A2C for BOARD products"]);
      }
      $yieldPerSheet = (int)$yieldMap[$boardSizeCode];
    } else {
      $boardSizeCode = null;
    }

    $category = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $categoryId]
    );
    if (!$category) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid categoryId"]);
    }
    if ((int)($category["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Category is inactive"]);
    }

    $id = create_id("prod");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO products (id, sku_code, name, category_id, product_type, unit_of_measure, cost_price, selling_price, is_active, board_size_code, yield_per_sheet, notes) " .
        "VALUES (:id, :sku_code, :name, :category_id, :product_type, :unit_of_measure, :cost_price, :selling_price, :is_active, :board_size_code, :yield_per_sheet, :notes)"
      );
      $stmt->execute([
        ":id" => $id,
        ":sku_code" => $skuCode,
        ":name" => $name,
        ":category_id" => $categoryId,
        ":product_type" => $productType,
        ":unit_of_measure" => $unitOfMeasure,
        ":cost_price" => $costPrice,
        ":selling_price" => $sellingPrice,
        ":is_active" => $isActive ? 1 : 0,
        ":board_size_code" => $boardSizeCode,
        ":yield_per_sheet" => $yieldPerSheet,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create product"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created product"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "skuCode" => (string)$row["sku_code"],
      "name" => (string)$row["name"],
      "categoryId" => (string)$row["category_id"],
      "categoryName" => (string)$row["category_name"],
      "productType" => (string)$row["product_type"],
      "unitOfMeasure" => (string)$row["unit_of_measure"],
      "costPrice" => $row["cost_price"] === null ? null : (int)$row["cost_price"],
      "sellingPrice" => (int)$row["selling_price"],
      "isActive" => (int)$row["is_active"] === 1,
      "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
      "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "product", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^products\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Product not found"]);
    }

    $nextSkuCode = (string)$existing["sku_code"];
    $nextName = (string)$existing["name"];
    $nextCategoryId = (string)$existing["category_id"];
    $nextProductType = (string)$existing["product_type"];
    $nextUnitOfMeasure = (string)$existing["unit_of_measure"];
    $nextCostPrice = $existing["cost_price"] === null ? null : (int)$existing["cost_price"];
    $nextSellingPrice = (int)$existing["selling_price"];
    $nextIsActive = (int)$existing["is_active"] === 1;
    $nextBoardSizeCode = $existing["board_size_code"] === null ? null : (string)$existing["board_size_code"];
    $nextNotes = $existing["notes"] ?? null;

    if (array_key_exists("skuCode", $body)) {
      $value = is_string($body["skuCode"]) ? trim($body["skuCode"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode cannot be empty"]);
      }
      $nextSkuCode = $value;
    }
    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $nextName = $value;
    }
    if (array_key_exists("categoryId", $body)) {
      $value = is_string($body["categoryId"]) ? trim($body["categoryId"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "categoryId cannot be empty"]);
      }
      $nextCategoryId = $value;
    }
    if (array_key_exists("productType", $body)) {
      $value = is_string($body["productType"]) ? trim($body["productType"]) : "";
      if ($value !== "BOARD" && $value !== "NON_BOARD") {
        json_response(400, ["error" => "ValidationError", "message" => "productType must be BOARD or NON_BOARD"]);
      }
      $nextProductType = $value;
    }
    if (array_key_exists("unitOfMeasure", $body)) {
      $value = is_string($body["unitOfMeasure"]) ? trim($body["unitOfMeasure"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "unitOfMeasure cannot be empty"]);
      }
      $nextUnitOfMeasure = $value;
    }
    if (array_key_exists("costPrice", $body)) {
      if ($body["costPrice"] === null) {
        $nextCostPrice = null;
      } elseif (is_int($body["costPrice"]) || is_float($body["costPrice"]) || (is_string($body["costPrice"]) && $body["costPrice"] !== "")) {
        $value = (int)$body["costPrice"];
        if ($value < 0) {
          json_response(400, ["error" => "ValidationError", "message" => "costPrice must be >= 0"]);
        }
        $nextCostPrice = $value;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "costPrice must be a number or null"]);
      }
    }
    if (array_key_exists("sellingPrice", $body)) {
      if (!is_int($body["sellingPrice"]) && !is_float($body["sellingPrice"]) && !(is_string($body["sellingPrice"]) && $body["sellingPrice"] !== "")) {
        json_response(400, ["error" => "ValidationError", "message" => "sellingPrice must be a number"]);
      }
      $value = (int)$body["sellingPrice"];
      if ($value < 1) {
        json_response(400, ["error" => "ValidationError", "message" => "sellingPrice must be >= 1"]);
      }
      $nextSellingPrice = $value;
    }
    if (array_key_exists("isActive", $body)) {
      $nextIsActive = (bool)$body["isActive"];
    }
    if (array_key_exists("boardSizeCode", $body)) {
      if ($body["boardSizeCode"] === null) {
        $nextBoardSizeCode = null;
      } elseif (is_string($body["boardSizeCode"])) {
        $value = trim($body["boardSizeCode"]);
        $nextBoardSizeCode = $value !== "" ? $value : null;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be a string or null"]);
      }
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $nextNotes = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }

    if ($nextCategoryId !== (string)$existing["category_id"]) {
      $category = phase1_db_fetch_one(
        $pdo,
        "SELECT id, is_active FROM product_categories WHERE id = :id LIMIT 1",
        [":id" => $nextCategoryId]
      );
      if (!$category) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid categoryId"]);
      }
      if ((int)($category["is_active"] ?? 0) !== 1) {
        json_response(400, ["error" => "ValidationError", "message" => "Category is inactive"]);
      }
    }

    $yieldMap = ["A4C" => 48, "A3C" => 24, "A2C" => 12];
    $yieldPerSheet = null;

    if ($nextProductType === "BOARD") {
      if ($nextBoardSizeCode === null || !isset($yieldMap[$nextBoardSizeCode])) {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be A4C, A3C, or A2C for BOARD products"]);
      }
      $yieldPerSheet = (int)$yieldMap[$nextBoardSizeCode];
    } else {
      $nextBoardSizeCode = null;
      $yieldPerSheet = null;
    }

    try {
      $stmt = $pdo->prepare(
        "UPDATE products SET sku_code = :sku_code, name = :name, category_id = :category_id, product_type = :product_type, " .
          "unit_of_measure = :unit_of_measure, cost_price = :cost_price, selling_price = :selling_price, is_active = :is_active, " .
          "board_size_code = :board_size_code, yield_per_sheet = :yield_per_sheet, notes = :notes, updated_at = NOW() WHERE id = :id"
      );
      $stmt->execute([
        ":id" => $id,
        ":sku_code" => $nextSkuCode,
        ":name" => $nextName,
        ":category_id" => $nextCategoryId,
        ":product_type" => $nextProductType,
        ":unit_of_measure" => $nextUnitOfMeasure,
        ":cost_price" => $nextCostPrice,
        ":selling_price" => $nextSellingPrice,
        ":is_active" => $nextIsActive ? 1 : 0,
        ":board_size_code" => $nextBoardSizeCode,
        ":yield_per_sheet" => $yieldPerSheet,
        ":notes" => $nextNotes,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update product"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated product"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "skuCode" => (string)$existing["sku_code"],
      "name" => (string)$existing["name"],
      "categoryId" => (string)$existing["category_id"],
      "categoryName" => (string)$existing["category_name"],
      "productType" => (string)$existing["product_type"],
      "unitOfMeasure" => (string)$existing["unit_of_measure"],
      "costPrice" => $existing["cost_price"] === null ? null : (int)$existing["cost_price"],
      "sellingPrice" => (int)$existing["selling_price"],
      "isActive" => (int)$existing["is_active"] === 1,
      "boardSizeCode" => $existing["board_size_code"] === null ? null : (string)$existing["board_size_code"],
      "yieldPerSheet" => $existing["yield_per_sheet"] === null ? null : (int)$existing["yield_per_sheet"],
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "skuCode" => (string)$row["sku_code"],
      "name" => (string)$row["name"],
      "categoryId" => (string)$row["category_id"],
      "categoryName" => (string)$row["category_name"],
      "productType" => (string)$row["product_type"],
      "unitOfMeasure" => (string)$row["unit_of_measure"],
      "costPrice" => $row["cost_price"] === null ? null : (int)$row["cost_price"],
      "sellingPrice" => (int)$row["selling_price"],
      "isActive" => (int)$row["is_active"] === 1,
      "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
      "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "product", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "customers") {
    // Sales can create customers; managers can view.
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at " .
      "FROM customers ORDER BY created_at DESC",
      []
    );

    $customers = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "mobileNumber" => (string)($row["mobile"] ?? ""),
        "firstName" => (string)($row["first_name"] ?? ""),
        "lastName" => (string)($row["last_name"] ?? ""),
        "email" => $row["email"] ?? null,
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $customers]);
  }

  if ($method === "POST" && $route === "customers") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $mobile = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
    $firstName = isset($body["firstName"]) && is_string($body["firstName"]) ? trim($body["firstName"]) : "";
    $lastName = isset($body["lastName"]) && is_string($body["lastName"]) ? trim($body["lastName"]) : "";
    $email = array_key_exists("email", $body) ? $body["email"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($mobile === "" || $firstName === "" || $lastName === "") {
      json_response(400, ["error" => "ValidationError", "message" => "mobileNumber, firstName, and lastName are required"]);
    }
    if ($email !== null) {
      if (!is_string($email)) {
        json_response(400, ["error" => "ValidationError", "message" => "email must be a string or null"]);
      }
      $trimmed = trim($email);
      if ($trimmed !== "" && filter_var($trimmed, FILTER_VALIDATE_EMAIL) === false) {
        json_response(400, ["error" => "ValidationError", "message" => "email is invalid"]);
      }
      $email = $trimmed !== "" ? $trimmed : null;
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $id = create_id("cust");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO customers (id, mobile, first_name, last_name, email, is_active, notes) " .
        "VALUES (:id, :mobile, :first_name, :last_name, :email, :is_active, :notes)"
      );
      $stmt->execute([
        ":id" => $id,
        ":mobile" => $mobile,
        ":first_name" => $firstName,
        ":last_name" => $lastName,
        ":email" => $email,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Customer mobile number already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create customer"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created customer"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "mobileNumber" => (string)$row["mobile"],
      "firstName" => (string)$row["first_name"],
      "lastName" => (string)$row["last_name"],
      "email" => $row["email"] ?? null,
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "customer", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^customers\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Customer not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("mobileNumber", $body)) {
      $value = is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "mobileNumber cannot be empty"]);
      }
      $updates[] = "mobile = :mobile";
      $params[":mobile"] = $value;
    }
    if (array_key_exists("firstName", $body)) {
      $value = is_string($body["firstName"]) ? trim($body["firstName"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "firstName cannot be empty"]);
      }
      $updates[] = "first_name = :first_name";
      $params[":first_name"] = $value;
    }
    if (array_key_exists("lastName", $body)) {
      $value = is_string($body["lastName"]) ? trim($body["lastName"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "lastName cannot be empty"]);
      }
      $updates[] = "last_name = :last_name";
      $params[":last_name"] = $value;
    }
    if (array_key_exists("email", $body)) {
      $email = $body["email"];
      if ($email === null) {
        $updates[] = "email = NULL";
      } elseif (is_string($email)) {
        $trimmed = trim($email);
        if ($trimmed !== "" && filter_var($trimmed, FILTER_VALIDATE_EMAIL) === false) {
          json_response(400, ["error" => "ValidationError", "message" => "email is invalid"]);
        }
        $updates[] = "email = :email";
        $params[":email"] = $trimmed !== "" ? $trimmed : null;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "email must be a string or null"]);
      }
    }
    if (array_key_exists("notes", $body)) {
      $notes = $body["notes"];
      if ($notes !== null && !is_string($notes)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notes) && trim($notes) !== "" ? trim($notes) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE customers SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Customer mobile number already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update customer"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated customer"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "mobileNumber" => (string)$existing["mobile"],
      "firstName" => (string)$existing["first_name"],
      "lastName" => (string)$existing["last_name"],
      "email" => $existing["email"] ?? null,
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "mobileNumber" => (string)$row["mobile"],
      "firstName" => (string)$row["first_name"],
      "lastName" => (string)$row["last_name"],
      "email" => $row["email"] ?? null,
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "customer", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "invoices") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $params = [];
    $whereSql = "";

    if ($roleName !== "ADMIN") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $shopId) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $shopId;
      }
      $whereSql = "WHERE i.shop_id IN (" . implode(", ", $placeholders) . ") ";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
        "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, i.status, i.issued_at, i.due_date, " .
        "i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
      "FROM invoices i " .
      "JOIN shops s ON s.id = i.shop_id " .
      "JOIN customers c ON c.id = i.customer_id " .
      $whereSql .
      "ORDER BY i.created_at DESC",
      $params
    );

    $invoices = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "invoiceNumber" => (string)($row["invoice_number"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "sequenceNumber" => (int)($row["sequence_number"] ?? 0),
        "customerId" => (string)($row["customer_id"] ?? ""),
        "customerMobileNumber" => (string)($row["customer_mobile"] ?? ""),
        "customerFirstName" => (string)($row["first_name"] ?? ""),
        "customerLastName" => (string)($row["last_name"] ?? ""),
        "status" => (string)($row["status"] ?? ""),
        "issuedAt" => $row["issued_at"] ?? null,
        "dueDate" => $row["due_date"] ?? null,
        "totalAmount" => (int)($row["total_amount"] ?? 0),
        "paidAmount" => (int)($row["paid_amount"] ?? 0),
        "balance" => (int)($row["balance"] ?? 0),
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $invoices]);
  }

  if ($method === "GET" && preg_match('/^invoices\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $invoiceId = (string)$matches[1];

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
        "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
        "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
      "FROM invoices i " .
      "JOIN shops s ON s.id = i.shop_id " .
      "JOIN customers c ON c.id = i.customer_id " .
      "WHERE i.id = :id LIMIT 1",
      [":id" => $invoiceId]
    );
    if (!$row) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }

    phase1_require_shop_access($roleName, $assignments, (string)$row["shop_id"]);

    $linesRows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
      "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
      [":invoice_id" => $invoiceId]
    );

    $lines = array_map(function ($line) {
      return [
        "id" => (string)($line["id"] ?? ""),
        "invoiceId" => (string)($line["invoice_id"] ?? ""),
        "sortOrder" => (int)($line["sort_order"] ?? 0),
        "description" => (string)($line["description"] ?? ""),
        "quantity" => (int)($line["quantity"] ?? 0),
        "unitPrice" => (int)($line["unit_price"] ?? 0),
        "lineTotal" => (int)($line["line_total"] ?? 0),
        "notes" => $line["notes"] ?? null,
        "createdAt" => (string)($line["created_at"] ?? ""),
        "updatedAt" => (string)($line["updated_at"] ?? ""),
      ];
    }, $linesRows);

    $invoice = [
      "id" => (string)$row["id"],
      "invoiceNumber" => (string)$row["invoice_number"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "sequenceNumber" => (int)$row["sequence_number"],
      "customerId" => (string)$row["customer_id"],
      "customerMobileNumber" => (string)$row["customer_mobile"],
      "customerFirstName" => (string)$row["first_name"],
      "customerLastName" => (string)$row["last_name"],
      "customerEmail" => $row["customer_email"] ?? null,
      "status" => (string)$row["status"],
      "issuedAt" => $row["issued_at"] ?? null,
      "dueDate" => $row["due_date"] ?? null,
      "totalAmount" => (int)$row["total_amount"],
      "paidAmount" => (int)$row["paid_amount"],
      "balance" => (int)$row["balance"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    json_response(200, ["data" => ["invoice" => $invoice, "lines" => $lines]]);
  }

  if ($method === "POST" && $route === "invoices") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $requestedShopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
    $customerId = isset($body["customerId"]) && is_string($body["customerId"]) ? trim($body["customerId"]) : "";
    $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "DRAFT";
    $dueDate = array_key_exists("dueDate", $body) ? $body["dueDate"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if ($customerId === "") {
      json_response(400, ["error" => "ValidationError", "message" => "customerId is required"]);
    }
    if ($status !== "DRAFT" && $status !== "ISSUED") {
      json_response(400, ["error" => "ValidationError", "message" => "status must be DRAFT or ISSUED"]);
    }
    if ($dueDate !== null) {
      if (!is_string($dueDate)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be a string (YYYY-MM-DD) or null"]);
      }
      $trimmed = trim($dueDate);
      if ($trimmed !== "" && !is_valid_ymd_date($trimmed)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be YYYY-MM-DD"]);
      }
      $dueDate = $trimmed !== "" ? $trimmed : null;
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    if (!is_array($linesPayload) || count($linesPayload) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "lines (non-empty array) is required"]);
    }

    $shopId = $requestedShopId;
    if ($roleName !== "ADMIN") {
      if ($shopId === "") {
        $shopId = phase1_primary_shop_id($assignments);
      }
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "Sales user is not assigned to a shop"]);
      }
      phase1_require_shop_access($roleName, $assignments, $shopId);
    } else {
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "shopId is required"]);
      }
    }

    $shopRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, code, name FROM shops WHERE id = :id LIMIT 1",
      [":id" => $shopId]
    );
    if (!$shopRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }

    $customerRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active FROM customers WHERE id = :id LIMIT 1",
      [":id" => $customerId]
    );
    if (!$customerRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid customerId"]);
    }
    if ((int)($customerRow["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Customer is inactive"]);
    }

    $lines = [];
    $totalAmount = 0;

    foreach ($linesPayload as $idx => $rawLine) {
      if (!is_array($rawLine)) {
        json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
      }
      $description = isset($rawLine["description"]) && is_string($rawLine["description"]) ? trim($rawLine["description"]) : "";
      $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
      $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
      $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;

      if ($description === "" || $quantity < 1 || $unitPrice < 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Line requires description, quantity (>=1), unitPrice (>=0)"]);
      }
      if ($lineNotes !== null && !is_string($lineNotes)) {
        json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
      }

      $lineTotal = $quantity * $unitPrice;
      if ($lineTotal < 0 || $lineTotal > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
      }

      $totalAmount += $lineTotal;
      if ($totalAmount > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Invoice total is too large"]);
      }

      $lines[] = [
        "sortOrder" => (int)$idx + 1,
        "description" => $description,
        "quantity" => $quantity,
        "unitPrice" => $unitPrice,
        "lineTotal" => $lineTotal,
        "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
      ];
    }

    if ($totalAmount <= 0) {
      json_response(400, ["error" => "ValidationError", "message" => "Invoice total must be > 0"]);
    }

    $invoiceId = create_id("inv");
    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      // Ensure counter row exists, then lock it.
      $stmtCounterInit = $pdo->prepare(
        "INSERT INTO shop_invoice_counters (shop_id, next_seq) VALUES (:shop_id, 1) " .
        "ON DUPLICATE KEY UPDATE shop_id = shop_id"
      );
      $stmtCounterInit->execute([":shop_id" => $shopId]);

      $counterRow = phase1_db_fetch_one(
        $pdo,
        "SELECT next_seq FROM shop_invoice_counters WHERE shop_id = :shop_id FOR UPDATE",
        [":shop_id" => $shopId]
      );
      if (!$counterRow) {
        throw new RuntimeException("Failed to acquire invoice counter lock");
      }

      $seq = (int)($counterRow["next_seq"] ?? 1);
      if ($seq < 1) {
        $seq = 1;
      }

      phase1_db_execute(
        $pdo,
        "UPDATE shop_invoice_counters SET next_seq = :next_seq, updated_at = NOW() WHERE shop_id = :shop_id",
        [":next_seq" => $seq + 1, ":shop_id" => $shopId]
      );

      $shopCode = (string)($shopRow["code"] ?? "");
      $invoiceNumber = $shopCode . "-" . str_pad((string)$seq, 6, "0", STR_PAD_LEFT);

      $issuedAt = $status === "ISSUED" ? gmdate("Y-m-d H:i:s") : null;

      $stmtInvoice = $pdo->prepare(
        "INSERT INTO invoices (id, shop_id, sequence_number, invoice_number, customer_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_by_user_id) " .
        "VALUES (:id, :shop_id, :sequence_number, :invoice_number, :customer_id, :status, :issued_at, :due_date, :total_amount, 0, :balance, :notes, :created_by_user_id)"
      );
      $stmtInvoice->execute([
        ":id" => $invoiceId,
        ":shop_id" => $shopId,
        ":sequence_number" => $seq,
        ":invoice_number" => $invoiceNumber,
        ":customer_id" => $customerId,
        ":status" => $status,
        ":issued_at" => $issuedAt,
        ":due_date" => $dueDate,
        ":total_amount" => $totalAmount,
        ":balance" => $totalAmount,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ":created_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
      ]);

      $stmtLine = $pdo->prepare(
        "INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes) " .
        "VALUES (:id, :invoice_id, :sort_order, :description, :quantity, :unit_price, :line_total, :notes)"
      );
      $linePublic = [];
      foreach ($lines as $line) {
        $lineId = create_id("line");
        $stmtLine->execute([
          ":id" => $lineId,
          ":invoice_id" => $invoiceId,
          ":sort_order" => (int)$line["sortOrder"],
          ":description" => (string)$line["description"],
          ":quantity" => (int)$line["quantity"],
          ":unit_price" => (int)$line["unitPrice"],
          ":line_total" => (int)$line["lineTotal"],
          ":notes" => $line["notes"] ?? null,
        ]);
        $linePublic[] = [
          "id" => $lineId,
          "invoiceId" => $invoiceId,
          "sortOrder" => (int)$line["sortOrder"],
          "description" => (string)$line["description"],
          "quantity" => (int)$line["quantity"],
          "unitPrice" => (int)$line["unitPrice"],
          "lineTotal" => (int)$line["lineTotal"],
          "notes" => $line["notes"] ?? null,
        ];
      }

      $invoicePublic = [
        "id" => $invoiceId,
        "invoiceNumber" => $invoiceNumber,
        "shopId" => $shopId,
        "shopCode" => (string)$shopRow["code"],
        "shopName" => (string)$shopRow["name"],
        "sequenceNumber" => $seq,
        "customerId" => $customerId,
        "customerMobileNumber" => (string)$customerRow["mobile"],
        "customerFirstName" => (string)$customerRow["first_name"],
        "customerLastName" => (string)$customerRow["last_name"],
        "customerEmail" => $customerRow["email"] ?? null,
        "status" => $status,
        "issuedAt" => $issuedAt,
        "dueDate" => $dueDate,
        "totalAmount" => $totalAmount,
        "paidAmount" => 0,
        "balance" => $totalAmount,
        "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ];

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "invoice", $invoiceId, null, [
        "invoice" => $invoicePublic,
        "lines" => $linePublic,
      ]);

      $pdo->commit();

      // Read back for timestamps.
      $created = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i JOIN shops s ON s.id = i.shop_id JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id LIMIT 1",
        [":id" => $invoiceId]
      );

      $linesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
        [":invoice_id" => $invoiceId]
      );

      $outLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "invoiceId" => (string)($line["invoice_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "description" => (string)($line["description"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $linesRows);

      if (!$created) {
        json_response(201, ["data" => ["invoice" => $invoicePublic, "lines" => $linePublic]]);
      }

      $outInvoice = [
        "id" => (string)$created["id"],
        "invoiceNumber" => (string)$created["invoice_number"],
        "shopId" => (string)$created["shop_id"],
        "shopCode" => (string)$created["shop_code"],
        "shopName" => (string)$created["shop_name"],
        "sequenceNumber" => (int)$created["sequence_number"],
        "customerId" => (string)$created["customer_id"],
        "customerMobileNumber" => (string)$created["customer_mobile"],
        "customerFirstName" => (string)$created["first_name"],
        "customerLastName" => (string)$created["last_name"],
        "customerEmail" => $created["customer_email"] ?? null,
        "status" => (string)$created["status"],
        "issuedAt" => $created["issued_at"] ?? null,
        "dueDate" => $created["due_date"] ?? null,
        "totalAmount" => (int)$created["total_amount"],
        "paidAmount" => (int)$created["paid_amount"],
        "balance" => (int)$created["balance"],
        "notes" => $created["notes"] ?? null,
        "createdAt" => (string)$created["created_at"],
        "updatedAt" => (string)$created["updated_at"],
      ];

      json_response(201, ["data" => ["invoice" => $outInvoice, "lines" => $outLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create invoice"]);
    }
  }

  if ($method === "PATCH" && preg_match('/^invoices\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $invoiceId = (string)$matches[1];
    $body = read_json_body();

    $requestedStatus = array_key_exists("status", $body) && is_string($body["status"]) ? trim($body["status"]) : null;
    $dueDate = array_key_exists("dueDate", $body) ? $body["dueDate"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $customerId = array_key_exists("customerId", $body) && is_string($body["customerId"]) ? trim($body["customerId"]) : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if ($requestedStatus !== null && $requestedStatus !== "ISSUED" && $requestedStatus !== "VOID") {
      json_response(400, ["error" => "ValidationError", "message" => "status can only be set to ISSUED or VOID"]);
    }

    if ($dueDate !== null) {
      if (!is_string($dueDate)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be a string (YYYY-MM-DD) or null"]);
      }
      $trimmed = trim($dueDate);
      if ($trimmed !== "" && !is_valid_ymd_date($trimmed)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be YYYY-MM-DD"]);
      }
      $dueDate = $trimmed !== "" ? $trimmed : null;
    }

    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    if ($linesPayload !== null && (!is_array($linesPayload) || count($linesPayload) < 1)) {
      json_response(400, ["error" => "ValidationError", "message" => "lines must be a non-empty array when provided"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i " .
        "JOIN shops s ON s.id = i.shop_id " .
        "JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id FOR UPDATE",
        [":id" => $invoiceId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
      }

      phase1_require_shop_access($roleName, $assignments, (string)$existing["shop_id"]);

      $currentStatus = (string)($existing["status"] ?? "");
      $paidAmount = (int)($existing["paid_amount"] ?? 0);

      if ($currentStatus === "VOID") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Invoice is void"]);
      }

      if ($requestedStatus === "VOID") {
        phase1_require_role($roleName, ["ADMIN"]);
        // Allow voiding any non-void invoice.
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'VOID', voided_at = NOW(), voided_by_user_id = :actor, updated_at = NOW() WHERE id = :id",
          [":actor" => $actorUserId !== "" ? $actorUserId : null, ":id" => $invoiceId]
        );
      } elseif ($requestedStatus === "ISSUED") {
        if ($currentStatus !== "DRAFT") {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Only draft invoices can be issued"]);
        }
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'ISSUED', issued_at = COALESCE(issued_at, NOW()), updated_at = NOW() WHERE id = :id",
          [":id" => $invoiceId]
        );
        $currentStatus = "ISSUED";
      }

      if ($customerId !== null || $linesPayload !== null) {
        if ($paidAmount !== 0 || $currentStatus !== "DRAFT") {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Customer and line edits are only allowed for draft invoices with no payments"]);
        }
      }

      if ($customerId !== null) {
        if ($customerId === "") {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "customerId cannot be empty"]);
        }
        $customerRow = phase1_db_fetch_one(
          $pdo,
          "SELECT id, is_active FROM customers WHERE id = :id LIMIT 1",
          [":id" => $customerId]
        );
        if (!$customerRow) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Invalid customerId"]);
        }
        if ((int)($customerRow["is_active"] ?? 0) !== 1) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Customer is inactive"]);
        }
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET customer_id = :customer_id, updated_at = NOW() WHERE id = :id",
          [":customer_id" => $customerId, ":id" => $invoiceId]
        );
      }

      if ($dueDate !== null) {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET due_date = :due_date, updated_at = NOW() WHERE id = :id",
          [":due_date" => $dueDate, ":id" => $invoiceId]
        );
      }

      if ($notes !== null) {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET notes = :notes, updated_at = NOW() WHERE id = :id",
          [":notes" => trim($notes) !== "" ? trim($notes) : null, ":id" => $invoiceId]
        );
      }

      if ($linesPayload !== null) {
        $lines = [];
        $totalAmount = 0;
        foreach ($linesPayload as $idx => $rawLine) {
          if (!is_array($rawLine)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
          }
          $description = isset($rawLine["description"]) && is_string($rawLine["description"]) ? trim($rawLine["description"]) : "";
          $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
          $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
          $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;
          if ($description === "" || $quantity < 1 || $unitPrice < 0) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line requires description, quantity (>=1), unitPrice (>=0)"]);
          }
          if ($lineNotes !== null && !is_string($lineNotes)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
          }

          $lineTotal = $quantity * $unitPrice;
          if ($lineTotal < 0 || $lineTotal > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
          }
          $totalAmount += $lineTotal;
          if ($totalAmount > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Invoice total is too large"]);
          }

          $lines[] = [
            "sortOrder" => (int)$idx + 1,
            "description" => $description,
            "quantity" => $quantity,
            "unitPrice" => $unitPrice,
            "lineTotal" => $lineTotal,
            "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
          ];
        }
        if ($totalAmount <= 0) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Invoice total must be > 0"]);
        }

        phase1_db_execute($pdo, "DELETE FROM invoice_lines WHERE invoice_id = :invoice_id", [":invoice_id" => $invoiceId]);
        $stmtLine = $pdo->prepare(
          "INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes) " .
          "VALUES (:id, :invoice_id, :sort_order, :description, :quantity, :unit_price, :line_total, :notes)"
        );
        foreach ($lines as $line) {
          $stmtLine->execute([
            ":id" => create_id("line"),
            ":invoice_id" => $invoiceId,
            ":sort_order" => (int)$line["sortOrder"],
            ":description" => (string)$line["description"],
            ":quantity" => (int)$line["quantity"],
            ":unit_price" => (int)$line["unitPrice"],
            ":line_total" => (int)$line["lineTotal"],
            ":notes" => $line["notes"] ?? null,
          ]);
        }

        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET total_amount = :total_amount, balance = :balance, updated_at = NOW() WHERE id = :id",
          [":total_amount" => $totalAmount, ":balance" => $totalAmount, ":id" => $invoiceId]
        );
      }

      $updated = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i " .
        "JOIN shops s ON s.id = i.shop_id " .
        "JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id LIMIT 1",
        [":id" => $invoiceId]
      );

      $updatedLinesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
        [":invoice_id" => $invoiceId]
      );

      $beforeInvoice = [
        "id" => (string)$existing["id"],
        "invoiceNumber" => (string)$existing["invoice_number"],
        "shopId" => (string)$existing["shop_id"],
        "shopCode" => (string)$existing["shop_code"],
        "shopName" => (string)$existing["shop_name"],
        "sequenceNumber" => (int)$existing["sequence_number"],
        "customerId" => (string)$existing["customer_id"],
        "customerMobileNumber" => (string)$existing["customer_mobile"],
        "customerFirstName" => (string)$existing["first_name"],
        "customerLastName" => (string)$existing["last_name"],
        "customerEmail" => $existing["customer_email"] ?? null,
        "status" => (string)$existing["status"],
        "issuedAt" => $existing["issued_at"] ?? null,
        "dueDate" => $existing["due_date"] ?? null,
        "totalAmount" => (int)$existing["total_amount"],
        "paidAmount" => (int)$existing["paid_amount"],
        "balance" => (int)$existing["balance"],
        "notes" => $existing["notes"] ?? null,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      $afterInvoice = $updated ? [
        "id" => (string)$updated["id"],
        "invoiceNumber" => (string)$updated["invoice_number"],
        "shopId" => (string)$updated["shop_id"],
        "shopCode" => (string)$updated["shop_code"],
        "shopName" => (string)$updated["shop_name"],
        "sequenceNumber" => (int)$updated["sequence_number"],
        "customerId" => (string)$updated["customer_id"],
        "customerMobileNumber" => (string)$updated["customer_mobile"],
        "customerFirstName" => (string)$updated["first_name"],
        "customerLastName" => (string)$updated["last_name"],
        "customerEmail" => $updated["customer_email"] ?? null,
        "status" => (string)$updated["status"],
        "issuedAt" => $updated["issued_at"] ?? null,
        "dueDate" => $updated["due_date"] ?? null,
        "totalAmount" => (int)$updated["total_amount"],
        "paidAmount" => (int)$updated["paid_amount"],
        "balance" => (int)$updated["balance"],
        "notes" => $updated["notes"] ?? null,
        "createdAt" => (string)$updated["created_at"],
        "updatedAt" => (string)$updated["updated_at"],
      ] : $beforeInvoice;

      $afterLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "invoiceId" => (string)($line["invoice_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "description" => (string)($line["description"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $updatedLinesRows);

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "invoice", $invoiceId, [
        "invoice" => $beforeInvoice,
      ], [
        "invoice" => $afterInvoice,
        "lines" => $afterLines,
      ]);

      $pdo->commit();

      json_response(200, ["data" => ["invoice" => $afterInvoice, "lines" => $afterLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update invoice"]);
    }
  }

  if ($method === "GET" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $invoiceId = (string)$matches[1];

    $invoiceRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, shop_id FROM invoices WHERE id = :id LIMIT 1",
      [":id" => $invoiceId]
    );
    if (!$invoiceRow) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }
    phase1_require_shop_access($roleName, $assignments, (string)$invoiceRow["shop_id"]);

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, invoice_id, amount, method, notes, created_at, updated_at FROM invoice_payments WHERE invoice_id = :invoice_id ORDER BY created_at ASC",
      [":invoice_id" => $invoiceId]
    );

    $payments = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "invoiceId" => (string)($row["invoice_id"] ?? ""),
        "amount" => (int)($row["amount"] ?? 0),
        "method" => (string)($row["method"] ?? ""),
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $payments]);
  }

  if ($method === "POST" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $invoiceId = (string)$matches[1];
    $body = read_json_body();

    $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;
    $methodValue = isset($body["method"]) && is_string($body["method"]) ? trim($body["method"]) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($amount <= 0 || !in_array($methodValue, ["CASH", "MOBILE_MONEY", "CARD"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "amount (>0) and method (CASH/MOBILE_MONEY/CARD) are required"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, status, total_amount, paid_amount, balance, issued_at FROM invoices WHERE id = :id FOR UPDATE",
        [":id" => $invoiceId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
      }

      phase1_require_shop_access($roleName, $assignments, (string)$existing["shop_id"]);

      $status = (string)($existing["status"] ?? "");
      if ($status === "VOID") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Cannot accept payment for a void invoice"]);
      }

      $totalAmount = (int)($existing["total_amount"] ?? 0);
      $paidAmount = (int)($existing["paid_amount"] ?? 0);
      $balance = $totalAmount - $paidAmount;
      if ($balance < 0) {
        $balance = 0;
      }
      if ($amount > $balance) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Payment exceeds invoice balance"]);
      }

      if ($status === "DRAFT") {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'ISSUED', issued_at = COALESCE(issued_at, NOW()), updated_at = NOW() WHERE id = :id",
          [":id" => $invoiceId]
        );
        $status = "ISSUED";
      }

      $paymentId = create_id("pay");
      $stmtPayment = $pdo->prepare(
        "INSERT INTO invoice_payments (id, invoice_id, amount, method, notes, created_by_user_id) " .
        "VALUES (:id, :invoice_id, :amount, :method, :notes, :created_by_user_id)"
      );
      $stmtPayment->execute([
        ":id" => $paymentId,
        ":invoice_id" => $invoiceId,
        ":amount" => $amount,
        ":method" => $methodValue,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ":created_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
      ]);

      $newPaid = $paidAmount + $amount;
      $newBalance = $totalAmount - $newPaid;
      if ($newBalance < 0) {
        $newBalance = 0;
      }

      $newStatus = $status;
      if ($newBalance <= 0) {
        $newStatus = "PAID";
      } elseif ($newPaid > 0) {
        $newStatus = "PARTIALLY_PAID";
      } elseif ($status === "ISSUED") {
        $newStatus = "ISSUED";
      }

      phase1_db_execute(
        $pdo,
        "UPDATE invoices SET paid_amount = :paid_amount, balance = :balance, status = :status, updated_at = NOW() WHERE id = :id",
        [
          ":paid_amount" => $newPaid,
          ":balance" => $newBalance,
          ":status" => $newStatus,
          ":id" => $invoiceId
        ]
      );

      $paymentPublic = [
        "id" => $paymentId,
        "invoiceId" => $invoiceId,
        "amount" => $amount,
        "method" => $methodValue,
        "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ];

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "invoice_payment", $paymentId, null, $paymentPublic);

      $updated = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_at, updated_at FROM invoices WHERE id = :id LIMIT 1",
        [":id" => $invoiceId]
      );
      if ($updated) {
        $before = [
          "id" => (string)$existing["id"],
          "status" => (string)$existing["status"],
          "issuedAt" => $existing["issued_at"] ?? null,
          "totalAmount" => (int)$existing["total_amount"],
          "paidAmount" => (int)$existing["paid_amount"],
          "balance" => (int)$existing["balance"],
        ];
        $after = [
          "id" => (string)$updated["id"],
          "status" => (string)$updated["status"],
          "issuedAt" => $updated["issued_at"] ?? null,
          "totalAmount" => (int)$updated["total_amount"],
          "paidAmount" => (int)$updated["paid_amount"],
          "balance" => (int)$updated["balance"],
        ];
        phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "invoice", (string)$updated["id"], $before, $after);
      }

      $pdo->commit();

      $paymentRow = phase1_db_fetch_one(
        $pdo,
        "SELECT id, invoice_id, amount, method, notes, created_at, updated_at FROM invoice_payments WHERE id = :id LIMIT 1",
        [":id" => $paymentId]
      );
      $outPayment = $paymentRow ? [
        "id" => (string)$paymentRow["id"],
        "invoiceId" => (string)$paymentRow["invoice_id"],
        "amount" => (int)$paymentRow["amount"],
        "method" => (string)$paymentRow["method"],
        "notes" => $paymentRow["notes"] ?? null,
        "createdAt" => (string)$paymentRow["created_at"],
        "updatedAt" => (string)$paymentRow["updated_at"],
      ] : $paymentPublic;

      json_response(201, ["data" => ["payment" => $outPayment]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to record payment"]);
    }
  }

  json_response(404, ["error" => "NotFound", "message" => "Route not found"]);
}

function seed_state(): array {
  $defaultPassword = "bdk1234";
  return [
    "shops" => [
      ["id" => "shop-kampala-main", "name" => "Kampala Main", "code" => "KLA"],
      ["id" => "shop-wandegeya", "name" => "Wandegeya", "code" => "WDG"],
    ],
    "users" => [
      [
        "id" => "user-admin-1",
        "fullName" => "System Admin",
        "role" => "ADMIN",
        "mobileNumber" => normalize_mobile_number("0700000000"),
        "passwordHash" => password_hash($defaultPassword, PASSWORD_DEFAULT),
      ],
      [
        "id" => "user-manager-1",
        "fullName" => "Shop Manager",
        "role" => "MANAGER",
        "mobileNumber" => normalize_mobile_number("0700000001"),
        "passwordHash" => password_hash($defaultPassword, PASSWORD_DEFAULT),
      ],
      [
        "id" => "user-sales-1",
        "fullName" => "Sales One",
        "role" => "SALES",
        "shopId" => "shop-kampala-main",
        "mobileNumber" => normalize_mobile_number("0700000002"),
        "passwordHash" => password_hash($defaultPassword, PASSWORD_DEFAULT),
      ],
      [
        "id" => "user-sales-2",
        "fullName" => "Sales Two",
        "role" => "SALES",
        "shopId" => "shop-wandegeya",
        "mobileNumber" => normalize_mobile_number("0700000003"),
        "passwordHash" => password_hash($defaultPassword, PASSWORD_DEFAULT),
      ],
    ],
    "products" => [
      [
        "id" => "prod-board-a4c",
        "skuCode" => "A4C-BOARD",
        "name" => "A4C Board",
        "category" => "Boards",
        "productType" => "BOARD",
        "unitOfMeasure" => "piece",
        "costPrice" => 1200,
        "sellingPrice" => 2500,
        "active" => true,
      ],
      [
        "id" => "prod-board-a3c",
        "skuCode" => "A3C-BOARD",
        "name" => "A3C Board",
        "category" => "Boards",
        "productType" => "BOARD",
        "unitOfMeasure" => "piece",
        "costPrice" => 2400,
        "sellingPrice" => 4200,
        "active" => true,
      ],
      [
        "id" => "prod-frame-basic",
        "skuCode" => "FRAME-BASIC",
        "name" => "Basic Frame",
        "category" => "Frames",
        "productType" => "NON_BOARD",
        "unitOfMeasure" => "piece",
        "costPrice" => 6000,
        "sellingPrice" => 10000,
        "active" => true,
      ],
    ],
    "inventoryRows" => [
      ["shopId" => "shop-kampala-main", "productId" => "prod-board-a4c", "quantity" => 200],
      ["shopId" => "shop-kampala-main", "productId" => "prod-board-a3c", "quantity" => 80],
      ["shopId" => "shop-kampala-main", "productId" => "prod-frame-basic", "quantity" => 25],
      ["shopId" => "shop-wandegeya", "productId" => "prod-board-a4c", "quantity" => 150],
      ["shopId" => "shop-wandegeya", "productId" => "prod-board-a3c", "quantity" => 60],
      ["shopId" => "shop-wandegeya", "productId" => "prod-frame-basic", "quantity" => 30],
    ],
    "sales" => [],
    "expenses" => [],
    "transfers" => [],
    "bankActions" => [],
    "customers" => [],
    "invoices" => [],
    "invoicePayments" => [],
    "shopInvoiceCounters" => [],
    "bankCash" => 0,
  ];
}

function state_path(): string {
  $dataDir = __DIR__ . "/../data";
  if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
  }
  return $dataDir . "/state.json";
}

function public_user(array $user): array {
  // Never expose credential material.
  $copy = $user;
  unset($copy["passwordHash"]);
  return $copy;
}

function load_state(): array {
  if (should_use_mysql()) {
    $pdo = mysql_pdo();
    mysql_ensure_state_table($pdo);
    $stmt = $pdo->prepare("SELECT state_json FROM bdk_state_store WHERE id = 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!is_array($row) || !isset($row["state_json"])) {
      // First-time DB init. If a file state exists, migrate it; otherwise seed.
      $initial = null;
      $path = state_path();
      if (file_exists($path)) {
        $raw = file_get_contents($path);
        $decoded = json_decode($raw ?: "{}", true);
        if (is_array($decoded) && !empty($decoded)) {
          $initial = $decoded;
        }
      }
      if (!is_array($initial)) {
        $initial = seed_state();
      }

      ensure_state_migrations($initial);

      $json = json_encode($initial, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
      if (!is_string($json)) {
        json_response(500, ["error" => "InternalServerError", "message" => "Failed to encode seed state"]);
      }
      $insert = $pdo->prepare("INSERT INTO bdk_state_store (id, state_json) VALUES (1, :json)");
      $insert->execute([":json" => $json]);
      return $initial;
    }

    $decoded = json_decode((string)$row["state_json"], true);
    if (!is_array($decoded)) {
      return seed_state();
    }
    ensure_state_migrations($decoded);
    return $decoded;
  }

  $path = state_path();
  if (!file_exists($path)) {
    $seed = seed_state();
    file_put_contents($path, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    return $seed;
  }
  $raw = file_get_contents($path);
  $decoded = json_decode($raw ?: "{}", true);
  if (!is_array($decoded)) {
    return seed_state();
  }
  ensure_state_migrations($decoded);
  return $decoded;
}

function ensure_state_migrations(array &$state): void {
  // Add missing top-level keys for forward compatibility.
  if (!isset($state["shops"]) || !is_array($state["shops"])) {
    $state["shops"] = [];
  }
  if (!isset($state["users"]) || !is_array($state["users"])) {
    $state["users"] = [];
  }
  if (!isset($state["products"]) || !is_array($state["products"])) {
    $state["products"] = [];
  }
  if (!isset($state["inventoryRows"]) || !is_array($state["inventoryRows"])) {
    $state["inventoryRows"] = [];
  }
  if (!isset($state["sales"]) || !is_array($state["sales"])) {
    $state["sales"] = [];
  }
  if (!isset($state["expenses"]) || !is_array($state["expenses"])) {
    $state["expenses"] = [];
  }
  if (!isset($state["transfers"]) || !is_array($state["transfers"])) {
    $state["transfers"] = [];
  }
  if (!isset($state["bankActions"]) || !is_array($state["bankActions"])) {
    $state["bankActions"] = [];
  }
  if (!isset($state["customers"]) || !is_array($state["customers"])) {
    $state["customers"] = [];
  }
  if (!isset($state["invoices"]) || !is_array($state["invoices"])) {
    $state["invoices"] = [];
  }
  if (!isset($state["invoicePayments"]) || !is_array($state["invoicePayments"])) {
    $state["invoicePayments"] = [];
  }
  if (!isset($state["shopInvoiceCounters"]) || !is_array($state["shopInvoiceCounters"])) {
    $state["shopInvoiceCounters"] = [];
  }
  if (!isset($state["bankCash"]) || !is_int($state["bankCash"])) {
    $state["bankCash"] = (int)($state["bankCash"] ?? 0);
  }

  // Existing deployments predate auth; assign default credentials to legacy users
  // so login works without requiring manual migrations.
  $defaultPassword = "bdk1234";
  foreach ($state["users"] as $idx => $user) {
    if (!is_array($user)) {
      continue;
    }
    $id = isset($user["id"]) && is_string($user["id"]) ? $user["id"] : "";

    if (!isset($user["mobileNumber"]) || !is_string($user["mobileNumber"]) || $user["mobileNumber"] === "") {
      // Known seed IDs.
      if ($id === "user-admin-1") {
        $user["mobileNumber"] = normalize_mobile_number("0700000000");
      } elseif ($id === "user-manager-1") {
        $user["mobileNumber"] = normalize_mobile_number("0700000001");
      } elseif ($id === "user-sales-1") {
        $user["mobileNumber"] = normalize_mobile_number("0700000002");
      } elseif ($id === "user-sales-2") {
        $user["mobileNumber"] = normalize_mobile_number("0700000003");
      }
    } else {
      $user["mobileNumber"] = normalize_mobile_number($user["mobileNumber"]);
    }

    if (!isset($user["passwordHash"]) || !is_string($user["passwordHash"]) || $user["passwordHash"] === "") {
      $user["passwordHash"] = password_hash($defaultPassword, PASSWORD_DEFAULT);
    }

    $state["users"][$idx] = $user;
  }
}

function with_state(callable $mutator) {
  if (should_use_mysql()) {
    $pdo = mysql_pdo();
    mysql_ensure_state_table($pdo);

    try {
      $pdo->beginTransaction();
      $stmt = $pdo->prepare("SELECT state_json FROM bdk_state_store WHERE id = 1 FOR UPDATE");
      $stmt->execute();
      $row = $stmt->fetch();
      if (!is_array($row) || !isset($row["state_json"])) {
        // First-time DB init. If a file state exists, migrate it; otherwise seed.
        $initial = null;
        $path = state_path();
        if (file_exists($path)) {
          $raw = file_get_contents($path);
          $decoded = json_decode($raw ?: "{}", true);
          if (is_array($decoded) && !empty($decoded)) {
            $initial = $decoded;
          }
        }
        if (!is_array($initial)) {
          $initial = seed_state();
        }

        ensure_state_migrations($initial);

        $json = json_encode($initial, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) {
          throw new RuntimeException("Failed to encode seed state");
        }
        $insert = $pdo->prepare("INSERT INTO bdk_state_store (id, state_json) VALUES (1, :json)");
        $insert->execute([":json" => $json]);
        $state = $initial;
      } else {
        $decoded = json_decode((string)$row["state_json"], true);
        $state = is_array($decoded) && !empty($decoded) ? $decoded : seed_state();
      }

      ensure_state_migrations($state);

      $result = $mutator($state);

      $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
      if (!is_string($json)) {
        throw new RuntimeException("Failed to encode state");
      }
      $update = $pdo->prepare("UPDATE bdk_state_store SET state_json = :json WHERE id = 1");
      $update->execute([":json" => $json]);

      $pdo->commit();
      return $result;
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      throw $error;
    }
  }

  $path = state_path();
  $fp = fopen($path, "c+");
  if ($fp === false) {
    json_response(500, ["error" => "InternalServerError", "message" => "Unable to open state file"]);
  }
  if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    json_response(500, ["error" => "InternalServerError", "message" => "Unable to lock state file"]);
  }

  rewind($fp);
  $raw = stream_get_contents($fp);
  $state = json_decode($raw ?: "{}", true);
  if (!is_array($state) || empty($state)) {
    $state = seed_state();
  }

  ensure_state_migrations($state);

  $result = $mutator($state);

  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  return $result;
}

function find_user(array $state, string $userId): ?array {
  foreach ($state["users"] as $user) {
    if (($user["id"] ?? "") === $userId) {
      return $user;
    }
  }
  return null;
}

function find_user_by_mobile(array $state, string $mobileNumber): ?array {
  foreach ($state["users"] as $user) {
    if (($user["mobileNumber"] ?? "") === $mobileNumber) {
      return $user;
    }
  }
  return null;
}

function find_shop(array $state, string $shopId): ?array {
  foreach ($state["shops"] as $shop) {
    if (($shop["id"] ?? "") === $shopId) {
      return $shop;
    }
  }
  return null;
}

function find_product(array $state, string $productId): ?array {
  foreach ($state["products"] as $product) {
    if (($product["id"] ?? "") === $productId) {
      return $product;
    }
  }
  return null;
}

function find_customer(array $state, string $customerId): ?array {
  foreach ($state["customers"] as $customer) {
    if (($customer["id"] ?? "") === $customerId) {
      return $customer;
    }
  }
  return null;
}

function require_auth(array $state): array {
  $userId = get_header_value("x-user-id");
  if (!$userId) {
    json_response(401, ["error" => "HttpError", "message" => "Missing x-user-id header"]);
  }
  $user = find_user($state, $userId);
  if (!$user) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid user"]);
  }
  return $user;
}

function cash_at_hand(array $state, string $userId): int {
  $cashSales = 0;
  foreach ($state["sales"] as $sale) {
    if (($sale["userId"] ?? "") === $userId && ($sale["paymentMethod"] ?? "") === "CASH") {
      $cashSales += (int)($sale["subtotal"] ?? 0);
    }
  }

  $cashExpenses = 0;
  foreach ($state["expenses"] as $expense) {
    if (($expense["recordedByUserId"] ?? "") === $userId && ($expense["paidBy"] ?? "") === "SALESPERSON_CASH") {
      $cashExpenses += (int)($expense["amount"] ?? 0);
    }
  }

  $sent = 0;
  $received = 0;
  foreach ($state["transfers"] as $transfer) {
    if (($transfer["status"] ?? "") !== "APPROVED") {
      continue;
    }
    if (($transfer["senderUserId"] ?? "") === $userId) {
      $sent += (int)($transfer["amount"] ?? 0);
    }
    if (($transfer["receiverUserId"] ?? "") === $userId) {
      $received += (int)($transfer["amount"] ?? 0);
    }
  }

  $banked = 0;
  foreach ($state["bankActions"] as $action) {
    if (($action["status"] ?? "") === "APPROVED" && ($action["userId"] ?? "") === $userId) {
      $banked += (int)($action["amount"] ?? 0);
    }
  }

  return $cashSales - $cashExpenses - $sent + $received - $banked;
}

function require_role(array $user, array $roles): void {
  $role = $user["role"] ?? "";
  if (!in_array($role, $roles, true)) {
    json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
  }
}

function api_path(): string {
  $path = parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH);
  if (!is_string($path)) {
    return "";
  }
  $pos = strpos($path, "/api/");
  if ($pos === false) {
    return "";
  }
  return trim(substr($path, $pos + 5), "/"); // after "/api/"
}

function now_iso(): string {
  return gmdate("c");
}

function today_ymd(): string {
  return gmdate("Y-m-d");
}

function is_valid_ymd_date(string $value): bool {
  if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $value)) {
    return false;
  }
  $dt = DateTime::createFromFormat("Y-m-d", $value, new DateTimeZone("UTC"));
  if ($dt === false) {
    return false;
  }
  return $dt->format("Y-m-d") === $value;
}

function create_id(string $prefix): string {
  $bytes = random_bytes(16);
  $hex = bin2hex($bytes);
  return $prefix . "-" . substr($hex, 0, 8) . "-" . substr($hex, 8, 4) . "-" . substr($hex, 12, 4) . "-" . substr($hex, 16, 4) . "-" . substr($hex, 20);
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$route = api_path();

$apiMode = strtolower((string)(getenv("BDK_API_MODE") ?: ""));
if ($apiMode === "phase1") {
  phase1_handle($method, $route);
}

// Public endpoints.
if ($method === "GET" && $route === "health") {
  json_response(200, ["status" => "ok", "service" => "bdk-api", "timestamp" => now_iso()]);
}

if ($method === "POST" && $route === "auth/login") {
  $body = read_json_body();
  $mobileNumber = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
  $password = isset($body["password"]) && is_string($body["password"]) ? $body["password"] : "";

  if ($mobileNumber === "" || $password === "") {
    json_response(400, ["error" => "ValidationError", "message" => "mobileNumber and password are required"]);
  }

  $result = with_state(function (&$s) use ($mobileNumber, $password) {
    $user = find_user_by_mobile($s, $mobileNumber);
    if (!$user) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    $hash = $user["passwordHash"] ?? "";
    if (!is_string($hash) || $hash === "" || !password_verify($password, $hash)) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    return ["token" => $user["id"], "user" => public_user($user)];
  });

  json_response(200, ["data" => $result]);
}

$state = load_state();
$authUser = require_auth($state);

if ($method === "GET" && $route === "auth/me") {
  json_response(200, ["data" => public_user($authUser)]);
}

if ($method === "GET" && $route === "meta/seed") {
  $users = [];
  foreach ($state["users"] as $user) {
    if (is_array($user)) {
      $users[] = public_user($user);
    }
  }
  json_response(200, ["data" => ["shops" => $state["shops"], "users" => $users]]);
}

if ($method === "POST" && $route === "admin/users") {
  require_role($authUser, ["ADMIN"]);
  $body = read_json_body();

  $fullName = isset($body["fullName"]) && is_string($body["fullName"]) ? trim($body["fullName"]) : "";
  $role = isset($body["role"]) && is_string($body["role"]) ? strtoupper(trim($body["role"])) : "";
  $shopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
  $mobileNumber = isset($body["mobileNumber"]) && is_string($body["mobileNumber"])
    ? normalize_mobile_number($body["mobileNumber"])
    : "";
  $password = isset($body["password"]) && is_string($body["password"]) ? $body["password"] : "";

  if ($fullName === "" || $role === "" || $mobileNumber === "" || $password === "") {
    json_response(400, ["error" => "ValidationError", "message" => "fullName, role, mobileNumber, and password are required"]);
  }
  if (!in_array($role, ["ADMIN", "MANAGER", "SALES"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid role"]);
  }
  if (strlen($password) < 6) {
    json_response(400, ["error" => "ValidationError", "message" => "password must be at least 6 characters"]);
  }

  if ($role === "SALES") {
    if ($shopId === "") {
      json_response(400, ["error" => "ValidationError", "message" => "shopId is required for SALES users"]);
    }
    if (!find_shop($state, $shopId)) {
      json_response(404, ["error" => "NotFound", "message" => "Shop not found"]);
    }
  } else {
    // Only SALES users are assigned to a shop in v1.
    $shopId = "";
  }

  $user = with_state(function (&$s) use ($fullName, $role, $shopId, $mobileNumber, $password) {
    $existing = find_user_by_mobile($s, $mobileNumber);
    if ($existing) {
      json_response(409, ["error" => "Conflict", "message" => "Mobile number is already registered"]);
    }

    $user = [
      "id" => create_id("user"),
      "fullName" => $fullName,
      "role" => $role,
      "mobileNumber" => $mobileNumber,
      "passwordHash" => password_hash($password, PASSWORD_DEFAULT),
      "createdAt" => now_iso(),
    ];
    if ($role === "SALES") {
      $user["shopId"] = $shopId;
    }

    $s["users"][] = $user;
    return $user;
  });

  json_response(201, ["data" => public_user($user)]);
}

if ($method === "GET" && $route === "products") {
  json_response(200, ["data" => $state["products"]]);
}

if ($method === "POST" && $route === "products") {
  require_role($authUser, ["ADMIN"]);
  $body = read_json_body();

  $skuCode = isset($body["skuCode"]) && is_string($body["skuCode"]) ? trim($body["skuCode"]) : "";
  $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
  $category = isset($body["category"]) && is_string($body["category"]) ? trim($body["category"]) : "";
  $productType = isset($body["productType"]) && is_string($body["productType"]) ? trim($body["productType"]) : "";
  $unitOfMeasure = isset($body["unitOfMeasure"]) && is_string($body["unitOfMeasure"]) ? trim($body["unitOfMeasure"]) : "";
  $costPrice = isset($body["costPrice"]) ? (int)$body["costPrice"] : null;
  $sellingPrice = isset($body["sellingPrice"]) ? (int)$body["sellingPrice"] : 0;
  $active = isset($body["active"]) ? (bool)$body["active"] : true;

  if ($skuCode === "" || $name === "" || $category === "" || $unitOfMeasure === "") {
    json_response(400, ["error" => "ValidationError", "message" => "skuCode, name, category, and unitOfMeasure are required"]);
  }
  if (!in_array($productType, ["BOARD", "NON_BOARD"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid productType"]);
  }
  if ($sellingPrice <= 0) {
    json_response(400, ["error" => "ValidationError", "message" => "sellingPrice must be > 0"]);
  }
  if ($costPrice !== null && $costPrice < 0) {
    json_response(400, ["error" => "ValidationError", "message" => "costPrice must be >= 0"]);
  }

  $product = with_state(function (&$s) use ($skuCode, $name, $category, $productType, $unitOfMeasure, $costPrice, $sellingPrice, $active) {
    foreach ($s["products"] as $existing) {
      if (strtolower((string)($existing["skuCode"] ?? "")) === strtolower($skuCode)) {
        json_response(409, ["error" => "Conflict", "message" => "Duplicate SKU code"]);
      }
    }

    $product = [
      "id" => create_id("prod"),
      "skuCode" => $skuCode,
      "name" => $name,
      "category" => $category,
      "productType" => $productType,
      "unitOfMeasure" => $unitOfMeasure,
      "sellingPrice" => $sellingPrice,
      "active" => $active,
    ];
    if ($costPrice !== null) {
      $product["costPrice"] = $costPrice;
    }

    $s["products"][] = $product;
    return $product;
  });

  json_response(201, ["data" => $product]);
}

if ($method === "GET" && $route === "products/inventory") {
  json_response(200, ["data" => $state["inventoryRows"]]);
}

if ($method === "POST" && $route === "products/inventory/receive") {
  require_role($authUser, ["ADMIN"]);
  $body = read_json_body();

  $shopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
  $productId = isset($body["productId"]) && is_string($body["productId"]) ? trim($body["productId"]) : "";
  $quantity = isset($body["quantity"]) ? (int)$body["quantity"] : 0;

  if ($shopId === "" || $productId === "" || $quantity <= 0) {
    json_response(400, ["error" => "ValidationError", "message" => "shopId, productId, and quantity (>0) are required"]);
  }

  $row = with_state(function (&$s) use ($shopId, $productId, $quantity) {
    if (!find_shop($s, $shopId)) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }
    if (!find_product($s, $productId)) {
      json_response(404, ["error" => "HttpError", "message" => "Product not found"]);
    }

    $rowIndex = null;
    foreach ($s["inventoryRows"] as $idx => $row) {
      if (($row["shopId"] ?? "") === $shopId && ($row["productId"] ?? "") === $productId) {
        $rowIndex = $idx;
        break;
      }
    }
    if ($rowIndex === null) {
      $created = ["shopId" => $shopId, "productId" => $productId, "quantity" => $quantity];
      $s["inventoryRows"][] = $created;
      return $created;
    }
    $s["inventoryRows"][$rowIndex]["quantity"] = (int)$s["inventoryRows"][$rowIndex]["quantity"] + $quantity;
    return $s["inventoryRows"][$rowIndex];
  });

  json_response(201, ["data" => $row]);
}

if ($method === "GET" && $route === "sales") {
  $role = (string)($authUser["role"] ?? "");
  if ($role === "ADMIN") {
    json_response(200, ["data" => $state["sales"]]);
  }
  if ($role === "SALES") {
    $userId = (string)$authUser["id"];
    $filtered = [];
    foreach ($state["sales"] as $sale) {
      if (($sale["userId"] ?? "") === $userId) {
        $filtered[] = $sale;
      }
    }
    json_response(200, ["data" => $filtered]);
  }
  json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
}

if ($method === "POST" && $route === "sales") {
  require_role($authUser, ["SALES"]);
  $shopId = $authUser["shopId"] ?? null;
  if (!$shopId) {
    json_response(400, ["error" => "BadRequest", "message" => "User is not assigned to a shop"]);
  }

  $body = read_json_body();
  $paymentMethod = $body["paymentMethod"] ?? null;
  $lines = $body["lines"] ?? null;
  if (!is_string($paymentMethod) || !in_array($paymentMethod, ["CASH", "MOBILE_MONEY", "CARD", "CREDIT"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid paymentMethod"]);
  }
  if (!is_array($lines) || count($lines) < 1) {
    json_response(400, ["error" => "ValidationError", "message" => "lines must be a non-empty array"]);
  }

  $notes = isset($body["notes"]) && is_string($body["notes"]) ? $body["notes"] : null;

  $sale = with_state(function (&$s) use ($shopId, $authUser, $paymentMethod, $lines, $notes) {
    // Validate stock.
    foreach ($lines as $line) {
      $productId = $line["productId"] ?? "";
      $qty = (int)($line["quantity"] ?? 0);
      if (!is_string($productId) || $productId === "" || $qty <= 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid sale line"]);
      }

      $rowIndex = null;
      foreach ($s["inventoryRows"] as $idx => $row) {
        if (($row["shopId"] ?? "") === $shopId && ($row["productId"] ?? "") === $productId) {
          $rowIndex = $idx;
          break;
        }
      }
      $available = $rowIndex === null ? 0 : (int)($s["inventoryRows"][$rowIndex]["quantity"] ?? 0);
      if ($available < $qty) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "Insufficient stock for product " . $productId . ". Available: " . $available . ", required: " . $qty,
        ]);
      }
    }

    // Deduct stock.
    foreach ($lines as $line) {
      $productId = $line["productId"];
      $qty = (int)$line["quantity"];
      foreach ($s["inventoryRows"] as $idx => $row) {
        if (($row["shopId"] ?? "") === $shopId && ($row["productId"] ?? "") === $productId) {
          $s["inventoryRows"][$idx]["quantity"] = (int)$s["inventoryRows"][$idx]["quantity"] - $qty;
          break;
        }
      }
    }

    $materialized = [];
    $subtotal = 0;
    foreach ($lines as $line) {
      $productId = (string)$line["productId"];
      $qty = (int)$line["quantity"];
      $unitPrice = (int)($line["unitPrice"] ?? 0);
      if ($unitPrice <= 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid unitPrice"]);
      }
      $lineTotal = $qty * $unitPrice;
      $subtotal += $lineTotal;
      $materialized[] = [
        "productId" => $productId,
        "quantity" => $qty,
        "unitPrice" => $unitPrice,
        "lineTotal" => $lineTotal,
      ];
    }

    $sale = [
      "id" => create_id("sale"),
      "shopId" => $shopId,
      "userId" => $authUser["id"],
      "lines" => $materialized,
      "subtotal" => $subtotal,
      "paymentMethod" => $paymentMethod,
      "notes" => $notes,
      "createdAt" => now_iso(),
    ];

    $s["sales"][] = $sale;
    return $sale;
  });

  json_response(201, ["data" => $sale]);
}

if ($method === "GET" && $route === "cash/actions") {
  $role = (string)($authUser["role"] ?? "");
  $userId = (string)($authUser["id"] ?? "");

  if ($role === "ADMIN") {
    json_response(200, [
      "data" => [
        "expenses" => $state["expenses"],
        "transfers" => $state["transfers"],
        "bankActions" => $state["bankActions"],
        "bankCash" => (int)($state["bankCash"] ?? 0),
      ],
    ]);
  }

  if ($role === "SALES") {
    $expenses = [];
    foreach ($state["expenses"] as $expense) {
      if (($expense["recordedByUserId"] ?? "") === $userId) {
        $expenses[] = $expense;
      }
    }
    $transfers = [];
    foreach ($state["transfers"] as $transfer) {
      if (($transfer["senderUserId"] ?? "") === $userId || ($transfer["receiverUserId"] ?? "") === $userId) {
        $transfers[] = $transfer;
      }
    }
    $bankActions = [];
    foreach ($state["bankActions"] as $action) {
      if (($action["userId"] ?? "") === $userId) {
        $bankActions[] = $action;
      }
    }
    json_response(200, [
      "data" => [
        "expenses" => $expenses,
        "transfers" => $transfers,
        "bankActions" => $bankActions,
        "bankCash" => (int)($state["bankCash"] ?? 0),
      ],
    ]);
  }

  json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
}

if ($method === "POST" && $route === "cash/expenses") {
  $body = read_json_body();
  $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;
  $category = isset($body["category"]) && is_string($body["category"]) ? trim($body["category"]) : "";
  $date = isset($body["date"]) && is_string($body["date"]) ? trim($body["date"]) : "";
  $notes = isset($body["notes"]) && is_string($body["notes"]) ? $body["notes"] : null;
  $paidBy = isset($body["paidBy"]) && is_string($body["paidBy"]) ? trim($body["paidBy"]) : "";

  if ($amount <= 0 || $category === "" || $paidBy === "") {
    json_response(400, ["error" => "ValidationError", "message" => "amount (>0), category, and paidBy are required"]);
  }
  if ($date !== "" && !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $date)) {
    json_response(400, ["error" => "ValidationError", "message" => "date must be YYYY-MM-DD"]);
  }
  if (!in_array($paidBy, ["SALESPERSON_CASH", "ADMIN_BANK"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid paidBy"]);
  }

  $role = (string)($authUser["role"] ?? "");
  if ($paidBy === "SALESPERSON_CASH" && $role !== "SALES") {
    json_response(403, ["error" => "HttpError", "message" => "Only sales users can record salesperson-cash expenses"]);
  }
  if ($paidBy === "ADMIN_BANK" && $role !== "ADMIN") {
    json_response(403, ["error" => "HttpError", "message" => "Only admins can record admin/bank expenses"]);
  }

  $expense = with_state(function (&$s) use ($authUser, $amount, $category, $date, $notes, $paidBy) {
    $userId = (string)$authUser["id"];
    if ($paidBy === "SALESPERSON_CASH") {
      $available = cash_at_hand($s, $userId);
      if ($available < $amount) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
        ]);
      }
    } else {
      $bankCash = (int)($s["bankCash"] ?? 0);
      if ($bankCash < $amount) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "Insufficient bank cash. Available: " . $bankCash . ", required: " . $amount,
        ]);
      }
      $s["bankCash"] = $bankCash - $amount;
    }

    $expense = [
      "id" => create_id("exp"),
      "amount" => $amount,
      "category" => $category,
      "date" => $date !== "" ? $date : today_ymd(),
      "notes" => $notes,
      "paidBy" => $paidBy,
      "recordedByUserId" => $userId,
      "createdAt" => now_iso(),
    ];
    $s["expenses"][] = $expense;
    return $expense;
  });

  json_response(201, ["data" => $expense]);
}

if ($method === "POST" && $route === "cash/transfers") {
  require_role($authUser, ["SALES"]);
  $body = read_json_body();
  $receiverUserId = isset($body["receiverUserId"]) && is_string($body["receiverUserId"]) ? trim($body["receiverUserId"]) : "";
  $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;

  if ($receiverUserId === "" || $amount <= 0) {
    json_response(400, ["error" => "ValidationError", "message" => "receiverUserId and amount (>0) are required"]);
  }
  if ($receiverUserId === (string)$authUser["id"]) {
    json_response(400, ["error" => "ValidationError", "message" => "Cannot transfer to the same user"]);
  }

  $transfer = with_state(function (&$s) use ($authUser, $receiverUserId, $amount) {
    $receiver = find_user($s, $receiverUserId);
    if (!$receiver || ($receiver["role"] ?? "") !== "SALES") {
      json_response(400, ["error" => "ValidationError", "message" => "Receiver must be a valid SALES user"]);
    }

    $senderId = (string)$authUser["id"];
    $available = cash_at_hand($s, $senderId);
    if ($available < $amount) {
      json_response(400, [
        "error" => "BadRequest",
        "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
      ]);
    }

    $transfer = [
      "id" => create_id("trf"),
      "senderUserId" => $senderId,
      "receiverUserId" => $receiverUserId,
      "amount" => $amount,
      "status" => "PENDING",
      "createdAt" => now_iso(),
    ];
    $s["transfers"][] = $transfer;
    return $transfer;
  });

  json_response(201, ["data" => $transfer]);
}

if ($method === "PATCH" && preg_match('/^cash\\/transfers\\/([^\\/]+)\\/decision$/', $route, $matches) === 1) {
  require_role($authUser, ["SALES"]);
  $transferId = (string)$matches[1];
  $body = read_json_body();
  $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "";
  if (!in_array($status, ["APPROVED", "REJECTED"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "status must be APPROVED or REJECTED"]);
  }

  $updated = with_state(function (&$s) use ($authUser, $transferId, $status) {
    $idx = null;
    foreach ($s["transfers"] as $i => $t) {
      if (($t["id"] ?? "") === $transferId) {
        $idx = $i;
        break;
      }
    }
    if ($idx === null) {
      json_response(404, ["error" => "HttpError", "message" => "Transfer not found"]);
    }

    $existing = $s["transfers"][$idx];
    if (($existing["status"] ?? "") !== "PENDING") {
      json_response(400, ["error" => "BadRequest", "message" => "Transfer is not pending"]);
    }
    if (($existing["receiverUserId"] ?? "") !== (string)$authUser["id"]) {
      json_response(403, ["error" => "HttpError", "message" => "Only the receiver can approve/reject this transfer"]);
    }

    if ($status === "APPROVED") {
      $senderId = (string)($existing["senderUserId"] ?? "");
      $amount = (int)($existing["amount"] ?? 0);
      $available = cash_at_hand($s, $senderId);
      if ($available < $amount) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "Sender has insufficient cash at hand for approval. Available: " . $available . ", required: " . $amount,
        ]);
      }
    }

    $s["transfers"][$idx]["status"] = $status;
    $s["transfers"][$idx]["decidedAt"] = now_iso();
    return $s["transfers"][$idx];
  });

  json_response(200, ["data" => $updated]);
}

if ($method === "POST" && $route === "cash/bank-actions") {
  require_role($authUser, ["SALES"]);
  $body = read_json_body();
  $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;
  if ($amount <= 0) {
    json_response(400, ["error" => "ValidationError", "message" => "amount (>0) is required"]);
  }

  $action = with_state(function (&$s) use ($authUser, $amount) {
    $userId = (string)$authUser["id"];
    $available = cash_at_hand($s, $userId);
    if ($available < $amount) {
      json_response(400, [
        "error" => "BadRequest",
        "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
      ]);
    }

    $action = [
      "id" => create_id("bank"),
      "userId" => $userId,
      "amount" => $amount,
      "status" => "PENDING",
      "createdAt" => now_iso(),
    ];
    $s["bankActions"][] = $action;
    return $action;
  });

  json_response(201, ["data" => $action]);
}

if ($method === "PATCH" && preg_match('/^cash\\/bank-actions\\/([^\\/]+)\\/decision$/', $route, $matches) === 1) {
  require_role($authUser, ["ADMIN"]);
  $actionId = (string)$matches[1];
  $body = read_json_body();
  $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "";
  if (!in_array($status, ["APPROVED", "REJECTED"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "status must be APPROVED or REJECTED"]);
  }

  $updated = with_state(function (&$s) use ($actionId, $status) {
    $idx = null;
    foreach ($s["bankActions"] as $i => $a) {
      if (($a["id"] ?? "") === $actionId) {
        $idx = $i;
        break;
      }
    }
    if ($idx === null) {
      json_response(404, ["error" => "HttpError", "message" => "Bank action not found"]);
    }

    $existing = $s["bankActions"][$idx];
    if (($existing["status"] ?? "") !== "PENDING") {
      json_response(400, ["error" => "BadRequest", "message" => "Bank action is not pending"]);
    }

    if ($status === "APPROVED") {
      $userId = (string)($existing["userId"] ?? "");
      $amount = (int)($existing["amount"] ?? 0);
      $available = cash_at_hand($s, $userId);
      if ($available < $amount) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "User has insufficient cash at hand for approval. Available: " . $available . ", required: " . $amount,
        ]);
      }
      $s["bankCash"] = (int)($s["bankCash"] ?? 0) + $amount;
    }

    $s["bankActions"][$idx]["status"] = $status;
    $s["bankActions"][$idx]["decidedAt"] = now_iso();
    return $s["bankActions"][$idx];
  });

  json_response(200, ["data" => $updated]);
}

if ($method === "GET" && $route === "cash/dashboard/sales/" . ($authUser["id"] ?? "")) {
  // Allow sales user to view their own dashboard at /cash/dashboard/sales/:id.
  $userId = $authUser["id"];
  $cash = cash_at_hand($state, $userId);

  $pendingTransfers = [];
  foreach ($state["transfers"] as $transfer) {
    if (($transfer["status"] ?? "") === "PENDING" && (($transfer["senderUserId"] ?? "") === $userId || ($transfer["receiverUserId"] ?? "") === $userId)) {
      $pendingTransfers[] = $transfer;
    }
  }
  $pendingBankActions = [];
  foreach ($state["bankActions"] as $action) {
    if (($action["status"] ?? "") === "PENDING" && ($action["userId"] ?? "") === $userId) {
      $pendingBankActions[] = $action;
    }
  }

  json_response(200, [
    "data" => [
      "userId" => $userId,
      "cashAtHand" => $cash,
      "pendingTransfers" => $pendingTransfers,
      "pendingBankActions" => $pendingBankActions,
    ],
  ]);
}

if ($method === "GET" && str_starts_with($route, "cash/dashboard/sales/")) {
  // Admin can view any sales dashboard.
  require_role($authUser, ["ADMIN"]);
  $userId = substr($route, strlen("cash/dashboard/sales/"));
  $target = find_user($state, $userId);
  if (!$target) {
    json_response(404, ["error" => "HttpError", "message" => "User not found"]);
  }

  $cash = cash_at_hand($state, $userId);
  $pendingTransfers = [];
  foreach ($state["transfers"] as $transfer) {
    if (($transfer["status"] ?? "") === "PENDING" && (($transfer["senderUserId"] ?? "") === $userId || ($transfer["receiverUserId"] ?? "") === $userId)) {
      $pendingTransfers[] = $transfer;
    }
  }
  $pendingBankActions = [];
  foreach ($state["bankActions"] as $action) {
    if (($action["status"] ?? "") === "PENDING" && ($action["userId"] ?? "") === $userId) {
      $pendingBankActions[] = $action;
    }
  }

  json_response(200, [
    "data" => [
      "userId" => $userId,
      "cashAtHand" => $cash,
      "pendingTransfers" => $pendingTransfers,
      "pendingBankActions" => $pendingBankActions,
    ],
  ]);
}

if ($method === "GET" && $route === "cash/dashboard/admin") {
  require_role($authUser, ["ADMIN"]);
  $users = [];
  $totalCashAtHand = 0;
  foreach ($state["users"] as $u) {
    $balance = cash_at_hand($state, (string)$u["id"]);
    $users[] = [
      "userId" => $u["id"],
      "fullName" => $u["fullName"],
      "role" => $u["role"],
      "cashAtHand" => $balance,
    ];
    $totalCashAtHand += $balance;
  }

  $pendingTransfers = 0;
  foreach ($state["transfers"] as $t) {
    if (($t["status"] ?? "") === "PENDING") {
      $pendingTransfers += 1;
    }
  }
  $pendingBankActions = 0;
  foreach ($state["bankActions"] as $a) {
    if (($a["status"] ?? "") === "PENDING") {
      $pendingBankActions += 1;
    }
  }

  json_response(200, [
    "data" => [
      "users" => $users,
      "bankCash" => (int)($state["bankCash"] ?? 0),
      "totalCashAtHand" => $totalCashAtHand,
      "pendingTransfers" => $pendingTransfers,
      "pendingBankActions" => $pendingBankActions,
    ],
  ]);
}

if ($method === "GET" && $route === "cash/capital/summary") {
  require_role($authUser, ["ADMIN"]);
  $totalCashAtHand = 0;
  foreach ($state["users"] as $u) {
    $totalCashAtHand += cash_at_hand($state, (string)$u["id"]);
  }

  $warnings = [];
  $totalInventoryValue = 0;
  foreach ($state["products"] as $product) {
    $productId = (string)$product["id"];
    $totalQty = 0;
    foreach ($state["inventoryRows"] as $row) {
      if (($row["productId"] ?? "") === $productId) {
        $totalQty += (int)($row["quantity"] ?? 0);
      }
    }

    $type = (string)($product["productType"] ?? "");
    $cost = isset($product["costPrice"]) ? (int)$product["costPrice"] : null;

    if ($type === "NON_BOARD") {
      $totalInventoryValue += $totalQty * ($cost ?? 0);
      continue;
    }

    if ($cost !== null) {
      $totalInventoryValue += $totalQty * $cost;
    } else {
      $warnings[] = "Board SKU " . ($product["skuCode"] ?? $productId) . " has no cost configured. Value treated as 0.";
    }
  }

  $bankCash = (int)($state["bankCash"] ?? 0);
  json_response(200, [
    "data" => [
      "totalCashAtHand" => $totalCashAtHand,
      "bankCash" => $bankCash,
      "totalInventoryValue" => $totalInventoryValue,
      "businessCapital" => $totalCashAtHand + $bankCash + $totalInventoryValue,
      "warnings" => $warnings,
    ],
  ]);
}

if ($method === "GET" && $route === "invoices/customers") {
  json_response(200, ["data" => $state["customers"]]);
}

if ($method === "POST" && $route === "invoices/customers") {
  $role = (string)($authUser["role"] ?? "");
  if (!in_array($role, ["SALES", "ADMIN"], true)) {
    json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
  }

  $body = read_json_body();
  $mobileNumber = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
  $firstName = isset($body["firstName"]) && is_string($body["firstName"]) ? trim($body["firstName"]) : "";
  $lastName = isset($body["lastName"]) && is_string($body["lastName"]) ? trim($body["lastName"]) : "";
  $email = isset($body["email"]) && is_string($body["email"]) ? trim($body["email"]) : null;

  if ($mobileNumber === "" || $firstName === "" || $lastName === "") {
    json_response(400, ["error" => "ValidationError", "message" => "mobileNumber, firstName, and lastName are required"]);
  }
  if ($email !== null && $email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid email"]);
  }

  $customer = with_state(function (&$s) use ($mobileNumber, $firstName, $lastName, $email) {
    foreach ($s["customers"] as $existing) {
      if (($existing["mobileNumber"] ?? "") === $mobileNumber) {
        json_response(409, ["error" => "Conflict", "message" => "Customer already exists with this mobile number"]);
      }
    }

    $customer = [
      "id" => create_id("cust"),
      "mobileNumber" => $mobileNumber,
      "firstName" => $firstName,
      "lastName" => $lastName,
    ];
    if ($email !== null && $email !== "") {
      $customer["email"] = $email;
    }

    $s["customers"][] = $customer;
    return $customer;
  });

  json_response(201, ["data" => $customer]);
}

if ($method === "GET" && $route === "invoices") {
  json_response(200, ["data" => $state["invoices"]]);
}

if ($method === "GET" && $route === "invoices/overdue") {
  require_role($authUser, ["ADMIN", "MANAGER"]);
  $today = today_ymd();
  $overdue = [];
  foreach ($state["invoices"] as $invoice) {
    $due = $invoice["dueDate"] ?? null;
    $balance = (int)($invoice["balance"] ?? 0);
    $status = (string)($invoice["status"] ?? "");
    if (is_string($due) && $due !== "" && $balance > 0 && $due < $today && $status !== "VOID") {
      $overdue[] = $invoice;
    }
  }
  json_response(200, ["data" => $overdue]);
}

if ($method === "POST" && $route === "invoices") {
  require_role($authUser, ["SALES"]);
  $shopId = $authUser["shopId"] ?? null;
  if (!$shopId) {
    json_response(400, ["error" => "BadRequest", "message" => "User is not assigned to a shop"]);
  }

  $body = read_json_body();
  $customerId = isset($body["customerId"]) && is_string($body["customerId"]) ? trim($body["customerId"]) : "";
  $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "ISSUED";
  $lines = $body["lines"] ?? null;
  $dueDate = isset($body["dueDate"]) && is_string($body["dueDate"]) ? trim($body["dueDate"]) : null;
  $notes = isset($body["notes"]) && is_string($body["notes"]) ? $body["notes"] : null;

  if ($customerId === "" || !in_array($status, ["DRAFT", "ISSUED"], true) || !is_array($lines) || count($lines) < 1) {
    json_response(400, ["error" => "ValidationError", "message" => "customerId, status (DRAFT|ISSUED), and lines[] are required"]);
  }
  if ($dueDate !== null && $dueDate !== "" && !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $dueDate)) {
    json_response(400, ["error" => "ValidationError", "message" => "dueDate must be YYYY-MM-DD"]);
  }

  $invoice = with_state(function (&$s) use ($shopId, $authUser, $customerId, $status, $lines, $dueDate, $notes) {
    if (!find_shop($s, (string)$shopId)) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }
    if (!find_customer($s, $customerId)) {
      json_response(400, ["error" => "ValidationError", "message" => "Customer not found"]);
    }

    $materialized = [];
    $total = 0;
    foreach ($lines as $line) {
      $productId = $line["productId"] ?? "";
      $qty = (int)($line["quantity"] ?? 0);
      $unitPrice = (int)($line["unitPrice"] ?? 0);
      if (!is_string($productId) || $productId === "" || $qty <= 0 || $unitPrice <= 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid invoice line"]);
      }
      if (!find_product($s, $productId)) {
        json_response(404, ["error" => "HttpError", "message" => "Product not found"]);
      }

      $lineTotal = $qty * $unitPrice;
      $total += $lineTotal;
      $materialized[] = [
        "productId" => $productId,
        "quantity" => $qty,
        "unitPrice" => $unitPrice,
        "lineTotal" => $lineTotal,
      ];
    }

    $shop = find_shop($s, (string)$shopId);
    $code = is_array($shop) ? (string)($shop["code"] ?? "SHOP") : "SHOP";
    $counter = (int)($s["shopInvoiceCounters"][(string)$shopId] ?? 0) + 1;
    $s["shopInvoiceCounters"][(string)$shopId] = $counter;
    $invoiceNumber = $code . "-" . str_pad((string)$counter, 6, "0", STR_PAD_LEFT);

    $invoice = [
      "id" => create_id("inv"),
      "invoiceNumber" => $invoiceNumber,
      "shopId" => (string)$shopId,
      "customerId" => $customerId,
      "status" => $status,
      "lines" => $materialized,
      "totalAmount" => $total,
      "paidAmount" => 0,
      "balance" => $total,
      "dueDate" => $dueDate !== null && $dueDate !== "" ? $dueDate : null,
      "notes" => $notes,
      "createdByUserId" => (string)$authUser["id"],
      "createdAt" => now_iso(),
    ];

    $s["invoices"][] = $invoice;
    return $invoice;
  });

  json_response(201, ["data" => $invoice]);
}

if ($method === "PATCH" && preg_match('/^invoices\\/([^\\/]+)\\/status$/', $route, $matches) === 1) {
  require_role($authUser, ["ADMIN"]);
  $invoiceId = (string)$matches[1];
  $body = read_json_body();
  $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "";
  if (!in_array($status, ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "Invalid status"]);
  }

  $invoice = with_state(function (&$s) use ($invoiceId, $status) {
    $idx = null;
    foreach ($s["invoices"] as $i => $inv) {
      if (($inv["id"] ?? "") === $invoiceId) {
        $idx = $i;
        break;
      }
    }
    if ($idx === null) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }
    $s["invoices"][$idx]["status"] = $status;
    $s["invoices"][$idx]["updatedAt"] = now_iso();
    return $s["invoices"][$idx];
  });

  json_response(200, ["data" => $invoice]);
}

if ($method === "GET" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
  $invoiceId = (string)$matches[1];
  $payments = [];
  foreach ($state["invoicePayments"] as $payment) {
    if (($payment["invoiceId"] ?? "") === $invoiceId) {
      $payments[] = $payment;
    }
  }
  json_response(200, ["data" => $payments]);
}

if ($method === "POST" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
  $role = (string)($authUser["role"] ?? "");
  if (!in_array($role, ["SALES", "ADMIN"], true)) {
    json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
  }

  $invoiceId = (string)$matches[1];
  $body = read_json_body();
  $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;
  $paymentMethod = isset($body["method"]) && is_string($body["method"]) ? trim($body["method"]) : "";
  $notes = isset($body["notes"]) && is_string($body["notes"]) ? $body["notes"] : null;

  if ($amount <= 0 || !in_array($paymentMethod, ["CASH", "MOBILE_MONEY", "CARD"], true)) {
    json_response(400, ["error" => "ValidationError", "message" => "amount (>0) and method are required"]);
  }

  $result = with_state(function (&$s) use ($invoiceId, $amount, $paymentMethod, $notes) {
    $invoiceIdx = null;
    foreach ($s["invoices"] as $i => $inv) {
      if (($inv["id"] ?? "") === $invoiceId) {
        $invoiceIdx = $i;
        break;
      }
    }
    if ($invoiceIdx === null) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }

    $invoice = $s["invoices"][$invoiceIdx];
    if (($invoice["status"] ?? "") === "VOID") {
      json_response(400, ["error" => "BadRequest", "message" => "Cannot accept payment for a void invoice"]);
    }
    $balance = (int)($invoice["balance"] ?? 0);
    if ($amount > $balance) {
      json_response(400, ["error" => "BadRequest", "message" => "Payment exceeds invoice balance"]);
    }

    $payment = [
      "id" => create_id("pay"),
      "invoiceId" => $invoiceId,
      "amount" => $amount,
      "method" => $paymentMethod,
      "notes" => $notes,
      "createdAt" => now_iso(),
    ];
    $s["invoicePayments"][] = $payment;

    $paidAmount = (int)($invoice["paidAmount"] ?? 0) + $amount;
    $totalAmount = (int)($invoice["totalAmount"] ?? 0);
    $newBalance = $totalAmount - $paidAmount;

    $invoice["paidAmount"] = $paidAmount;
    $invoice["balance"] = $newBalance;
    if ($newBalance <= 0) {
      $invoice["status"] = "PAID";
      $invoice["balance"] = 0;
    } elseif ($paidAmount > 0) {
      $invoice["status"] = "PARTIALLY_PAID";
    }
    $invoice["updatedAt"] = now_iso();

    $s["invoices"][$invoiceIdx] = $invoice;
    return ["invoice" => $invoice, "payment" => $payment];
  });

  json_response(201, ["data" => $result]);
}

json_response(404, ["error" => "HttpError", "message" => "Route not found"]);
