<?php
/**
 * Recoloca fotos do MySQL em /products depois do Reimplantar Git.
 * Um único processo — não usar rewrite 404→PHP (isso gerava 503).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$lock = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora_restore_photos.lock';
$fp = @fopen($lock, 'c+');
if ($fp && !flock($fp, LOCK_EX | LOCK_NB)) {
  echo '{"ok":true,"skipped":"busy"}';
  exit;
}

try {
  require_once __DIR__ . '/db.php';
  $pdo = aurora_db(false);
  $restored = aurora_restore_missing_photos($pdo, 40);
  $backed = 0;
  $stamp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora_photo_backup_' . md5(__DIR__);
  $backupDue = $restored > 0 || !is_file($stamp) || (filemtime($stamp) < (time() - 180));
  if ($backupDue) {
    $backed = aurora_backup_disk_photos_to_mysql($pdo, 20);
    @file_put_contents($stamp, (string) time());
  }
  echo json_encode([
    'ok' => true,
    'restored' => $restored,
    'backed' => $backed,
  ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['ok' => false, 'error' => 'restore'], JSON_UNESCAPED_UNICODE);
}

if ($fp) {
  flock($fp, LOCK_UN);
  fclose($fp);
}
