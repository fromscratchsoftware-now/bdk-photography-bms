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

function file_response(string $contentType, string $filename, string $body): void {
  http_response_code(200);
  header("Content-Type: " . $contentType);
  header("Content-Disposition: attachment; filename=\"" . $filename . "\"");
  header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
  header("Pragma: no-cache");
  header("Expires: 0");
  header("X-Content-Type-Options: nosniff");
  header("Content-Length: " . (string)strlen($body));
  echo $body;
  exit;
}

function safe_filename(string $value): string {
  $trimmed = trim($value);
  if ($trimmed === "") {
    return "download";
  }
  // Keep it ASCII and avoid path traversal. Replace everything else with underscores.
  $clean = preg_replace('/[^A-Za-z0-9._-]+/', '_', $trimmed);
  if (!is_string($clean) || $clean === "") {
    return "download";
  }
  return substr($clean, 0, 120);
}

function csv_bytes(array $rows): string {
  $fp = fopen("php://temp", "r+");
  if ($fp === false) {
    return "";
  }
  foreach ($rows as $row) {
    if (!is_array($row)) {
      continue;
    }
    fputcsv($fp, $row);
  }
  rewind($fp);
  $csv = stream_get_contents($fp);
  fclose($fp);
  return is_string($csv) ? $csv : "";
}

function text_table_lines(array $headers, array $rows, array $rightAlignCols = []): array {
  $colCount = count($headers);
  $widths = array_fill(0, $colCount, 0);

  for ($i = 0; $i < $colCount; $i++) {
    $widths[$i] = max($widths[$i], strlen((string)($headers[$i] ?? "")));
  }

  foreach ($rows as $row) {
    if (!is_array($row)) {
      continue;
    }
    for ($i = 0; $i < $colCount; $i++) {
      $value = isset($row[$i]) ? (string)$row[$i] : "";
      $widths[$i] = max($widths[$i], strlen($value));
    }
  }

  // Keep PDF line length sane; cap overly-wide columns.
  for ($i = 0; $i < $colCount; $i++) {
    $widths[$i] = min($widths[$i], 30);
  }

  $renderRow = function (array $row) use ($colCount, $widths, $rightAlignCols): string {
    $cells = [];
    for ($i = 0; $i < $colCount; $i++) {
      $raw = isset($row[$i]) ? (string)$row[$i] : "";
      $cell = strlen($raw) > $widths[$i] ? substr($raw, 0, max(0, $widths[$i] - 3)) . "..." : $raw;
      $pad = $widths[$i];
      if (in_array($i, $rightAlignCols, true)) {
        $cells[] = str_pad($cell, $pad, " ", STR_PAD_LEFT);
      } else {
        $cells[] = str_pad($cell, $pad, " ", STR_PAD_RIGHT);
      }
    }
    return implode(" | ", $cells);
  };

  $lines = [];
  $lines[] = $renderRow($headers);
  $sepParts = array_map(function ($w) { return str_repeat("-", max(1, $w)); }, $widths);
  $lines[] = implode("-+-", $sepParts);
  foreach ($rows as $row) {
    if (!is_array($row)) {
      continue;
    }
    $lines[] = $renderRow($row);
  }
  return $lines;
}

function xml_escape(string $value): string {
  return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, "UTF-8");
}

function xlsx_col_letters(int $col1Based): string {
  $letters = "";
  $n = $col1Based;
  while ($n > 0) {
    $n--;
    $letters = chr(($n % 26) + 65) . $letters;
    $n = intdiv($n, 26);
  }
  return $letters;
}

function xlsx_cell_ref(int $col1Based, int $row1Based): string {
  return xlsx_col_letters($col1Based) . (string)$row1Based;
}

function xlsx_sheet_xml(array $rows): string {
  $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>";
  $xml .= "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ";
  $xml .= "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">";
  $xml .= "<sheetData>";

  $rowNum = 1;
  foreach ($rows as $row) {
    if (!is_array($row)) {
      continue;
    }
    $xml .= "<row r=\"" . (string)$rowNum . "\">";
    $colNum = 1;
    foreach ($row as $cell) {
      $ref = xlsx_cell_ref($colNum, $rowNum);
      if (is_int($cell) || is_float($cell)) {
        $xml .= "<c r=\"" . $ref . "\" t=\"n\"><v>" . (string)$cell . "</v></c>";
      } else {
        $text = $cell === null ? "" : (string)$cell;
        $xml .= "<c r=\"" . $ref . "\" t=\"inlineStr\"><is><t>" . xml_escape($text) . "</t></is></c>";
      }
      $colNum++;
    }
    $xml .= "</row>";
    $rowNum++;
  }

  $xml .= "</sheetData></worksheet>";
  return $xml;
}

function xlsx_bytes(string $sheetName, array $rows): string {
  if (!class_exists("ZipArchive")) {
    json_response(500, ["error" => "InternalServerError", "message" => "ZipArchive is not available (cannot generate XLSX)"]);
  }

  $tmp = tempnam(sys_get_temp_dir(), "bdk_xlsx_");
  if ($tmp === false) {
    json_response(500, ["error" => "InternalServerError", "message" => "Failed to create temp file for XLSX"]);
  }

  $zip = new ZipArchive();
  if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    @unlink($tmp);
    json_response(500, ["error" => "InternalServerError", "message" => "Failed to open XLSX zip archive"]);
  }

  $sheetNameSafe = trim($sheetName) !== "" ? trim($sheetName) : "Sheet1";

  $zip->addFromString("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" .
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" .
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" .
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" .
    "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" .
    "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" .
    "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" .
    "</Types>"
  );

  $zip->addFromString("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" .
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" .
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" .
    "</Relationships>"
  );

  $zip->addFromString("xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" .
    "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" " .
      "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" .
      "<sheets>" .
        "<sheet name=\"" . xml_escape($sheetNameSafe) . "\" sheetId=\"1\" r:id=\"rId1\"/>" .
      "</sheets>" .
    "</workbook>"
  );

  $zip->addFromString("xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" .
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" .
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" .
    "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" .
    "</Relationships>"
  );

  $zip->addFromString("xl/styles.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" .
    "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" .
      "<fonts count=\"1\"><font><sz val=\"11\"/><color theme=\"1\"/><name val=\"Calibri\"/><family val=\"2\"/></font></fonts>" .
      "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills>" .
      "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" .
      "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" .
      "<cellXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs>" .
      "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" .
    "</styleSheet>"
  );

  $zip->addFromString("xl/worksheets/sheet1.xml", xlsx_sheet_xml($rows));

  $zip->close();

  $bytes = file_get_contents($tmp);
  @unlink($tmp);
  return is_string($bytes) ? $bytes : "";
}

function pdf_escape_text(string $value): string {
  $value = str_replace("\\", "\\\\", $value);
  $value = str_replace("(", "\\(", $value);
  $value = str_replace(")", "\\)", $value);
  $value = str_replace("\r", "", $value);
  $value = str_replace("\n", "", $value);
  return $value;
}

function pdf_build(string $title, array $lines): string {
  $pageWidth = 595;
  $pageHeight = 842;
  $marginX = 40;
  $marginTop = 50;
  $marginBottom = 50;
  $fontSize = 10;
  $lineHeight = 12;
  $maxLinesPerPage = (int)floor(($pageHeight - $marginTop - $marginBottom) / $lineHeight);

  $wrapped = [];
  foreach ($lines as $line) {
    if (!is_string($line)) {
      continue;
    }
    $text = $line;
    // Conservative wrap; Courier at 10pt fits ~95 chars with margins.
    while (strlen($text) > 95) {
      $wrapped[] = substr($text, 0, 95);
      $text = substr($text, 95);
    }
    $wrapped[] = $text;
  }

  $allLines = array_merge([$title, str_repeat("-", min(95, max(10, strlen($title))))], $wrapped);

  $pages = [];
  for ($i = 0; $i < count($allLines); $i += $maxLinesPerPage) {
    $pages[] = array_slice($allLines, $i, $maxLinesPerPage);
  }
  if (count($pages) < 1) {
    $pages[] = [$title];
  }

  $objects = [];
  $offsets = [];

  $addObject = function (string $body) use (&$objects): int {
    $objects[] = $body;
    return count($objects);
  };

  $fontObj = $addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  $resourcesObj = $addObject("<< /Font << /F1 " . $fontObj . " 0 R >> >>");

  $pageKids = [];
  foreach ($pages as $pageLines) {
    $content = "BT\n/F1 " . $fontSize . " Tf\n" .
      $marginX . " " . ($pageHeight - $marginTop) . " Td\n" .
      $lineHeight . " TL\n";
    foreach ($pageLines as $line) {
      $content .= "(" . pdf_escape_text((string)$line) . ") Tj\nT*\n";
    }
    $content .= "ET\n";
    $stream = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "endstream";
    $contentObj = $addObject($stream);

    $pageObj = $addObject(
      "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 " . $pageWidth . " " . $pageHeight . "] " .
        "/Resources " . $resourcesObj . " 0 R /Contents " . $contentObj . " 0 R >>"
    );
    $pageKids[] = $pageObj;
  }

  $kidsRefs = array_map(function ($id) { return $id . " 0 R"; }, $pageKids);
  $pagesObj = $addObject("<< /Type /Pages /Kids [" . implode(" ", $kidsRefs) . "] /Count " . count($pageKids) . " >>");

  // Patch Parent reference now that we know pages object id.
  foreach ($pageKids as $idx => $pageObjId) {
    $objects[$pageObjId - 1] = str_replace("/Parent 0 0 R", "/Parent " . $pagesObj . " 0 R", $objects[$pageObjId - 1]);
  }

  $catalogObj = $addObject("<< /Type /Catalog /Pages " . $pagesObj . " 0 R >>");

  $pdf = "%PDF-1.4\n";
  $offsets[0] = 0;
  for ($i = 0; $i < count($objects); $i++) {
    $offsets[$i + 1] = strlen($pdf);
    $pdf .= ($i + 1) . " 0 obj\n" . $objects[$i] . "\nendobj\n";
  }

  $xrefPos = strlen($pdf);
  $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
  $pdf .= "0000000000 65535 f \n";
  for ($i = 1; $i <= count($objects); $i++) {
    $pdf .= str_pad((string)$offsets[$i], 10, "0", STR_PAD_LEFT) . " 00000 n \n";
  }
  $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root " . $catalogObj . " 0 R >>\n";
  $pdf .= "startxref\n" . $xrefPos . "\n%%EOF";
  return $pdf;
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

function get_authorization_header(): ?string {
  $direct = get_header_value("Authorization");
  if ($direct) {
    return $direct;
  }
  // Some hosting setups forward Authorization via this alternate key.
  if (isset($_SERVER["REDIRECT_HTTP_AUTHORIZATION"]) && is_string($_SERVER["REDIRECT_HTTP_AUTHORIZATION"]) && $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] !== "") {
    return $_SERVER["REDIRECT_HTTP_AUTHORIZATION"];
  }
  return null;
}

function base64url_encode(string $data): string {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
}

function base64url_decode(string $data): string {
  $decoded = strtr($data, "-_", "+/");
  $pad = strlen($decoded) % 4;
  if ($pad > 0) {
    $decoded .= str_repeat("=", 4 - $pad);
  }
  $raw = base64_decode($decoded, true);
  return $raw === false ? "" : $raw;
}

function jwt_secret(): string {
  $secret = (string)(getenv("BDK_JWT_SECRET") ?: (getenv("JWT_SECRET") ?: ""));
  if (strlen($secret) < 32) {
    json_response(500, ["error" => "ConfigError", "message" => "Set BDK_JWT_SECRET (>=32 chars) in .env"]);
  }
  return $secret;
}

function jwt_ttl_seconds(): int {
  $raw = (string)(getenv("BDK_JWT_TTL_SECONDS") ?: "");
  $ttl = $raw !== "" ? (int)$raw : 43200; // 12h
  return $ttl > 0 ? $ttl : 43200;
}

function jwt_sign(string $userId): string {
  $header = ["alg" => "HS256", "typ" => "JWT"];
  $now = time();
  $payload = ["sub" => $userId, "iat" => $now, "exp" => $now + jwt_ttl_seconds()];

  $encodedHeader = base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
  $encodedPayload = base64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
  $unsigned = $encodedHeader . "." . $encodedPayload;
  $signature = hash_hmac("sha256", $unsigned, jwt_secret(), true);
  return $unsigned . "." . base64url_encode($signature);
}

function jwt_verify(string $token): array {
  $parts = explode(".", $token);
  if (count($parts) !== 3) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }
  [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
  $unsigned = $encodedHeader . "." . $encodedPayload;
  $expectedSignature = hash_hmac("sha256", $unsigned, jwt_secret(), true);
  $signature = base64url_decode($encodedSignature);
  if ($signature === "" || !hash_equals($expectedSignature, $signature)) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $payloadRaw = base64url_decode($encodedPayload);
  $payload = json_decode($payloadRaw, true);
  if (!is_array($payload) || !isset($payload["sub"]) || !is_string($payload["sub"])) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $exp = isset($payload["exp"]) ? (int)$payload["exp"] : 0;
  if ($exp > 0 && time() > $exp) {
    json_response(401, ["error" => "HttpError", "message" => "Token expired"]);
  }

  return $payload;
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

  // Keep DB timestamps consistent across environments.
  $pdo->exec("SET time_zone = '+00:00'");

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

function phase1_db_fetch_one(PDO $pdo, string $sql, array $params): ?array {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $row = $stmt->fetch();
  return is_array($row) ? $row : null;
}

function phase1_db_fetch_all(PDO $pdo, string $sql, array $params): array {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();
  return is_array($rows) ? $rows : [];
}

function phase1_db_execute(PDO $pdo, string $sql, array $params): int {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  return (int)$stmt->rowCount();
}

function phase1_audit_log(PDO $pdo, ?string $actorUserId, string $action, string $entityType, ?string $entityId, $before, $after, ?string $notes = null): void {
  $beforeJson = $before === null ? null : json_encode($before, JSON_UNESCAPED_SLASHES);
  $afterJson = $after === null ? null : json_encode($after, JSON_UNESCAPED_SLASHES);

  $stmt = $pdo->prepare(
    "INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_json, after_json, notes) " .
    "VALUES (:id, :actor_user_id, :action, :entity_type, :entity_id, :before_json, :after_json, :notes)"
  );
  $stmt->execute([
    ":id" => create_id("audit"),
    ":actor_user_id" => $actorUserId,
    ":action" => $action,
    ":entity_type" => $entityType,
    ":entity_id" => $entityId,
    ":before_json" => $beforeJson,
    ":after_json" => $afterJson,
    ":notes" => $notes,
  ]);
}

function phase1_load_assignments(PDO $pdo, string $userId): array {
  return phase1_db_fetch_all(
    $pdo,
    "SELECT a.id, a.shop_id, a.is_primary, a.assigned_at, a.unassigned_at, a.notes, a.created_at, a.updated_at, " .
      "s.name AS shop_name, s.code AS shop_code " .
    "FROM user_shop_assignment a " .
    "JOIN shops s ON s.id = a.shop_id " .
    "WHERE a.user_id = :user_id AND a.unassigned_at IS NULL " .
    "ORDER BY a.is_primary DESC, a.assigned_at DESC",
    [":user_id" => $userId]
  );
}

function phase1_find_user_by_phone(PDO $pdo, string $phone): ?array {
  return phase1_db_fetch_one(
    $pdo,
    "SELECT u.id, u.full_name, u.phone, u.password_hash, u.role_id, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
    "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.phone = :phone LIMIT 1",
    [":phone" => $phone]
  );
}

function phase1_find_user_by_id(PDO $pdo, string $userId): ?array {
  return phase1_db_fetch_one(
    $pdo,
    "SELECT u.id, u.full_name, u.phone, u.password_hash, u.role_id, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
    "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1",
    [":id" => $userId]
  );
}

function phase1_public_user(array $user, array $assignments): array {
  return [
    "id" => (string)$user["id"],
    "fullName" => (string)$user["full_name"],
    "mobileNumber" => (string)$user["phone"],
    "role" => (string)$user["role_name"],
    "notes" => $user["notes"] ?? null,
    "createdAt" => (string)$user["created_at"],
    "updatedAt" => (string)$user["updated_at"],
    "shops" => array_map(function ($row) {
      return [
        "shopId" => (string)($row["shop_id"] ?? ""),
        "code" => (string)($row["shop_code"] ?? ""),
        "name" => (string)($row["shop_name"] ?? ""),
        "isPrimary" => (bool)($row["is_primary"] ?? false),
      ];
    }, $assignments),
  ];
}

function phase1_require_auth(PDO $pdo): array {
  $authHeader = get_authorization_header();
  if (!$authHeader) {
    json_response(401, ["error" => "HttpError", "message" => "Missing Authorization header"]);
  }

  $token = "";
  if (stripos($authHeader, "Bearer ") === 0) {
    $token = trim(substr($authHeader, 7));
  }
  if ($token === "") {
    json_response(401, ["error" => "HttpError", "message" => "Invalid Authorization header"]);
  }

  $payload = jwt_verify($token);
  $userId = (string)($payload["sub"] ?? "");
  if ($userId === "") {
    json_response(401, ["error" => "HttpError", "message" => "Invalid token"]);
  }

  $user = phase1_find_user_by_id($pdo, $userId);
  if (!$user || (int)($user["is_active"] ?? 0) !== 1) {
    json_response(401, ["error" => "HttpError", "message" => "Invalid user"]);
  }

  $assignments = phase1_load_assignments($pdo, (string)$user["id"]);
  return ["user" => $user, "assignments" => $assignments];
}

function phase1_require_role(string $roleName, array $allowed): void {
  if (!in_array($roleName, $allowed, true)) {
    json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
  }
}

function phase1_assigned_shop_ids(array $assignments): array {
  $shopIds = [];
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      $shopIds[] = $shopId;
    }
  }
  // Preserve order but dedupe.
  $seen = [];
  $unique = [];
  foreach ($shopIds as $id) {
    if (isset($seen[$id])) {
      continue;
    }
    $seen[$id] = true;
    $unique[] = $id;
  }
  return $unique;
}

function phase1_primary_shop_id(array $assignments): string {
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    if ((int)($row["is_primary"] ?? 0) !== 1) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      return $shopId;
    }
  }
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    $shopId = isset($row["shop_id"]) && is_string($row["shop_id"]) ? $row["shop_id"] : "";
    if ($shopId !== "") {
      return $shopId;
    }
  }
  return "";
}

function phase1_require_shop_access(string $roleName, array $assignments, string $shopId): void {
  if ($roleName === "ADMIN") {
    return;
  }
  foreach ($assignments as $row) {
    if (!is_array($row)) {
      continue;
    }
    if (($row["shop_id"] ?? null) === $shopId) {
      return;
    }
  }
  json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
}

function phase1_business_tz_id(): string {
  $raw = (string)(getenv("BDK_BUSINESS_TZ") ?: "");
  $tz = trim($raw);
  return $tz !== "" ? $tz : "Africa/Kampala";
}

function phase1_business_today_ymd(): string {
  try {
    $dt = new DateTime("now", new DateTimeZone(phase1_business_tz_id()));
    return $dt->format("Y-m-d");
  } catch (Throwable $error) {
    // Fallback to UTC if timezone config is invalid.
    return gmdate("Y-m-d");
  }
}

function phase1_is_shop_date_locked(PDO $pdo, string $shopId, string $lockDateYmd): bool {
  if ($shopId === "" || $lockDateYmd === "") {
    return false;
  }
  $row = phase1_db_fetch_one(
    $pdo,
    "SELECT id FROM reconciliation_locks WHERE shop_id = :shop_id AND lock_date = :lock_date LIMIT 1",
    [":shop_id" => $shopId, ":lock_date" => $lockDateYmd]
  );
  return $row !== null;
}

function phase1_cash_summary(PDO $pdo, string $userId): array {
  $cashSalesRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(total_amount), 0) AS total " .
      "FROM sales WHERE user_id = :user_id AND payment_method = 'CASH' AND is_void = 0",
    [":user_id" => $userId]
  );
  $cashSales = $cashSalesRow ? (int)($cashSalesRow["total"] ?? 0) : 0;

  // Installment payments collected as cash also increase cash at hand.
  $cashPaymentsRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount), 0) AS total " .
      "FROM invoice_payments WHERE created_by_user_id = :user_id AND method = 'CASH'",
    [":user_id" => $userId]
  );
  $cashInvoicePayments = $cashPaymentsRow ? (int)($cashPaymentsRow["total"] ?? 0) : 0;

  $cashExpensesRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM expenses WHERE paid_by_user_id = :user_id AND payment_source = 'SALESPERSON_CASH' AND is_void = 0",
    [":user_id" => $userId]
  );
  $cashExpenses = $cashExpensesRow ? (int)($cashExpensesRow["total"] ?? 0) : 0;

  $sentRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM cash_transfers WHERE sender_user_id = :user_id AND status = 'APPROVED'",
    [":user_id" => $userId]
  );
  $transfersSent = $sentRow ? (int)($sentRow["total"] ?? 0) : 0;

  $receivedRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM cash_transfers WHERE receiver_user_id = :user_id AND status = 'APPROVED'",
    [":user_id" => $userId]
  );
  $transfersReceived = $receivedRow ? (int)($receivedRow["total"] ?? 0) : 0;

  $bankedRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM banking_requests WHERE user_id = :user_id AND status = 'APPROVED'",
    [":user_id" => $userId]
  );
  $banked = $bankedRow ? (int)($bankedRow["total"] ?? 0) : 0;

  $cashAtHand = $cashSales + $cashInvoicePayments - $cashExpenses - $transfersSent + $transfersReceived - $banked;

  return [
    "cashAtHand" => $cashAtHand,
    "cashSales" => $cashSales,
    "cashInvoicePayments" => $cashInvoicePayments,
    "cashExpenses" => $cashExpenses,
    "transfersSent" => $transfersSent,
    "transfersReceived" => $transfersReceived,
    "banked" => $banked,
  ];
}

function phase1_cash_summary_as_of(PDO $pdo, string $userId, string $asOfYmd): array {
  $asOf = trim($asOfYmd);
  if ($asOf === "" || !is_valid_ymd_date($asOf)) {
    $asOf = phase1_business_today_ymd();
  }

  $cashSalesRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(total_amount), 0) AS total " .
      "FROM sales WHERE user_id = :user_id AND payment_method = 'CASH' AND is_void = 0 AND sale_date <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $cashSales = $cashSalesRow ? (int)($cashSalesRow["total"] ?? 0) : 0;

  $cashPaymentsRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount), 0) AS total " .
      "FROM invoice_payments WHERE created_by_user_id = :user_id AND method = 'CASH' AND DATE(created_at) <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $cashInvoicePayments = $cashPaymentsRow ? (int)($cashPaymentsRow["total"] ?? 0) : 0;

  $cashExpensesRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM expenses WHERE paid_by_user_id = :user_id AND payment_source = 'SALESPERSON_CASH' AND is_void = 0 AND expense_date <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $cashExpenses = $cashExpensesRow ? (int)($cashExpensesRow["total"] ?? 0) : 0;

  $sentRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM cash_transfers WHERE sender_user_id = :user_id AND status = 'APPROVED' AND decided_at IS NOT NULL AND DATE(decided_at) <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $transfersSent = $sentRow ? (int)($sentRow["total"] ?? 0) : 0;

  $receivedRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM cash_transfers WHERE receiver_user_id = :user_id AND status = 'APPROVED' AND decided_at IS NOT NULL AND DATE(decided_at) <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $transfersReceived = $receivedRow ? (int)($receivedRow["total"] ?? 0) : 0;

  $bankedRow = phase1_db_fetch_one(
    $pdo,
    "SELECT COALESCE(SUM(amount_ugx), 0) AS total " .
      "FROM banking_requests WHERE user_id = :user_id AND status = 'APPROVED' AND decided_at IS NOT NULL AND DATE(decided_at) <= :as_of",
    [":user_id" => $userId, ":as_of" => $asOf]
  );
  $banked = $bankedRow ? (int)($bankedRow["total"] ?? 0) : 0;

  $cashAtHand = $cashSales + $cashInvoicePayments - $cashExpenses - $transfersSent + $transfersReceived - $banked;

  return [
    "asOf" => $asOf,
    "cashAtHand" => $cashAtHand,
    "cashSales" => $cashSales,
    "cashInvoicePayments" => $cashInvoicePayments,
    "cashExpenses" => $cashExpenses,
    "transfersSent" => $transfersSent,
    "transfersReceived" => $transfersReceived,
    "banked" => $banked,
  ];
}

function phase1_cash_at_hand(PDO $pdo, string $userId): int {
  $summary = phase1_cash_summary($pdo, $userId);
  return (int)($summary["cashAtHand"] ?? 0);
}

function phase1_date_add_days(string $ymd, int $days): string {
  try {
    $dt = new DateTime($ymd, new DateTimeZone(phase1_business_tz_id()));
    $dt->modify(($days >= 0 ? "+" : "") . (string)$days . " days");
    return $dt->format("Y-m-d");
  } catch (Throwable $error) {
    return $ymd;
  }
}

function phase1_resolve_date_range(?string $dateFrom, ?string $dateTo, int $defaultDays): array {
  $to = is_string($dateTo) ? trim($dateTo) : "";
  if ($to === "") {
    $to = phase1_business_today_ymd();
  }
  if (!is_valid_ymd_date($to)) {
    json_response(400, ["error" => "ValidationError", "message" => "dateTo must be YYYY-MM-DD"]);
  }

  $from = is_string($dateFrom) ? trim($dateFrom) : "";
  if ($from === "") {
    $from = phase1_date_add_days($to, -max(0, $defaultDays - 1));
  }
  if (!is_valid_ymd_date($from)) {
    json_response(400, ["error" => "ValidationError", "message" => "dateFrom must be YYYY-MM-DD"]);
  }
  if ($from > $to) {
    json_response(400, ["error" => "ValidationError", "message" => "dateFrom must be <= dateTo"]);
  }

  return ["dateFrom" => $from, "dateTo" => $to];
}

function phase1_shop_scope_sql(string $roleName, array $assignments, string $requestedShopId, string $column, array &$params): string {
  $shopId = trim($requestedShopId);
  if ($shopId !== "") {
    phase1_require_shop_access($roleName, $assignments, $shopId);
    $params[":shop_id"] = $shopId;
    return " AND " . $column . " = :shop_id";
  }
  if ($roleName === "ADMIN") {
    return "";
  }
  $shopIds = phase1_assigned_shop_ids($assignments);
  if (count($shopIds) < 1) {
    return " AND 1=0";
  }
  $placeholders = [];
  foreach ($shopIds as $idx => $id) {
    $key = ":shop_" . (string)$idx;
    $placeholders[] = $key;
    $params[$key] = $id;
  }
  return " AND " . $column . " IN (" . implode(", ", $placeholders) . ")";
}

function phase1_handle(string $method, string $route): void {
  $pdo = mysql_pdo();

  if ($method === "GET" && $route === "health") {
    json_response(200, ["status" => "ok", "service" => "bdk-api", "timestamp" => now_iso(), "mode" => "phase1"]);
  }

  if ($method === "POST" && $route === "auth/login") {
    $body = read_json_body();
    $mobile = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
    $password = isset($body["password"]) && is_string($body["password"]) ? $body["password"] : "";

    if ($mobile === "" || $password === "") {
      json_response(400, ["error" => "ValidationError", "message" => "mobileNumber and password are required"]);
    }

    $user = phase1_find_user_by_phone($pdo, $mobile);
    if (!$user || (int)($user["is_active"] ?? 0) !== 1) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    $hash = (string)($user["password_hash"] ?? "");
    if ($hash === "" || !password_verify($password, $hash)) {
      json_response(401, ["error" => "HttpError", "message" => "Invalid credentials"]);
    }

    $assignments = phase1_load_assignments($pdo, (string)$user["id"]);
    $token = jwt_sign((string)$user["id"]);
    json_response(200, ["data" => ["token" => $token, "user" => phase1_public_user($user, $assignments)]]);
  }

  $auth = phase1_require_auth($pdo);
  $authUser = $auth["user"];
  $roleName = (string)($authUser["role_name"] ?? "");
  $assignments = $auth["assignments"];

  if ($method === "GET" && $route === "auth/me") {
    json_response(200, ["data" => phase1_public_user($authUser, $assignments)]);
  }

  if ($method === "GET" && $route === "shops") {
    if ($roleName === "ADMIN") {
      $rows = phase1_db_fetch_all($pdo, "SELECT id, name, code, notes, created_at, updated_at FROM shops ORDER BY name ASC", []);
      $shops = array_map(function ($row) {
        return [
          "id" => (string)($row["id"] ?? ""),
          "name" => (string)($row["name"] ?? ""),
          "code" => (string)($row["code"] ?? ""),
          "notes" => $row["notes"] ?? null,
          "createdAt" => (string)($row["created_at"] ?? ""),
          "updatedAt" => (string)($row["updated_at"] ?? ""),
        ];
      }, $rows);
      json_response(200, ["data" => $shops]);
    }

    $shops = [];
    foreach ($assignments as $row) {
      $shops[] = [
        "id" => (string)($row["shop_id"] ?? ""),
        "name" => (string)($row["shop_name"] ?? ""),
        "code" => (string)($row["shop_code"] ?? ""),
      ];
    }
    json_response(200, ["data" => $shops]);
  }

  if ($method === "GET" && $route === "users") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    if ($roleName === "ADMIN") {
      $rows = phase1_db_fetch_all(
        $pdo,
        "SELECT u.id, u.full_name, u.phone, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
        "FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC",
        []
      );
      $users = array_map(function ($row) use ($pdo) {
        $assignments = phase1_load_assignments($pdo, (string)$row["id"]);
        return phase1_public_user($row, $assignments);
      }, $rows);
      json_response(200, ["data" => $users]);
    }

    // Manager: only sales users in the manager's shops.
    $shopIds = [];
    foreach ($assignments as $row) {
      $shopId = (string)($row["shop_id"] ?? "");
      if ($shopId !== "") {
        $shopIds[] = $shopId;
      }
    }
    if (count($shopIds) < 1) {
      json_response(200, ["data" => []]);
    }

    $placeholders = [];
    $params = [];
    foreach ($shopIds as $idx => $shopId) {
      $key = ":shop_" . (string)$idx;
      $placeholders[] = $key;
      $params[$key] = $shopId;
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT DISTINCT u.id, u.full_name, u.phone, u.is_active, u.notes, u.created_at, u.updated_at, r.name AS role_name " .
      "FROM users u " .
      "JOIN roles r ON r.id = u.role_id " .
      "JOIN user_shop_assignment a ON a.user_id = u.id AND a.unassigned_at IS NULL " .
      "WHERE r.name = 'SALES' AND a.shop_id IN (" . implode(", ", $placeholders) . ") " .
      "ORDER BY u.created_at DESC",
      $params
    );

    $users = array_map(function ($row) use ($pdo) {
      $assignments = phase1_load_assignments($pdo, (string)$row["id"]);
      return phase1_public_user($row, $assignments);
    }, $rows);

    json_response(200, ["data" => $users]);
  }

  if ($method === "GET" && $route === "expense-categories") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $where = $roleName === "ADMIN" ? "" : "WHERE is_active = 1 ";
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories " . $where . "ORDER BY name ASC",
      []
    );
    $categories = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $categories]);
  }

  if ($method === "POST" && $route === "expense-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $notes = isset($body["notes"]) && is_string($body["notes"]) ? trim($body["notes"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($name === "") {
      json_response(400, ["error" => "ValidationError", "message" => "name is required"]);
    }

    $id = create_id("expcat");

    try {
      $stmt = $pdo->prepare("INSERT INTO expense_categories (id, name, is_active, notes) VALUES (:id, :name, :is_active, :notes)");
      $stmt->execute([
        ":id" => $id,
        ":name" => $name,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => $notes !== "" ? $notes : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Expense category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create expense category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created expense category"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "expense_category", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^expense-categories\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Expense category not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $updates[] = "name = :name";
      $params[":name"] = $value;
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE expense_categories SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Expense category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update expense category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated expense category"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "name" => (string)$existing["name"],
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "expense_category", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "expenses") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $expenseDate = isset($_GET["expenseDate"]) && is_string($_GET["expenseDate"]) ? trim($_GET["expenseDate"]) : "";
    $dateFrom = isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? trim($_GET["dateFrom"]) : "";
    $dateTo = isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? trim($_GET["dateTo"]) : "";

    if ($expenseDate !== "" && !is_valid_ymd_date($expenseDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "expenseDate must be YYYY-MM-DD"]);
    }
    if ($dateFrom !== "" && !is_valid_ymd_date($dateFrom)) {
      json_response(400, ["error" => "ValidationError", "message" => "dateFrom must be YYYY-MM-DD"]);
    }
    if ($dateTo !== "" && !is_valid_ymd_date($dateTo)) {
      json_response(400, ["error" => "ValidationError", "message" => "dateTo must be YYYY-MM-DD"]);
    }

    $where = [];
    $params = [];

    if ($shopId !== "") {
      phase1_require_shop_access($roleName, $assignments, $shopId);
      $where[] = "e.shop_id = :shop_id";
      $params[":shop_id"] = $shopId;
    } elseif ($roleName !== "ADMIN") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $id) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $id;
      }
      $where[] = "e.shop_id IN (" . implode(", ", $placeholders) . ")";
    }

    if ($expenseDate !== "") {
      $where[] = "e.expense_date = :expense_date";
      $params[":expense_date"] = $expenseDate;
    }
    if ($dateFrom !== "") {
      $where[] = "e.expense_date >= :date_from";
      $params[":date_from"] = $dateFrom;
    }
    if ($dateTo !== "") {
      $where[] = "e.expense_date <= :date_to";
      $params[":date_to"] = $dateTo;
    }

    if ($roleName === "SALES") {
      // Sales can view admin/bank expenses for their shop(s) and their own salesperson-cash expenses.
      $userId = (string)($authUser["id"] ?? "");
      $where[] = "(e.payment_source = 'ADMIN_BANK' OR e.paid_by_user_id = :viewer_user_id)";
      $params[":viewer_user_id"] = $userId;
    }

    if (count($where) < 1) {
      $where[] = "1=1";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT e.id, e.shop_id, sh.code AS shop_code, sh.name AS shop_name, e.category_id, c.name AS category_name, " .
        "e.amount_ugx, e.expense_date, e.notes, e.payment_source, e.paid_by_user_id, pu.full_name AS paid_by_full_name, " .
        "e.recorded_by_user_id, ru.full_name AS recorded_by_full_name, e.is_void, e.voided_at, e.voided_by_user_id, " .
        "vu.full_name AS voided_by_full_name, e.created_at, e.updated_at " .
      "FROM expenses e " .
      "JOIN shops sh ON sh.id = e.shop_id " .
      "JOIN expense_categories c ON c.id = e.category_id " .
      "LEFT JOIN users pu ON pu.id = e.paid_by_user_id " .
      "LEFT JOIN users ru ON ru.id = e.recorded_by_user_id " .
      "LEFT JOIN users vu ON vu.id = e.voided_by_user_id " .
      "WHERE " . implode(" AND ", $where) . " " .
      "ORDER BY e.expense_date DESC, e.created_at DESC " .
      "LIMIT 200",
      $params
    );

    $expenses = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "categoryId" => (string)($row["category_id"] ?? ""),
        "categoryName" => (string)($row["category_name"] ?? ""),
        "amountUGX" => (int)($row["amount_ugx"] ?? 0),
        "expenseDate" => (string)($row["expense_date"] ?? ""),
        "notes" => $row["notes"] ?? null,
        "paymentSource" => (string)($row["payment_source"] ?? ""),
        "paidByUserId" => $row["paid_by_user_id"] ?? null,
        "paidByFullName" => $row["paid_by_full_name"] ?? null,
        "recordedByUserId" => $row["recorded_by_user_id"] ?? null,
        "recordedByFullName" => $row["recorded_by_full_name"] ?? null,
        "isVoid" => (int)($row["is_void"] ?? 0) === 1,
        "voidedAt" => $row["voided_at"] ?? null,
        "voidedByUserId" => $row["voided_by_user_id"] ?? null,
        "voidedByFullName" => $row["voided_by_full_name"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $expenses]);
  }

  if ($method === "POST" && $route === "expenses") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $requestedShopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
    $categoryId = isset($body["categoryId"]) && is_string($body["categoryId"]) ? trim($body["categoryId"]) : "";
    $amount = isset($body["amountUGX"]) ? (int)$body["amountUGX"] : 0;
    $expenseDate = isset($body["date"]) && is_string($body["date"]) ? trim($body["date"]) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $paymentSource = isset($body["paymentSource"]) && is_string($body["paymentSource"]) ? trim($body["paymentSource"]) : "";
    $paidByUserId = isset($body["paidByUserId"]) && is_string($body["paidByUserId"]) ? trim($body["paidByUserId"]) : "";

    if ($categoryId === "" || $amount <= 0 || $paymentSource === "") {
      json_response(400, ["error" => "ValidationError", "message" => "categoryId, amountUGX (>0), and paymentSource are required"]);
    }
    if (!in_array($paymentSource, ["SALESPERSON_CASH", "ADMIN_BANK"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "paymentSource must be SALESPERSON_CASH or ADMIN_BANK"]);
    }
    if ($expenseDate === "") {
      $expenseDate = phase1_business_today_ymd();
    }
    if (!is_valid_ymd_date($expenseDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "date must be YYYY-MM-DD"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $shopId = $requestedShopId;
    $actorUserId = (string)($authUser["id"] ?? "");

    if ($roleName !== "ADMIN") {
      $shopId = phase1_primary_shop_id($assignments);
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "Sales user is not assigned to a shop"]);
      }
    } else {
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "shopId is required"]);
      }
    }

    phase1_require_shop_access($roleName, $assignments, $shopId);

    if ($paymentSource === "ADMIN_BANK") {
      phase1_require_role($roleName, ["ADMIN"]);
      $paidByUserId = "";
    }

    if ($paymentSource === "SALESPERSON_CASH") {
      if ($roleName === "SALES") {
        $paidByUserId = $actorUserId;
      } else {
        if ($paidByUserId === "") {
          json_response(400, ["error" => "ValidationError", "message" => "paidByUserId is required for SALESPERSON_CASH expenses"]);
        }
      }
    }

    $categoryRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active FROM expense_categories WHERE id = :id LIMIT 1",
      [":id" => $categoryId]
    );
    if (!$categoryRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid categoryId"]);
    }
    if ((int)($categoryRow["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Expense category is inactive"]);
    }

    $paidByRow = null;
    if ($paymentSource === "SALESPERSON_CASH") {
      $paidByRow = phase1_db_fetch_one(
        $pdo,
        "SELECT u.id, u.full_name, r.name AS role_name " .
        "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1",
        [":id" => $paidByUserId]
      );
      if (!$paidByRow) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid paidByUserId"]);
      }
      if ((string)($paidByRow["role_name"] ?? "") !== "SALES") {
        json_response(400, ["error" => "ValidationError", "message" => "paidByUserId must be a SALES user"]);
      }
      if ($roleName === "SALES" && $paidByUserId !== $actorUserId) {
        json_response(403, ["error" => "HttpError", "message" => "Cannot record salesperson-cash expense for another user"]);
      }

      // Negative cash blocking (admin override is implicit by role).
      if ($roleName !== "ADMIN") {
        $summary = phase1_cash_summary($pdo, $paidByUserId);
        $available = (int)($summary["cashAtHand"] ?? 0);
        $available = max(0, $available);
        if ($available < $amount) {
          json_response(400, [
            "error" => "BadRequest",
            "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
          ]);
        }
      }
    }

    $expenseId = create_id("exp");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO expenses (id, shop_id, category_id, amount_ugx, expense_date, notes, payment_source, paid_by_user_id, recorded_by_user_id) " .
        "VALUES (:id, :shop_id, :category_id, :amount_ugx, :expense_date, :notes, :payment_source, :paid_by_user_id, :recorded_by_user_id)"
      );
      $stmt->execute([
        ":id" => $expenseId,
        ":shop_id" => $shopId,
        ":category_id" => $categoryId,
        ":amount_ugx" => $amount,
        ":expense_date" => $expenseDate,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ":payment_source" => $paymentSource,
        ":paid_by_user_id" => $paidByUserId !== "" ? $paidByUserId : null,
        ":recorded_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
      ]);
    } catch (Throwable $error) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create expense"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT e.id, e.shop_id, sh.code AS shop_code, sh.name AS shop_name, e.category_id, c.name AS category_name, " .
        "e.amount_ugx, e.expense_date, e.notes, e.payment_source, e.paid_by_user_id, pu.full_name AS paid_by_full_name, " .
        "e.recorded_by_user_id, ru.full_name AS recorded_by_full_name, e.is_void, e.voided_at, e.voided_by_user_id, " .
        "vu.full_name AS voided_by_full_name, e.created_at, e.updated_at " .
      "FROM expenses e " .
      "JOIN shops sh ON sh.id = e.shop_id " .
      "JOIN expense_categories c ON c.id = e.category_id " .
      "LEFT JOIN users pu ON pu.id = e.paid_by_user_id " .
      "LEFT JOIN users ru ON ru.id = e.recorded_by_user_id " .
      "LEFT JOIN users vu ON vu.id = e.voided_by_user_id " .
      "WHERE e.id = :id LIMIT 1",
      [":id" => $expenseId]
    );
    if (!$row) {
      json_response(201, ["data" => ["id" => $expenseId]]);
    }

    $public = [
      "id" => (string)$row["id"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "categoryId" => (string)$row["category_id"],
      "categoryName" => (string)$row["category_name"],
      "amountUGX" => (int)$row["amount_ugx"],
      "expenseDate" => (string)$row["expense_date"],
      "notes" => $row["notes"] ?? null,
      "paymentSource" => (string)$row["payment_source"],
      "paidByUserId" => $row["paid_by_user_id"] ?? null,
      "paidByFullName" => $row["paid_by_full_name"] ?? null,
      "recordedByUserId" => $row["recorded_by_user_id"] ?? null,
      "recordedByFullName" => $row["recorded_by_full_name"] ?? null,
      "isVoid" => (int)$row["is_void"] === 1,
      "voidedAt" => $row["voided_at"] ?? null,
      "voidedByUserId" => $row["voided_by_user_id"] ?? null,
      "voidedByFullName" => $row["voided_by_full_name"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "expense", $expenseId, null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "DELETE" && preg_match('/^expenses\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $expenseId = (string)$matches[1];
    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT e.id, e.shop_id, sh.code AS shop_code, sh.name AS shop_name, e.category_id, c.name AS category_name, " .
          "e.amount_ugx, e.expense_date, e.notes, e.payment_source, e.paid_by_user_id, pu.full_name AS paid_by_full_name, " .
          "e.recorded_by_user_id, ru.full_name AS recorded_by_full_name, e.is_void, e.created_at, e.updated_at " .
        "FROM expenses e " .
        "JOIN shops sh ON sh.id = e.shop_id " .
        "JOIN expense_categories c ON c.id = e.category_id " .
        "LEFT JOIN users pu ON pu.id = e.paid_by_user_id " .
        "LEFT JOIN users ru ON ru.id = e.recorded_by_user_id " .
        "WHERE e.id = :id FOR UPDATE",
        [":id" => $expenseId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Expense not found"]);
      }

      if ((int)($existing["is_void"] ?? 0) === 1) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Expense is already void"]);
      }

      $beforePublic = [
        "id" => (string)$existing["id"],
        "shopId" => (string)$existing["shop_id"],
        "shopCode" => (string)$existing["shop_code"],
        "shopName" => (string)$existing["shop_name"],
        "categoryId" => (string)$existing["category_id"],
        "categoryName" => (string)$existing["category_name"],
        "amountUGX" => (int)$existing["amount_ugx"],
        "expenseDate" => (string)$existing["expense_date"],
        "notes" => $existing["notes"] ?? null,
        "paymentSource" => (string)$existing["payment_source"],
        "paidByUserId" => $existing["paid_by_user_id"] ?? null,
        "paidByFullName" => $existing["paid_by_full_name"] ?? null,
        "recordedByUserId" => $existing["recorded_by_user_id"] ?? null,
        "recordedByFullName" => $existing["recorded_by_full_name"] ?? null,
        "isVoid" => (int)$existing["is_void"] === 1,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      phase1_db_execute(
        $pdo,
        "UPDATE expenses SET is_void = 1, voided_at = NOW(), voided_by_user_id = :actor, updated_at = NOW() WHERE id = :id",
        [":actor" => $actorUserId !== "" ? $actorUserId : null, ":id" => $expenseId]
      );

      $updated = phase1_db_fetch_one(
        $pdo,
        "SELECT e.id, e.shop_id, sh.code AS shop_code, sh.name AS shop_name, e.category_id, c.name AS category_name, " .
          "e.amount_ugx, e.expense_date, e.notes, e.payment_source, e.paid_by_user_id, pu.full_name AS paid_by_full_name, " .
          "e.recorded_by_user_id, ru.full_name AS recorded_by_full_name, e.is_void, e.voided_at, e.voided_by_user_id, " .
          "vu.full_name AS voided_by_full_name, e.created_at, e.updated_at " .
        "FROM expenses e " .
        "JOIN shops sh ON sh.id = e.shop_id " .
        "JOIN expense_categories c ON c.id = e.category_id " .
        "LEFT JOIN users pu ON pu.id = e.paid_by_user_id " .
        "LEFT JOIN users ru ON ru.id = e.recorded_by_user_id " .
        "LEFT JOIN users vu ON vu.id = e.voided_by_user_id " .
        "WHERE e.id = :id LIMIT 1",
        [":id" => $expenseId]
      );

      $pdo->commit();

      $afterPublic = $updated ? [
        "id" => (string)$updated["id"],
        "shopId" => (string)$updated["shop_id"],
        "shopCode" => (string)$updated["shop_code"],
        "shopName" => (string)$updated["shop_name"],
        "categoryId" => (string)$updated["category_id"],
        "categoryName" => (string)$updated["category_name"],
        "amountUGX" => (int)$updated["amount_ugx"],
        "expenseDate" => (string)$updated["expense_date"],
        "notes" => $updated["notes"] ?? null,
        "paymentSource" => (string)$updated["payment_source"],
        "paidByUserId" => $updated["paid_by_user_id"] ?? null,
        "paidByFullName" => $updated["paid_by_full_name"] ?? null,
        "recordedByUserId" => $updated["recorded_by_user_id"] ?? null,
        "recordedByFullName" => $updated["recorded_by_full_name"] ?? null,
        "isVoid" => (int)$updated["is_void"] === 1,
        "voidedAt" => $updated["voided_at"] ?? null,
        "voidedByUserId" => $updated["voided_by_user_id"] ?? null,
        "voidedByFullName" => $updated["voided_by_full_name"] ?? null,
        "createdAt" => (string)$updated["created_at"],
        "updatedAt" => (string)$updated["updated_at"],
      ] : $beforePublic;

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "expense", $expenseId, $beforePublic, $afterPublic);
      json_response(200, ["data" => $afterPublic]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to void expense"]);
    }
  }

  if ($method === "GET" && $route === "product-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories ORDER BY name ASC",
      []
    );
    $categories = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $categories]);
  }

  if ($method === "POST" && $route === "product-categories") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $notes = isset($body["notes"]) && is_string($body["notes"]) ? trim($body["notes"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($name === "") {
      json_response(400, ["error" => "ValidationError", "message" => "name is required"]);
    }

    $id = create_id("prodcat");

    try {
      $stmt = $pdo->prepare("INSERT INTO product_categories (id, name, is_active, notes) VALUES (:id, :name, :is_active, :notes)");
      $stmt->execute([
        ":id" => $id,
        ":name" => $name,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => $notes !== "" ? $notes : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Product category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create product category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created product category"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "product_category", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^product-categories\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Product category not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $updates[] = "name = :name";
      $params[":name"] = $value;
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE product_categories SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Product category name already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update product category"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active, notes, created_at, updated_at FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated product category"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "name" => (string)$existing["name"],
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "name" => (string)$row["name"],
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "product_category", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "products") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $includeCost = $roleName === "ADMIN";
    $where = $includeCost ? "" : "WHERE p.is_active = 1 AND c.is_active = 1 ";
    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id " .
      $where .
      "ORDER BY p.name ASC",
      []
    );
    $products = array_map(function ($row) use ($includeCost) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "skuCode" => (string)($row["sku_code"] ?? ""),
        "name" => (string)($row["name"] ?? ""),
        "categoryId" => (string)($row["category_id"] ?? ""),
        "categoryName" => (string)($row["category_name"] ?? ""),
        "productType" => (string)($row["product_type"] ?? ""),
        "unitOfMeasure" => (string)($row["unit_of_measure"] ?? ""),
        "costPrice" => $includeCost ? ($row["cost_price"] === null ? null : (int)$row["cost_price"]) : null,
        "sellingPrice" => (int)($row["selling_price"] ?? 0),
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
        "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);
    json_response(200, ["data" => $products]);
  }

  if ($method === "POST" && $route === "products") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $skuCode = isset($body["skuCode"]) && is_string($body["skuCode"]) ? trim($body["skuCode"]) : "";
    $name = isset($body["name"]) && is_string($body["name"]) ? trim($body["name"]) : "";
    $categoryId = isset($body["categoryId"]) && is_string($body["categoryId"]) ? trim($body["categoryId"]) : "";
    $productType = isset($body["productType"]) && is_string($body["productType"]) ? trim($body["productType"]) : "";
    $unitOfMeasure = isset($body["unitOfMeasure"]) && is_string($body["unitOfMeasure"]) ? trim($body["unitOfMeasure"]) : "";
    $sellingPrice = isset($body["sellingPrice"]) ? (int)$body["sellingPrice"] : 0;
    $costPrice = array_key_exists("costPrice", $body) ? ($body["costPrice"] === null ? null : (int)$body["costPrice"]) : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;
    $boardSizeCode = array_key_exists("boardSizeCode", $body) && is_string($body["boardSizeCode"]) ? trim($body["boardSizeCode"]) : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($skuCode === "" || $name === "" || $categoryId === "" || $unitOfMeasure === "" || $sellingPrice < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "skuCode, name, categoryId, unitOfMeasure, and sellingPrice are required"]);
    }
    if ($productType !== "BOARD" && $productType !== "NON_BOARD") {
      json_response(400, ["error" => "ValidationError", "message" => "productType must be BOARD or NON_BOARD"]);
    }
    if ($costPrice !== null && $costPrice < 0) {
      json_response(400, ["error" => "ValidationError", "message" => "costPrice must be >= 0"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $yieldMap = ["A4C" => 48, "A3C" => 24, "A2C" => 12];
    $yieldPerSheet = null;

    if ($productType === "BOARD") {
      if ($boardSizeCode === null || !isset($yieldMap[$boardSizeCode])) {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be A4C, A3C, or A2C for BOARD products"]);
      }
      $yieldPerSheet = (int)$yieldMap[$boardSizeCode];
    } else {
      $boardSizeCode = null;
    }

    $category = phase1_db_fetch_one(
      $pdo,
      "SELECT id, name, is_active FROM product_categories WHERE id = :id LIMIT 1",
      [":id" => $categoryId]
    );
    if (!$category) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid categoryId"]);
    }
    if ((int)($category["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Category is inactive"]);
    }

    $id = create_id("prod");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO products (id, sku_code, name, category_id, product_type, unit_of_measure, cost_price, selling_price, is_active, board_size_code, yield_per_sheet, notes) " .
        "VALUES (:id, :sku_code, :name, :category_id, :product_type, :unit_of_measure, :cost_price, :selling_price, :is_active, :board_size_code, :yield_per_sheet, :notes)"
      );
      $stmt->execute([
        ":id" => $id,
        ":sku_code" => $skuCode,
        ":name" => $name,
        ":category_id" => $categoryId,
        ":product_type" => $productType,
        ":unit_of_measure" => $unitOfMeasure,
        ":cost_price" => $costPrice,
        ":selling_price" => $sellingPrice,
        ":is_active" => $isActive ? 1 : 0,
        ":board_size_code" => $boardSizeCode,
        ":yield_per_sheet" => $yieldPerSheet,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create product"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created product"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "skuCode" => (string)$row["sku_code"],
      "name" => (string)$row["name"],
      "categoryId" => (string)$row["category_id"],
      "categoryName" => (string)$row["category_name"],
      "productType" => (string)$row["product_type"],
      "unitOfMeasure" => (string)$row["unit_of_measure"],
      "costPrice" => $row["cost_price"] === null ? null : (int)$row["cost_price"],
      "sellingPrice" => (int)$row["selling_price"],
      "isActive" => (int)$row["is_active"] === 1,
      "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
      "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];
    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "product", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^products\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Product not found"]);
    }

    $nextSkuCode = (string)$existing["sku_code"];
    $nextName = (string)$existing["name"];
    $nextCategoryId = (string)$existing["category_id"];
    $nextProductType = (string)$existing["product_type"];
    $nextUnitOfMeasure = (string)$existing["unit_of_measure"];
    $nextCostPrice = $existing["cost_price"] === null ? null : (int)$existing["cost_price"];
    $nextSellingPrice = (int)$existing["selling_price"];
    $nextIsActive = (int)$existing["is_active"] === 1;
    $nextBoardSizeCode = $existing["board_size_code"] === null ? null : (string)$existing["board_size_code"];
    $nextNotes = $existing["notes"] ?? null;

    if (array_key_exists("skuCode", $body)) {
      $value = is_string($body["skuCode"]) ? trim($body["skuCode"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode cannot be empty"]);
      }
      $nextSkuCode = $value;
    }
    if (array_key_exists("name", $body)) {
      $value = is_string($body["name"]) ? trim($body["name"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "name cannot be empty"]);
      }
      $nextName = $value;
    }
    if (array_key_exists("categoryId", $body)) {
      $value = is_string($body["categoryId"]) ? trim($body["categoryId"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "categoryId cannot be empty"]);
      }
      $nextCategoryId = $value;
    }
    if (array_key_exists("productType", $body)) {
      $value = is_string($body["productType"]) ? trim($body["productType"]) : "";
      if ($value !== "BOARD" && $value !== "NON_BOARD") {
        json_response(400, ["error" => "ValidationError", "message" => "productType must be BOARD or NON_BOARD"]);
      }
      $nextProductType = $value;
    }
    if (array_key_exists("unitOfMeasure", $body)) {
      $value = is_string($body["unitOfMeasure"]) ? trim($body["unitOfMeasure"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "unitOfMeasure cannot be empty"]);
      }
      $nextUnitOfMeasure = $value;
    }
    if (array_key_exists("costPrice", $body)) {
      if ($body["costPrice"] === null) {
        $nextCostPrice = null;
      } elseif (is_int($body["costPrice"]) || is_float($body["costPrice"]) || (is_string($body["costPrice"]) && $body["costPrice"] !== "")) {
        $value = (int)$body["costPrice"];
        if ($value < 0) {
          json_response(400, ["error" => "ValidationError", "message" => "costPrice must be >= 0"]);
        }
        $nextCostPrice = $value;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "costPrice must be a number or null"]);
      }
    }
    if (array_key_exists("sellingPrice", $body)) {
      if (!is_int($body["sellingPrice"]) && !is_float($body["sellingPrice"]) && !(is_string($body["sellingPrice"]) && $body["sellingPrice"] !== "")) {
        json_response(400, ["error" => "ValidationError", "message" => "sellingPrice must be a number"]);
      }
      $value = (int)$body["sellingPrice"];
      if ($value < 1) {
        json_response(400, ["error" => "ValidationError", "message" => "sellingPrice must be >= 1"]);
      }
      $nextSellingPrice = $value;
    }
    if (array_key_exists("isActive", $body)) {
      $nextIsActive = (bool)$body["isActive"];
    }
    if (array_key_exists("boardSizeCode", $body)) {
      if ($body["boardSizeCode"] === null) {
        $nextBoardSizeCode = null;
      } elseif (is_string($body["boardSizeCode"])) {
        $value = trim($body["boardSizeCode"]);
        $nextBoardSizeCode = $value !== "" ? $value : null;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be a string or null"]);
      }
    }
    if (array_key_exists("notes", $body)) {
      $notesValue = $body["notes"];
      if ($notesValue !== null && !is_string($notesValue)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $nextNotes = is_string($notesValue) && trim($notesValue) !== "" ? trim($notesValue) : null;
    }

    if ($nextCategoryId !== (string)$existing["category_id"]) {
      $category = phase1_db_fetch_one(
        $pdo,
        "SELECT id, is_active FROM product_categories WHERE id = :id LIMIT 1",
        [":id" => $nextCategoryId]
      );
      if (!$category) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid categoryId"]);
      }
      if ((int)($category["is_active"] ?? 0) !== 1) {
        json_response(400, ["error" => "ValidationError", "message" => "Category is inactive"]);
      }
    }

    $yieldMap = ["A4C" => 48, "A3C" => 24, "A2C" => 12];
    $yieldPerSheet = null;

    if ($nextProductType === "BOARD") {
      if ($nextBoardSizeCode === null || !isset($yieldMap[$nextBoardSizeCode])) {
        json_response(400, ["error" => "ValidationError", "message" => "boardSizeCode must be A4C, A3C, or A2C for BOARD products"]);
      }
      $yieldPerSheet = (int)$yieldMap[$nextBoardSizeCode];
    } else {
      $nextBoardSizeCode = null;
      $yieldPerSheet = null;
    }

    try {
      $stmt = $pdo->prepare(
        "UPDATE products SET sku_code = :sku_code, name = :name, category_id = :category_id, product_type = :product_type, " .
          "unit_of_measure = :unit_of_measure, cost_price = :cost_price, selling_price = :selling_price, is_active = :is_active, " .
          "board_size_code = :board_size_code, yield_per_sheet = :yield_per_sheet, notes = :notes, updated_at = NOW() WHERE id = :id"
      );
      $stmt->execute([
        ":id" => $id,
        ":sku_code" => $nextSkuCode,
        ":name" => $nextName,
        ":category_id" => $nextCategoryId,
        ":product_type" => $nextProductType,
        ":unit_of_measure" => $nextUnitOfMeasure,
        ":cost_price" => $nextCostPrice,
        ":selling_price" => $nextSellingPrice,
        ":is_active" => $nextIsActive ? 1 : 0,
        ":board_size_code" => $nextBoardSizeCode,
        ":yield_per_sheet" => $yieldPerSheet,
        ":notes" => $nextNotes,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "skuCode already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update product"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT p.id, p.sku_code, p.name, p.category_id, c.name AS category_name, p.product_type, p.unit_of_measure, " .
        "p.cost_price, p.selling_price, p.is_active, p.board_size_code, p.yield_per_sheet, p.notes, p.created_at, p.updated_at " .
      "FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated product"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "skuCode" => (string)$existing["sku_code"],
      "name" => (string)$existing["name"],
      "categoryId" => (string)$existing["category_id"],
      "categoryName" => (string)$existing["category_name"],
      "productType" => (string)$existing["product_type"],
      "unitOfMeasure" => (string)$existing["unit_of_measure"],
      "costPrice" => $existing["cost_price"] === null ? null : (int)$existing["cost_price"],
      "sellingPrice" => (int)$existing["selling_price"],
      "isActive" => (int)$existing["is_active"] === 1,
      "boardSizeCode" => $existing["board_size_code"] === null ? null : (string)$existing["board_size_code"],
      "yieldPerSheet" => $existing["yield_per_sheet"] === null ? null : (int)$existing["yield_per_sheet"],
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "skuCode" => (string)$row["sku_code"],
      "name" => (string)$row["name"],
      "categoryId" => (string)$row["category_id"],
      "categoryName" => (string)$row["category_name"],
      "productType" => (string)$row["product_type"],
      "unitOfMeasure" => (string)$row["unit_of_measure"],
      "costPrice" => $row["cost_price"] === null ? null : (int)$row["cost_price"],
      "sellingPrice" => (int)$row["selling_price"],
      "isActive" => (int)$row["is_active"] === 1,
      "boardSizeCode" => $row["board_size_code"] === null ? null : (string)$row["board_size_code"],
      "yieldPerSheet" => $row["yield_per_sheet"] === null ? null : (int)$row["yield_per_sheet"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "product", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "customers") {
    // Sales can create customers; managers can view.
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at " .
      "FROM customers ORDER BY created_at DESC",
      []
    );

    $customers = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "mobileNumber" => (string)($row["mobile"] ?? ""),
        "firstName" => (string)($row["first_name"] ?? ""),
        "lastName" => (string)($row["last_name"] ?? ""),
        "email" => $row["email"] ?? null,
        "isActive" => (int)($row["is_active"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $customers]);
  }

  if ($method === "POST" && $route === "customers") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $mobile = isset($body["mobileNumber"]) && is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
    $firstName = isset($body["firstName"]) && is_string($body["firstName"]) ? trim($body["firstName"]) : "";
    $lastName = isset($body["lastName"]) && is_string($body["lastName"]) ? trim($body["lastName"]) : "";
    $email = array_key_exists("email", $body) ? $body["email"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $isActive = array_key_exists("isActive", $body) ? (bool)$body["isActive"] : true;

    if ($mobile === "" || $firstName === "" || $lastName === "") {
      json_response(400, ["error" => "ValidationError", "message" => "mobileNumber, firstName, and lastName are required"]);
    }
    if ($email !== null) {
      if (!is_string($email)) {
        json_response(400, ["error" => "ValidationError", "message" => "email must be a string or null"]);
      }
      $trimmed = trim($email);
      if ($trimmed !== "" && filter_var($trimmed, FILTER_VALIDATE_EMAIL) === false) {
        json_response(400, ["error" => "ValidationError", "message" => "email is invalid"]);
      }
      $email = $trimmed !== "" ? $trimmed : null;
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $id = create_id("cust");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO customers (id, mobile, first_name, last_name, email, is_active, notes) " .
        "VALUES (:id, :mobile, :first_name, :last_name, :email, :is_active, :notes)"
      );
      $stmt->execute([
        ":id" => $id,
        ":mobile" => $mobile,
        ":first_name" => $firstName,
        ":last_name" => $lastName,
        ":email" => $email,
        ":is_active" => $isActive ? 1 : 0,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Customer mobile number already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create customer"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read created customer"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "mobileNumber" => (string)$row["mobile"],
      "firstName" => (string)$row["first_name"],
      "lastName" => (string)$row["last_name"],
      "email" => $row["email"] ?? null,
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "CREATE", "customer", (string)$row["id"], null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^customers\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $id = (string)$matches[1];
    $body = read_json_body();

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$existing) {
      json_response(404, ["error" => "HttpError", "message" => "Customer not found"]);
    }

    $updates = [];
    $params = [":id" => $id];

    if (array_key_exists("mobileNumber", $body)) {
      $value = is_string($body["mobileNumber"]) ? normalize_mobile_number($body["mobileNumber"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "mobileNumber cannot be empty"]);
      }
      $updates[] = "mobile = :mobile";
      $params[":mobile"] = $value;
    }
    if (array_key_exists("firstName", $body)) {
      $value = is_string($body["firstName"]) ? trim($body["firstName"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "firstName cannot be empty"]);
      }
      $updates[] = "first_name = :first_name";
      $params[":first_name"] = $value;
    }
    if (array_key_exists("lastName", $body)) {
      $value = is_string($body["lastName"]) ? trim($body["lastName"]) : "";
      if ($value === "") {
        json_response(400, ["error" => "ValidationError", "message" => "lastName cannot be empty"]);
      }
      $updates[] = "last_name = :last_name";
      $params[":last_name"] = $value;
    }
    if (array_key_exists("email", $body)) {
      $email = $body["email"];
      if ($email === null) {
        $updates[] = "email = NULL";
      } elseif (is_string($email)) {
        $trimmed = trim($email);
        if ($trimmed !== "" && filter_var($trimmed, FILTER_VALIDATE_EMAIL) === false) {
          json_response(400, ["error" => "ValidationError", "message" => "email is invalid"]);
        }
        $updates[] = "email = :email";
        $params[":email"] = $trimmed !== "" ? $trimmed : null;
      } else {
        json_response(400, ["error" => "ValidationError", "message" => "email must be a string or null"]);
      }
    }
    if (array_key_exists("notes", $body)) {
      $notes = $body["notes"];
      if ($notes !== null && !is_string($notes)) {
        json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
      }
      $updates[] = "notes = :notes";
      $params[":notes"] = is_string($notes) && trim($notes) !== "" ? trim($notes) : null;
    }
    if (array_key_exists("isActive", $body)) {
      $updates[] = "is_active = :is_active";
      $params[":is_active"] = (bool)$body["isActive"] ? 1 : 0;
    }

    if (count($updates) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    try {
      phase1_db_execute($pdo, "UPDATE customers SET " . implode(", ", $updates) . ", updated_at = NOW() WHERE id = :id", $params);
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code === 1062) {
        json_response(400, ["error" => "ValidationError", "message" => "Customer mobile number already exists"]);
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update customer"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active, notes, created_at, updated_at FROM customers WHERE id = :id LIMIT 1",
      [":id" => $id]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read updated customer"]);
    }

    $beforePublic = [
      "id" => (string)$existing["id"],
      "mobileNumber" => (string)$existing["mobile"],
      "firstName" => (string)$existing["first_name"],
      "lastName" => (string)$existing["last_name"],
      "email" => $existing["email"] ?? null,
      "isActive" => (int)$existing["is_active"] === 1,
      "notes" => $existing["notes"] ?? null,
      "createdAt" => (string)$existing["created_at"],
      "updatedAt" => (string)$existing["updated_at"],
    ];
    $afterPublic = [
      "id" => (string)$row["id"],
      "mobileNumber" => (string)$row["mobile"],
      "firstName" => (string)$row["first_name"],
      "lastName" => (string)$row["last_name"],
      "email" => $row["email"] ?? null,
      "isActive" => (int)$row["is_active"] === 1,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    phase1_audit_log($pdo, (string)($authUser["id"] ?? null), "UPDATE", "customer", (string)$row["id"], $beforePublic, $afterPublic);
    json_response(200, ["data" => $afterPublic]);
  }

  if ($method === "GET" && $route === "invoices") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $params = [];
    $whereSql = "";

    if ($roleName !== "ADMIN") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $shopId) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $shopId;
      }
      $whereSql = "WHERE i.shop_id IN (" . implode(", ", $placeholders) . ") ";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
        "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, i.status, i.issued_at, i.due_date, " .
        "i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
      "FROM invoices i " .
      "JOIN shops s ON s.id = i.shop_id " .
      "JOIN customers c ON c.id = i.customer_id " .
      $whereSql .
      "ORDER BY i.created_at DESC",
      $params
    );

    $invoices = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "invoiceNumber" => (string)($row["invoice_number"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "sequenceNumber" => (int)($row["sequence_number"] ?? 0),
        "customerId" => (string)($row["customer_id"] ?? ""),
        "customerMobileNumber" => (string)($row["customer_mobile"] ?? ""),
        "customerFirstName" => (string)($row["first_name"] ?? ""),
        "customerLastName" => (string)($row["last_name"] ?? ""),
        "status" => (string)($row["status"] ?? ""),
        "issuedAt" => $row["issued_at"] ?? null,
        "dueDate" => $row["due_date"] ?? null,
        "totalAmount" => (int)($row["total_amount"] ?? 0),
        "paidAmount" => (int)($row["paid_amount"] ?? 0),
        "balance" => (int)($row["balance"] ?? 0),
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $invoices]);
  }

  if ($method === "GET" && preg_match('/^invoices\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $invoiceId = (string)$matches[1];

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
        "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
        "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
      "FROM invoices i " .
      "JOIN shops s ON s.id = i.shop_id " .
      "JOIN customers c ON c.id = i.customer_id " .
      "WHERE i.id = :id LIMIT 1",
      [":id" => $invoiceId]
    );
    if (!$row) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }

    phase1_require_shop_access($roleName, $assignments, (string)$row["shop_id"]);

    $linesRows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
      "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
      [":invoice_id" => $invoiceId]
    );

    $lines = array_map(function ($line) {
      return [
        "id" => (string)($line["id"] ?? ""),
        "invoiceId" => (string)($line["invoice_id"] ?? ""),
        "sortOrder" => (int)($line["sort_order"] ?? 0),
        "description" => (string)($line["description"] ?? ""),
        "quantity" => (int)($line["quantity"] ?? 0),
        "unitPrice" => (int)($line["unit_price"] ?? 0),
        "lineTotal" => (int)($line["line_total"] ?? 0),
        "notes" => $line["notes"] ?? null,
        "createdAt" => (string)($line["created_at"] ?? ""),
        "updatedAt" => (string)($line["updated_at"] ?? ""),
      ];
    }, $linesRows);

    $invoice = [
      "id" => (string)$row["id"],
      "invoiceNumber" => (string)$row["invoice_number"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "sequenceNumber" => (int)$row["sequence_number"],
      "customerId" => (string)$row["customer_id"],
      "customerMobileNumber" => (string)$row["customer_mobile"],
      "customerFirstName" => (string)$row["first_name"],
      "customerLastName" => (string)$row["last_name"],
      "customerEmail" => $row["customer_email"] ?? null,
      "status" => (string)$row["status"],
      "issuedAt" => $row["issued_at"] ?? null,
      "dueDate" => $row["due_date"] ?? null,
      "totalAmount" => (int)$row["total_amount"],
      "paidAmount" => (int)$row["paid_amount"],
      "balance" => (int)$row["balance"],
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    json_response(200, ["data" => ["invoice" => $invoice, "lines" => $lines]]);
  }

  if ($method === "POST" && $route === "invoices") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $requestedShopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
    $customerId = isset($body["customerId"]) && is_string($body["customerId"]) ? trim($body["customerId"]) : "";
    $status = isset($body["status"]) && is_string($body["status"]) ? trim($body["status"]) : "DRAFT";
    $dueDate = array_key_exists("dueDate", $body) ? $body["dueDate"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if ($customerId === "") {
      json_response(400, ["error" => "ValidationError", "message" => "customerId is required"]);
    }
    if ($status !== "DRAFT" && $status !== "ISSUED") {
      json_response(400, ["error" => "ValidationError", "message" => "status must be DRAFT or ISSUED"]);
    }
    if ($dueDate !== null) {
      if (!is_string($dueDate)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be a string (YYYY-MM-DD) or null"]);
      }
      $trimmed = trim($dueDate);
      if ($trimmed !== "" && !is_valid_ymd_date($trimmed)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be YYYY-MM-DD"]);
      }
      $dueDate = $trimmed !== "" ? $trimmed : null;
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    if (!is_array($linesPayload) || count($linesPayload) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "lines (non-empty array) is required"]);
    }

    $shopId = $requestedShopId;
    if ($roleName !== "ADMIN") {
      if ($shopId === "") {
        $shopId = phase1_primary_shop_id($assignments);
      }
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "Sales user is not assigned to a shop"]);
      }
      phase1_require_shop_access($roleName, $assignments, $shopId);
    } else {
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "shopId is required"]);
      }
    }

    $shopRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, code, name FROM shops WHERE id = :id LIMIT 1",
      [":id" => $shopId]
    );
    if (!$shopRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }

    $customerRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, mobile, first_name, last_name, email, is_active FROM customers WHERE id = :id LIMIT 1",
      [":id" => $customerId]
    );
    if (!$customerRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid customerId"]);
    }
    if ((int)($customerRow["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Customer is inactive"]);
    }

    $lines = [];
    $totalAmount = 0;

    foreach ($linesPayload as $idx => $rawLine) {
      if (!is_array($rawLine)) {
        json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
      }
      $description = isset($rawLine["description"]) && is_string($rawLine["description"]) ? trim($rawLine["description"]) : "";
      $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
      $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
      $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;

      if ($description === "" || $quantity < 1 || $unitPrice < 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Line requires description, quantity (>=1), unitPrice (>=0)"]);
      }
      if ($lineNotes !== null && !is_string($lineNotes)) {
        json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
      }

      $lineTotal = $quantity * $unitPrice;
      if ($lineTotal < 0 || $lineTotal > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
      }

      $totalAmount += $lineTotal;
      if ($totalAmount > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Invoice total is too large"]);
      }

      $lines[] = [
        "sortOrder" => (int)$idx + 1,
        "description" => $description,
        "quantity" => $quantity,
        "unitPrice" => $unitPrice,
        "lineTotal" => $lineTotal,
        "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
      ];
    }

    if ($totalAmount <= 0) {
      json_response(400, ["error" => "ValidationError", "message" => "Invoice total must be > 0"]);
    }

    $invoiceId = create_id("inv");
    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      // Ensure counter row exists, then lock it.
      $stmtCounterInit = $pdo->prepare(
        "INSERT INTO shop_invoice_counters (shop_id, next_seq) VALUES (:shop_id, 1) " .
        "ON DUPLICATE KEY UPDATE shop_id = shop_id"
      );
      $stmtCounterInit->execute([":shop_id" => $shopId]);

      $counterRow = phase1_db_fetch_one(
        $pdo,
        "SELECT next_seq FROM shop_invoice_counters WHERE shop_id = :shop_id FOR UPDATE",
        [":shop_id" => $shopId]
      );
      if (!$counterRow) {
        throw new RuntimeException("Failed to acquire invoice counter lock");
      }

      $seq = (int)($counterRow["next_seq"] ?? 1);
      if ($seq < 1) {
        $seq = 1;
      }

      phase1_db_execute(
        $pdo,
        "UPDATE shop_invoice_counters SET next_seq = :next_seq, updated_at = NOW() WHERE shop_id = :shop_id",
        [":next_seq" => $seq + 1, ":shop_id" => $shopId]
      );

      $shopCode = (string)($shopRow["code"] ?? "");
      $invoiceNumber = $shopCode . "-" . str_pad((string)$seq, 6, "0", STR_PAD_LEFT);

      $issuedAt = $status === "ISSUED" ? gmdate("Y-m-d H:i:s") : null;

      $stmtInvoice = $pdo->prepare(
        "INSERT INTO invoices (id, shop_id, sequence_number, invoice_number, customer_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_by_user_id) " .
        "VALUES (:id, :shop_id, :sequence_number, :invoice_number, :customer_id, :status, :issued_at, :due_date, :total_amount, 0, :balance, :notes, :created_by_user_id)"
      );
      $stmtInvoice->execute([
        ":id" => $invoiceId,
        ":shop_id" => $shopId,
        ":sequence_number" => $seq,
        ":invoice_number" => $invoiceNumber,
        ":customer_id" => $customerId,
        ":status" => $status,
        ":issued_at" => $issuedAt,
        ":due_date" => $dueDate,
        ":total_amount" => $totalAmount,
        ":balance" => $totalAmount,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ":created_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
      ]);

      $stmtLine = $pdo->prepare(
        "INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes) " .
        "VALUES (:id, :invoice_id, :sort_order, :description, :quantity, :unit_price, :line_total, :notes)"
      );
      $linePublic = [];
      foreach ($lines as $line) {
        $lineId = create_id("line");
        $stmtLine->execute([
          ":id" => $lineId,
          ":invoice_id" => $invoiceId,
          ":sort_order" => (int)$line["sortOrder"],
          ":description" => (string)$line["description"],
          ":quantity" => (int)$line["quantity"],
          ":unit_price" => (int)$line["unitPrice"],
          ":line_total" => (int)$line["lineTotal"],
          ":notes" => $line["notes"] ?? null,
        ]);
        $linePublic[] = [
          "id" => $lineId,
          "invoiceId" => $invoiceId,
          "sortOrder" => (int)$line["sortOrder"],
          "description" => (string)$line["description"],
          "quantity" => (int)$line["quantity"],
          "unitPrice" => (int)$line["unitPrice"],
          "lineTotal" => (int)$line["lineTotal"],
          "notes" => $line["notes"] ?? null,
        ];
      }

      $invoicePublic = [
        "id" => $invoiceId,
        "invoiceNumber" => $invoiceNumber,
        "shopId" => $shopId,
        "shopCode" => (string)$shopRow["code"],
        "shopName" => (string)$shopRow["name"],
        "sequenceNumber" => $seq,
        "customerId" => $customerId,
        "customerMobileNumber" => (string)$customerRow["mobile"],
        "customerFirstName" => (string)$customerRow["first_name"],
        "customerLastName" => (string)$customerRow["last_name"],
        "customerEmail" => $customerRow["email"] ?? null,
        "status" => $status,
        "issuedAt" => $issuedAt,
        "dueDate" => $dueDate,
        "totalAmount" => $totalAmount,
        "paidAmount" => 0,
        "balance" => $totalAmount,
        "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ];

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "invoice", $invoiceId, null, [
        "invoice" => $invoicePublic,
        "lines" => $linePublic,
      ]);

      $pdo->commit();

      // Read back for timestamps.
      $created = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i JOIN shops s ON s.id = i.shop_id JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id LIMIT 1",
        [":id" => $invoiceId]
      );

      $linesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
        [":invoice_id" => $invoiceId]
      );

      $outLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "invoiceId" => (string)($line["invoice_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "description" => (string)($line["description"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $linesRows);

      if (!$created) {
        json_response(201, ["data" => ["invoice" => $invoicePublic, "lines" => $linePublic]]);
      }

      $outInvoice = [
        "id" => (string)$created["id"],
        "invoiceNumber" => (string)$created["invoice_number"],
        "shopId" => (string)$created["shop_id"],
        "shopCode" => (string)$created["shop_code"],
        "shopName" => (string)$created["shop_name"],
        "sequenceNumber" => (int)$created["sequence_number"],
        "customerId" => (string)$created["customer_id"],
        "customerMobileNumber" => (string)$created["customer_mobile"],
        "customerFirstName" => (string)$created["first_name"],
        "customerLastName" => (string)$created["last_name"],
        "customerEmail" => $created["customer_email"] ?? null,
        "status" => (string)$created["status"],
        "issuedAt" => $created["issued_at"] ?? null,
        "dueDate" => $created["due_date"] ?? null,
        "totalAmount" => (int)$created["total_amount"],
        "paidAmount" => (int)$created["paid_amount"],
        "balance" => (int)$created["balance"],
        "notes" => $created["notes"] ?? null,
        "createdAt" => (string)$created["created_at"],
        "updatedAt" => (string)$created["updated_at"],
      ];

      json_response(201, ["data" => ["invoice" => $outInvoice, "lines" => $outLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create invoice"]);
    }
  }

  if ($method === "PATCH" && preg_match('/^invoices\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $invoiceId = (string)$matches[1];
    $body = read_json_body();

    $requestedStatus = array_key_exists("status", $body) && is_string($body["status"]) ? trim($body["status"]) : null;
    $dueDate = array_key_exists("dueDate", $body) ? $body["dueDate"] : null;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $customerId = array_key_exists("customerId", $body) && is_string($body["customerId"]) ? trim($body["customerId"]) : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if ($requestedStatus !== null && $requestedStatus !== "ISSUED" && $requestedStatus !== "VOID") {
      json_response(400, ["error" => "ValidationError", "message" => "status can only be set to ISSUED or VOID"]);
    }

    if ($dueDate !== null) {
      if (!is_string($dueDate)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be a string (YYYY-MM-DD) or null"]);
      }
      $trimmed = trim($dueDate);
      if ($trimmed !== "" && !is_valid_ymd_date($trimmed)) {
        json_response(400, ["error" => "ValidationError", "message" => "dueDate must be YYYY-MM-DD"]);
      }
      $dueDate = $trimmed !== "" ? $trimmed : null;
    }

    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    if ($linesPayload !== null && (!is_array($linesPayload) || count($linesPayload) < 1)) {
      json_response(400, ["error" => "ValidationError", "message" => "lines must be a non-empty array when provided"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i " .
        "JOIN shops s ON s.id = i.shop_id " .
        "JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id FOR UPDATE",
        [":id" => $invoiceId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
      }

      phase1_require_shop_access($roleName, $assignments, (string)$existing["shop_id"]);

      $currentStatus = (string)($existing["status"] ?? "");
      $paidAmount = (int)($existing["paid_amount"] ?? 0);

      if ($currentStatus === "VOID") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Invoice is void"]);
      }

      if ($requestedStatus === "VOID") {
        phase1_require_role($roleName, ["ADMIN"]);
        // Allow voiding any non-void invoice.
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'VOID', voided_at = NOW(), voided_by_user_id = :actor, updated_at = NOW() WHERE id = :id",
          [":actor" => $actorUserId !== "" ? $actorUserId : null, ":id" => $invoiceId]
        );
      } elseif ($requestedStatus === "ISSUED") {
        if ($currentStatus !== "DRAFT") {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Only draft invoices can be issued"]);
        }
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'ISSUED', issued_at = COALESCE(issued_at, NOW()), updated_at = NOW() WHERE id = :id",
          [":id" => $invoiceId]
        );
        $currentStatus = "ISSUED";
      }

      if ($customerId !== null || $linesPayload !== null) {
        if ($paidAmount !== 0 || $currentStatus !== "DRAFT") {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Customer and line edits are only allowed for draft invoices with no payments"]);
        }
      }

      if ($customerId !== null) {
        if ($customerId === "") {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "customerId cannot be empty"]);
        }
        $customerRow = phase1_db_fetch_one(
          $pdo,
          "SELECT id, is_active FROM customers WHERE id = :id LIMIT 1",
          [":id" => $customerId]
        );
        if (!$customerRow) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Invalid customerId"]);
        }
        if ((int)($customerRow["is_active"] ?? 0) !== 1) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Customer is inactive"]);
        }
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET customer_id = :customer_id, updated_at = NOW() WHERE id = :id",
          [":customer_id" => $customerId, ":id" => $invoiceId]
        );
      }

      if ($dueDate !== null) {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET due_date = :due_date, updated_at = NOW() WHERE id = :id",
          [":due_date" => $dueDate, ":id" => $invoiceId]
        );
      }

      if ($notes !== null) {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET notes = :notes, updated_at = NOW() WHERE id = :id",
          [":notes" => trim($notes) !== "" ? trim($notes) : null, ":id" => $invoiceId]
        );
      }

      if ($linesPayload !== null) {
        $lines = [];
        $totalAmount = 0;
        foreach ($linesPayload as $idx => $rawLine) {
          if (!is_array($rawLine)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
          }
          $description = isset($rawLine["description"]) && is_string($rawLine["description"]) ? trim($rawLine["description"]) : "";
          $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
          $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
          $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;
          if ($description === "" || $quantity < 1 || $unitPrice < 0) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line requires description, quantity (>=1), unitPrice (>=0)"]);
          }
          if ($lineNotes !== null && !is_string($lineNotes)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
          }

          $lineTotal = $quantity * $unitPrice;
          if ($lineTotal < 0 || $lineTotal > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
          }
          $totalAmount += $lineTotal;
          if ($totalAmount > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Invoice total is too large"]);
          }

          $lines[] = [
            "sortOrder" => (int)$idx + 1,
            "description" => $description,
            "quantity" => $quantity,
            "unitPrice" => $unitPrice,
            "lineTotal" => $lineTotal,
            "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
          ];
        }
        if ($totalAmount <= 0) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Invoice total must be > 0"]);
        }

        phase1_db_execute($pdo, "DELETE FROM invoice_lines WHERE invoice_id = :invoice_id", [":invoice_id" => $invoiceId]);
        $stmtLine = $pdo->prepare(
          "INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes) " .
          "VALUES (:id, :invoice_id, :sort_order, :description, :quantity, :unit_price, :line_total, :notes)"
        );
        foreach ($lines as $line) {
          $stmtLine->execute([
            ":id" => create_id("line"),
            ":invoice_id" => $invoiceId,
            ":sort_order" => (int)$line["sortOrder"],
            ":description" => (string)$line["description"],
            ":quantity" => (int)$line["quantity"],
            ":unit_price" => (int)$line["unitPrice"],
            ":line_total" => (int)$line["lineTotal"],
            ":notes" => $line["notes"] ?? null,
          ]);
        }

        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET total_amount = :total_amount, balance = :balance, updated_at = NOW() WHERE id = :id",
          [":total_amount" => $totalAmount, ":balance" => $totalAmount, ":id" => $invoiceId]
        );
      }

      $updated = phase1_db_fetch_one(
        $pdo,
        "SELECT i.id, i.shop_id, s.code AS shop_code, s.name AS shop_name, i.sequence_number, i.invoice_number, " .
          "i.customer_id, c.mobile AS customer_mobile, c.first_name, c.last_name, c.email AS customer_email, " .
          "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, i.created_at, i.updated_at " .
        "FROM invoices i " .
        "JOIN shops s ON s.id = i.shop_id " .
        "JOIN customers c ON c.id = i.customer_id " .
        "WHERE i.id = :id LIMIT 1",
        [":id" => $invoiceId]
      );

      $updatedLinesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM invoice_lines WHERE invoice_id = :invoice_id ORDER BY sort_order ASC, created_at ASC",
        [":invoice_id" => $invoiceId]
      );

      $beforeInvoice = [
        "id" => (string)$existing["id"],
        "invoiceNumber" => (string)$existing["invoice_number"],
        "shopId" => (string)$existing["shop_id"],
        "shopCode" => (string)$existing["shop_code"],
        "shopName" => (string)$existing["shop_name"],
        "sequenceNumber" => (int)$existing["sequence_number"],
        "customerId" => (string)$existing["customer_id"],
        "customerMobileNumber" => (string)$existing["customer_mobile"],
        "customerFirstName" => (string)$existing["first_name"],
        "customerLastName" => (string)$existing["last_name"],
        "customerEmail" => $existing["customer_email"] ?? null,
        "status" => (string)$existing["status"],
        "issuedAt" => $existing["issued_at"] ?? null,
        "dueDate" => $existing["due_date"] ?? null,
        "totalAmount" => (int)$existing["total_amount"],
        "paidAmount" => (int)$existing["paid_amount"],
        "balance" => (int)$existing["balance"],
        "notes" => $existing["notes"] ?? null,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      $afterInvoice = $updated ? [
        "id" => (string)$updated["id"],
        "invoiceNumber" => (string)$updated["invoice_number"],
        "shopId" => (string)$updated["shop_id"],
        "shopCode" => (string)$updated["shop_code"],
        "shopName" => (string)$updated["shop_name"],
        "sequenceNumber" => (int)$updated["sequence_number"],
        "customerId" => (string)$updated["customer_id"],
        "customerMobileNumber" => (string)$updated["customer_mobile"],
        "customerFirstName" => (string)$updated["first_name"],
        "customerLastName" => (string)$updated["last_name"],
        "customerEmail" => $updated["customer_email"] ?? null,
        "status" => (string)$updated["status"],
        "issuedAt" => $updated["issued_at"] ?? null,
        "dueDate" => $updated["due_date"] ?? null,
        "totalAmount" => (int)$updated["total_amount"],
        "paidAmount" => (int)$updated["paid_amount"],
        "balance" => (int)$updated["balance"],
        "notes" => $updated["notes"] ?? null,
        "createdAt" => (string)$updated["created_at"],
        "updatedAt" => (string)$updated["updated_at"],
      ] : $beforeInvoice;

      $afterLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "invoiceId" => (string)($line["invoice_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "description" => (string)($line["description"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $updatedLinesRows);

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "invoice", $invoiceId, [
        "invoice" => $beforeInvoice,
      ], [
        "invoice" => $afterInvoice,
        "lines" => $afterLines,
      ]);

      $pdo->commit();

      json_response(200, ["data" => ["invoice" => $afterInvoice, "lines" => $afterLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update invoice"]);
    }
  }

  if ($method === "GET" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $invoiceId = (string)$matches[1];

    $invoiceRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, shop_id FROM invoices WHERE id = :id LIMIT 1",
      [":id" => $invoiceId]
    );
    if (!$invoiceRow) {
      json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
    }
    phase1_require_shop_access($roleName, $assignments, (string)$invoiceRow["shop_id"]);

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, invoice_id, amount, method, notes, created_at, updated_at FROM invoice_payments WHERE invoice_id = :invoice_id ORDER BY created_at ASC",
      [":invoice_id" => $invoiceId]
    );

    $payments = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "invoiceId" => (string)($row["invoice_id"] ?? ""),
        "amount" => (int)($row["amount"] ?? 0),
        "method" => (string)($row["method"] ?? ""),
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $payments]);
  }

  if ($method === "POST" && preg_match('/^invoices\\/([^\\/]+)\\/payments$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $invoiceId = (string)$matches[1];
    $body = read_json_body();

    $amount = isset($body["amount"]) ? (int)$body["amount"] : 0;
    $methodValue = isset($body["method"]) && is_string($body["method"]) ? trim($body["method"]) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($amount <= 0 || !in_array($methodValue, ["CASH", "MOBILE_MONEY", "CARD"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "amount (>0) and method (CASH/MOBILE_MONEY/CARD) are required"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, status, total_amount, paid_amount, balance, issued_at FROM invoices WHERE id = :id FOR UPDATE",
        [":id" => $invoiceId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Invoice not found"]);
      }

      phase1_require_shop_access($roleName, $assignments, (string)$existing["shop_id"]);

      $status = (string)($existing["status"] ?? "");
      if ($status === "VOID") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Cannot accept payment for a void invoice"]);
      }

      $totalAmount = (int)($existing["total_amount"] ?? 0);
      $paidAmount = (int)($existing["paid_amount"] ?? 0);
      $balance = $totalAmount - $paidAmount;
      if ($balance < 0) {
        $balance = 0;
      }
      if ($amount > $balance) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Payment exceeds invoice balance"]);
      }

      if ($status === "DRAFT") {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'ISSUED', issued_at = COALESCE(issued_at, NOW()), updated_at = NOW() WHERE id = :id",
          [":id" => $invoiceId]
        );
        $status = "ISSUED";
      }

      $paymentId = create_id("pay");
      $stmtPayment = $pdo->prepare(
        "INSERT INTO invoice_payments (id, invoice_id, amount, method, notes, created_by_user_id) " .
        "VALUES (:id, :invoice_id, :amount, :method, :notes, :created_by_user_id)"
      );
      $stmtPayment->execute([
        ":id" => $paymentId,
        ":invoice_id" => $invoiceId,
        ":amount" => $amount,
        ":method" => $methodValue,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ":created_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
      ]);

      $newPaid = $paidAmount + $amount;
      $newBalance = $totalAmount - $newPaid;
      if ($newBalance < 0) {
        $newBalance = 0;
      }

      $newStatus = $status;
      if ($newBalance <= 0) {
        $newStatus = "PAID";
      } elseif ($newPaid > 0) {
        $newStatus = "PARTIALLY_PAID";
      } elseif ($status === "ISSUED") {
        $newStatus = "ISSUED";
      }

      phase1_db_execute(
        $pdo,
        "UPDATE invoices SET paid_amount = :paid_amount, balance = :balance, status = :status, updated_at = NOW() WHERE id = :id",
        [
          ":paid_amount" => $newPaid,
          ":balance" => $newBalance,
          ":status" => $newStatus,
          ":id" => $invoiceId
        ]
      );

      $paymentPublic = [
        "id" => $paymentId,
        "invoiceId" => $invoiceId,
        "amount" => $amount,
        "method" => $methodValue,
        "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ];

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "invoice_payment", $paymentId, null, $paymentPublic);

      $updated = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_at, updated_at FROM invoices WHERE id = :id LIMIT 1",
        [":id" => $invoiceId]
      );
      if ($updated) {
        $before = [
          "id" => (string)$existing["id"],
          "status" => (string)$existing["status"],
          "issuedAt" => $existing["issued_at"] ?? null,
          "totalAmount" => (int)$existing["total_amount"],
          "paidAmount" => (int)$existing["paid_amount"],
          "balance" => (int)$existing["balance"],
        ];
        $after = [
          "id" => (string)$updated["id"],
          "status" => (string)$updated["status"],
          "issuedAt" => $updated["issued_at"] ?? null,
          "totalAmount" => (int)$updated["total_amount"],
          "paidAmount" => (int)$updated["paid_amount"],
          "balance" => (int)$updated["balance"],
        ];
        phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "invoice", (string)$updated["id"], $before, $after);
      }

      $pdo->commit();

      $paymentRow = phase1_db_fetch_one(
        $pdo,
        "SELECT id, invoice_id, amount, method, notes, created_at, updated_at FROM invoice_payments WHERE id = :id LIMIT 1",
        [":id" => $paymentId]
      );
      $outPayment = $paymentRow ? [
        "id" => (string)$paymentRow["id"],
        "invoiceId" => (string)$paymentRow["invoice_id"],
        "amount" => (int)$paymentRow["amount"],
        "method" => (string)$paymentRow["method"],
        "notes" => $paymentRow["notes"] ?? null,
        "createdAt" => (string)$paymentRow["created_at"],
        "updatedAt" => (string)$paymentRow["updated_at"],
      ] : $paymentPublic;

      json_response(201, ["data" => ["payment" => $outPayment]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to record payment"]);
    }
  }

  if ($method === "GET" && $route === "reconciliation-locks") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $lockDate = isset($_GET["lockDate"]) && is_string($_GET["lockDate"]) ? trim($_GET["lockDate"]) : "";

    if ($lockDate !== "" && !is_valid_ymd_date($lockDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "lockDate must be YYYY-MM-DD"]);
    }

    $where = [];
    $params = [];

    if ($shopId !== "") {
      phase1_require_shop_access($roleName, $assignments, $shopId);
      $where[] = "r.shop_id = :shop_id";
      $params[":shop_id"] = $shopId;
    } elseif ($roleName !== "ADMIN") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $id) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $id;
      }
      $where[] = "r.shop_id IN (" . implode(", ", $placeholders) . ")";
    }

    if ($lockDate !== "") {
      $where[] = "r.lock_date = :lock_date";
      $params[":lock_date"] = $lockDate;
    }

    $sql =
      "SELECT r.id, r.shop_id, s.code AS shop_code, s.name AS shop_name, r.lock_date, r.locked_by_user_id, " .
        "u.full_name AS locked_by_full_name, r.notes, r.created_at, r.updated_at " .
      "FROM reconciliation_locks r " .
      "JOIN shops s ON s.id = r.shop_id " .
      "LEFT JOIN users u ON u.id = r.locked_by_user_id ";
    if (count($where) > 0) {
      $sql .= "WHERE " . implode(" AND ", $where) . " ";
    }
    $sql .= "ORDER BY r.lock_date DESC, r.created_at DESC LIMIT 200";

    $rows = phase1_db_fetch_all($pdo, $sql, $params);
    $locks = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "lockDate" => (string)($row["lock_date"] ?? ""),
        "lockedByUserId" => $row["locked_by_user_id"] ?? null,
        "lockedByFullName" => $row["locked_by_full_name"] ?? null,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $locks]);
  }

  if ($method === "POST" && $route === "reconciliation-locks") {
    phase1_require_role($roleName, ["ADMIN"]);
    $body = read_json_body();

    $shopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
    $lockDate = isset($body["lockDate"]) && is_string($body["lockDate"]) ? trim($body["lockDate"]) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($shopId === "" || $lockDate === "") {
      json_response(400, ["error" => "ValidationError", "message" => "shopId and lockDate are required"]);
    }
    if (!is_valid_ymd_date($lockDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "lockDate must be YYYY-MM-DD"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $shopRow = phase1_db_fetch_one($pdo, "SELECT id FROM shops WHERE id = :id LIMIT 1", [":id" => $shopId]);
    if (!$shopRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }

    $lockId = create_id("lock");
    $actorUserId = (string)($authUser["id"] ?? "");

    $created = false;
    try {
      $stmt = $pdo->prepare(
        "INSERT INTO reconciliation_locks (id, shop_id, lock_date, locked_by_user_id, notes) " .
        "VALUES (:id, :shop_id, :lock_date, :locked_by_user_id, :notes)"
      );
      $stmt->execute([
        ":id" => $lockId,
        ":shop_id" => $shopId,
        ":lock_date" => $lockDate,
        ":locked_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
      $created = true;
    } catch (PDOException $error) {
      $info = $error->errorInfo;
      $code = is_array($info) && isset($info[1]) ? (int)$info[1] : 0;
      if ($code !== 1062) {
        json_response(500, ["error" => "InternalServerError", "message" => "Failed to reconcile day"]);
      }
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT r.id, r.shop_id, s.code AS shop_code, s.name AS shop_name, r.lock_date, r.locked_by_user_id, " .
        "u.full_name AS locked_by_full_name, r.notes, r.created_at, r.updated_at " .
      "FROM reconciliation_locks r " .
      "JOIN shops s ON s.id = r.shop_id " .
      "LEFT JOIN users u ON u.id = r.locked_by_user_id " .
      "WHERE r.shop_id = :shop_id AND r.lock_date = :lock_date LIMIT 1",
      [":shop_id" => $shopId, ":lock_date" => $lockDate]
    );
    if (!$row) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to read reconciliation lock"]);
    }

    $public = [
      "id" => (string)$row["id"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "lockDate" => (string)$row["lock_date"],
      "lockedByUserId" => $row["locked_by_user_id"] ?? null,
      "lockedByFullName" => $row["locked_by_full_name"] ?? null,
      "notes" => $row["notes"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    if ($created) {
      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "reconciliation_lock", (string)$row["id"], null, $public);
    }

    json_response($created ? 201 : 200, ["data" => $public]);
  }

  if ($method === "GET" && $route === "sales") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $requestedSaleDate = isset($_GET["saleDate"]) && is_string($_GET["saleDate"]) ? trim($_GET["saleDate"]) : "";

    $saleDate = $requestedSaleDate;
    if ($saleDate === "" && $roleName !== "ADMIN") {
      $saleDate = phase1_business_today_ymd();
    }
    if ($saleDate !== "" && !is_valid_ymd_date($saleDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "saleDate must be YYYY-MM-DD"]);
    }

    $where = [];
    $params = [];

    if ($roleName === "SALES") {
      $where[] = "sa.user_id = :user_id";
      $params[":user_id"] = (string)($authUser["id"] ?? "");
    } elseif ($roleName === "MANAGER") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $id) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $id;
      }
      $where[] = "sa.shop_id IN (" . implode(", ", $placeholders) . ")";
    }

    if ($requestedShopId !== "") {
      phase1_require_shop_access($roleName, $assignments, $requestedShopId);
      $where[] = "sa.shop_id = :shop_id";
      $params[":shop_id"] = $requestedShopId;
    }
    if ($saleDate !== "") {
      $where[] = "sa.sale_date = :sale_date";
      $params[":sale_date"] = $saleDate;
    }

    if (count($where) < 1) {
      $where[] = "1=1";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT sa.id, sa.shop_id, sh.code AS shop_code, sh.name AS shop_name, sa.user_id, u.full_name AS user_full_name, " .
        "sa.customer_id, c.mobile AS customer_mobile, c.first_name AS customer_first_name, c.last_name AS customer_last_name, " .
        "sa.invoice_id, i.invoice_number, sa.sale_date, sa.payment_method, sa.total_amount, sa.notes, sa.is_void, " .
        "sa.voided_at, sa.voided_by_user_id, sa.created_at, sa.updated_at " .
      "FROM sales sa " .
      "JOIN shops sh ON sh.id = sa.shop_id " .
      "JOIN users u ON u.id = sa.user_id " .
      "LEFT JOIN customers c ON c.id = sa.customer_id " .
      "LEFT JOIN invoices i ON i.id = sa.invoice_id " .
      "WHERE " . implode(" AND ", $where) . " " .
      "ORDER BY sa.sale_date DESC, sa.created_at DESC " .
      "LIMIT 200",
      $params
    );

    $sales = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "userId" => (string)($row["user_id"] ?? ""),
        "userFullName" => (string)($row["user_full_name"] ?? ""),
        "customerId" => $row["customer_id"] === null ? null : (string)$row["customer_id"],
        "customerMobileNumber" => $row["customer_mobile"] ?? null,
        "customerFirstName" => $row["customer_first_name"] ?? null,
        "customerLastName" => $row["customer_last_name"] ?? null,
        "invoiceId" => $row["invoice_id"] === null ? null : (string)$row["invoice_id"],
        "invoiceNumber" => $row["invoice_number"] ?? null,
        "saleDate" => (string)($row["sale_date"] ?? ""),
        "paymentMethod" => (string)($row["payment_method"] ?? ""),
        "totalAmount" => (int)($row["total_amount"] ?? 0),
        "notes" => $row["notes"] ?? null,
        "isVoid" => (int)($row["is_void"] ?? 0) === 1,
        "voidedAt" => $row["voided_at"] ?? null,
        "voidedByUserId" => $row["voided_by_user_id"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $sales]);
  }

  if ($method === "GET" && preg_match('/^sales\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $saleId = (string)$matches[1];

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT sa.id, sa.shop_id, sh.code AS shop_code, sh.name AS shop_name, sa.user_id, u.full_name AS user_full_name, " .
        "sa.customer_id, c.mobile AS customer_mobile, c.first_name AS customer_first_name, c.last_name AS customer_last_name, " .
        "sa.invoice_id, i.invoice_number, sa.sale_date, sa.payment_method, sa.total_amount, sa.notes, sa.is_void, " .
        "sa.voided_at, sa.voided_by_user_id, sa.created_at, sa.updated_at " .
      "FROM sales sa " .
      "JOIN shops sh ON sh.id = sa.shop_id " .
      "JOIN users u ON u.id = sa.user_id " .
      "LEFT JOIN customers c ON c.id = sa.customer_id " .
      "LEFT JOIN invoices i ON i.id = sa.invoice_id " .
      "WHERE sa.id = :id LIMIT 1",
      [":id" => $saleId]
    );
    if (!$row) {
      json_response(404, ["error" => "HttpError", "message" => "Sale not found"]);
    }

    phase1_require_shop_access($roleName, $assignments, (string)$row["shop_id"]);
    if ($roleName === "SALES" && (string)($row["user_id"] ?? "") !== (string)($authUser["id"] ?? "")) {
      json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
    }

    $sale = [
      "id" => (string)$row["id"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "userId" => (string)$row["user_id"],
      "userFullName" => (string)$row["user_full_name"],
      "customerId" => $row["customer_id"] === null ? null : (string)$row["customer_id"],
      "customerMobileNumber" => $row["customer_mobile"] ?? null,
      "customerFirstName" => $row["customer_first_name"] ?? null,
      "customerLastName" => $row["customer_last_name"] ?? null,
      "invoiceId" => $row["invoice_id"] === null ? null : (string)$row["invoice_id"],
      "invoiceNumber" => $row["invoice_number"] ?? null,
      "saleDate" => (string)$row["sale_date"],
      "paymentMethod" => (string)$row["payment_method"],
      "totalAmount" => (int)$row["total_amount"],
      "notes" => $row["notes"] ?? null,
      "isVoid" => (int)$row["is_void"] === 1,
      "voidedAt" => $row["voided_at"] ?? null,
      "voidedByUserId" => $row["voided_by_user_id"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ];

    $linesRows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes, created_at, updated_at " .
      "FROM sale_lines WHERE sale_id = :sale_id ORDER BY sort_order ASC, created_at ASC",
      [":sale_id" => $saleId]
    );

    $lines = array_map(function ($line) {
      return [
        "id" => (string)($line["id"] ?? ""),
        "saleId" => (string)($line["sale_id"] ?? ""),
        "sortOrder" => (int)($line["sort_order"] ?? 0),
        "productId" => (string)($line["product_id"] ?? ""),
        "skuCode" => (string)($line["sku_code"] ?? ""),
        "productName" => (string)($line["product_name"] ?? ""),
        "quantity" => (int)($line["quantity"] ?? 0),
        "unitPrice" => (int)($line["unit_price"] ?? 0),
        "lineTotal" => (int)($line["line_total"] ?? 0),
        "notes" => $line["notes"] ?? null,
        "createdAt" => (string)($line["created_at"] ?? ""),
        "updatedAt" => (string)($line["updated_at"] ?? ""),
      ];
    }, $linesRows);

    json_response(200, ["data" => ["sale" => $sale, "lines" => $lines]]);
  }

  if ($method === "POST" && $route === "sales") {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $body = read_json_body();

    $requestedShopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";
    $requestedSaleDate = isset($body["saleDate"]) && is_string($body["saleDate"]) ? trim($body["saleDate"]) : "";
    $paymentMethod = isset($body["paymentMethod"]) && is_string($body["paymentMethod"]) ? trim($body["paymentMethod"]) : "";
    $customerId = isset($body["customerId"]) && is_string($body["customerId"]) ? trim($body["customerId"]) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if (!in_array($paymentMethod, ["CASH", "MOBILE_MONEY", "CARD", "CREDIT"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "paymentMethod must be CASH, MOBILE_MONEY, CARD, or CREDIT"]);
    }
    if ($paymentMethod === "CREDIT" && $customerId === "") {
      json_response(400, ["error" => "ValidationError", "message" => "customerId is required for CREDIT sales"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }
    if (!is_array($linesPayload) || count($linesPayload) < 1) {
      json_response(400, ["error" => "ValidationError", "message" => "lines (non-empty array) is required"]);
    }

    $shopId = $requestedShopId;
    $saleDate = $requestedSaleDate;
    if ($roleName !== "ADMIN") {
      $shopId = phase1_primary_shop_id($assignments);
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "Sales user is not assigned to a shop"]);
      }
      $saleDate = phase1_business_today_ymd();
    } else {
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "shopId is required"]);
      }
      if ($saleDate === "") {
        $saleDate = phase1_business_today_ymd();
      }
    }

    if (!is_valid_ymd_date($saleDate)) {
      json_response(400, ["error" => "ValidationError", "message" => "saleDate must be YYYY-MM-DD"]);
    }

    if ($roleName !== "ADMIN" && phase1_is_shop_date_locked($pdo, $shopId, $saleDate)) {
      json_response(400, ["error" => "BadRequest", "message" => "This day is reconciled (locked)"]);
    }

    $shopRow = phase1_db_fetch_one(
      $pdo,
      "SELECT id, code, name FROM shops WHERE id = :id LIMIT 1",
      [":id" => $shopId]
    );
    if (!$shopRow) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid shopId"]);
    }

    $customerRow = null;
    if ($customerId !== "") {
      $customerRow = phase1_db_fetch_one(
        $pdo,
        "SELECT id, mobile, first_name, last_name, email, is_active FROM customers WHERE id = :id LIMIT 1",
        [":id" => $customerId]
      );
      if (!$customerRow) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid customerId"]);
      }
      if ((int)($customerRow["is_active"] ?? 0) !== 1) {
        json_response(400, ["error" => "ValidationError", "message" => "Customer is inactive"]);
      }
    }

    $materializedLines = [];
    $totalAmount = 0;
    foreach ($linesPayload as $idx => $rawLine) {
      if (!is_array($rawLine)) {
        json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
      }
      $productId = isset($rawLine["productId"]) && is_string($rawLine["productId"]) ? trim($rawLine["productId"]) : "";
      $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
      $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
      $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;

      if ($productId === "" || $quantity < 1 || $unitPrice < 0) {
        json_response(400, ["error" => "ValidationError", "message" => "Line requires productId, quantity (>=1), unitPrice (>=0)"]);
      }
      if ($lineNotes !== null && !is_string($lineNotes)) {
        json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
      }

      $productRow = phase1_db_fetch_one(
        $pdo,
        "SELECT id, sku_code, name, is_active FROM products WHERE id = :id LIMIT 1",
        [":id" => $productId]
      );
      if (!$productRow) {
        json_response(400, ["error" => "ValidationError", "message" => "Invalid productId"]);
      }
      if ((int)($productRow["is_active"] ?? 0) !== 1) {
        json_response(400, ["error" => "ValidationError", "message" => "Product is inactive"]);
      }

      $lineTotal = $quantity * $unitPrice;
      if ($lineTotal < 0 || $lineTotal > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
      }
      $totalAmount += $lineTotal;
      if ($totalAmount > 2000000000) {
        json_response(400, ["error" => "ValidationError", "message" => "Sale total is too large"]);
      }

      $materializedLines[] = [
        "sortOrder" => (int)$idx + 1,
        "productId" => (string)$productRow["id"],
        "skuCode" => (string)$productRow["sku_code"],
        "productName" => (string)$productRow["name"],
        "quantity" => $quantity,
        "unitPrice" => $unitPrice,
        "lineTotal" => $lineTotal,
        "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
      ];
    }

    if ($totalAmount <= 0) {
      json_response(400, ["error" => "ValidationError", "message" => "Sale total must be > 0"]);
    }

    $saleId = create_id("sale");
    $actorUserId = (string)($authUser["id"] ?? "");
    $invoiceId = null;
    $invoiceNumber = null;
    $invoicePublic = null;
    $invoiceLinesPublic = [];

    try {
      $pdo->beginTransaction();

      if ($paymentMethod === "CREDIT") {
        $invoiceId = create_id("inv");

        // Ensure counter row exists, then lock it.
        $stmtCounterInit = $pdo->prepare(
          "INSERT INTO shop_invoice_counters (shop_id, next_seq) VALUES (:shop_id, 1) " .
          "ON DUPLICATE KEY UPDATE shop_id = shop_id"
        );
        $stmtCounterInit->execute([":shop_id" => $shopId]);

        $counterRow = phase1_db_fetch_one(
          $pdo,
          "SELECT next_seq FROM shop_invoice_counters WHERE shop_id = :shop_id FOR UPDATE",
          [":shop_id" => $shopId]
        );
        if (!$counterRow) {
          throw new RuntimeException("Failed to acquire invoice counter lock");
        }

        $seq = (int)($counterRow["next_seq"] ?? 1);
        if ($seq < 1) {
          $seq = 1;
        }
        phase1_db_execute(
          $pdo,
          "UPDATE shop_invoice_counters SET next_seq = :next_seq, updated_at = NOW() WHERE shop_id = :shop_id",
          [":next_seq" => $seq + 1, ":shop_id" => $shopId]
        );

        $shopCode = (string)($shopRow["code"] ?? "");
        $invoiceNumber = $shopCode . "-" . str_pad((string)$seq, 6, "0", STR_PAD_LEFT);

        $stmtInvoice = $pdo->prepare(
          "INSERT INTO invoices (id, shop_id, sequence_number, invoice_number, customer_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_by_user_id) " .
          "VALUES (:id, :shop_id, :sequence_number, :invoice_number, :customer_id, 'ISSUED', :issued_at, NULL, :total_amount, 0, :balance, :notes, :created_by_user_id)"
        );
        $issuedAt = gmdate("Y-m-d H:i:s");
        $stmtInvoice->execute([
          ":id" => $invoiceId,
          ":shop_id" => $shopId,
          ":sequence_number" => $seq,
          ":invoice_number" => $invoiceNumber,
          ":customer_id" => $customerId,
          ":issued_at" => $issuedAt,
          ":total_amount" => $totalAmount,
          ":balance" => $totalAmount,
          ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
          ":created_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
        ]);

        $stmtInvoiceLine = $pdo->prepare(
          "INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit_price, line_total, notes) " .
          "VALUES (:id, :invoice_id, :sort_order, :description, :quantity, :unit_price, :line_total, :notes)"
        );
        foreach ($materializedLines as $line) {
          $lineId = create_id("line");
          $stmtInvoiceLine->execute([
            ":id" => $lineId,
            ":invoice_id" => $invoiceId,
            ":sort_order" => (int)$line["sortOrder"],
            ":description" => (string)$line["productName"],
            ":quantity" => (int)$line["quantity"],
            ":unit_price" => (int)$line["unitPrice"],
            ":line_total" => (int)$line["lineTotal"],
            ":notes" => $line["notes"] ?? null,
          ]);
          $invoiceLinesPublic[] = [
            "id" => $lineId,
            "invoiceId" => $invoiceId,
            "sortOrder" => (int)$line["sortOrder"],
            "description" => (string)$line["productName"],
            "quantity" => (int)$line["quantity"],
            "unitPrice" => (int)$line["unitPrice"],
            "lineTotal" => (int)$line["lineTotal"],
            "notes" => $line["notes"] ?? null,
          ];
        }

        $invoicePublic = [
          "id" => $invoiceId,
          "invoiceNumber" => $invoiceNumber,
          "shopId" => $shopId,
          "shopCode" => (string)($shopRow["code"] ?? ""),
          "shopName" => (string)($shopRow["name"] ?? ""),
          "sequenceNumber" => $seq,
          "customerId" => $customerId,
          "customerMobileNumber" => $customerRow ? (string)($customerRow["mobile"] ?? "") : null,
          "customerFirstName" => $customerRow ? (string)($customerRow["first_name"] ?? "") : null,
          "customerLastName" => $customerRow ? (string)($customerRow["last_name"] ?? "") : null,
          "customerEmail" => $customerRow ? ($customerRow["email"] ?? null) : null,
          "status" => "ISSUED",
          "issuedAt" => $issuedAt,
          "dueDate" => null,
          "totalAmount" => $totalAmount,
          "paidAmount" => 0,
          "balance" => $totalAmount,
          "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        ];

        phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "invoice", $invoiceId, null, [
          "invoice" => $invoicePublic,
          "lines" => $invoiceLinesPublic,
        ]);
      }

      $stmtSale = $pdo->prepare(
        "INSERT INTO sales (id, shop_id, user_id, customer_id, invoice_id, sale_date, payment_method, total_amount, notes) " .
        "VALUES (:id, :shop_id, :user_id, :customer_id, :invoice_id, :sale_date, :payment_method, :total_amount, :notes)"
      );
      $stmtSale->execute([
        ":id" => $saleId,
        ":shop_id" => $shopId,
        ":user_id" => $actorUserId,
        ":customer_id" => $customerId !== "" ? $customerId : null,
        ":invoice_id" => $invoiceId,
        ":sale_date" => $saleDate,
        ":payment_method" => $paymentMethod,
        ":total_amount" => $totalAmount,
        ":notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);

      $stmtSaleLine = $pdo->prepare(
        "INSERT INTO sale_lines (id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes) " .
        "VALUES (:id, :sale_id, :sort_order, :product_id, :sku_code, :product_name, :quantity, :unit_price, :line_total, :notes)"
      );
      $saleLinesPublic = [];
      foreach ($materializedLines as $line) {
        $saleLineId = create_id("sline");
        $stmtSaleLine->execute([
          ":id" => $saleLineId,
          ":sale_id" => $saleId,
          ":sort_order" => (int)$line["sortOrder"],
          ":product_id" => (string)$line["productId"],
          ":sku_code" => (string)$line["skuCode"],
          ":product_name" => (string)$line["productName"],
          ":quantity" => (int)$line["quantity"],
          ":unit_price" => (int)$line["unitPrice"],
          ":line_total" => (int)$line["lineTotal"],
          ":notes" => $line["notes"] ?? null,
        ]);
        $saleLinesPublic[] = [
          "id" => $saleLineId,
          "saleId" => $saleId,
          "sortOrder" => (int)$line["sortOrder"],
          "productId" => (string)$line["productId"],
          "skuCode" => (string)$line["skuCode"],
          "productName" => (string)$line["productName"],
          "quantity" => (int)$line["quantity"],
          "unitPrice" => (int)$line["unitPrice"],
          "lineTotal" => (int)$line["lineTotal"],
          "notes" => $line["notes"] ?? null,
        ];
      }

      $saleAudit = [
        "id" => $saleId,
        "shopId" => $shopId,
        "userId" => $actorUserId,
        "customerId" => $customerId !== "" ? $customerId : null,
        "invoiceId" => $invoiceId,
        "invoiceNumber" => $invoiceNumber,
        "saleDate" => $saleDate,
        "paymentMethod" => $paymentMethod,
        "totalAmount" => $totalAmount,
        "notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ];

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "sale", $saleId, null, [
        "sale" => $saleAudit,
        "lines" => $saleLinesPublic,
      ]);

      $pdo->commit();

      $createdSaleRow = phase1_db_fetch_one(
        $pdo,
        "SELECT sa.id, sa.shop_id, sh.code AS shop_code, sh.name AS shop_name, sa.user_id, u.full_name AS user_full_name, " .
          "sa.customer_id, c.mobile AS customer_mobile, c.first_name AS customer_first_name, c.last_name AS customer_last_name, " .
          "sa.invoice_id, i.invoice_number, sa.sale_date, sa.payment_method, sa.total_amount, sa.notes, sa.is_void, " .
          "sa.voided_at, sa.voided_by_user_id, sa.created_at, sa.updated_at " .
        "FROM sales sa " .
        "JOIN shops sh ON sh.id = sa.shop_id " .
        "JOIN users u ON u.id = sa.user_id " .
        "LEFT JOIN customers c ON c.id = sa.customer_id " .
        "LEFT JOIN invoices i ON i.id = sa.invoice_id " .
        "WHERE sa.id = :id LIMIT 1",
        [":id" => $saleId]
      );
      if (!$createdSaleRow) {
        json_response(201, ["data" => ["sale" => $saleAudit, "lines" => $saleLinesPublic]]);
      }

      $outSale = [
        "id" => (string)$createdSaleRow["id"],
        "shopId" => (string)$createdSaleRow["shop_id"],
        "shopCode" => (string)$createdSaleRow["shop_code"],
        "shopName" => (string)$createdSaleRow["shop_name"],
        "userId" => (string)$createdSaleRow["user_id"],
        "userFullName" => (string)$createdSaleRow["user_full_name"],
        "customerId" => $createdSaleRow["customer_id"] === null ? null : (string)$createdSaleRow["customer_id"],
        "customerMobileNumber" => $createdSaleRow["customer_mobile"] ?? null,
        "customerFirstName" => $createdSaleRow["customer_first_name"] ?? null,
        "customerLastName" => $createdSaleRow["customer_last_name"] ?? null,
        "invoiceId" => $createdSaleRow["invoice_id"] === null ? null : (string)$createdSaleRow["invoice_id"],
        "invoiceNumber" => $createdSaleRow["invoice_number"] ?? null,
        "saleDate" => (string)$createdSaleRow["sale_date"],
        "paymentMethod" => (string)$createdSaleRow["payment_method"],
        "totalAmount" => (int)$createdSaleRow["total_amount"],
        "notes" => $createdSaleRow["notes"] ?? null,
        "isVoid" => (int)($createdSaleRow["is_void"] ?? 0) === 1,
        "voidedAt" => $createdSaleRow["voided_at"] ?? null,
        "voidedByUserId" => $createdSaleRow["voided_by_user_id"] ?? null,
        "createdAt" => (string)$createdSaleRow["created_at"],
        "updatedAt" => (string)$createdSaleRow["updated_at"],
      ];

      $createdLines = phase1_db_fetch_all(
        $pdo,
        "SELECT id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM sale_lines WHERE sale_id = :sale_id ORDER BY sort_order ASC, created_at ASC",
        [":sale_id" => $saleId]
      );
      $outLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "saleId" => (string)($line["sale_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "productId" => (string)($line["product_id"] ?? ""),
          "skuCode" => (string)($line["sku_code"] ?? ""),
          "productName" => (string)($line["product_name"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $createdLines);

      json_response(201, ["data" => ["sale" => $outSale, "lines" => $outLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create sale"]);
    }
  }

  if ($method === "PATCH" && preg_match('/^sales\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $saleId = (string)$matches[1];
    $body = read_json_body();

    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $linesPayload = array_key_exists("lines", $body) ? $body["lines"] : null;

    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }
    if ($linesPayload !== null && (!is_array($linesPayload) || count($linesPayload) < 1)) {
      json_response(400, ["error" => "ValidationError", "message" => "lines must be a non-empty array when provided"]);
    }
    if ($notes === null && $linesPayload === null) {
      json_response(400, ["error" => "ValidationError", "message" => "No fields to update"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");
    $today = phase1_business_today_ymd();

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, user_id, invoice_id, payment_method, sale_date, total_amount, notes, is_void, created_at, updated_at " .
        "FROM sales WHERE id = :id FOR UPDATE",
        [":id" => $saleId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Sale not found"]);
      }

      $shopId = (string)($existing["shop_id"] ?? "");
      phase1_require_shop_access($roleName, $assignments, $shopId);

      if ((int)($existing["is_void"] ?? 0) === 1) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Sale is void"]);
      }

      if ($roleName === "SALES") {
        if ((string)($existing["user_id"] ?? "") !== $actorUserId) {
          $pdo->rollBack();
          json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
        }
        if ((string)($existing["sale_date"] ?? "") !== $today) {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Sales can only edit same-day sales"]);
        }
        if (phase1_is_shop_date_locked($pdo, $shopId, $today)) {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "This day is reconciled (locked)"]);
        }
      }

      $paymentMethod = (string)($existing["payment_method"] ?? "");
      $invoiceId = $existing["invoice_id"] === null ? "" : (string)$existing["invoice_id"];
      if ($linesPayload !== null && ($paymentMethod === "CREDIT" || $invoiceId !== "")) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Credit sales cannot edit line items (manage via invoices)"]);
      }

      $beforeLinesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM sale_lines WHERE sale_id = :sale_id ORDER BY sort_order ASC, created_at ASC",
        [":sale_id" => $saleId]
      );
      $beforeLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "saleId" => (string)($line["sale_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "productId" => (string)($line["product_id"] ?? ""),
          "skuCode" => (string)($line["sku_code"] ?? ""),
          "productName" => (string)($line["product_name"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $beforeLinesRows);

      $beforeSale = [
        "id" => (string)$existing["id"],
        "shopId" => (string)$existing["shop_id"],
        "userId" => (string)$existing["user_id"],
        "invoiceId" => $existing["invoice_id"] === null ? null : (string)$existing["invoice_id"],
        "saleDate" => (string)$existing["sale_date"],
        "paymentMethod" => (string)$existing["payment_method"],
        "totalAmount" => (int)$existing["total_amount"],
        "notes" => $existing["notes"] ?? null,
        "isVoid" => (int)($existing["is_void"] ?? 0) === 1,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      $newTotalAmount = (int)$existing["total_amount"];
      $newNotesValue = $notes !== null ? (is_string($notes) && trim($notes) !== "" ? trim($notes) : null) : ($existing["notes"] ?? null);

      if ($linesPayload !== null) {
        $materializedLines = [];
        $newTotalAmount = 0;
        foreach ($linesPayload as $idx => $rawLine) {
          if (!is_array($rawLine)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Each line must be an object"]);
          }
          $productId = isset($rawLine["productId"]) && is_string($rawLine["productId"]) ? trim($rawLine["productId"]) : "";
          $quantity = isset($rawLine["quantity"]) ? (int)$rawLine["quantity"] : 0;
          $unitPrice = isset($rawLine["unitPrice"]) ? (int)$rawLine["unitPrice"] : 0;
          $lineNotes = array_key_exists("notes", $rawLine) ? $rawLine["notes"] : null;

          if ($productId === "" || $quantity < 1 || $unitPrice < 0) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line requires productId, quantity (>=1), unitPrice (>=0)"]);
          }
          if ($lineNotes !== null && !is_string($lineNotes)) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line notes must be a string or null"]);
          }

          $productRow = phase1_db_fetch_one(
            $pdo,
            "SELECT id, sku_code, name, is_active FROM products WHERE id = :id LIMIT 1",
            [":id" => $productId]
          );
          if (!$productRow) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Invalid productId"]);
          }
          if ((int)($productRow["is_active"] ?? 0) !== 1) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Product is inactive"]);
          }

          $lineTotal = $quantity * $unitPrice;
          if ($lineTotal < 0 || $lineTotal > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Line total is too large"]);
          }
          $newTotalAmount += $lineTotal;
          if ($newTotalAmount > 2000000000) {
            $pdo->rollBack();
            json_response(400, ["error" => "ValidationError", "message" => "Sale total is too large"]);
          }

          $materializedLines[] = [
            "sortOrder" => (int)$idx + 1,
            "productId" => (string)$productRow["id"],
            "skuCode" => (string)$productRow["sku_code"],
            "productName" => (string)$productRow["name"],
            "quantity" => $quantity,
            "unitPrice" => $unitPrice,
            "lineTotal" => $lineTotal,
            "notes" => is_string($lineNotes) && trim($lineNotes) !== "" ? trim($lineNotes) : null,
          ];
        }

        if ($newTotalAmount <= 0) {
          $pdo->rollBack();
          json_response(400, ["error" => "ValidationError", "message" => "Sale total must be > 0"]);
        }

        phase1_db_execute($pdo, "DELETE FROM sale_lines WHERE sale_id = :sale_id", [":sale_id" => $saleId]);

        $stmtSaleLine = $pdo->prepare(
          "INSERT INTO sale_lines (id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes) " .
          "VALUES (:id, :sale_id, :sort_order, :product_id, :sku_code, :product_name, :quantity, :unit_price, :line_total, :notes)"
        );
        foreach ($materializedLines as $line) {
          $saleLineId = create_id("sline");
          $stmtSaleLine->execute([
            ":id" => $saleLineId,
            ":sale_id" => $saleId,
            ":sort_order" => (int)$line["sortOrder"],
            ":product_id" => (string)$line["productId"],
            ":sku_code" => (string)$line["skuCode"],
            ":product_name" => (string)$line["productName"],
            ":quantity" => (int)$line["quantity"],
            ":unit_price" => (int)$line["unitPrice"],
            ":line_total" => (int)$line["lineTotal"],
            ":notes" => $line["notes"] ?? null,
          ]);
        }
      }

      phase1_db_execute(
        $pdo,
        "UPDATE sales SET total_amount = :total_amount, notes = :notes, updated_at = NOW() WHERE id = :id",
        [":total_amount" => $newTotalAmount, ":notes" => $newNotesValue, ":id" => $saleId]
      );

      $updatedRow = phase1_db_fetch_one(
        $pdo,
        "SELECT sa.id, sa.shop_id, sh.code AS shop_code, sh.name AS shop_name, sa.user_id, u.full_name AS user_full_name, " .
          "sa.customer_id, c.mobile AS customer_mobile, c.first_name AS customer_first_name, c.last_name AS customer_last_name, " .
          "sa.invoice_id, i.invoice_number, sa.sale_date, sa.payment_method, sa.total_amount, sa.notes, sa.is_void, " .
          "sa.voided_at, sa.voided_by_user_id, sa.created_at, sa.updated_at " .
        "FROM sales sa " .
        "JOIN shops sh ON sh.id = sa.shop_id " .
        "JOIN users u ON u.id = sa.user_id " .
        "LEFT JOIN customers c ON c.id = sa.customer_id " .
        "LEFT JOIN invoices i ON i.id = sa.invoice_id " .
        "WHERE sa.id = :id LIMIT 1",
        [":id" => $saleId]
      );

      $updatedLinesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM sale_lines WHERE sale_id = :sale_id ORDER BY sort_order ASC, created_at ASC",
        [":sale_id" => $saleId]
      );

      $afterLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "saleId" => (string)($line["sale_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "productId" => (string)($line["product_id"] ?? ""),
          "skuCode" => (string)($line["sku_code"] ?? ""),
          "productName" => (string)($line["product_name"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $updatedLinesRows);

      $afterSale = $updatedRow ? [
        "id" => (string)$updatedRow["id"],
        "shopId" => (string)$updatedRow["shop_id"],
        "shopCode" => (string)$updatedRow["shop_code"],
        "shopName" => (string)$updatedRow["shop_name"],
        "userId" => (string)$updatedRow["user_id"],
        "userFullName" => (string)$updatedRow["user_full_name"],
        "customerId" => $updatedRow["customer_id"] === null ? null : (string)$updatedRow["customer_id"],
        "customerMobileNumber" => $updatedRow["customer_mobile"] ?? null,
        "customerFirstName" => $updatedRow["customer_first_name"] ?? null,
        "customerLastName" => $updatedRow["customer_last_name"] ?? null,
        "invoiceId" => $updatedRow["invoice_id"] === null ? null : (string)$updatedRow["invoice_id"],
        "invoiceNumber" => $updatedRow["invoice_number"] ?? null,
        "saleDate" => (string)$updatedRow["sale_date"],
        "paymentMethod" => (string)$updatedRow["payment_method"],
        "totalAmount" => (int)$updatedRow["total_amount"],
        "notes" => $updatedRow["notes"] ?? null,
        "isVoid" => (int)($updatedRow["is_void"] ?? 0) === 1,
        "voidedAt" => $updatedRow["voided_at"] ?? null,
        "voidedByUserId" => $updatedRow["voided_by_user_id"] ?? null,
        "createdAt" => (string)$updatedRow["created_at"],
        "updatedAt" => (string)$updatedRow["updated_at"],
      ] : $beforeSale;

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "sale", $saleId, [
        "sale" => $beforeSale,
        "lines" => $beforeLines,
      ], [
        "sale" => $afterSale,
        "lines" => $afterLines,
      ]);

      $pdo->commit();

      json_response(200, ["data" => ["sale" => $afterSale, "lines" => $afterLines]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to update sale"]);
    }
  }

  if ($method === "DELETE" && preg_match('/^sales\\/([^\\/]+)$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "SALES"]);
    $saleId = (string)$matches[1];

    $actorUserId = (string)($authUser["id"] ?? "");
    $today = phase1_business_today_ymd();

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, user_id, invoice_id, payment_method, sale_date, total_amount, notes, is_void, created_at, updated_at " .
        "FROM sales WHERE id = :id FOR UPDATE",
        [":id" => $saleId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Sale not found"]);
      }

      $shopId = (string)($existing["shop_id"] ?? "");
      phase1_require_shop_access($roleName, $assignments, $shopId);

      if ((int)($existing["is_void"] ?? 0) === 1) {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Sale is already void"]);
      }

      $paymentMethod = (string)($existing["payment_method"] ?? "");
      $invoiceId = $existing["invoice_id"] === null ? "" : (string)$existing["invoice_id"];

      if ($roleName === "SALES") {
        if ((string)($existing["user_id"] ?? "") !== $actorUserId) {
          $pdo->rollBack();
          json_response(403, ["error" => "HttpError", "message" => "Forbidden"]);
        }
        if ((string)($existing["sale_date"] ?? "") !== $today) {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "Sales can only void same-day sales"]);
        }
        if (phase1_is_shop_date_locked($pdo, $shopId, $today)) {
          $pdo->rollBack();
          json_response(400, ["error" => "BadRequest", "message" => "This day is reconciled (locked)"]);
        }
        if ($paymentMethod === "CREDIT" || $invoiceId !== "") {
          $pdo->rollBack();
          json_response(403, ["error" => "HttpError", "message" => "Credit sales can only be voided by admin (invoice void required)"]);
        }
      }

      $beforeLinesRows = phase1_db_fetch_all(
        $pdo,
        "SELECT id, sale_id, sort_order, product_id, sku_code, product_name, quantity, unit_price, line_total, notes, created_at, updated_at " .
        "FROM sale_lines WHERE sale_id = :sale_id ORDER BY sort_order ASC, created_at ASC",
        [":sale_id" => $saleId]
      );
      $beforeLines = array_map(function ($line) {
        return [
          "id" => (string)($line["id"] ?? ""),
          "saleId" => (string)($line["sale_id"] ?? ""),
          "sortOrder" => (int)($line["sort_order"] ?? 0),
          "productId" => (string)($line["product_id"] ?? ""),
          "skuCode" => (string)($line["sku_code"] ?? ""),
          "productName" => (string)($line["product_name"] ?? ""),
          "quantity" => (int)($line["quantity"] ?? 0),
          "unitPrice" => (int)($line["unit_price"] ?? 0),
          "lineTotal" => (int)($line["line_total"] ?? 0),
          "notes" => $line["notes"] ?? null,
          "createdAt" => (string)($line["created_at"] ?? ""),
          "updatedAt" => (string)($line["updated_at"] ?? ""),
        ];
      }, $beforeLinesRows);

      $beforeSale = [
        "id" => (string)$existing["id"],
        "shopId" => (string)$existing["shop_id"],
        "userId" => (string)$existing["user_id"],
        "invoiceId" => $existing["invoice_id"] === null ? null : (string)$existing["invoice_id"],
        "saleDate" => (string)$existing["sale_date"],
        "paymentMethod" => (string)$existing["payment_method"],
        "totalAmount" => (int)$existing["total_amount"],
        "notes" => $existing["notes"] ?? null,
        "isVoid" => (int)($existing["is_void"] ?? 0) === 1,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      phase1_db_execute(
        $pdo,
        "UPDATE sales SET is_void = 1, voided_at = NOW(), voided_by_user_id = :actor, updated_at = NOW() WHERE id = :id",
        [":actor" => $actorUserId !== "" ? $actorUserId : null, ":id" => $saleId]
      );

      if ($roleName === "ADMIN" && $invoiceId !== "") {
        phase1_db_execute(
          $pdo,
          "UPDATE invoices SET status = 'VOID', voided_at = NOW(), voided_by_user_id = :actor, updated_at = NOW() WHERE id = :id",
          [":actor" => $actorUserId !== "" ? $actorUserId : null, ":id" => $invoiceId]
        );

        $invoiceRow = phase1_db_fetch_one(
          $pdo,
          "SELECT id, shop_id, status, issued_at, due_date, total_amount, paid_amount, balance, notes, created_at, updated_at FROM invoices WHERE id = :id LIMIT 1",
          [":id" => $invoiceId]
        );
        if ($invoiceRow) {
          phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "invoice", (string)$invoiceRow["id"], null, [
            "id" => (string)$invoiceRow["id"],
            "status" => (string)$invoiceRow["status"],
            "issuedAt" => $invoiceRow["issued_at"] ?? null,
            "totalAmount" => (int)$invoiceRow["total_amount"],
            "paidAmount" => (int)$invoiceRow["paid_amount"],
            "balance" => (int)$invoiceRow["balance"],
          ]);
        }
      }

      $updatedRow = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, user_id, invoice_id, payment_method, sale_date, total_amount, notes, is_void, voided_at, voided_by_user_id, created_at, updated_at " .
        "FROM sales WHERE id = :id LIMIT 1",
        [":id" => $saleId]
      );

      $afterSale = $updatedRow ? [
        "id" => (string)$updatedRow["id"],
        "shopId" => (string)$updatedRow["shop_id"],
        "userId" => (string)$updatedRow["user_id"],
        "invoiceId" => $updatedRow["invoice_id"] === null ? null : (string)$updatedRow["invoice_id"],
        "saleDate" => (string)$updatedRow["sale_date"],
        "paymentMethod" => (string)$updatedRow["payment_method"],
        "totalAmount" => (int)$updatedRow["total_amount"],
        "notes" => $updatedRow["notes"] ?? null,
        "isVoid" => (int)($updatedRow["is_void"] ?? 0) === 1,
        "voidedAt" => $updatedRow["voided_at"] ?? null,
        "voidedByUserId" => $updatedRow["voided_by_user_id"] ?? null,
        "createdAt" => (string)$updatedRow["created_at"],
        "updatedAt" => (string)$updatedRow["updated_at"],
      ] : $beforeSale;

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "sale", $saleId, [
        "sale" => $beforeSale,
        "lines" => $beforeLines,
      ], [
        "sale" => $afterSale,
        "lines" => $beforeLines,
      ]);

      $pdo->commit();
      json_response(200, ["data" => ["sale" => $afterSale]]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to void sale"]);
    }
  }

  // Phase 6 — Cash Tracking (derived cash at hand + approvals)
  if ($method === "GET" && $route === "cash/me") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $userId = (string)($authUser["id"] ?? "");
    $summary = phase1_cash_summary($pdo, $userId);
    json_response(200, ["data" => array_merge(["userId" => $userId, "computedAt" => now_iso()], $summary)]);
  }

  if ($method === "GET" && $route === "cash/recipients") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $viewerUserId = (string)($authUser["id"] ?? "");

    if ($roleName === "ADMIN") {
      $params = [":viewer_user_id" => $viewerUserId];
      $where = ["u.is_active = 1", "u.id <> :viewer_user_id"];
      if ($shopId !== "") {
        $where[] = "(r.name = 'ADMIN' OR EXISTS (" .
          "SELECT 1 FROM user_shop_assignment a WHERE a.user_id = u.id AND a.unassigned_at IS NULL AND a.shop_id = :shop_id" .
        "))";
        $params[":shop_id"] = $shopId;
      }

      $rows = phase1_db_fetch_all(
        $pdo,
        "SELECT DISTINCT u.id, u.full_name, r.name AS role_name " .
          "FROM users u JOIN roles r ON r.id = u.role_id " .
          "WHERE " . implode(" AND ", $where) . " " .
          "ORDER BY (r.name = 'ADMIN') DESC, u.full_name ASC",
        $params
      );

      $recipients = array_map(function ($row) {
        return [
          "id" => (string)($row["id"] ?? ""),
          "fullName" => (string)($row["full_name"] ?? ""),
          "role" => (string)($row["role_name"] ?? ""),
        ];
      }, $rows);

      json_response(200, ["data" => $recipients]);
    }

    $shopIds = phase1_assigned_shop_ids($assignments);
    if (count($shopIds) < 1) {
      json_response(200, ["data" => []]);
    }

    $placeholders = [];
    $params = [":viewer_user_id" => $viewerUserId];
    foreach ($shopIds as $idx => $id) {
      $key = ":shop_" . (string)$idx;
      $placeholders[] = $key;
      $params[$key] = $id;
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT DISTINCT u.id, u.full_name, r.name AS role_name " .
        "FROM users u " .
        "JOIN roles r ON r.id = u.role_id " .
        "LEFT JOIN user_shop_assignment a ON a.user_id = u.id AND a.unassigned_at IS NULL " .
        "WHERE u.is_active = 1 AND u.id <> :viewer_user_id " .
          "AND (r.name = 'ADMIN' OR a.shop_id IN (" . implode(", ", $placeholders) . ")) " .
        "ORDER BY (r.name = 'ADMIN') DESC, u.full_name ASC",
      $params
    );

    $recipients = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "fullName" => (string)($row["full_name"] ?? ""),
        "role" => (string)($row["role_name"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $recipients]);
  }

  if ($method === "GET" && $route === "cash/transfers") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $status = isset($_GET["status"]) && is_string($_GET["status"]) ? strtoupper(trim($_GET["status"])) : "";
    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";

    if ($status !== "" && !in_array($status, ["PENDING", "APPROVED", "REJECTED"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "status must be PENDING, APPROVED, or REJECTED"]);
    }

    $where = [];
    $params = [];

    if ($roleName === "SALES") {
      $viewerUserId = (string)($authUser["id"] ?? "");
      $where[] = "(t.sender_user_id = :viewer_user_id OR t.receiver_user_id = :viewer_user_id)";
      $params[":viewer_user_id"] = $viewerUserId;
    } elseif ($roleName === "MANAGER") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $id) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $id;
      }
      $where[] = "t.shop_id IN (" . implode(", ", $placeholders) . ")";
    } else {
      if ($shopId !== "") {
        $where[] = "t.shop_id = :shop_id";
        $params[":shop_id"] = $shopId;
      }
    }

    if ($status !== "") {
      $where[] = "t.status = :status";
      $params[":status"] = $status;
    }

    if (count($where) < 1) {
      $where[] = "1=1";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT t.id, t.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
        "t.sender_user_id, su.full_name AS sender_full_name, " .
        "t.receiver_user_id, ru.full_name AS receiver_full_name, " .
        "t.amount_ugx, t.status, t.request_notes, t.decision_notes, t.decided_at, t.decided_by_user_id, du.full_name AS decided_by_full_name, " .
        "t.created_at, t.updated_at " .
      "FROM cash_transfers t " .
      "JOIN shops sh ON sh.id = t.shop_id " .
      "JOIN users su ON su.id = t.sender_user_id " .
      "JOIN users ru ON ru.id = t.receiver_user_id " .
      "LEFT JOIN users du ON du.id = t.decided_by_user_id " .
      "WHERE " . implode(" AND ", $where) . " " .
      "ORDER BY t.created_at DESC " .
      "LIMIT 200",
      $params
    );

    $out = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "senderUserId" => (string)($row["sender_user_id"] ?? ""),
        "senderFullName" => (string)($row["sender_full_name"] ?? ""),
        "receiverUserId" => (string)($row["receiver_user_id"] ?? ""),
        "receiverFullName" => (string)($row["receiver_full_name"] ?? ""),
        "amountUGX" => (int)($row["amount_ugx"] ?? 0),
        "status" => (string)($row["status"] ?? ""),
        "requestNotes" => $row["request_notes"] ?? null,
        "decisionNotes" => $row["decision_notes"] ?? null,
        "decidedAt" => $row["decided_at"] ?? null,
        "decidedByUserId" => $row["decided_by_user_id"] ?? null,
        "decidedByFullName" => $row["decided_by_full_name"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $out]);
  }

  if ($method === "POST" && $route === "cash/transfers") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $body = read_json_body();

    $receiverUserId = isset($body["receiverUserId"]) && is_string($body["receiverUserId"]) ? trim($body["receiverUserId"]) : "";
    $amount = isset($body["amountUGX"]) ? (int)$body["amountUGX"] : 0;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;
    $requestedShopId = isset($body["shopId"]) && is_string($body["shopId"]) ? trim($body["shopId"]) : "";

    if ($receiverUserId === "" || $amount <= 0) {
      json_response(400, ["error" => "ValidationError", "message" => "receiverUserId and amountUGX (>0) are required"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    $shopId = "";
    if ($roleName === "ADMIN") {
      if ($requestedShopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "shopId is required"]);
      }
      $shopId = $requestedShopId;
    } else {
      $shopId = phase1_primary_shop_id($assignments);
      if ($shopId === "") {
        json_response(400, ["error" => "ValidationError", "message" => "User is not assigned to a shop"]);
      }
    }

    phase1_require_shop_access($roleName, $assignments, $shopId);

    if ($receiverUserId === $actorUserId) {
      json_response(400, ["error" => "ValidationError", "message" => "Cannot transfer cash to yourself"]);
    }

    $receiverRow = phase1_db_fetch_one(
      $pdo,
      "SELECT u.id, u.full_name, u.is_active, r.name AS role_name " .
      "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1",
      [":id" => $receiverUserId]
    );
    if (!$receiverRow || (int)($receiverRow["is_active"] ?? 0) !== 1) {
      json_response(400, ["error" => "ValidationError", "message" => "Invalid receiverUserId"]);
    }

    $receiverRole = (string)($receiverRow["role_name"] ?? "");
    if ($receiverRole !== "ADMIN") {
      $receiverAssignment = phase1_db_fetch_one(
        $pdo,
        "SELECT id FROM user_shop_assignment WHERE user_id = :user_id AND shop_id = :shop_id AND unassigned_at IS NULL LIMIT 1",
        [":user_id" => $receiverUserId, ":shop_id" => $shopId]
      );
      if (!$receiverAssignment) {
        json_response(400, ["error" => "ValidationError", "message" => "Receiver is not assigned to this shop"]);
      }
    }

    // Negative cash blocking (admin override is implicit by role).
    if ($roleName !== "ADMIN") {
      $available = max(0, phase1_cash_at_hand($pdo, $actorUserId));
      if ($available < $amount) {
        json_response(400, [
          "error" => "BadRequest",
          "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
        ]);
      }
    }

    $transferId = create_id("ctr");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO cash_transfers (id, shop_id, sender_user_id, receiver_user_id, amount_ugx, status, request_notes) " .
        "VALUES (:id, :shop_id, :sender_user_id, :receiver_user_id, :amount_ugx, 'PENDING', :request_notes)"
      );
      $stmt->execute([
        ":id" => $transferId,
        ":shop_id" => $shopId,
        ":sender_user_id" => $actorUserId,
        ":receiver_user_id" => $receiverUserId,
        ":amount_ugx" => $amount,
        ":request_notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (Throwable $error) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create transfer"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT t.id, t.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
        "t.sender_user_id, su.full_name AS sender_full_name, " .
        "t.receiver_user_id, ru.full_name AS receiver_full_name, " .
        "t.amount_ugx, t.status, t.request_notes, t.decision_notes, t.decided_at, t.decided_by_user_id, du.full_name AS decided_by_full_name, " .
        "t.created_at, t.updated_at " .
      "FROM cash_transfers t " .
      "JOIN shops sh ON sh.id = t.shop_id " .
      "JOIN users su ON su.id = t.sender_user_id " .
      "JOIN users ru ON ru.id = t.receiver_user_id " .
      "LEFT JOIN users du ON du.id = t.decided_by_user_id " .
      "WHERE t.id = :id LIMIT 1",
      [":id" => $transferId]
    );

    $public = $row ? [
      "id" => (string)$row["id"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "senderUserId" => (string)$row["sender_user_id"],
      "senderFullName" => (string)$row["sender_full_name"],
      "receiverUserId" => (string)$row["receiver_user_id"],
      "receiverFullName" => (string)$row["receiver_full_name"],
      "amountUGX" => (int)$row["amount_ugx"],
      "status" => (string)$row["status"],
      "requestNotes" => $row["request_notes"] ?? null,
      "decisionNotes" => $row["decision_notes"] ?? null,
      "decidedAt" => $row["decided_at"] ?? null,
      "decidedByUserId" => $row["decided_by_user_id"] ?? null,
      "decidedByFullName" => $row["decided_by_full_name"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ] : [
      "id" => $transferId,
      "shopId" => $shopId,
      "senderUserId" => $actorUserId,
      "receiverUserId" => $receiverUserId,
      "amountUGX" => $amount,
      "status" => "PENDING",
      "requestNotes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
    ];

    phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "cash_transfer", $transferId, null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^cash\\/transfers\\/([^\\/]+)\\/decision$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);
    $transferId = (string)$matches[1];
    $body = read_json_body();

    $decision = isset($body["decision"]) && is_string($body["decision"]) ? strtoupper(trim($body["decision"])) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($decision !== "APPROVE" && $decision !== "REJECT") {
      json_response(400, ["error" => "ValidationError", "message" => "decision must be APPROVE or REJECT"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, sender_user_id, receiver_user_id, amount_ugx, status, request_notes, decision_notes, decided_at, decided_by_user_id, created_at, updated_at " .
        "FROM cash_transfers WHERE id = :id FOR UPDATE",
        [":id" => $transferId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Transfer not found"]);
      }

      $receiverUserId = (string)($existing["receiver_user_id"] ?? "");
      if ($roleName !== "ADMIN" && $receiverUserId !== $actorUserId) {
        $pdo->rollBack();
        json_response(403, ["error" => "HttpError", "message" => "Only the receiver can approve or reject this transfer"]);
      }

      $status = (string)($existing["status"] ?? "");
      if ($status !== "PENDING") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Only pending transfers can be decided"]);
      }

      $senderUserId = (string)($existing["sender_user_id"] ?? "");
      $amount = (int)($existing["amount_ugx"] ?? 0);

      $newStatus = $decision === "APPROVE" ? "APPROVED" : "REJECTED";

      if ($newStatus === "APPROVED" && $roleName !== "ADMIN") {
        $available = max(0, phase1_cash_at_hand($pdo, $senderUserId));
        if ($available < $amount) {
          $pdo->rollBack();
          json_response(400, [
            "error" => "BadRequest",
            "message" => "Sender has insufficient cash at hand to approve. Available: " . $available . ", required: " . $amount,
          ]);
        }
      }

      phase1_db_execute(
        $pdo,
        "UPDATE cash_transfers SET status = :status, decision_notes = :decision_notes, decided_at = NOW(), decided_by_user_id = :decided_by_user_id, updated_at = NOW() WHERE id = :id",
        [
          ":status" => $newStatus,
          ":decision_notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
          ":decided_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
          ":id" => $transferId,
        ]
      );

      $row = phase1_db_fetch_one(
        $pdo,
        "SELECT t.id, t.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
          "t.sender_user_id, su.full_name AS sender_full_name, " .
          "t.receiver_user_id, ru.full_name AS receiver_full_name, " .
          "t.amount_ugx, t.status, t.request_notes, t.decision_notes, t.decided_at, t.decided_by_user_id, du.full_name AS decided_by_full_name, " .
          "t.created_at, t.updated_at " .
        "FROM cash_transfers t " .
        "JOIN shops sh ON sh.id = t.shop_id " .
        "JOIN users su ON su.id = t.sender_user_id " .
        "JOIN users ru ON ru.id = t.receiver_user_id " .
        "LEFT JOIN users du ON du.id = t.decided_by_user_id " .
        "WHERE t.id = :id LIMIT 1",
        [":id" => $transferId]
      );

      $pdo->commit();

      $beforePublic = [
        "id" => (string)$existing["id"],
        "shopId" => (string)$existing["shop_id"],
        "senderUserId" => (string)$existing["sender_user_id"],
        "receiverUserId" => (string)$existing["receiver_user_id"],
        "amountUGX" => (int)$existing["amount_ugx"],
        "status" => (string)$existing["status"],
        "requestNotes" => $existing["request_notes"] ?? null,
        "decisionNotes" => $existing["decision_notes"] ?? null,
        "decidedAt" => $existing["decided_at"] ?? null,
        "decidedByUserId" => $existing["decided_by_user_id"] ?? null,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      $afterPublic = $row ? [
        "id" => (string)$row["id"],
        "shopId" => (string)$row["shop_id"],
        "shopCode" => (string)$row["shop_code"],
        "shopName" => (string)$row["shop_name"],
        "senderUserId" => (string)$row["sender_user_id"],
        "senderFullName" => (string)$row["sender_full_name"],
        "receiverUserId" => (string)$row["receiver_user_id"],
        "receiverFullName" => (string)$row["receiver_full_name"],
        "amountUGX" => (int)$row["amount_ugx"],
        "status" => (string)$row["status"],
        "requestNotes" => $row["request_notes"] ?? null,
        "decisionNotes" => $row["decision_notes"] ?? null,
        "decidedAt" => $row["decided_at"] ?? null,
        "decidedByUserId" => $row["decided_by_user_id"] ?? null,
        "decidedByFullName" => $row["decided_by_full_name"] ?? null,
        "createdAt" => (string)$row["created_at"],
        "updatedAt" => (string)$row["updated_at"],
      ] : array_merge($beforePublic, [
        "status" => $newStatus,
        "decisionNotes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        "decidedAt" => now_iso(),
        "decidedByUserId" => $actorUserId,
      ]);

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "cash_transfer", $transferId, $beforePublic, $afterPublic);
      json_response(200, ["data" => $afterPublic]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to decide transfer"]);
    }
  }

  if ($method === "GET" && $route === "cash/bankings") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER", "SALES"]);

    $status = isset($_GET["status"]) && is_string($_GET["status"]) ? strtoupper(trim($_GET["status"])) : "";
    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";

    if ($status !== "" && !in_array($status, ["PENDING", "APPROVED", "REJECTED"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "status must be PENDING, APPROVED, or REJECTED"]);
    }

    $where = [];
    $params = [];

    if ($roleName === "SALES") {
      $viewerUserId = (string)($authUser["id"] ?? "");
      $where[] = "b.user_id = :viewer_user_id";
      $params[":viewer_user_id"] = $viewerUserId;
    } elseif ($roleName === "MANAGER") {
      $shopIds = phase1_assigned_shop_ids($assignments);
      if (count($shopIds) < 1) {
        json_response(200, ["data" => []]);
      }
      $placeholders = [];
      foreach ($shopIds as $idx => $id) {
        $key = ":shop_" . (string)$idx;
        $placeholders[] = $key;
        $params[$key] = $id;
      }
      $where[] = "b.shop_id IN (" . implode(", ", $placeholders) . ")";
    } else {
      if ($shopId !== "") {
        $where[] = "b.shop_id = :shop_id";
        $params[":shop_id"] = $shopId;
      }
    }

    if ($status !== "") {
      $where[] = "b.status = :status";
      $params[":status"] = $status;
    }

    if (count($where) < 1) {
      $where[] = "1=1";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT b.id, b.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
        "b.user_id, u.full_name AS user_full_name, " .
        "b.amount_ugx, b.status, b.request_notes, b.decision_notes, b.decided_at, b.decided_by_user_id, du.full_name AS decided_by_full_name, " .
        "b.created_at, b.updated_at " .
      "FROM banking_requests b " .
      "JOIN shops sh ON sh.id = b.shop_id " .
      "JOIN users u ON u.id = b.user_id " .
      "LEFT JOIN users du ON du.id = b.decided_by_user_id " .
      "WHERE " . implode(" AND ", $where) . " " .
      "ORDER BY b.created_at DESC " .
      "LIMIT 200",
      $params
    );

    $out = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "userId" => (string)($row["user_id"] ?? ""),
        "userFullName" => (string)($row["user_full_name"] ?? ""),
        "amountUGX" => (int)($row["amount_ugx"] ?? 0),
        "status" => (string)($row["status"] ?? ""),
        "requestNotes" => $row["request_notes"] ?? null,
        "decisionNotes" => $row["decision_notes"] ?? null,
        "decidedAt" => $row["decided_at"] ?? null,
        "decidedByUserId" => $row["decided_by_user_id"] ?? null,
        "decidedByFullName" => $row["decided_by_full_name"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $out]);
  }

  if ($method === "POST" && $route === "cash/bankings") {
    phase1_require_role($roleName, ["SALES"]);
    $body = read_json_body();

    $amount = isset($body["amountUGX"]) ? (int)$body["amountUGX"] : 0;
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($amount <= 0) {
      json_response(400, ["error" => "ValidationError", "message" => "amountUGX (>0) is required"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");
    $shopId = phase1_primary_shop_id($assignments);
    if ($shopId === "") {
      json_response(400, ["error" => "ValidationError", "message" => "Sales user is not assigned to a shop"]);
    }

    $available = max(0, phase1_cash_at_hand($pdo, $actorUserId));
    if ($available < $amount) {
      json_response(400, [
        "error" => "BadRequest",
        "message" => "Insufficient cash at hand. Available: " . $available . ", required: " . $amount,
      ]);
    }

    $bankingId = create_id("bank");

    try {
      $stmt = $pdo->prepare(
        "INSERT INTO banking_requests (id, shop_id, user_id, amount_ugx, status, request_notes) " .
        "VALUES (:id, :shop_id, :user_id, :amount_ugx, 'PENDING', :request_notes)"
      );
      $stmt->execute([
        ":id" => $bankingId,
        ":shop_id" => $shopId,
        ":user_id" => $actorUserId,
        ":amount_ugx" => $amount,
        ":request_notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
      ]);
    } catch (Throwable $error) {
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to create banking request"]);
    }

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT b.id, b.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
        "b.user_id, u.full_name AS user_full_name, " .
        "b.amount_ugx, b.status, b.request_notes, b.decision_notes, b.decided_at, b.decided_by_user_id, du.full_name AS decided_by_full_name, " .
        "b.created_at, b.updated_at " .
      "FROM banking_requests b " .
      "JOIN shops sh ON sh.id = b.shop_id " .
      "JOIN users u ON u.id = b.user_id " .
      "LEFT JOIN users du ON du.id = b.decided_by_user_id " .
      "WHERE b.id = :id LIMIT 1",
      [":id" => $bankingId]
    );

    $public = $row ? [
      "id" => (string)$row["id"],
      "shopId" => (string)$row["shop_id"],
      "shopCode" => (string)$row["shop_code"],
      "shopName" => (string)$row["shop_name"],
      "userId" => (string)$row["user_id"],
      "userFullName" => (string)$row["user_full_name"],
      "amountUGX" => (int)$row["amount_ugx"],
      "status" => (string)$row["status"],
      "requestNotes" => $row["request_notes"] ?? null,
      "decisionNotes" => $row["decision_notes"] ?? null,
      "decidedAt" => $row["decided_at"] ?? null,
      "decidedByUserId" => $row["decided_by_user_id"] ?? null,
      "decidedByFullName" => $row["decided_by_full_name"] ?? null,
      "createdAt" => (string)$row["created_at"],
      "updatedAt" => (string)$row["updated_at"],
    ] : [
      "id" => $bankingId,
      "shopId" => $shopId,
      "userId" => $actorUserId,
      "amountUGX" => $amount,
      "status" => "PENDING",
      "requestNotes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
    ];

    phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "CREATE", "banking_request", $bankingId, null, $public);
    json_response(201, ["data" => $public]);
  }

  if ($method === "PATCH" && preg_match('/^cash\\/bankings\\/([^\\/]+)\\/decision$/', $route, $matches) === 1) {
    phase1_require_role($roleName, ["ADMIN"]);
    $bankingId = (string)$matches[1];
    $body = read_json_body();

    $decision = isset($body["decision"]) && is_string($body["decision"]) ? strtoupper(trim($body["decision"])) : "";
    $notes = array_key_exists("notes", $body) ? $body["notes"] : null;

    if ($decision !== "APPROVE" && $decision !== "REJECT") {
      json_response(400, ["error" => "ValidationError", "message" => "decision must be APPROVE or REJECT"]);
    }
    if ($notes !== null && !is_string($notes)) {
      json_response(400, ["error" => "ValidationError", "message" => "notes must be a string or null"]);
    }

    $actorUserId = (string)($authUser["id"] ?? "");

    try {
      $pdo->beginTransaction();

      $existing = phase1_db_fetch_one(
        $pdo,
        "SELECT id, shop_id, user_id, amount_ugx, status, request_notes, decision_notes, decided_at, decided_by_user_id, created_at, updated_at " .
        "FROM banking_requests WHERE id = :id FOR UPDATE",
        [":id" => $bankingId]
      );
      if (!$existing) {
        $pdo->rollBack();
        json_response(404, ["error" => "HttpError", "message" => "Banking request not found"]);
      }

      $status = (string)($existing["status"] ?? "");
      if ($status !== "PENDING") {
        $pdo->rollBack();
        json_response(400, ["error" => "BadRequest", "message" => "Only pending banking requests can be decided"]);
      }

      $newStatus = $decision === "APPROVE" ? "APPROVED" : "REJECTED";

      phase1_db_execute(
        $pdo,
        "UPDATE banking_requests SET status = :status, decision_notes = :decision_notes, decided_at = NOW(), decided_by_user_id = :decided_by_user_id, updated_at = NOW() WHERE id = :id",
        [
          ":status" => $newStatus,
          ":decision_notes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
          ":decided_by_user_id" => $actorUserId !== "" ? $actorUserId : null,
          ":id" => $bankingId,
        ]
      );

      $targetUserId = (string)($existing["user_id"] ?? "");
      $amount = (int)($existing["amount_ugx"] ?? 0);
      $shopId = (string)($existing["shop_id"] ?? "");

      // Create an in-app notification for the requester.
      $title = $newStatus === "APPROVED" ? "Banking approved" : "Banking rejected";
      $message = "Your banking request of UGX " . $amount . " was " . strtolower($newStatus) . ".";
      $meta = json_encode(["bankingRequestId" => $bankingId, "status" => $newStatus, "amountUGX" => $amount, "shopId" => $shopId], JSON_UNESCAPED_SLASHES);

      $stmtNotif = $pdo->prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, meta_json, is_read) " .
        "VALUES (:id, :user_id, :type, :title, :message, :meta_json, 0)"
      );
      $stmtNotif->execute([
        ":id" => create_id("notif"),
        ":user_id" => $targetUserId,
        ":type" => "BANKING_DECISION",
        ":title" => $title,
        ":message" => $message,
        ":meta_json" => is_string($meta) ? $meta : null,
      ]);

      $row = phase1_db_fetch_one(
        $pdo,
        "SELECT b.id, b.shop_id, sh.code AS shop_code, sh.name AS shop_name, " .
          "b.user_id, u.full_name AS user_full_name, " .
          "b.amount_ugx, b.status, b.request_notes, b.decision_notes, b.decided_at, b.decided_by_user_id, du.full_name AS decided_by_full_name, " .
          "b.created_at, b.updated_at " .
        "FROM banking_requests b " .
        "JOIN shops sh ON sh.id = b.shop_id " .
        "JOIN users u ON u.id = b.user_id " .
        "LEFT JOIN users du ON du.id = b.decided_by_user_id " .
        "WHERE b.id = :id LIMIT 1",
        [":id" => $bankingId]
      );

      $pdo->commit();

      $beforePublic = [
        "id" => (string)$existing["id"],
        "shopId" => (string)$existing["shop_id"],
        "userId" => (string)$existing["user_id"],
        "amountUGX" => (int)$existing["amount_ugx"],
        "status" => (string)$existing["status"],
        "requestNotes" => $existing["request_notes"] ?? null,
        "decisionNotes" => $existing["decision_notes"] ?? null,
        "decidedAt" => $existing["decided_at"] ?? null,
        "decidedByUserId" => $existing["decided_by_user_id"] ?? null,
        "createdAt" => (string)$existing["created_at"],
        "updatedAt" => (string)$existing["updated_at"],
      ];

      $afterPublic = $row ? [
        "id" => (string)$row["id"],
        "shopId" => (string)$row["shop_id"],
        "shopCode" => (string)$row["shop_code"],
        "shopName" => (string)$row["shop_name"],
        "userId" => (string)$row["user_id"],
        "userFullName" => (string)$row["user_full_name"],
        "amountUGX" => (int)$row["amount_ugx"],
        "status" => (string)$row["status"],
        "requestNotes" => $row["request_notes"] ?? null,
        "decisionNotes" => $row["decision_notes"] ?? null,
        "decidedAt" => $row["decided_at"] ?? null,
        "decidedByUserId" => $row["decided_by_user_id"] ?? null,
        "decidedByFullName" => $row["decided_by_full_name"] ?? null,
        "createdAt" => (string)$row["created_at"],
        "updatedAt" => (string)$row["updated_at"],
      ] : array_merge($beforePublic, [
        "status" => $newStatus,
        "decisionNotes" => is_string($notes) && trim($notes) !== "" ? trim($notes) : null,
        "decidedAt" => now_iso(),
        "decidedByUserId" => $actorUserId,
      ]);

      phase1_audit_log($pdo, $actorUserId !== "" ? $actorUserId : null, "UPDATE", "banking_request", $bankingId, $beforePublic, $afterPublic);
      json_response(200, ["data" => $afterPublic]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      json_response(500, ["error" => "InternalServerError", "message" => "Failed to decide banking request"]);
    }
  }

  if ($method === "GET" && $route === "cash/admin/overview") {
    phase1_require_role($roleName, ["ADMIN"]);

    $shopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $dateFrom = isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? trim($_GET["dateFrom"]) : "";
    $dateTo = isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? trim($_GET["dateTo"]) : "";

    if ($dateFrom !== "" && !is_valid_ymd_date($dateFrom)) {
      json_response(400, ["error" => "ValidationError", "message" => "dateFrom must be YYYY-MM-DD"]);
    }
    if ($dateTo !== "" && !is_valid_ymd_date($dateTo)) {
      json_response(400, ["error" => "ValidationError", "message" => "dateTo must be YYYY-MM-DD"]);
    }

    $params = [];
    $where = ["u.is_active = 1", "r.name = 'SALES'"];
    if ($shopId !== "") {
      $where[] = "EXISTS (" .
        "SELECT 1 FROM user_shop_assignment a WHERE a.user_id = u.id AND a.unassigned_at IS NULL AND a.shop_id = :shop_id" .
      ")";
      $params[":shop_id"] = $shopId;
    }

    $usersRows = phase1_db_fetch_all(
      $pdo,
      "SELECT u.id, u.full_name " .
        "FROM users u JOIN roles r ON r.id = u.role_id " .
        "WHERE " . implode(" AND ", $where) . " " .
        "ORDER BY u.full_name ASC",
      $params
    );

    $items = [];
    $totalCashAtHand = 0;
    $totalBanked = 0;

    foreach ($usersRows as $row) {
      if (!is_array($row)) {
        continue;
      }
      $userId = (string)($row["id"] ?? "");
      if ($userId === "") {
        continue;
      }

      $assign = phase1_load_assignments($pdo, $userId);
      $primaryShopId = phase1_primary_shop_id($assign);
      $shopMeta = ["shopId" => $primaryShopId, "shopCode" => null, "shopName" => null];
      foreach ($assign as $a) {
        if (!is_array($a)) {
          continue;
        }
        if ((string)($a["shop_id"] ?? "") === $primaryShopId) {
          $shopMeta["shopCode"] = (string)($a["shop_code"] ?? "");
          $shopMeta["shopName"] = (string)($a["shop_name"] ?? "");
          break;
        }
      }

      $summary = phase1_cash_summary($pdo, $userId);
      $cashAtHand = (int)($summary["cashAtHand"] ?? 0);

      $bankWhere = ["user_id = :user_id", "status = 'APPROVED'", "decided_at IS NOT NULL"];
      $bankParams = [":user_id" => $userId];
      if ($shopId !== "") {
        $bankWhere[] = "shop_id = :shop_id";
        $bankParams[":shop_id"] = $shopId;
      }
      if ($dateFrom !== "") {
        $bankWhere[] = "DATE(decided_at) >= :date_from";
        $bankParams[":date_from"] = $dateFrom;
      }
      if ($dateTo !== "") {
        $bankWhere[] = "DATE(decided_at) <= :date_to";
        $bankParams[":date_to"] = $dateTo;
      }

      $bankedRow = phase1_db_fetch_one(
        $pdo,
        "SELECT COALESCE(SUM(amount_ugx), 0) AS total FROM banking_requests WHERE " . implode(" AND ", $bankWhere),
        $bankParams
      );
      $banked = $bankedRow ? (int)($bankedRow["total"] ?? 0) : 0;

      $items[] = [
        "userId" => $userId,
        "fullName" => (string)($row["full_name"] ?? ""),
        "shopId" => $shopMeta["shopId"],
        "shopCode" => $shopMeta["shopCode"],
        "shopName" => $shopMeta["shopName"],
        "cashAtHand" => $cashAtHand,
        "bankedTotal" => $banked,
      ];

      $totalCashAtHand += $cashAtHand;
      $totalBanked += $banked;
    }

    json_response(200, ["data" => ["items" => $items, "totals" => ["cashAtHand" => $totalCashAtHand, "bankedTotal" => $totalBanked]]]);
  }

  if ($method === "GET" && $route === "notifications/me") {
    $userId = (string)($authUser["id"] ?? "");

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT id, type, title, message, meta_json, is_read, created_at, updated_at " .
      "FROM notifications WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 100",
      [":user_id" => $userId]
    );

    $out = array_map(function ($row) {
      $metaRaw = $row["meta_json"] ?? null;
      $meta = null;
      if (is_string($metaRaw) && $metaRaw !== "") {
        $decoded = json_decode($metaRaw, true);
        if (is_array($decoded)) {
          $meta = $decoded;
        }
      } elseif (is_array($metaRaw)) {
        $meta = $metaRaw;
      }

      return [
        "id" => (string)($row["id"] ?? ""),
        "type" => (string)($row["type"] ?? ""),
        "title" => (string)($row["title"] ?? ""),
        "message" => (string)($row["message"] ?? ""),
        "meta" => $meta,
        "isRead" => (int)($row["is_read"] ?? 0) === 1,
        "createdAt" => (string)($row["created_at"] ?? ""),
        "updatedAt" => (string)($row["updated_at"] ?? ""),
      ];
    }, $rows);

    json_response(200, ["data" => $out]);
  }

  if ($method === "PATCH" && preg_match('/^notifications\\/([^\\/]+)\\/read$/', $route, $matches) === 1) {
    $notifId = (string)$matches[1];
    $userId = (string)($authUser["id"] ?? "");

    $existing = phase1_db_fetch_one(
      $pdo,
      "SELECT id, user_id, is_read FROM notifications WHERE id = :id LIMIT 1",
      [":id" => $notifId]
    );
    if (!$existing || (string)($existing["user_id"] ?? "") !== $userId) {
      json_response(404, ["error" => "HttpError", "message" => "Notification not found"]);
    }

    phase1_db_execute(
      $pdo,
      "UPDATE notifications SET is_read = 1, updated_at = NOW() WHERE id = :id",
      [":id" => $notifId]
    );

    $row = phase1_db_fetch_one(
      $pdo,
      "SELECT id, type, title, message, meta_json, is_read, created_at, updated_at " .
      "FROM notifications WHERE id = :id LIMIT 1",
      [":id" => $notifId]
    );

    $metaRaw = $row ? ($row["meta_json"] ?? null) : null;
    $meta = null;
    if (is_string($metaRaw) && $metaRaw !== "") {
      $decoded = json_decode($metaRaw, true);
      if (is_array($decoded)) {
        $meta = $decoded;
      }
    } elseif (is_array($metaRaw)) {
      $meta = $metaRaw;
    }

    $public = $row ? [
      "id" => (string)($row["id"] ?? ""),
      "type" => (string)($row["type"] ?? ""),
      "title" => (string)($row["title"] ?? ""),
      "message" => (string)($row["message"] ?? ""),
      "meta" => $meta,
      "isRead" => (int)($row["is_read"] ?? 0) === 1,
      "createdAt" => (string)($row["created_at"] ?? ""),
      "updatedAt" => (string)($row["updated_at"] ?? ""),
    ] : ["id" => $notifId, "isRead" => true];

    json_response(200, ["data" => $public]);
  }

  // Phase 7 — Reports + Exports
  if ($method === "GET" && $route === "reports/sales") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    $period = isset($_GET["period"]) && is_string($_GET["period"]) ? strtolower(trim($_GET["period"])) : "daily";
    if (!in_array($period, ["daily", "weekly", "monthly", "quarterly"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "period must be daily, weekly, monthly, or quarterly"]);
    }

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $range = phase1_resolve_date_range(
      isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? $_GET["dateFrom"] : null,
      isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? $_GET["dateTo"] : null,
      30
    );
    $dateFrom = (string)$range["dateFrom"];
    $dateTo = (string)$range["dateTo"];

    $format = isset($_GET["format"]) && is_string($_GET["format"]) ? strtolower(trim($_GET["format"])) : "";
    if ($format !== "" && !in_array($format, ["csv", "xlsx", "pdf"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "format must be csv, xlsx, or pdf"]);
    }

    $params = [":date_from" => $dateFrom, ":date_to" => $dateTo];
    $shopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "s.shop_id", $params);

    $periodStartExpr = "s.sale_date";
    $periodEndExpr = "s.sale_date";
    if ($period === "weekly") {
      $periodStartExpr = "DATE_SUB(s.sale_date, INTERVAL WEEKDAY(s.sale_date) DAY)";
      $periodEndExpr = "DATE_ADD(DATE_SUB(s.sale_date, INTERVAL WEEKDAY(s.sale_date) DAY), INTERVAL 6 DAY)";
    } elseif ($period === "monthly") {
      $periodStartExpr = "DATE_FORMAT(s.sale_date, '%Y-%m-01')";
      $periodEndExpr = "LAST_DAY(s.sale_date)";
    } elseif ($period === "quarterly") {
      $quarterStart = "DATE_ADD(MAKEDATE(YEAR(s.sale_date), 1), INTERVAL (QUARTER(s.sale_date) - 1) * 3 MONTH)";
      $periodStartExpr = $quarterStart;
      $periodEndExpr = "LAST_DAY(DATE_ADD(" . $quarterStart . ", INTERVAL 2 MONTH))";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT t.period_start, t.period_end, " .
        "COUNT(*) AS sale_count, " .
        "COALESCE(SUM(t.total_amount), 0) AS total_amount, " .
        "COALESCE(SUM(CASE WHEN t.payment_method = 'CASH' THEN t.total_amount ELSE 0 END), 0) AS cash_amount, " .
        "COALESCE(SUM(CASE WHEN t.payment_method = 'MOBILE_MONEY' THEN t.total_amount ELSE 0 END), 0) AS mobile_money_amount, " .
        "COALESCE(SUM(CASE WHEN t.payment_method = 'CARD' THEN t.total_amount ELSE 0 END), 0) AS card_amount, " .
        "COALESCE(SUM(CASE WHEN t.payment_method = 'CREDIT' THEN t.total_amount ELSE 0 END), 0) AS credit_amount " .
      "FROM (" .
        "SELECT s.total_amount, s.payment_method, " . $periodStartExpr . " AS period_start, " . $periodEndExpr . " AS period_end " .
        "FROM sales s " .
        "WHERE s.is_void = 0 AND s.sale_date BETWEEN :date_from AND :date_to" . $shopSql .
      ") t " .
      "GROUP BY t.period_start, t.period_end " .
      "ORDER BY t.period_start ASC",
      $params
    );

    $periods = array_map(function ($row) {
      return [
        "periodStart" => (string)($row["period_start"] ?? ""),
        "periodEnd" => (string)($row["period_end"] ?? ""),
        "saleCount" => (int)($row["sale_count"] ?? 0),
        "totalAmount" => (int)($row["total_amount"] ?? 0),
        "cashAmount" => (int)($row["cash_amount"] ?? 0),
        "mobileMoneyAmount" => (int)($row["mobile_money_amount"] ?? 0),
        "cardAmount" => (int)($row["card_amount"] ?? 0),
        "creditAmount" => (int)($row["credit_amount"] ?? 0),
      ];
    }, $rows);

    $totals = [
      "saleCount" => 0,
      "totalAmount" => 0,
      "cashAmount" => 0,
      "mobileMoneyAmount" => 0,
      "cardAmount" => 0,
      "creditAmount" => 0,
    ];
    foreach ($periods as $p) {
      $totals["saleCount"] += (int)$p["saleCount"];
      $totals["totalAmount"] += (int)$p["totalAmount"];
      $totals["cashAmount"] += (int)$p["cashAmount"];
      $totals["mobileMoneyAmount"] += (int)$p["mobileMoneyAmount"];
      $totals["cardAmount"] += (int)$p["cardAmount"];
      $totals["creditAmount"] += (int)$p["creditAmount"];
    }

    $payload = [
      "period" => $period,
      "dateFrom" => $dateFrom,
      "dateTo" => $dateTo,
      "shopId" => $requestedShopId !== "" ? $requestedShopId : null,
      "periods" => $periods,
      "totals" => $totals,
    ];

    if ($format === "") {
      json_response(200, ["data" => $payload]);
    }

    $exportRows = [];
    $exportRows[] = ["Period Start", "Period End", "Sales", "Total (UGX)", "Cash", "Mobile Money", "Card", "Credit"];
    foreach ($periods as $p) {
      $exportRows[] = [
        $p["periodStart"],
        $p["periodEnd"],
        $p["saleCount"],
        $p["totalAmount"],
        $p["cashAmount"],
        $p["mobileMoneyAmount"],
        $p["cardAmount"],
        $p["creditAmount"],
      ];
    }
    $exportRows[] = ["TOTAL", "", $totals["saleCount"], $totals["totalAmount"], $totals["cashAmount"], $totals["mobileMoneyAmount"], $totals["cardAmount"], $totals["creditAmount"]];

    $baseName = safe_filename("bdk_sales_report_" . $period . "_" . $dateFrom . "_to_" . $dateTo);
    if ($format === "csv") {
      file_response("text/csv; charset=utf-8", $baseName . ".csv", csv_bytes($exportRows));
    }
    if ($format === "xlsx") {
      file_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $baseName . ".xlsx", xlsx_bytes("Sales Report", $exportRows));
    }
    $lines = text_table_lines($exportRows[0], array_slice($exportRows, 1), [2, 3, 4, 5, 6, 7]);
    file_response("application/pdf", $baseName . ".pdf", pdf_build("Sales Report (" . $period . ") " . $dateFrom . " to " . $dateTo, $lines));
  }

  if ($method === "GET" && $route === "reports/invoices") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $statusFilter = isset($_GET["status"]) && is_string($_GET["status"]) ? strtoupper(trim($_GET["status"])) : "ALL";
    if (!in_array($statusFilter, ["ALL", "PAID", "UNPAID", "OVERDUE"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "status must be ALL, PAID, UNPAID, or OVERDUE"]);
    }

    $range = phase1_resolve_date_range(
      isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? $_GET["dateFrom"] : null,
      isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? $_GET["dateTo"] : null,
      30
    );
    $dateFrom = (string)$range["dateFrom"];
    $dateTo = (string)$range["dateTo"];
    $today = phase1_business_today_ymd();

    $format = isset($_GET["format"]) && is_string($_GET["format"]) ? strtolower(trim($_GET["format"])) : "";
    if ($format !== "" && !in_array($format, ["csv", "xlsx", "pdf"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "format must be csv, xlsx, or pdf"]);
    }

    $params = [":date_from" => $dateFrom, ":date_to" => $dateTo, ":today" => $today];
    $shopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "i.shop_id", $params);

    $where = "i.status <> 'VOID' AND DATE(COALESCE(i.issued_at, i.created_at)) BETWEEN :date_from AND :date_to";
    if ($statusFilter === "PAID") {
      $where .= " AND i.status = 'PAID'";
    } elseif ($statusFilter === "UNPAID") {
      $where .= " AND i.status <> 'PAID' AND i.balance > 0";
    } elseif ($statusFilter === "OVERDUE") {
      $where .= " AND i.due_date IS NOT NULL AND i.due_date < :today AND i.balance > 0";
    }

    $rows = phase1_db_fetch_all(
      $pdo,
      "SELECT i.id, i.invoice_number, i.shop_id, s.code AS shop_code, s.name AS shop_name, " .
        "i.status, i.issued_at, i.due_date, i.total_amount, i.paid_amount, i.balance, i.notes, " .
        "c.mobile AS customer_mobile, c.first_name, c.last_name, " .
        "DATE(COALESCE(i.issued_at, i.created_at)) AS invoice_date, " .
        "CASE WHEN i.due_date IS NOT NULL AND i.due_date < :today AND i.balance > 0 AND i.status <> 'VOID' THEN 1 ELSE 0 END AS is_overdue " .
      "FROM invoices i " .
      "JOIN shops s ON s.id = i.shop_id " .
      "JOIN customers c ON c.id = i.customer_id " .
      "WHERE " . $where . $shopSql . " " .
      "ORDER BY invoice_date DESC, i.created_at DESC " .
      "LIMIT 300",
      $params
    );

    $items = array_map(function ($row) {
      $customerName = trim((string)($row["first_name"] ?? "") . " " . (string)($row["last_name"] ?? ""));
      return [
        "id" => (string)($row["id"] ?? ""),
        "invoiceNumber" => (string)($row["invoice_number"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "status" => (string)($row["status"] ?? ""),
        "invoiceDate" => (string)($row["invoice_date"] ?? ""),
        "issuedAt" => $row["issued_at"] ?? null,
        "dueDate" => $row["due_date"] ?? null,
        "customerMobileNumber" => (string)($row["customer_mobile"] ?? ""),
        "customerName" => $customerName,
        "totalAmount" => (int)($row["total_amount"] ?? 0),
        "paidAmount" => (int)($row["paid_amount"] ?? 0),
        "balance" => (int)($row["balance"] ?? 0),
        "isOverdue" => (int)($row["is_overdue"] ?? 0) === 1,
        "notes" => $row["notes"] ?? null,
      ];
    }, $rows);

    $summary = [
      "count" => count($items),
      "totalAmount" => 0,
      "paidAmount" => 0,
      "balance" => 0,
      "overdueCount" => 0,
      "overdueBalance" => 0,
    ];
    foreach ($items as $inv) {
      $summary["totalAmount"] += (int)$inv["totalAmount"];
      $summary["paidAmount"] += (int)$inv["paidAmount"];
      $summary["balance"] += (int)$inv["balance"];
      if ($inv["isOverdue"]) {
        $summary["overdueCount"] += 1;
        $summary["overdueBalance"] += (int)$inv["balance"];
      }
    }

    $payload = [
      "status" => $statusFilter,
      "dateFrom" => $dateFrom,
      "dateTo" => $dateTo,
      "shopId" => $requestedShopId !== "" ? $requestedShopId : null,
      "items" => $items,
      "summary" => $summary,
    ];

    if ($format === "") {
      json_response(200, ["data" => $payload]);
    }

    $exportRows = [];
    $exportRows[] = ["Invoice #", "Shop", "Customer", "Status", "Invoice Date", "Due Date", "Total (UGX)", "Paid", "Balance", "Overdue"];
    foreach ($items as $inv) {
      $exportRows[] = [
        $inv["invoiceNumber"],
        $inv["shopCode"],
        $inv["customerName"],
        $inv["status"],
        $inv["invoiceDate"],
        $inv["dueDate"] ?? "",
        $inv["totalAmount"],
        $inv["paidAmount"],
        $inv["balance"],
        $inv["isOverdue"] ? "YES" : "NO",
      ];
    }
    $exportRows[] = ["TOTAL", "", "", "", "", "", $summary["totalAmount"], $summary["paidAmount"], $summary["balance"], ""];

    $baseName = safe_filename("bdk_invoice_report_" . strtolower($statusFilter) . "_" . $dateFrom . "_to_" . $dateTo);
    if ($format === "csv") {
      file_response("text/csv; charset=utf-8", $baseName . ".csv", csv_bytes($exportRows));
    }
    if ($format === "xlsx") {
      file_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $baseName . ".xlsx", xlsx_bytes("Invoice Report", $exportRows));
    }
    $lines = text_table_lines($exportRows[0], array_slice($exportRows, 1), [6, 7, 8]);
    file_response("application/pdf", $baseName . ".pdf", pdf_build("Invoice Report (" . $statusFilter . ") " . $dateFrom . " to " . $dateTo, $lines));
  }

  if ($method === "GET" && $route === "reports/expenses") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $range = phase1_resolve_date_range(
      isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? $_GET["dateFrom"] : null,
      isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? $_GET["dateTo"] : null,
      30
    );
    $dateFrom = (string)$range["dateFrom"];
    $dateTo = (string)$range["dateTo"];

    $format = isset($_GET["format"]) && is_string($_GET["format"]) ? strtolower(trim($_GET["format"])) : "";
    if ($format !== "" && !in_array($format, ["csv", "xlsx", "pdf"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "format must be csv, xlsx, or pdf"]);
    }

    $params = [":date_from" => $dateFrom, ":date_to" => $dateTo];
    $shopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "e.shop_id", $params);

    $itemsRows = phase1_db_fetch_all(
      $pdo,
      "SELECT e.id, e.shop_id, sh.code AS shop_code, sh.name AS shop_name, e.category_id, c.name AS category_name, " .
        "e.amount_ugx, e.expense_date, e.notes, e.payment_source, e.paid_by_user_id, pu.full_name AS paid_by_full_name, " .
        "e.recorded_by_user_id, ru.full_name AS recorded_by_full_name, e.created_at " .
      "FROM expenses e " .
      "JOIN shops sh ON sh.id = e.shop_id " .
      "JOIN expense_categories c ON c.id = e.category_id " .
      "LEFT JOIN users pu ON pu.id = e.paid_by_user_id " .
      "LEFT JOIN users ru ON ru.id = e.recorded_by_user_id " .
      "WHERE e.is_void = 0 AND e.expense_date BETWEEN :date_from AND :date_to" . $shopSql . " " .
      "ORDER BY e.expense_date DESC, e.created_at DESC " .
      "LIMIT 500",
      $params
    );

    $items = array_map(function ($row) {
      return [
        "id" => (string)($row["id"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "categoryId" => (string)($row["category_id"] ?? ""),
        "categoryName" => (string)($row["category_name"] ?? ""),
        "amountUGX" => (int)($row["amount_ugx"] ?? 0),
        "expenseDate" => (string)($row["expense_date"] ?? ""),
        "paymentSource" => (string)($row["payment_source"] ?? ""),
        "paidByFullName" => $row["paid_by_full_name"] ?? null,
        "recordedByFullName" => $row["recorded_by_full_name"] ?? null,
        "notes" => $row["notes"] ?? null,
        "createdAt" => (string)($row["created_at"] ?? ""),
      ];
    }, $itemsRows);

    $byCategoryRows = phase1_db_fetch_all(
      $pdo,
      "SELECT e.category_id, c.name AS category_name, COUNT(*) AS expense_count, COALESCE(SUM(e.amount_ugx), 0) AS total_amount " .
      "FROM expenses e JOIN expense_categories c ON c.id = e.category_id " .
      "WHERE e.is_void = 0 AND e.expense_date BETWEEN :date_from AND :date_to" . $shopSql . " " .
      "GROUP BY e.category_id, c.name " .
      "ORDER BY total_amount DESC",
      $params
    );

    $byCategory = array_map(function ($row) {
      return [
        "categoryId" => (string)($row["category_id"] ?? ""),
        "categoryName" => (string)($row["category_name"] ?? ""),
        "expenseCount" => (int)($row["expense_count"] ?? 0),
        "totalAmount" => (int)($row["total_amount"] ?? 0),
      ];
    }, $byCategoryRows);

    $summary = [
      "count" => count($items),
      "totalAmount" => 0,
      "salespersonCashAmount" => 0,
      "adminBankAmount" => 0,
    ];
    foreach ($items as $exp) {
      $summary["totalAmount"] += (int)$exp["amountUGX"];
      if ($exp["paymentSource"] === "SALESPERSON_CASH") {
        $summary["salespersonCashAmount"] += (int)$exp["amountUGX"];
      } elseif ($exp["paymentSource"] === "ADMIN_BANK") {
        $summary["adminBankAmount"] += (int)$exp["amountUGX"];
      }
    }

    $payload = [
      "dateFrom" => $dateFrom,
      "dateTo" => $dateTo,
      "shopId" => $requestedShopId !== "" ? $requestedShopId : null,
      "items" => $items,
      "byCategory" => $byCategory,
      "summary" => $summary,
    ];

    if ($format === "") {
      json_response(200, ["data" => $payload]);
    }

    $exportRows = [];
    $exportRows[] = ["Date", "Shop", "Category", "Amount (UGX)", "Source", "Paid by", "Notes"];
    foreach ($items as $exp) {
      $exportRows[] = [
        $exp["expenseDate"],
        $exp["shopCode"],
        $exp["categoryName"],
        $exp["amountUGX"],
        $exp["paymentSource"],
        $exp["paymentSource"] === "SALESPERSON_CASH" ? ($exp["paidByFullName"] ?? "") : "",
        $exp["notes"] ?? "",
      ];
    }
    $exportRows[] = ["TOTAL", "", "", $summary["totalAmount"], "", "", ""];

    $baseName = safe_filename("bdk_expense_report_" . $dateFrom . "_to_" . $dateTo);
    if ($format === "csv") {
      file_response("text/csv; charset=utf-8", $baseName . ".csv", csv_bytes($exportRows));
    }
    if ($format === "xlsx") {
      file_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $baseName . ".xlsx", xlsx_bytes("Expense Report", $exportRows));
    }
    $lines = text_table_lines($exportRows[0], array_slice($exportRows, 1), [3]);
    file_response("application/pdf", $baseName . ".pdf", pdf_build("Expense Report " . $dateFrom . " to " . $dateTo, $lines));
  }

  if ($method === "GET" && $route === "reports/cash") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $range = phase1_resolve_date_range(
      isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? $_GET["dateFrom"] : null,
      isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? $_GET["dateTo"] : null,
      30
    );
    $dateFrom = (string)$range["dateFrom"];
    $dateTo = (string)$range["dateTo"];

    $asOf = isset($_GET["asOf"]) && is_string($_GET["asOf"]) ? trim($_GET["asOf"]) : "";
    if ($asOf === "") {
      $asOf = $dateTo;
    }
    if (!is_valid_ymd_date($asOf)) {
      json_response(400, ["error" => "ValidationError", "message" => "asOf must be YYYY-MM-DD"]);
    }

    $format = isset($_GET["format"]) && is_string($_GET["format"]) ? strtolower(trim($_GET["format"])) : "";
    if ($format !== "" && !in_array($format, ["csv", "xlsx", "pdf"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "format must be csv, xlsx, or pdf"]);
    }

    $params = [];
    $shopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "a.shop_id", $params);

    $usersRows = phase1_db_fetch_all(
      $pdo,
      "SELECT DISTINCT u.id, u.full_name, sh.id AS shop_id, sh.code AS shop_code, sh.name AS shop_name " .
      "FROM users u " .
      "JOIN roles r ON r.id = u.role_id " .
      "JOIN user_shop_assignment a ON a.user_id = u.id AND a.unassigned_at IS NULL AND a.is_primary = 1 " .
      "JOIN shops sh ON sh.id = a.shop_id " .
      "WHERE u.is_active = 1 AND r.name = 'SALES'" . $shopSql . " " .
      "ORDER BY u.full_name ASC",
      $params
    );

    $items = [];
    $totals = [
      "cashAtHand" => 0,
      "bankedInRange" => 0,
    ];

    foreach ($usersRows as $row) {
      if (!is_array($row)) {
        continue;
      }
      $userId = (string)($row["id"] ?? "");
      if ($userId === "") {
        continue;
      }

      $summary = phase1_cash_summary_as_of($pdo, $userId, $asOf);

      $bankedRow = phase1_db_fetch_one(
        $pdo,
        "SELECT COALESCE(SUM(amount_ugx), 0) AS total FROM banking_requests " .
          "WHERE user_id = :user_id AND status = 'APPROVED' AND decided_at IS NOT NULL " .
          "AND DATE(decided_at) BETWEEN :date_from AND :date_to",
        [":user_id" => $userId, ":date_from" => $dateFrom, ":date_to" => $dateTo]
      );
      $bankedInRange = $bankedRow ? (int)($bankedRow["total"] ?? 0) : 0;

      $items[] = [
        "userId" => $userId,
        "fullName" => (string)($row["full_name"] ?? ""),
        "shopId" => (string)($row["shop_id"] ?? ""),
        "shopCode" => (string)($row["shop_code"] ?? ""),
        "shopName" => (string)($row["shop_name"] ?? ""),
        "cashAtHandAsOf" => (int)($summary["cashAtHand"] ?? 0),
        "bankedInRange" => $bankedInRange,
      ];

      $totals["cashAtHand"] += (int)($summary["cashAtHand"] ?? 0);
      $totals["bankedInRange"] += $bankedInRange;
    }

    $payload = [
      "asOf" => $asOf,
      "dateFrom" => $dateFrom,
      "dateTo" => $dateTo,
      "shopId" => $requestedShopId !== "" ? $requestedShopId : null,
      "items" => $items,
      "totals" => $totals,
    ];

    if ($format === "") {
      json_response(200, ["data" => $payload]);
    }

    $exportRows = [];
    $exportRows[] = ["User", "Shop", "Cash at hand (as of)", "Banked (range)"];
    foreach ($items as $item) {
      $exportRows[] = [
        $item["fullName"],
        $item["shopCode"],
        $item["cashAtHandAsOf"],
        $item["bankedInRange"],
      ];
    }
    $exportRows[] = ["TOTAL", "", $totals["cashAtHand"], $totals["bankedInRange"]];

    $baseName = safe_filename("bdk_cash_report_asof_" . $asOf . "_" . $dateFrom . "_to_" . $dateTo);
    if ($format === "csv") {
      file_response("text/csv; charset=utf-8", $baseName . ".csv", csv_bytes($exportRows));
    }
    if ($format === "xlsx") {
      file_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $baseName . ".xlsx", xlsx_bytes("Cash Report", $exportRows));
    }
    $lines = text_table_lines($exportRows[0], array_slice($exportRows, 1), [2, 3]);
    file_response("application/pdf", $baseName . ".pdf", pdf_build("Cash Report (as of " . $asOf . ") " . $dateFrom . " to " . $dateTo, $lines));
  }

  if ($method === "GET" && $route === "reports/pl") {
    phase1_require_role($roleName, ["ADMIN", "MANAGER"]);

    $requestedShopId = isset($_GET["shopId"]) && is_string($_GET["shopId"]) ? trim($_GET["shopId"]) : "";
    $range = phase1_resolve_date_range(
      isset($_GET["dateFrom"]) && is_string($_GET["dateFrom"]) ? $_GET["dateFrom"] : null,
      isset($_GET["dateTo"]) && is_string($_GET["dateTo"]) ? $_GET["dateTo"] : null,
      30
    );
    $dateFrom = (string)$range["dateFrom"];
    $dateTo = (string)$range["dateTo"];

    $format = isset($_GET["format"]) && is_string($_GET["format"]) ? strtolower(trim($_GET["format"])) : "";
    if ($format !== "" && !in_array($format, ["csv", "xlsx", "pdf"], true)) {
      json_response(400, ["error" => "ValidationError", "message" => "format must be csv, xlsx, or pdf"]);
    }

    $params = [":date_from" => $dateFrom, ":date_to" => $dateTo];
    $salesShopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "s.shop_id", $params);
    $expenseShopSql = phase1_shop_scope_sql($roleName, $assignments, $requestedShopId, "e.shop_id", $params);

    $revRow = phase1_db_fetch_one(
      $pdo,
      "SELECT COALESCE(SUM(s.total_amount), 0) AS total_amount, COUNT(*) AS sale_count " .
      "FROM sales s WHERE s.is_void = 0 AND s.sale_date BETWEEN :date_from AND :date_to" . $salesShopSql,
      $params
    );
    $revenue = $revRow ? (int)($revRow["total_amount"] ?? 0) : 0;
    $saleCount = $revRow ? (int)($revRow["sale_count"] ?? 0) : 0;

    $revByMethodRows = phase1_db_fetch_all(
      $pdo,
      "SELECT s.payment_method, COALESCE(SUM(s.total_amount), 0) AS total_amount " .
      "FROM sales s WHERE s.is_void = 0 AND s.sale_date BETWEEN :date_from AND :date_to" . $salesShopSql . " " .
      "GROUP BY s.payment_method ORDER BY total_amount DESC",
      $params
    );
    $revenueByPaymentMethod = array_map(function ($row) {
      return [
        "paymentMethod" => (string)($row["payment_method"] ?? ""),
        "totalAmount" => (int)($row["total_amount"] ?? 0),
      ];
    }, $revByMethodRows);

    $expRow = phase1_db_fetch_one(
      $pdo,
      "SELECT COALESCE(SUM(e.amount_ugx), 0) AS total_amount, COUNT(*) AS expense_count " .
      "FROM expenses e WHERE e.is_void = 0 AND e.expense_date BETWEEN :date_from AND :date_to" . $expenseShopSql,
      $params
    );
    $expensesTotal = $expRow ? (int)($expRow["total_amount"] ?? 0) : 0;
    $expenseCount = $expRow ? (int)($expRow["expense_count"] ?? 0) : 0;

    $expBySourceRows = phase1_db_fetch_all(
      $pdo,
      "SELECT e.payment_source, COALESCE(SUM(e.amount_ugx), 0) AS total_amount " .
      "FROM expenses e WHERE e.is_void = 0 AND e.expense_date BETWEEN :date_from AND :date_to" . $expenseShopSql . " " .
      "GROUP BY e.payment_source ORDER BY total_amount DESC",
      $params
    );
    $expensesByPaymentSource = array_map(function ($row) {
      return [
        "paymentSource" => (string)($row["payment_source"] ?? ""),
        "totalAmount" => (int)($row["total_amount"] ?? 0),
      ];
    }, $expBySourceRows);

    $profit = $revenue - $expensesTotal;

    $payload = [
      "dateFrom" => $dateFrom,
      "dateTo" => $dateTo,
      "shopId" => $requestedShopId !== "" ? $requestedShopId : null,
      "revenue" => $revenue,
      "saleCount" => $saleCount,
      "expenses" => $expensesTotal,
      "expenseCount" => $expenseCount,
      "profit" => $profit,
      "revenueByPaymentMethod" => $revenueByPaymentMethod,
      "expensesByPaymentSource" => $expensesByPaymentSource,
    ];

    if ($format === "") {
      json_response(200, ["data" => $payload]);
    }

    $exportRows = [];
    $exportRows[] = ["Metric", "Value"];
    $exportRows[] = ["Revenue (UGX)", $revenue];
    $exportRows[] = ["Expenses (UGX)", $expensesTotal];
    $exportRows[] = ["Profit (UGX)", $profit];
    $exportRows[] = ["Sales count", $saleCount];
    $exportRows[] = ["Expense count", $expenseCount];
    $exportRows[] = ["", ""];
    $exportRows[] = ["Revenue by payment method", ""];
    $exportRows[] = ["Payment method", "Total (UGX)"];
    foreach ($revenueByPaymentMethod as $row) {
      $exportRows[] = [$row["paymentMethod"], $row["totalAmount"]];
    }
    $exportRows[] = ["", ""];
    $exportRows[] = ["Expenses by payment source", ""];
    $exportRows[] = ["Payment source", "Total (UGX)"];
    foreach ($expensesByPaymentSource as $row) {
      $exportRows[] = [$row["paymentSource"], $row["totalAmount"]];
    }

    $baseName = safe_filename("bdk_pl_report_" . $dateFrom . "_to_" . $dateTo);
    if ($format === "csv") {
      file_response("text/csv; charset=utf-8", $baseName . ".csv", csv_bytes($exportRows));
    }
    if ($format === "xlsx") {
      file_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $baseName . ".xlsx", xlsx_bytes("P&L", $exportRows));
    }
    $pdfLines = [];
    foreach ($exportRows as $r) {
      if (!is_array($r)) {
        continue;
      }
      $pdfLines[] = (string)($r[0] ?? "") . (isset($r[1]) && (string)$r[1] !== "" ? (": " . (string)$r[1]) : "");
    }
    file_response("application/pdf", $baseName . ".pdf", pdf_build("P&L Report " . $dateFrom . " to " . $dateTo, $pdfLines));
  }

  json_response(404, ["error" => "NotFound", "message" => "Route not found"]);
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

function is_valid_ymd_date(string $value): bool {
  if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $value)) {
    return false;
  }
  $dt = DateTime::createFromFormat("Y-m-d", $value, new DateTimeZone("UTC"));
  if ($dt === false) {
    return false;
  }
  return $dt->format("Y-m-d") === $value;
}

function create_id(string $prefix): string {
  $bytes = random_bytes(16);
  $hex = bin2hex($bytes);
  return $prefix . "-" . substr($hex, 0, 8) . "-" . substr($hex, 8, 4) . "-" . substr($hex, 12, 4) . "-" . substr($hex, 16, 4) . "-" . substr($hex, 20);
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$route = api_path();

$apiMode = strtolower((string)(getenv("BDK_API_MODE") ?: ""));
if ($apiMode === "phase1") {
  phase1_handle($method, $route);
}

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
