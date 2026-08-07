<?php
/**
 * PDO MySQL — Aurora / Hostinger
 */

function aurora_db(bool $ensureSchema = true): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $cfg = require __DIR__ . '/config.php';
  $host = $cfg['host'] ?? 'localhost';
  $port = (int) ($cfg['port'] ?? 3306);
  $name = $cfg['name'] ?? '';
  $user = $cfg['user'] ?? '';
  $pass = $cfg['pass'] ?? '';
  $charset = $cfg['charset'] ?? 'utf8mb4';

  if ($name === '' || $user === '') {
    throw new RuntimeException('Config MySQL incompleta (name/user).');
  }
  if ($pass === '' || $pass === 'COLOQUE_A_SENHA_DO_MYSQL_AQUI') {
    throw new RuntimeException('Defina a senha MySQL em api/config.local.php');
  }

  $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  if ($ensureSchema) {
    aurora_ensure_schema($pdo);
    aurora_fix_copo_felicidade_price($pdo);
  }

  return $pdo;
}

/**
 * Corrige preço do Copo da Felicidade (tira promo antiga R$22 → R$29).
 * Roda 1x (flag) — idempotente.
 */
function aurora_fix_copo_felicidade_price(PDO $pdo): void {
  static $done = false;
  if ($done) {
    return;
  }
  $done = true;

  $flag = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora_fix_p0_price_v2_' . md5(__DIR__);
  if (is_file($flag)) {
    return;
  }

  try {
    $exists = $pdo->query(
      "SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' LIMIT 1"
    )->fetchColumn();
    if (!$exists) {
      return;
    }
    $pdo->exec(
      "UPDATE `products`
       SET `price` = 29,
           `promo_active` = 0,
           `promo_price` = NULL,
           `promo_label` = ''
       WHERE `id` = 'p0'"
    );
    @file_put_contents($flag, (string) time());
  } catch (Throwable $e) {
    // ignore
  }
}

/**
 * Garante schema necessário para o painel (fotos + frete + cupons).
 * Roda no máx. 1x por dia (arquivo flag) — evita ALTER/information_schema a cada request.
 */
function aurora_ensure_schema(PDO $pdo): void {
  static $done = false;
  if ($done) {
    return;
  }
  $done = true;

  $flag = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora_schema_ok_' . md5(__DIR__);
  if (is_file($flag) && (time() - (int) @filemtime($flag)) < 86400) {
    return;
  }

  try {
    $productsExists = $pdo->query(
      "SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' LIMIT 1"
    )->fetchColumn();
    if ($productsExists) {
      $col = $pdo->query("SHOW COLUMNS FROM products LIKE 'image'")->fetch(PDO::FETCH_ASSOC);
      $type = strtolower((string) ($col['Type'] ?? ''));
      if ($type !== '' && strpos($type, 'mediumtext') === false && strpos($type, 'longtext') === false) {
        $pdo->exec('ALTER TABLE `products` MODIFY `image` MEDIUMTEXT NULL');
      }
      aurora_ensure_column(
        $pdo,
        'products',
        'available',
        "TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Disponivel para pedido no site'"
      );
    }

    $settingsExists = $pdo->query(
      "SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' LIMIT 1"
    )->fetchColumn();
    if ($settingsExists) {
      aurora_ensure_column(
        $pdo,
        'settings',
        'delivery_fee',
        "DECIMAL(10,2) NOT NULL DEFAULT 7.00 COMMENT 'Frete região central'"
      );
      aurora_ensure_column(
        $pdo,
        'settings',
        'delivery_note',
        "VARCHAR(255) NULL DEFAULT 'Bairros mais afastados: consultar' COMMENT 'Texto extra do frete'"
      );
    }

    // Cupons: cria a tabela se ainda não existir (bancos antigos sem migrate)
    aurora_ensure_coupons_table($pdo);
    aurora_ensure_product_images_table($pdo);

    // Fidelidade: pedidos fora do site (ajuste manual)
    $clientsExists = $pdo->query(
      "SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' LIMIT 1"
    )->fetchColumn();
    if ($clientsExists) {
      aurora_ensure_column(
        $pdo,
        'clients',
        'loyalty_bonus',
        "INT NOT NULL DEFAULT 0 COMMENT 'Pedidos fora do site (ajuste fidelidade)'"
      );
    }

    @file_put_contents($flag, (string) time());
  } catch (Throwable $e) {
    // Não derruba o site se o ALTER falhar (permissão etc.)
  }
}

function aurora_ensure_coupons_table(PDO $pdo): void {
  $exists = $pdo->query(
    "SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons' LIMIT 1"
  )->fetchColumn();
  if ($exists) {
    return;
  }
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS `coupons` (
      `id` VARCHAR(64) NOT NULL,
      `code` VARCHAR(40) NOT NULL,
      `type` ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
      `value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      `min_order` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      `active` TINYINT(1) NOT NULL DEFAULT 1,
      `label` VARCHAR(120) DEFAULT NULL,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uk_coupons_code` (`code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function aurora_ensure_column(PDO $pdo, string $table, string $column, string $definition): void {
  $stmt = $pdo->prepare(
    'SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1'
  );
  $stmt->execute([$table, $column]);
  if ($stmt->fetchColumn()) {
    return;
  }
  $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
}

/**
 * Backup das fotos enviadas no painel (sobrevive ao Reimplantar Git).
 */
function aurora_ensure_product_images_table(PDO $pdo): void {
  static $done = false;
  if ($done) {
    return;
  }
  $done = true;
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS `product_images` (
      `filename` VARCHAR(190) NOT NULL,
      `mime` VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
      `data` LONGBLOB NOT NULL,
      `bytes` INT UNSIGNED NOT NULL DEFAULT 0,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`filename`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function aurora_store_product_image_blob(PDO $pdo, string $filename, string $bytes, string $mime = 'image/jpeg'): bool {
  $name = basename($filename);
  if ($name === '' || $bytes === '') {
    return false;
  }
  aurora_ensure_product_images_table($pdo);
  $stmt = $pdo->prepare(
    'INSERT INTO product_images (filename, mime, data, bytes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), data = VALUES(data), bytes = VALUES(bytes)'
  );
  return $stmt->execute([$name, $mime ?: 'image/jpeg', $bytes, strlen($bytes)]);
}
