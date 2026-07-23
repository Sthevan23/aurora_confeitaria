<?php
/**
 * Upload de imagens — Hostinger
 * Grava ao lado das fotos que já funcionam em /products.
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
  echo json_encode(['error' => 'Senha inválida — saia e entre de novo no admin']);
  exit;
}

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
  $err = (int) ($_FILES['image']['error'] ?? -1);
  $hints = [
    UPLOAD_ERR_INI_SIZE => 'Arquivo maior que o limite do servidor',
    UPLOAD_ERR_FORM_SIZE => 'Arquivo muito grande',
    UPLOAD_ERR_PARTIAL => 'Upload incompleto — tente de novo',
    UPLOAD_ERR_NO_FILE => 'Nenhum arquivo enviado',
    UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária ausente no servidor',
    UPLOAD_ERR_CANT_WRITE => 'Sem permissão para gravar no disco',
  ];
  http_response_code(400);
  echo json_encode(['error' => $hints[$err] ?? 'Envie uma imagem válida (JPG/PNG)']);
  exit;
}

$file = $_FILES['image'];
$tmp = $file['tmp_name'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmp);

$allowed = [
  'image/jpeg' => 'jpg',
  'image/png' => 'png',
  'image/webp' => 'webp',
  'image/gif' => 'gif',
];

if (!isset($allowed[$mime])) {
  http_response_code(400);
  echo json_encode(['error' => 'Formato inválido. Use JPG ou PNG (HEIC do iPhone não funciona)']);
  exit;
}

if ($file['size'] > 8 * 1024 * 1024) {
  http_response_code(400);
  echo json_encode(['error' => 'Imagem maior que 8MB']);
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

// Âncora: pasta onde já existe foto pública conhecida
$anchorName = '9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
$anchorDirs = [];
$otherDirs = [];
foreach ($candidates as $candidate) {
  if (!is_dir($candidate)) {
    @mkdir($candidate, 0755, true);
  }
  if (!(is_dir($candidate) && is_writable($candidate))) {
    continue;
  }
  if (is_file($candidate . DIRECTORY_SEPARATOR . $anchorName)) {
    $anchorDirs[] = $candidate;
  } else {
    $otherDirs[] = $candidate;
  }
}
$writableDirs = array_values(array_unique(array_merge($anchorDirs, $otherDirs)));

if (!$writableDirs) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Pasta products sem permissão de escrita no servidor',
    'tried' => $candidates,
    'docRoot' => $docRoot,
  ]);
  exit;
}

// Nome estável estilo UUID (os up-* sumiam no Hostinger)
$savedAs = sprintf(
  '%s-%s-%s-%s-%s.jpg',
  bin2hex(random_bytes(4)),
  bin2hex(random_bytes(2)),
  bin2hex(random_bytes(2)),
  bin2hex(random_bytes(2)),
  bin2hex(random_bytes(6))
);
$bytes = 0;
$savedDirs = [];

/**
 * Tenta reencode para JPG (mais compatível na Hostinger)
 */
function aurora_image_to_jpeg(string $src, string $dest, string $mime): bool {
  if (!function_exists('imagecreatetruecolor')) {
    return false;
  }
  $img = null;
  if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) {
    $img = @imagecreatefromjpeg($src);
  } elseif ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
    $img = @imagecreatefrompng($src);
  } elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
    $img = @imagecreatefromwebp($src);
  } elseif ($mime === 'image/gif' && function_exists('imagecreatefromgif')) {
    $img = @imagecreatefromgif($src);
  }
  if (!$img) {
    return false;
  }

  $w = imagesx($img);
  $h = imagesy($img);
  $max = 1600;
  if ($w > $max || $h > $max) {
    $scale = min($max / max($w, 1), $max / max($h, 1));
    $nw = max(1, (int) round($w * $scale));
    $nh = max(1, (int) round($h * $scale));
    $resized = imagecreatetruecolor($nw, $nh);
    $white = imagecolorallocate($resized, 255, 255, 255);
    imagefilledrectangle($resized, 0, 0, $nw, $nh, $white);
    imagecopyresampled($resized, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagedestroy($img);
    $img = $resized;
  } else {
    $canvas = imagecreatetruecolor($w, $h);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefilledrectangle($canvas, 0, 0, $w, $h, $white);
    imagecopy($canvas, $img, 0, 0, 0, 0, $w, $h);
    imagedestroy($img);
    $img = $canvas;
  }

  $ok = imagejpeg($img, $dest, 85);
  imagedestroy($img);
  return $ok && is_file($dest);
}

$primary = $writableDirs[0];
$primaryDestJpg = $primary . DIRECTORY_SEPARATOR . $savedAs;

$wrote = false;
if (aurora_image_to_jpeg($tmp, $primaryDestJpg, $mime)) {
  $wrote = true;
  $bytes = filesize($primaryDestJpg) ?: 0;
  $savedDirs[] = $primary;
} else {
  $ext = $allowed[$mime];
  $savedAs = preg_replace('/\.jpg$/i', '.' . $ext, $savedAs);
  $dest = $primary . DIRECTORY_SEPARATOR . $savedAs;
  if (move_uploaded_file($tmp, $dest) || @copy($tmp, $dest)) {
    $wrote = true;
    $bytes = filesize($dest) ?: 0;
    $savedDirs[] = $primary;
  }
}

if (!$wrote) {
  http_response_code(500);
  echo json_encode(['error' => 'Falha ao salvar a imagem', 'dir' => $primary]);
  exit;
}

@chmod($primary . DIRECTORY_SEPARATOR . $savedAs, 0644);

$srcFile = $primary . DIRECTORY_SEPARATOR . $savedAs;
foreach ($writableDirs as $dir) {
  if ($dir === $primary) {
    continue;
  }
  $copyTo = $dir . DIRECTORY_SEPARATOR . $savedAs;
  if (@copy($srcFile, $copyTo)) {
    @chmod($copyTo, 0644);
    $savedDirs[] = $dir;
  }
}

if (!is_file($srcFile) || filesize($srcFile) < 1) {
  http_response_code(500);
  echo json_encode(['error' => 'Arquivo não ficou gravado no servidor']);
  exit;
}

$path = 'products/' . $savedAs;
$jpegBytes = file_get_contents($srcFile);
$dataUrl = 'data:image/jpeg;base64,' . base64_encode($jpegBytes !== false ? $jpegBytes : '');

// Se a pasta âncora não foi usada, avisa — arquivo pode não ser público
$usedAnchor = in_array($primary, $anchorDirs, true);

echo json_encode([
  'ok' => true,
  'path' => $path,
  'url' => '/' . $path,
  'bytes' => $bytes,
  'dirs' => count($savedDirs),
  'anchor' => $usedAnchor,
  'dir' => $primary,
  'dataUrl' => $dataUrl,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
