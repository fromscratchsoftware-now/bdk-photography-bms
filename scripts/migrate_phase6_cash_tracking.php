<?php

declare(strict_types=1);

// Phase 6 migration: cash transfers, banking requests, and notifications tables for SiteGround Phase 1 API.
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase6_cash_tracking.php

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
      "CREATE TABLE IF NOT EXISTS cash_transfers (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "sender_user_id VARCHAR(191) NOT NULL," .
        "receiver_user_id VARCHAR(191) NOT NULL," .
        "amount_ugx INT NOT NULL," .
        "status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL," .
        "request_notes TEXT NULL," .
        "decision_notes TEXT NULL," .
        "decided_at TIMESTAMP NULL," .
        "decided_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY cash_transfers_shop_created_idx (shop_id, created_at)," .
        "KEY cash_transfers_sender_created_idx (sender_user_id, created_at)," .
        "KEY cash_transfers_receiver_created_idx (receiver_user_id, created_at)," .
        "KEY cash_transfers_status_created_idx (status, created_at)," .
        "CONSTRAINT cash_transfers_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT cash_transfers_sender_user_id_fk FOREIGN KEY (sender_user_id) REFERENCES users(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT cash_transfers_receiver_user_id_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT cash_transfers_decided_by_user_id_fk FOREIGN KEY (decided_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS banking_requests (" .
        "id VARCHAR(191) NOT NULL," .
        "shop_id VARCHAR(191) NOT NULL," .
        "user_id VARCHAR(191) NOT NULL," .
        "amount_ugx INT NOT NULL," .
        "status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL," .
        "request_notes TEXT NULL," .
        "decision_notes TEXT NULL," .
        "decided_at TIMESTAMP NULL," .
        "decided_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY banking_requests_shop_created_idx (shop_id, created_at)," .
        "KEY banking_requests_user_created_idx (user_id, created_at)," .
        "KEY banking_requests_status_created_idx (status, created_at)," .
        "CONSTRAINT banking_requests_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT banking_requests_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) " .
          "ON DELETE RESTRICT ON UPDATE CASCADE," .
        "CONSTRAINT banking_requests_decided_by_user_id_fk FOREIGN KEY (decided_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS notifications (" .
        "id VARCHAR(191) NOT NULL," .
        "user_id VARCHAR(191) NOT NULL," .
        "type VARCHAR(64) NOT NULL," .
        "title VARCHAR(191) NOT NULL," .
        "message TEXT NOT NULL," .
        "meta_json JSON NULL," .
        "is_read TINYINT(1) NOT NULL DEFAULT 0," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY notifications_user_created_idx (user_id, created_at)," .
        "KEY notifications_user_read_idx (user_id, is_read, created_at)," .
        "CONSTRAINT notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    echo "Phase 6 migration complete (cash transfers, banking requests, notifications)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

