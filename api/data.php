<?php
/**
 * API Aurora — MySQL Hostinger
 * Banco: u586160337_aurora_doces
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

require_once __DIR__ . '/mysql_store.php';

function public_payload(array $data): array {
  return [
    'version' => $data['version'] ?? 1,
    'settings' => $data['settings'] ?? new stdClass(),
    'categories' => $data['categories'] ?? [],
    'products' => $data['products'] ?? [],
    'reviews' => $data['reviews'] ?? [],
    'faq' => $data['faq'] ?? [],
    'gallery' => $data['gallery'] ?? [],
  ];
}

function get_password(): string {
  $header = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
  if ($header !== '') {
    return (string) $header;
  }
  $input = json_decode(file_get_contents('php://input'), true);
  if (is_array($input) && !empty($input['password'])) {
    return (string) $input['password'];
  }
  return '';
}

function json_out($payload, int $code = 200): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function db_or_fail(): PDO {
  try {
    return aurora_db();
  } catch (Throwable $e) {
    json_out([
      'error' => 'Falha na conexão MySQL',
      'detail' => $e->getMessage(),
      'hint' => 'Confira api/config.local.php (usuário/senha) e se importou api/aurora_mysql.sql',
    ], 500);
  }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
  // Health / probe do front
  if (isset($_GET['ping'])) {
    try {
      $cfg = require __DIR__ . '/config.php';
      $pdo = aurora_db();
      $ready = aurora_db_ready($pdo);
      $dbName = $pdo->query('SELECT DATABASE()')->fetchColumn();
      json_out([
        'ok' => true,
        'db' => 'mysql',
        'database' => $dbName ?: ($cfg['name'] ?? ''),
        'user' => $cfg['user'] ?? '',
        'ready' => $ready,
        'host' => $cfg['host'] ?? '',
      ]);
    } catch (Throwable $e) {
      json_out([
        'ok' => false,
        'db' => 'mysql',
        'error' => $e->getMessage(),
      ], 500);
    }
  }

  $pdo = db_or_fail();

  try {
    $data = aurora_load_all($pdo);
  } catch (Throwable $e) {
    json_out(['error' => 'Falha ao ler MySQL', 'detail' => $e->getMessage()], 500);
  }

  if ($data === null) {
    json_out(['empty' => true, 'db' => 'mysql']);
  }

  $password = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
  $wantFull = isset($_GET['full']) || $action === 'full';

  if ($wantFull) {
    $auth = aurora_get_auth($pdo);
    $ok = $auth['password'] !== '' && hash_equals($auth['password'], (string) $password);
    if (!$ok) {
      json_out(['error' => 'Senha inválida'], 401);
    }
    json_out($data);
  }

  json_out(public_payload($data));
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);

  if (!is_array($body)) {
    json_out(['error' => 'JSON inválido'], 400);
  }

  $pdo = db_or_fail();
  $password = get_password();

  try {
    $stored = aurora_load_all($pdo);
  } catch (Throwable $e) {
    json_out(['error' => 'Falha ao ler MySQL', 'detail' => $e->getMessage()], 500);
  }

  // Login
  if (($body['action'] ?? '') === 'login') {
    $email = trim((string) ($body['email'] ?? ''));
    $pass = (string) ($body['password'] ?? '');

    if ($stored === null) {
      json_out([
        'error' => 'Banco sem dados. Importe api/aurora_mysql.sql no phpMyAdmin.',
      ], 404);
    }

    $authEmail = (string) ($stored['auth']['email'] ?? '');
    $authPass = (string) ($stored['auth']['password'] ?? '');

    if (!hash_equals($authEmail, $email) || !hash_equals($authPass, $pass)) {
      json_out(['error' => 'E-mail ou senha incorretos.'], 401);
    }

    json_out(['ok' => true, 'data' => $stored]);
  }

  // Pedido público
  if (($body['action'] ?? '') === 'create_order') {
    if ($stored === null) {
      json_out(['error' => 'Sistema ainda não inicializado no MySQL.'], 503);
    }

    $order = $body['order'] ?? null;
    $client = $body['client'] ?? null;

    if (!is_array($order) || empty($order['clientName']) || empty($order['clientWhatsapp']) || empty($order['items'])) {
      json_out(['error' => 'Pedido incompleto'], 400);
    }

    try {
      $result = aurora_create_order($pdo, $order, is_array($client) ? $client : null);
      json_out($result);
    } catch (Throwable $e) {
      json_out(['error' => 'Falha ao gravar pedido', 'detail' => $e->getMessage()], 500);
    }
  }

  // Salvamento completo (admin)
  $payload = $body['data'] ?? $body;
  if (!is_array($payload) || !isset($payload['settings'])) {
    json_out(['error' => 'Dados incompletos'], 400);
  }

  if ($stored === null) {
    if ($password === '' && !empty($payload['auth']['password'])) {
      $password = (string) $payload['auth']['password'];
    }
    if ($password === '') {
      json_out(['error' => 'Informe a senha do admin para criar os dados'], 401);
    }
    if (empty($payload['auth']['password'])) {
      $payload['auth'] = [
        'email' => $payload['auth']['email'] ?? 'auroraconfeitaria2022@gmail.com',
        'password' => $password,
      ];
    }
  } else {
    $authPass = (string) ($stored['auth']['password'] ?? '');
    if ($password === '' || !hash_equals($authPass, $password)) {
      json_out(['error' => 'Senha inválida para salvar'], 401);
    }
    if (empty($payload['auth'])) {
      $payload['auth'] = $stored['auth'];
    }
  }

  try {
    aurora_save_all($pdo, $payload);
    json_out(['ok' => true, 'db' => 'mysql']);
  } catch (Throwable $e) {
    json_out(['error' => 'Falha ao gravar no MySQL', 'detail' => $e->getMessage()], 500);
  }
}

json_out(['error' => 'Método não permitido'], 405);
