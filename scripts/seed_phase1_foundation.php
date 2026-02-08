<?php

declare(strict_types=1);

// Phase 1 seed: roles, shops, and a single admin user.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/seed_phase1_foundation.php

function stderr(string $message): void {
  fwrite(STDERR, $message . PHP_EOL);
}

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
    if ((str_starts_with($value, "\"") && str_ends_with($value, "\"")) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
      $value = substr($value, 1, -1);
    }
    if (getenv($key) !== false) {
      continue;
    }
    putenv($key . "=" . $value);
    $_ENV[$key] = $value;
  }
}

function normalize_mobile_number(string $mobile): string {
  $digits = preg_replace('/\\D+/', '', trim($mobile));
  return is_string($digits) ? $digits : "";
}

function pdo(): PDO {
  $host = (string)(getenv("BDK_DB_HOST") ?: "");
  $port = (string)(getenv("BDK_DB_PORT") ?: "3306");
  $name = (string)(getenv("BDK_DB_NAME") ?: "");
  $user = (string)(getenv("BDK_DB_USER") ?: "");
  $pass = (string)(getenv("BDK_DB_PASS") ?: "");

  if ($host === "" || $name === "" || $user === "") {
    throw new RuntimeException("Missing DB config. Set BDK_DB_HOST, BDK_DB_NAME, BDK_DB_USER, BDK_DB_PASS in .env");
  }

  $dsn = "mysql:host=" . $host . ";port=" . $port . ";dbname=" . $name . ";charset=utf8mb4";
  return new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
}

function now_iso(): string {
  return gmdate("c");
}

function main(): int {
  if (php_sapi_name() !== "cli") {
    stderr("This script must be run via CLI.");
    return 1;
  }

  $root = dirname(__DIR__);
  load_dotenv($root . "/.env");

  $adminFullName = trim((string)(getenv("SEED_ADMIN_FULL_NAME") ?: "System Admin"));
  $adminPhone = normalize_mobile_number((string)(getenv("SEED_ADMIN_PHONE") ?: ""));
  $adminPassword = (string)(getenv("SEED_ADMIN_PASSWORD") ?: "");

  if ($adminPhone === "" || $adminPassword === "") {
    stderr("Missing seed config. Set SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD in .env");
    return 1;
  }
  if (strlen($adminPassword) < 6) {
    stderr("SEED_ADMIN_PASSWORD must be at least 6 characters.");
    return 1;
  }

  $db = pdo();
  $db->beginTransaction();

  try {
    // Roles (idempotent by unique name)
    $roles = [
      ["seedId" => "role-admin", "name" => "ADMIN", "description" => "Full system access"],
      ["seedId" => "role-manager", "name" => "MANAGER", "description" => "Shop manager (restricted visibility)"],
      ["seedId" => "role-sales", "name" => "SALES", "description" => "Sales user (single-shop access)"],
    ];

    $stmtRoleUpsert = $db->prepare(
      "INSERT INTO roles (id, name, description, notes, created_at, updated_at) " .
      "VALUES (:id, :name, :description, NULL, NOW(), NOW()) " .
      "ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()"
    );
    $stmtRoleId = $db->prepare("SELECT id FROM roles WHERE name = :name LIMIT 1");
    $roleIds = [];
    foreach ($roles as $role) {
      $stmtRoleUpsert->execute([
        ":id" => $role["seedId"],
        ":name" => $role["name"],
        ":description" => $role["description"],
      ]);
      $stmtRoleId->execute([":name" => $role["name"]]);
      $row = $stmtRoleId->fetch();
      if (!is_array($row) || !isset($row["id"])) {
        throw new RuntimeException("Failed to read role id for " . $role["name"]);
      }
      $roleIds[$role["name"]] = (string)$row["id"];
    }

    // Shops (idempotent by unique code)
    $shops = [
      ["seedId" => "shop-kla", "code" => "KLA", "name" => "Kampala Main"],
      ["seedId" => "shop-wdg", "code" => "WDG", "name" => "Wandegeya"],
    ];
    $stmtShopUpsert = $db->prepare(
      "INSERT INTO shops (id, code, name, notes, created_at, updated_at) " .
      "VALUES (:id, :code, :name, NULL, NOW(), NOW()) " .
      "ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()"
    );
    $stmtShopId = $db->prepare("SELECT id FROM shops WHERE code = :code LIMIT 1");
    foreach ($shops as $shop) {
      $stmtShopUpsert->execute([
        ":id" => $shop["seedId"],
        ":code" => $shop["code"],
        ":name" => $shop["name"],
      ]);
      $stmtShopId->execute([":code" => $shop["code"]]);
      $row = $stmtShopId->fetch();
      if (!is_array($row) || !isset($row["id"])) {
        throw new RuntimeException("Failed to read shop id for " . $shop["code"]);
      }
    }

    // Admin user (idempotent by unique phone)
    $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT, ["cost" => 12]);
    if (!is_string($passwordHash) || $passwordHash === "") {
      throw new RuntimeException("Failed to hash password");
    }

    $stmtUser = $db->prepare(
      "INSERT INTO users (id, full_name, phone, password_hash, role_id, is_active, notes, created_at, updated_at) " .
      "VALUES (:id, :full_name, :phone, :password_hash, :role_id, 1, :notes, NOW(), NOW()) " .
      "ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role_id = VALUES(role_id), is_active = 1, updated_at = NOW()"
    );
    $stmtUser->execute([
      ":id" => "user-admin-1",
      ":full_name" => $adminFullName,
      ":phone" => $adminPhone,
      ":password_hash" => $passwordHash,
      ":role_id" => $roleIds["ADMIN"],
      ":notes" => "Seeded on " . now_iso(),
    ]);

    $db->commit();
    echo "Seed complete. Admin phone: " . $adminPhone . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    $db->rollBack();
    stderr("Seed failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());
