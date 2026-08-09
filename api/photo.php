<?php
/**
 * Foto de produto: só arquivo estático em /products.
 * Backup MySQL desligado — cada miss + PDO estourava processos na Hostinger (503).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

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
$path = $root . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR . $name;
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

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
echo 'Foto não encontrada';
