<?php
/**
 * Serve foto de produto: arquivo em /products ou backup no MySQL.
 * Assim o deploy Git não “apaga” as fotos novas do painel.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$raw = (string) ($_GET['f'] ?? '');
$name = basename(str_replace(['\\', "\0"], '', $raw));
if ($name === '' || !preg_match('/^[a-zA-Z0-9._-]+\.(jpe?g|png|webp|gif)$/i', $name)) {
  http_response_code(400);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Arquivo inválido';
  exit;
}

$root = dirname(__DIR__);
$candidates = [
  $root . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR . $name,
];
$docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), "/\\");
if ($docRoot !== '') {
  $candidates[] = $docRoot . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR . $name;
}

foreach (array_unique($candidates) as $path) {
  if (is_file($path) && is_readable($path)) {
    $mime = 'image/jpeg';
    if (preg_match('/\.png$/i', $name)) $mime = 'image/png';
    elseif (preg_match('/\.webp$/i', $name)) $mime = 'image/webp';
    elseif (preg_match('/\.gif$/i', $name)) $mime = 'image/gif';
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=604800');
    header('Content-Length: ' . (string) filesize($path));
    readfile($path);
    exit;
  }
}

try {
  require_once __DIR__ . '/db.php';
  require_once __DIR__ . '/mysql_store.php';
  $pdo = aurora_db(false);
  aurora_ensure_product_images_table($pdo);
  $stmt = $pdo->prepare('SELECT mime, data FROM product_images WHERE filename = ? LIMIT 1');
  $stmt->execute([$name]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if ($row && !empty($row['data'])) {
    $mime = (string) ($row['mime'] ?: 'image/jpeg');
    $bin = $row['data'];
    if (is_resource($bin)) {
      $bin = stream_get_contents($bin);
    }
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=604800');
    header('Content-Length: ' . (string) strlen($bin));
    echo $bin;
    exit;
  }
} catch (Throwable $e) {
  // cai no 404
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
echo 'Foto não encontrada';
