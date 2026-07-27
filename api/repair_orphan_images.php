<?php
/**
 * Recupera fotos "órfãs": gravadas em pasta errada ou listadas no MySQL sem arquivo público.
 *
 * POST/GET https://auroraconfeitaria.com.br/api/repair_orphan_images.php
 * Header: X-Admin-Password: <senha>
 *
 * 1) Procura arquivos dos produtos em pastas candidatas e copia para a pasta pública
 * 2) Lista produtos que ainda estão com foto quebrada (precisa reenviar no admin)
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

$docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), "/\\");
$siteRoot = dirname(__DIR__);
$candidates = [];
if ($docRoot !== '') {
  $candidates[] = $docRoot . DIRECTORY_SEPARATOR . 'products';
}
$candidates[] = $siteRoot . DIRECTORY_SEPARATOR . 'products';
$homeGuess = dirname($siteRoot) . DIRECTORY_SEPARATOR . 'public_html' . DIRECTORY_SEPARATOR . 'products';
if (!in_array($homeGuess, $candidates, true)) {
  $candidates[] = $homeGuess;
}
$candidates = array_values(array_unique($candidates));

$anchorName = '9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
$publicDir = null;
foreach ($candidates as $dir) {
  if (is_dir($dir) && is_file($dir . DIRECTORY_SEPARATOR . $anchorName)) {
    $publicDir = $dir;
    break;
  }
}

if (!$publicDir) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Pasta pública products/ não encontrada',
    'tried' => $candidates,
  ]);
  exit;
}

$rows = $pdo->query('SELECT id, name, image FROM products')->fetchAll();
$recovered = [];
$stillBroken = [];
$ok = [];
$skipped = [];

foreach ($rows as $row) {
  $image = trim((string) ($row['image'] ?? ''));
  $name = (string) ($row['name'] ?? '');
  $id = (string) ($row['id'] ?? '');

  if ($image === '' || preg_match('#^(data:|https?://|blob:)#i', $image)) {
    $ok[] = ['id' => $id, 'name' => $name, 'image' => substr($image, 0, 60)];
    continue;
  }

  $rel = ltrim(str_replace('\\', '/', $image), '/');
  if (strpos($rel, 'products/') !== 0) {
    $skipped[] = ['id' => $id, 'name' => $name, 'image' => $image, 'reason' => 'path inesperado'];
    continue;
  }

  $fileName = basename($rel);
  $publicFile = $publicDir . DIRECTORY_SEPARATOR . $fileName;

  if (is_file($publicFile) && filesize($publicFile) > 32) {
    $ok[] = ['id' => $id, 'name' => $name, 'image' => $image];
    continue;
  }

  $found = null;
  foreach ($candidates as $dir) {
    $candidate = $dir . DIRECTORY_SEPARATOR . $fileName;
    if ($dir === $publicDir) {
      continue;
    }
    if (is_file($candidate) && filesize($candidate) > 32) {
      $found = $candidate;
      break;
    }
  }

  if ($found) {
    if (@copy($found, $publicFile)) {
      @chmod($publicFile, 0644);
      $recovered[] = [
        'id' => $id,
        'name' => $name,
        'image' => $image,
        'from' => $found,
        'to' => $publicFile,
      ];
      continue;
    }
  }

  $stillBroken[] = [
    'id' => $id,
    'name' => $name,
    'image' => $image,
    'hint' => 'Reenvie a foto no admin (Editar produto → escolher arquivo → Salvar)',
  ];
}

echo json_encode([
  'ok' => true,
  'publicDir' => $publicDir,
  'recovered' => $recovered,
  'stillBroken' => $stillBroken,
  'okCount' => count($ok),
  'recoveredCount' => count($recovered),
  'brokenCount' => count($stillBroken),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
