<?php

declare(strict_types=1);

// Phase 2 migration: master-data tables for SiteGround Phase 1 API.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase2_master_data.php

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
      "CREATE TABLE IF NOT EXISTS expense_categories (" .
        "id VARCHAR(191) NOT NULL," .
        "name VARCHAR(191) NOT NULL," .
        "is_active TINYINT(1) NOT NULL DEFAULT 1," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY expense_categories_name_unique (name)" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS product_categories (" .
        "id VARCHAR(191) NOT NULL," .
        "name VARCHAR(191) NOT NULL," .
        "is_active TINYINT(1) NOT NULL DEFAULT 1," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY product_categories_name_unique (name)" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS products (" .
        "id VARCHAR(191) NOT NULL," .
        "sku_code VARCHAR(64) NOT NULL," .
        "name VARCHAR(191) NOT NULL," .
        "category_id VARCHAR(191) NOT NULL," .
        "product_type ENUM('BOARD', 'NON_BOARD') NOT NULL," .
        "unit_of_measure VARCHAR(64) NOT NULL," .
        "cost_price INT NULL," .
        "selling_price INT NOT NULL," .
        "is_active TINYINT(1) NOT NULL DEFAULT 1," .
        "board_size_code ENUM('A4C', 'A3C', 'A2C') NULL," .
        "yield_per_sheet INT NULL," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY products_sku_code_unique (sku_code)," .
        "KEY products_category_id_idx (category_id)," .
        "CONSTRAINT products_category_id_fk FOREIGN KEY (category_id) REFERENCES product_categories(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    echo "Phase 2 migration complete (master data tables)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

