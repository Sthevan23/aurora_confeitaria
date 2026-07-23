<?php
/**
 * Rode UMA VEZ no navegador (logada no admin) ou com a senha:
 *   https://auroraconfeitaria.com.br/api/enable_admin_photos.php?p=SENHA_DO_ADMIN
 *
 * Isso libera a Clara a cadastrar produtos com foto pelo painel.
 * Depois pode apagar este arquivo.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/mysql_store.php';

$password = $_GET['p'] ?? ($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');

try {
  $pdo = aurora_db();
  $auth = aurora_get_auth($pdo);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'MySQL', 'detail' => $e->getMessage()]);
  exit;
}

$authPass = (string) ($auth['password'] ?? '');
if ($password === '' || $authPass === '' || !hash_equals($authPass, (string) $password)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'Informe a senha do admin: ?p=sua_senha']);
  exit;
}

$before = $pdo->query("SHOW COLUMNS FROM products LIKE 'image'")->fetch(PDO::FETCH_ASSOC);
$beforeType = (string) ($before['Type'] ?? '');

try {
  $pdo->exec('ALTER TABLE `products` MODIFY `image` MEDIUMTEXT NULL');
  $altered = true;
  $alterError = null;
} catch (Throwable $e) {
  $altered = false;
  $alterError = $e->getMessage();
}

$after = $pdo->query("SHOW COLUMNS FROM products LIKE 'image'")->fetch(PDO::FETCH_ASSOC);
$afterType = (string) ($after['Type'] ?? '');
$ok = stripos($afterType, 'mediumtext') !== false || stripos($afterType, 'longtext') !== false;

echo json_encode([
  'ok' => $ok,
  'altered' => $altered,
  'alterError' => $alterError,
  'before' => $beforeType,
  'after' => $afterType,
  'message' => $ok
    ? 'Pronto! A Clara já pode subir fotos pelo admin (Produtos → Nova foto → Salvar).'
    : 'Ainda não liberou. Rode no phpMyAdmin: ALTER TABLE products MODIFY image MEDIUMTEXT NULL;',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
