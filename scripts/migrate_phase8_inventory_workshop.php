<?php

declare(strict_types=1);

// Phase 8 migration: workshop + inventory lifecycle tables for SiteGround Phase 1 API.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase8_inventory_workshop.php

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

function column_exists(PDO $db, string $table, string $column): bool {
  $stmt = $db->prepare(
    "SELECT COUNT(*) AS cnt " .
    "FROM INFORMATION_SCHEMA.COLUMNS " .
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name"
  );
  $stmt->execute([":table_name" => $table, ":column_name" => $column]);
  $row = $stmt->fetch();
  return is_array($row) && (int)($row["cnt"] ?? 0) > 0;
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

    // Track available full sheets as a single locked row to prevent concurrent overspending.
    $db->exec(
      "CREATE TABLE IF NOT EXISTS workshop_sheet_balance (" .
        "id TINYINT UNSIGNED NOT NULL PRIMARY KEY," .
        "quantity_available INT NOT NULL DEFAULT 0," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $db->exec("INSERT INTO workshop_sheet_balance (id, quantity_available) VALUES (1, 0) ON DUPLICATE KEY UPDATE id = id");

    $db->exec(
      "CREATE TABLE IF NOT EXISTS workshop_sheet_receipts (" .
        "id VARCHAR(191) NOT NULL," .
        "receipt_date DATE NOT NULL," .
        "quantity_sheets INT NOT NULL," .
        "supplier VARCHAR(191) NULL," .
        "cost_per_sheet INT NULL," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY workshop_sheet_receipts_date_idx (receipt_date)," .
        "CONSTRAINT workshop_sheet_receipts_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS workshop_batches (" .
        "id VARCHAR(191) NOT NULL," .
        "batch_date DATE NOT NULL," .
        "total_sheets_used INT NOT NULL," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY workshop_batches_date_idx (batch_date)," .
        "CONSTRAINT workshop_batches_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS workshop_batch_lines (" .
        "id VARCHAR(191) NOT NULL," .
        "batch_id VARCHAR(191) NOT NULL," .
        "sort_order INT NOT NULL DEFAULT 0," .
        "product_id VARCHAR(191) NOT NULL," .
        "yield_per_sheet INT NOT NULL," .
        "sheets_used INT NOT NULL," .
        "expected_output INT NOT NULL," .
        "actual_good INT NOT NULL," .
        "actual_damaged INT NOT NULL," .
        "actual_waste INT NOT NULL," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY workshop_batch_lines_batch_id_idx (batch_id)," .
        "KEY workshop_batch_lines_product_id_idx (product_id)," .
        "CONSTRAINT workshop_batch_lines_batch_fk FOREIGN KEY (batch_id) REFERENCES workshop_batches(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE," .
        "CONSTRAINT workshop_batch_lines_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS workshop_inventory_levels (" .
        "product_id VARCHAR(191) NOT NULL," .
        "quantity INT NOT NULL DEFAULT 0," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (product_id)," .
        "CONSTRAINT workshop_inventory_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS shop_inventory_levels (" .
        "shop_id VARCHAR(191) NOT NULL," .
        "product_id VARCHAR(191) NOT NULL," .
        "quantity INT NOT NULL DEFAULT 0," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (shop_id, product_id)," .
        "KEY shop_inventory_product_idx (product_id)," .
        "CONSTRAINT shop_inventory_shop_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT shop_inventory_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS stock_receipts (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "product_id VARCHAR(191) NOT NULL," .
        "receipt_date DATE NOT NULL," .
        "quantity INT NOT NULL," .
        "notes TEXT NULL," .
        "recorded_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY stock_receipts_shop_date_idx (shop_id, receipt_date)," .
        "KEY stock_receipts_product_idx (product_id)," .
        "CONSTRAINT stock_receipts_shop_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT stock_receipts_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT stock_receipts_recorded_by_fk FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS shop_damage_events (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "product_id VARCHAR(191) NOT NULL," .
        "damage_date DATE NOT NULL," .
        "quantity INT NOT NULL," .
        "reason VARCHAR(191) NULL," .
        "notes TEXT NULL," .
        "recorded_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY shop_damage_shop_date_idx (shop_id, damage_date)," .
        "KEY shop_damage_product_idx (product_id)," .
        "CONSTRAINT shop_damage_shop_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT shop_damage_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT shop_damage_recorded_by_fk FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS inventory_transfers (" .
        "id VARCHAR(191) NOT NULL," .
        "to_shop_id VARCHAR(191) NOT NULL," .
        "status ENUM('DRAFT', 'SHIPPED', 'RECEIVED') NOT NULL DEFAULT 'DRAFT'," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "shipped_at TIMESTAMP NULL," .
        "shipped_by_user_id VARCHAR(191) NULL," .
        "received_at TIMESTAMP NULL," .
        "received_by_user_id VARCHAR(191) NULL," .
        "receive_notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY inventory_transfers_shop_status_idx (to_shop_id, status, created_at)," .
        "CONSTRAINT inventory_transfers_shop_fk FOREIGN KEY (to_shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT inventory_transfers_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT inventory_transfers_shipped_by_fk FOREIGN KEY (shipped_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT inventory_transfers_received_by_fk FOREIGN KEY (received_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS inventory_transfer_lines (" .
        "id VARCHAR(191) NOT NULL," .
        "transfer_id VARCHAR(191) NOT NULL," .
        "sort_order INT NOT NULL DEFAULT 0," .
        "product_id VARCHAR(191) NOT NULL," .
        "sku_code VARCHAR(64) NOT NULL," .
        "product_name VARCHAR(191) NOT NULL," .
        "quantity_shipped INT NOT NULL," .
        "quantity_damaged INT NOT NULL DEFAULT 0," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY inventory_transfer_lines_transfer_idx (transfer_id)," .
        "KEY inventory_transfer_lines_product_idx (product_id)," .
        "CONSTRAINT inventory_transfer_lines_transfer_fk FOREIGN KEY (transfer_id) REFERENCES inventory_transfers(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE," .
        "CONSTRAINT inventory_transfer_lines_product_fk FOREIGN KEY (product_id) REFERENCES products(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Safe evolution: sales inventory posting marker so historical sales won't back-adjust stock.
    if (!column_exists($db, "sales", "inventory_posted")) {
      $db->exec("ALTER TABLE sales ADD COLUMN inventory_posted TINYINT(1) NOT NULL DEFAULT 0");
    }

    echo "Phase 8 migration complete (workshop + inventory lifecycle tables)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

