<?php

declare(strict_types=1);

// Phase 3 migration: customers + invoices + payments tables for SiteGround Phase 1 API.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase3_customers_invoices.php

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
      "CREATE TABLE IF NOT EXISTS customers (" .
        "id VARCHAR(191) NOT NULL," .
        "mobile VARCHAR(32) NOT NULL," .
        "first_name VARCHAR(191) NOT NULL," .
        "last_name VARCHAR(191) NOT NULL," .
        "email VARCHAR(191) NULL," .
        "is_active TINYINT(1) NOT NULL DEFAULT 1," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY customers_mobile_unique (mobile)," .
        "KEY customers_name_idx (last_name, first_name)" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS shop_invoice_counters (" .
        "shop_id VARCHAR(191) NOT NULL," .
        "next_seq INT NOT NULL DEFAULT 1," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (shop_id)," .
        "CONSTRAINT shop_invoice_counters_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS invoices (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "sequence_number INT NOT NULL," .
        "invoice_number VARCHAR(64) NOT NULL," .
        "customer_id VARCHAR(191) NOT NULL," .
        "status ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID') NOT NULL," .
        "issued_at TIMESTAMP NULL," .
        "due_date DATE NULL," .
        "total_amount INT NOT NULL," .
        "paid_amount INT NOT NULL DEFAULT 0," .
        "balance INT NOT NULL," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "voided_at TIMESTAMP NULL," .
        "voided_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY invoices_number_unique (invoice_number)," .
        "UNIQUE KEY invoices_shop_seq_unique (shop_id, sequence_number)," .
        "KEY invoices_shop_status_idx (shop_id, status)," .
        "KEY invoices_customer_idx (customer_id)," .
        "CONSTRAINT invoices_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT invoices_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customers(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT invoices_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT invoices_voided_by_user_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS invoice_lines (" .
        "id VARCHAR(191) NOT NULL," .
        "invoice_id VARCHAR(191) NOT NULL," .
        "sort_order INT NOT NULL DEFAULT 0," .
        "description VARCHAR(191) NOT NULL," .
        "quantity INT NOT NULL," .
        "unit_price INT NOT NULL," .
        "line_total INT NOT NULL," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY invoice_lines_invoice_id_idx (invoice_id)," .
        "CONSTRAINT invoice_lines_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS invoice_payments (" .
        "id VARCHAR(191) NOT NULL," .
        "invoice_id VARCHAR(191) NOT NULL," .
        "amount INT NOT NULL," .
        "method ENUM('CASH', 'MOBILE_MONEY', 'CARD') NOT NULL," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY invoice_payments_invoice_id_idx (invoice_id)," .
        "KEY invoice_payments_created_at_idx (created_at)," .
        "CONSTRAINT invoice_payments_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE," .
        "CONSTRAINT invoice_payments_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    echo "Phase 3 migration complete (customers + invoices + payments tables)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

