<?php

declare(strict_types=1);

// Demo seed: creates a manager and two sales users assigned to the seeded shops.
// Intended for Phase 6 testing on a non-production environment.
//
// Run via SSH on SiteGround:
//   php scripts/seed_demo_users.php

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

function ensure_assignment(PDO $db, string $userId, string $shopId, bool $isPrimary): void {
  $stmt = $db->prepare(
    "SELECT id FROM user_shop_assignment WHERE user_id = :user_id AND shop_id = :shop_id AND unassigned_at IS NULL LIMIT 1"
  );
  $stmt->execute([":user_id" => $userId, ":shop_id" => $shopId]);
  $row = $stmt->fetch();
  if (is_array($row) && isset($row["id"])) {
    // Ensure primary flag is correct if requested.
    if ($isPrimary) {
      $upd = $db->prepare("UPDATE user_shop_assignment SET is_primary = 1, updated_at = NOW() WHERE id = :id");
      $upd->execute([":id" => (string)$row["id"]]);
    }
    return;
  }

  $ins = $db->prepare(
    "INSERT INTO user_shop_assignment (id, user_id, shop_id, is_primary, notes, assigned_at, created_at, updated_at) " .
    "VALUES (:id, :user_id, :shop_id, :is_primary, :notes, NOW(), NOW(), NOW())"
  );
  $ins->execute([
    ":id" => "assign-" . bin2hex(random_bytes(8)),
    ":user_id" => $userId,
    ":shop_id" => $shopId,
    ":is_primary" => $isPrimary ? 1 : 0,
    ":notes" => "Demo seed",
  ]);
}

function upsert_user(PDO $db, array $roleIds, string $seedId, string $fullName, string $phone, string $roleName, string $password): string {
  $phoneNorm = normalize_mobile_number($phone);
  if ($phoneNorm === "") {
    throw new RuntimeException("Invalid phone for " . $seedId);
  }
  if (!isset($roleIds[$roleName])) {
    throw new RuntimeException("Missing role id for " . $roleName);
  }

  $hash = password_hash($password, PASSWORD_BCRYPT, ["cost" => 12]);
  if (!is_string($hash) || $hash === "") {
    throw new RuntimeException("Failed to hash password");
  }

  // Idempotent by unique phone. When phone already exists, keep that id.
  $stmtFind = $db->prepare("SELECT id FROM users WHERE phone = :phone LIMIT 1");
  $stmtFind->execute([":phone" => $phoneNorm]);
  $existing = $stmtFind->fetch();
  if (is_array($existing) && isset($existing["id"])) {
    $userId = (string)$existing["id"];
    $stmtUpdate = $db->prepare(
      "UPDATE users SET full_name = :full_name, password_hash = :password_hash, role_id = :role_id, is_active = 1, updated_at = NOW() WHERE id = :id"
    );
    $stmtUpdate->execute([
      ":full_name" => $fullName,
      ":password_hash" => $hash,
      ":role_id" => $roleIds[$roleName],
      ":id" => $userId,
    ]);
    return $userId;
  }

  $stmtInsert = $db->prepare(
    "INSERT INTO users (id, full_name, phone, password_hash, role_id, is_active, notes, created_at, updated_at) " .
    "VALUES (:id, :full_name, :phone, :password_hash, :role_id, 1, :notes, NOW(), NOW())"
  );
  $stmtInsert->execute([
    ":id" => $seedId,
    ":full_name" => $fullName,
    ":phone" => $phoneNorm,
    ":password_hash" => $hash,
    ":role_id" => $roleIds[$roleName],
    ":notes" => "Demo seed",
  ]);
  return $seedId;
}

function main(): int {
  if (php_sapi_name() !== "cli") {
    stderr("This script must be run via CLI.");
    return 1;
  }

  $root = dirname(__DIR__);
  load_dotenv($root . "/.env");

  $password = (string)(getenv("SEED_DEMO_PASSWORD") ?: "bdk1234");
  if (strlen($password) < 6) {
    stderr("SEED_DEMO_PASSWORD must be at least 6 characters.");
    return 1;
  }

  $db = pdo();
  $db->beginTransaction();

  try {
    $db->exec("SET NAMES utf8mb4");
    $db->exec("SET time_zone = '+00:00'");

    $roleRows = $db->query("SELECT id, name FROM roles")->fetchAll();
    $roleIds = [];
    foreach ($roleRows as $r) {
      if (is_array($r) && isset($r["name"]) && isset($r["id"])) {
        $roleIds[(string)$r["name"]] = (string)$r["id"];
      }
    }

    $stmtShop = $db->prepare("SELECT id FROM shops WHERE code = :code LIMIT 1");
    $stmtShop->execute([":code" => "KLA"]);
    $kla = $stmtShop->fetch();
    $stmtShop->execute([":code" => "WDG"]);
    $wdg = $stmtShop->fetch();

    if (!is_array($kla) || !isset($kla["id"]) || !is_array($wdg) || !isset($wdg["id"])) {
      throw new RuntimeException("Seeded shops not found. Run seed_phase1_foundation.php first.");
    }

    $shopKlaId = (string)$kla["id"];
    $shopWdgId = (string)$wdg["id"];

    $managerId = upsert_user($db, $roleIds, "user-manager-1", "Shop Manager", "0700000001", "MANAGER", $password);
    $sales1Id = upsert_user($db, $roleIds, "user-sales-1", "Sales One", "0700000002", "SALES", $password);
    $sales2Id = upsert_user($db, $roleIds, "user-sales-2", "Sales Two", "0700000003", "SALES", $password);

    // Assign manager to both shops (primary = KLA)
    ensure_assignment($db, $managerId, $shopKlaId, true);
    ensure_assignment($db, $managerId, $shopWdgId, false);

    // Assign sales users (primary)
    ensure_assignment($db, $sales1Id, $shopKlaId, true);
    ensure_assignment($db, $sales2Id, $shopWdgId, true);

    $db->commit();
    echo "Demo users seeded. Password: " . $password . PHP_EOL;
    echo "Manager: 0700000001" . PHP_EOL;
    echo "Sales 1: 0700000002" . PHP_EOL;
    echo "Sales 2: 0700000003" . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    $db->rollBack();
    stderr("Seed failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

