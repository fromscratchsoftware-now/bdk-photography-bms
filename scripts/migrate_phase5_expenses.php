<?php

declare(strict_types=1);

// Phase 5 migration: expenses table for SiteGround Phase 1 API.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase5_expenses.php

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

function main(): int {
  if (php_sapi_name() !== "cli") {
    stderr("This script must be run via CLI.");
    return 1;
  }

  $root = dirname(__DIR__);
  load_dotenv($root . "/.env");

  $db = pdo();

  try {
    $db->exec("SET NAMES utf8mb4");
    $db->exec("SET time_zone = '+00:00'");

    $db->exec(
      "CREATE TABLE IF NOT EXISTS expenses (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "category_id VARCHAR(191) NOT NULL," .
        "amount_ugx INT NOT NULL," .
        "expense_date DATE NOT NULL," .
        "notes TEXT NULL," .
        "payment_source ENUM('SALESPERSON_CASH', 'ADMIN_BANK') NOT NULL," .
        "paid_by_user_id VARCHAR(191) NULL," .
        "recorded_by_user_id VARCHAR(191) NULL," .
        "is_void TINYINT(1) NOT NULL DEFAULT 0," .
        "voided_at TIMESTAMP NULL," .
        "voided_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY expenses_shop_date_idx (shop_id, expense_date)," .
        "KEY expenses_category_idx (category_id)," .
        "KEY expenses_paid_by_user_idx (paid_by_user_id, expense_date)," .
        "CONSTRAINT expenses_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT expenses_category_id_fk FOREIGN KEY (category_id) REFERENCES expense_categories(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT expenses_paid_by_user_id_fk FOREIGN KEY (paid_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT expenses_recorded_by_user_id_fk FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT expenses_voided_by_user_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    echo "Phase 5 migration complete (expenses table)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

