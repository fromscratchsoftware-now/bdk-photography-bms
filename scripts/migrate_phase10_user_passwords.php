<?php

declare(strict_types=1);

// Phase 10 migration: user email + password reset tokens (supports Help docs + forgot-password flow).
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase10_user_passwords.php

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

function has_column(PDO $db, string $table, string $column): bool {
  $stmt = $db->prepare(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS " .
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column"
  );
  $stmt->execute([":table" => $table, ":column" => $column]);
  $row = $stmt->fetch();
  return is_array($row) && (int)($row["cnt"] ?? 0) > 0;
}

function template_exists(PDO $db, string $templateKey, string $channel): bool {
  $stmt = $db->prepare("SELECT id FROM messaging_templates WHERE template_key = :k AND channel = :c LIMIT 1");
  $stmt->execute([":k" => $templateKey, ":c" => $channel]);
  $row = $stmt->fetch();
  return is_array($row) && isset($row["id"]);
}

function table_exists(PDO $db, string $table): bool {
  $stmt = $db->prepare(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES " .
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"
  );
  $stmt->execute([":table" => $table]);
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

    // Users: add optional email + token versioning (for invalidating old JWTs after password changes).
    if (!has_column($db, "users", "email")) {
      $db->exec("ALTER TABLE users ADD COLUMN email VARCHAR(191) NULL AFTER phone");
      $db->exec("CREATE UNIQUE INDEX users_email_unique ON users(email)");
    }
    if (!has_column($db, "users", "token_version")) {
      $db->exec("ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER password_hash");
    }

    // Reset tokens (hash-only storage; never store raw token).
    $db->exec(
      "CREATE TABLE IF NOT EXISTS password_reset_tokens (" .
        "id VARCHAR(191) NOT NULL," .
        "user_id VARCHAR(191) NOT NULL," .
        "token_hash CHAR(64) NOT NULL," .
        "expires_at TIMESTAMP NOT NULL," .
        "used_at TIMESTAMP NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "notes TEXT NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY password_reset_tokens_hash_unique (token_hash)," .
        "KEY password_reset_tokens_user_idx (user_id, created_at)," .
        "KEY password_reset_tokens_expires_idx (expires_at)," .
        "CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE," .
        "CONSTRAINT password_reset_tokens_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Seed messaging templates when Phase 9 scaffolding exists.
    // Templates are editable from the admin UI.
    if (table_exists($db, "messaging_templates")) {
      $seedTemplates = [
        [
          "template_key" => "USER_PASSWORD_RESET",
          "channel" => "EMAIL",
          "subject" => "BDK Photography password reset",
          "body" =>
            "Hello {{fullName}},\\n\\nUse the link below to reset your password (expires in {{expiresMinutes}} minutes):\\n{{resetLink}}\\n\\nIf you did not request this, ignore this message.",
        ],
        [
          "template_key" => "USER_PASSWORD_RESET",
          "channel" => "WHATSAPP",
          "subject" => null,
          "body" =>
            "*BDK Photography*\\nPassword reset for {{fullName}}\\nReset link (expires in {{expiresMinutes}} minutes):\\n{{resetLink}}\\n\\nIf you did not request this, ignore this message.",
        ],
        [
          "template_key" => "USER_PASSWORD_RESET",
          "channel" => "SMS",
          "subject" => null,
          "body" =>
            "BDK Photography password reset for {{fullName}}. Link (expires in {{expiresMinutes}} min): {{resetLink}}",
        ],
      ];

      $stmtInsert = $db->prepare(
        "INSERT INTO messaging_templates (id, template_key, channel, subject, body, is_active) " .
        "VALUES (:id, :template_key, :channel, :subject, :body, 1)"
      );
      foreach ($seedTemplates as $tpl) {
        if (!template_exists($db, (string)$tpl["template_key"], (string)$tpl["channel"])) {
          $stmtInsert->execute([
            ":id" => "tpl_" . bin2hex(random_bytes(8)),
            ":template_key" => $tpl["template_key"],
            ":channel" => $tpl["channel"],
            ":subject" => $tpl["subject"],
            ":body" => $tpl["body"],
          ]);
        }
      }
    } else {
      stderr("Warning: messaging_templates not found (Phase 9 not migrated). Skipping USER_PASSWORD_RESET template seed.");
    }

    echo "Phase 10 migration complete (user password reset support)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());
