<?php
/**
 * Cardápio público sem MySQL — só lê o JSON estático com Cache-Control no-store.
 * Usado pelo site quando catalog.live.json fica preso em CDN/cache.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$root = dirname(__DIR__);
$candidates = [
  $root . DIRECTORY_SEPARATOR . 'catalog.live.json',
  $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'catalog.live.json',
  $root . DIRECTORY_SEPARATOR . 'catalog.json',
  $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'catalog.json',
];

$best = null;
$bestVer = -1;
$bestGen = -1;
foreach ($candidates as $path) {
  if (!is_file($path) || !is_readable($path)) continue;
  $raw = @file_get_contents($path);
  if ($raw === false || $raw === '') continue;
  $data = json_decode($raw, true);
  if (!is_array($data) || empty($data['products']) || !is_array($data['products'])) continue;
  $ver = (int) ($data['version'] ?? 0);
  $gen = (int) (strtotime((string) ($data['generatedAt'] ?? '')) ?: 0);
  if ($ver > $bestVer || ($ver === $bestVer && $gen > $bestGen)) {
    $best = $raw;
    $bestVer = $ver;
    $bestGen = $gen;
  }
}

if ($best === null) {
  http_response_code(404);
  echo json_encode(['error' => 'Catálogo não encontrado'], JSON_UNESCAPED_UNICODE);
  exit;
}

echo $best;
exit;
