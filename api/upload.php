<?php
/**
 * Upload de imagens — autenticação via MySQL (Hostinger)
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Método não permitido']);
  exit;
}

require_once __DIR__ . '/mysql_store.php';

$password = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';

try {
  $pdo = aurora_db();
  $auth = aurora_get_auth($pdo);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Falha na conexão MySQL', 'detail' => $e->getMessage()]);
  exit;
}

$authPass = (string) ($auth['password'] ?? '');
if ($password === '' || $authPass === '' || !hash_equals($authPass, $password)) {
  http_response_code(401);
  echo json_encode(['error' => 'Senha inválida']);
  exit;
}

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Envie uma imagem válida']);
  exit;
}

$file = $_FILES['image'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = [
  'image/jpeg' => 'jpg',
  'image/png' => 'png',
  'image/webp' => 'webp',
  'image/gif' => 'gif',
];

if (!isset($allowed[$mime])) {
  http_response_code(400);
  echo json_encode(['error' => 'Use JPG, PNG, WEBP ou GIF']);
  exit;
}

if ($file['size'] > 5 * 1024 * 1024) {
  http_response_code(400);
  echo json_encode(['error' => 'Imagem maior que 5MB']);
  exit;
}

$dir = dirname(__DIR__) . '/products';
if (!is_dir($dir)) {
  mkdir($dir, 0755, true);
}

$name = 'up-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
$dest = $dir . DIRECTORY_SEPARATOR . $name;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
  http_response_code(500);
  echo json_encode(['error' => 'Falha ao salvar a imagem']);
  exit;
}

echo json_encode([
  'ok' => true,
  'path' => 'products/' . $name,
]);
