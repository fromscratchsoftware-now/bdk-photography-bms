<?php

declare(strict_types=1);

// Phase 9 migration: messaging templates + queue + delivery logs (SMS/WhatsApp/Email scaffolding).
// Intended to be run from CLI (SSH into SiteGround):
//   php scripts/migrate_phase9_messaging_notifications.php

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
      "CREATE TABLE IF NOT EXISTS messaging_templates (" .
        "id VARCHAR(191) NOT NULL," .
        "template_key VARCHAR(64) NOT NULL," .
        "channel ENUM('SMS', 'WHATSAPP', 'EMAIL') NOT NULL," .
        "subject VARCHAR(191) NULL," .
        "body TEXT NOT NULL," .
        "is_active TINYINT(1) NOT NULL DEFAULT 1," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "updated_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY messaging_templates_key_channel_unique (template_key, channel)," .
        "KEY messaging_templates_active_idx (is_active, template_key)," .
        "CONSTRAINT messaging_templates_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT messaging_templates_updated_by_user_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS messaging_queue (" .
        "id VARCHAR(191) NOT NULL," .
        "template_id VARCHAR(191) NULL," .
        "template_key VARCHAR(64) NOT NULL," .
        "channel ENUM('SMS', 'WHATSAPP', 'EMAIL') NOT NULL," .
        "recipient_type ENUM('CUSTOMER', 'USER', 'RAW') NOT NULL DEFAULT 'RAW'," .
        "recipient_customer_id VARCHAR(191) NULL," .
        "recipient_user_id VARCHAR(191) NULL," .
        "to_address VARCHAR(191) NOT NULL," .
        "rendered_subject VARCHAR(191) NULL," .
        "rendered_body TEXT NOT NULL," .
        "payload_json JSON NULL," .
        "status ENUM('QUEUED', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED'," .
        "dedupe_key VARCHAR(191) NULL," .
        "error_message TEXT NULL," .
        "notes TEXT NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "UNIQUE KEY messaging_queue_dedupe_unique (dedupe_key)," .
        "KEY messaging_queue_status_created_idx (status, created_at)," .
        "KEY messaging_queue_channel_created_idx (channel, created_at)," .
        "KEY messaging_queue_template_key_created_idx (template_key, created_at)," .
        "CONSTRAINT messaging_queue_template_id_fk FOREIGN KEY (template_id) REFERENCES messaging_templates(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT messaging_queue_customer_id_fk FOREIGN KEY (recipient_customer_id) REFERENCES customers(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT messaging_queue_user_id_fk FOREIGN KEY (recipient_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE," .
        "CONSTRAINT messaging_queue_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $db->exec(
      "CREATE TABLE IF NOT EXISTS messaging_delivery_logs (" .
        "id VARCHAR(191) NOT NULL," .
        "queue_id VARCHAR(191) NOT NULL," .
        "status ENUM('QUEUED', 'SENT', 'FAILED', 'CANCELLED') NOT NULL," .
        "message TEXT NULL," .
        "meta_json JSON NULL," .
        "created_by_user_id VARCHAR(191) NULL," .
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
        "PRIMARY KEY (id)," .
        "KEY messaging_delivery_logs_queue_created_idx (queue_id, created_at)," .
        "CONSTRAINT messaging_delivery_logs_queue_id_fk FOREIGN KEY (queue_id) REFERENCES messaging_queue(id) " .
          "ON DELETE CASCADE ON UPDATE CASCADE," .
        "CONSTRAINT messaging_delivery_logs_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) " .
          "ON DELETE SET NULL ON UPDATE CASCADE" .
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Seed default templates if missing. Templates are editable from the admin UI.
    $seedTemplates = [
      [
        "template_key" => "OVERDUE_INVOICE_REMINDER",
        "channel" => "SMS",
        "subject" => null,
        "body" =>
          "BDK Photography: Hello {{customerName}}. Your invoice {{invoiceNumber}} is overdue. Balance: UGX {{balanceUGX}}. Please pay to clear your balance. Thank you.",
      ],
      [
        "template_key" => "OVERDUE_INVOICE_REMINDER",
        "channel" => "WHATSAPP",
        "subject" => null,
        "body" =>
          "*BDK Photography*\\nHello {{customerName}}, your invoice *{{invoiceNumber}}* is overdue.\\nBalance: *UGX {{balanceUGX}}*\\nDue date: {{dueDate}}\\nThank you.",
      ],
      [
        "template_key" => "OVERDUE_INVOICE_REMINDER",
        "channel" => "EMAIL",
        "subject" => "BDK Photography overdue invoice {{invoiceNumber}}",
        "body" =>
          "Hello {{customerName}},\\n\\nYour invoice {{invoiceNumber}} is overdue.\\nDue date: {{dueDate}}\\nOutstanding balance: UGX {{balanceUGX}}\\n\\nThank you,\\nBDK Photography",
      ],
      [
        "template_key" => "ADMIN_DAILY_SUMMARY",
        "channel" => "WHATSAPP",
        "subject" => null,
        "body" =>
          "*BDK Daily Summary* ({{date}})\\nSales: UGX {{salesTotalUGX}} ({{salesCount}} sales)\\nCash at hand: UGX {{cashAtHandUGX}}\\nBanked (approved): UGX {{bankedUGX}}\\nCredit outstanding: UGX {{creditOutstandingUGX}}\\nOverdue invoices: {{overdueCount}}\\n",
      ],
      [
        "template_key" => "ADMIN_DAILY_SUMMARY",
        "channel" => "EMAIL",
        "subject" => "BDK Daily Summary ({{date}})",
        "body" =>
          "BDK Daily Summary ({{date}})\\n\\nSales: UGX {{salesTotalUGX}} ({{salesCount}} sales)\\nCash at hand: UGX {{cashAtHandUGX}}\\nBanked (approved): UGX {{bankedUGX}}\\nCredit outstanding: UGX {{creditOutstandingUGX}}\\nOverdue invoices: {{overdueCount}}\\n",
      ],
    ];

    $stmtInsert = $db->prepare(
      "INSERT INTO messaging_templates (id, template_key, channel, subject, body, is_active) " .
      "VALUES (:id, :template_key, :channel, :subject, :body, 1)"
    );
    foreach ($seedTemplates as $tpl) {
      $exists = $db->prepare("SELECT id FROM messaging_templates WHERE template_key = :k AND channel = :c LIMIT 1");
      $exists->execute([":k" => $tpl["template_key"], ":c" => $tpl["channel"]]);
      $row = $exists->fetch();
      if (is_array($row)) {
        continue;
      }

      $stmtInsert->execute([
        ":id" => "tpl_" . bin2hex(random_bytes(8)),
        ":template_key" => $tpl["template_key"],
        ":channel" => $tpl["channel"],
        ":subject" => $tpl["subject"],
        ":body" => $tpl["body"],
      ]);
    }

    echo "Phase 9 migration complete (messaging templates + queue + delivery logs)." . PHP_EOL;
    return 0;
  } catch (Throwable $error) {
    stderr("Migration failed: " . $error->getMessage());
    return 1;
  }
}

exit(main());

