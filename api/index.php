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

function create_id(string $prefix): string {
  $bytes = random_bytes(16);
  $hex = bin2hex($bytes);
  return $prefix . "-" . substr($hex, 0, 8) . "-" . substr($hex, 8, 4) . "-" . substr($hex, 12, 4) . "-" . substr($hex, 16, 4) . "-" . substr($hex, 20);
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$route = api_path();

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
