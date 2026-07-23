<?php
/**
 * Reparo único — fotos Afogadinhos / Pudim / Mini Bolo de Pote
 *
 * 1) Amplia products.image para MEDIUMTEXT
 * 2) Grava JPGs na pasta pública products/ (ao lado das fotos que já funcionam)
 * 3) Atualiza os 3 produtos
 *
 * Uso (uma vez):
 *   POST https://auroraconfeitaria.com.br/api/repair_photos.php
 *   Header: X-Admin-Password: <senha do admin>
 *
 * Depois pode apagar este arquivo.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

require_once __DIR__ . '/mysql_store.php';

$password = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? ($_GET['p'] ?? '');
if ($password === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (is_array($body) && !empty($body['password'])) {
    $password = (string) $body['password'];
  }
}

try {
  $pdo = aurora_db();
  $auth = aurora_get_auth($pdo);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => 'MySQL', 'detail' => $e->getMessage()]);
  exit;
}

$authPass = (string) ($auth['password'] ?? '');
if ($password === '' || $authPass === '' || !hash_equals($authPass, (string) $password)) {
  http_response_code(401);
  echo json_encode(['error' => 'Senha inválida']);
  exit;
}

$manifestPath = __DIR__ . '/repair_photos_data.json';
if (!is_file($manifestPath)) {
  http_response_code(500);
  echo json_encode(['error' => 'Arquivo repair_photos_data.json ausente — envie junto com este PHP']);
  exit;
}

$manifest = json_decode((string) file_get_contents($manifestPath), true);
if (!is_array($manifest) || empty($manifest['files'])) {
  http_response_code(500);
  echo json_encode(['error' => 'Manifest inválido']);
  exit;
}

// 1) Coluna image precisa caber data URL / paths longos
try {
  $pdo->exec('ALTER TABLE `products` MODIFY `image` MEDIUMTEXT NULL');
  $altered = true;
} catch (Throwable $e) {
  $altered = false;
  $alterError = $e->getMessage();
}

$col = $pdo->query("SHOW COLUMNS FROM products LIKE 'image'")->fetch(PDO::FETCH_ASSOC);
$colType = (string) ($col['Type'] ?? '');

// 2) Pasta pública (mesma das fotos que já abrem)
$docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), "/\\");
$siteRoot = dirname(__DIR__);
$candidates = [];
if ($docRoot !== '') {
  $candidates[] = $docRoot . DIRECTORY_SEPARATOR . 'products';
}
$candidates[] = $siteRoot . DIRECTORY_SEPARATOR . 'products';
$anchor = '9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
$productsDir = null;
foreach ($candidates as $dir) {
  if (is_dir($dir) && is_file($dir . DIRECTORY_SEPARATOR . $anchor) && is_writable($dir)) {
    $productsDir = $dir;
    break;
  }
}
if ($productsDir === null) {
  foreach ($candidates as $dir) {
    if (!is_dir($dir)) {
      @mkdir($dir, 0755, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
      $productsDir = $dir;
      break;
    }
  }
}
if ($productsDir === null) {
  http_response_code(500);
  echo json_encode(['error' => 'Sem pasta products gravável', 'tried' => $candidates]);
  exit;
}

$upd = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
$written = [];
$errors = [];

foreach ($manifest['files'] as $item) {
  $id = (string) ($item['id'] ?? '');
  $filename = (string) ($item['filename'] ?? '');
  $b64 = (string) ($item['jpegBase64'] ?? '');
  if ($id === '' || $filename === '' || $b64 === '') {
    $errors[] = ['id' => $id, 'error' => 'item incompleto'];
    continue;
  }
  $bin = base64_decode($b64, true);
  if ($bin === false || strlen($bin) < 100) {
    $errors[] = ['id' => $id, 'error' => 'base64 inválido'];
    continue;
  }
  $dest = $productsDir . DIRECTORY_SEPARATOR . $filename;
  if (@file_put_contents($dest, $bin) === false) {
    $errors[] = ['id' => $id, 'error' => 'falha ao gravar arquivo', 'dest' => $dest];
    continue;
  }
  @chmod($dest, 0644);
  $path = 'products/' . $filename;
  $upd->execute([$path, $id]);
  $written[] = [
    'id' => $id,
    'path' => $path,
    'bytes' => strlen($bin),
    'exists' => is_file($dest),
  ];
}

echo json_encode([
  'ok' => count($errors) === 0,
  'altered' => $altered,
  'alterError' => $alterError ?? null,
  'columnType' => $colType,
  'productsDir' => $productsDir,
  'written' => $written,
  'errors' => $errors,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
