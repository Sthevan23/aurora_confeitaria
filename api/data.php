<?php
/**
 * API de dados compartilhados â€” Aurora
 * Todos os celulares leem/gravam o mesmo arquivo no servidor Hostinger.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$file = __DIR__ . '/data.json';

function read_data($file) {
  if (!file_exists($file)) {
    return null;
  }
  $raw = file_get_contents($file);
  $data = json_decode($raw, true);
  return is_array($data) ? $data : null;
}

function write_data($file, $data) {
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    return false;
  }
  return file_put_contents($file, $json, LOCK_EX) !== false;
}

function public_payload($data) {
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

function get_password() {
  $header = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
  if ($header !== '') {
    return $header;
  }
  $input = json_decode(file_get_contents('php://input'), true);
  if (is_array($input) && !empty($input['password'])) {
    return (string) $input['password'];
  }
  return '';
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
  $data = read_data($file);

  if ($data === null) {
    echo json_encode(['empty' => true]);
    exit;
  }

  $password = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
  $wantFull = isset($_GET['full']) || $action === 'full';

  if ($wantFull) {
    $ok = isset($data['auth']['password']) && hash_equals((string) $data['auth']['password'], (string) $password);
    if (!$ok) {
      http_response_code(401);
      echo json_encode(['error' => 'Senha invÃ¡lida']);
      exit;
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }

  // Site pÃºblico: sem pedidos, clientes nem senha
  echo json_encode(public_payload($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);

  if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON invÃ¡lido']);
    exit;
  }

  $password = get_password();
  $stored = read_data($file);

  // Login: valida e devolve todos os dados
  if (($body['action'] ?? '') === 'login') {
    $email = trim((string) ($body['email'] ?? ''));
    $pass = (string) ($body['password'] ?? '');

    if ($stored === null) {
      http_response_code(404);
      echo json_encode(['error' => 'Sem dados no servidor. FaÃ§a o primeiro salvamento pelo admin.']);
      exit;
    }

    $authEmail = (string) ($stored['auth']['email'] ?? '');
    $authPass = (string) ($stored['auth']['password'] ?? '');

    if (!hash_equals($authEmail, $email) || !hash_equals($authPass, $pass)) {
      http_response_code(401);
      echo json_encode(['error' => 'E-mail ou senha incorretos.']);
      exit;
    }

    echo json_encode(['ok' => true, 'data' => $stored], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }

  // Pedido pÃºblico do site (sem senha de admin)
  if (($body['action'] ?? '') === 'create_order') {
    if ($stored === null) {
      http_response_code(503);
      echo json_encode(['error' => 'Sistema ainda nÃ£o inicializado. Entre no admin uma vez para sincronizar.']);
      exit;
    }

    $order = $body['order'] ?? null;
    $client = $body['client'] ?? null;

    if (!is_array($order) || empty($order['clientName']) || empty($order['clientWhatsapp']) || empty($order['items'])) {
      http_response_code(400);
      echo json_encode(['error' => 'Pedido incompleto']);
      exit;
    }

    if (!isset($stored['orders']) || !is_array($stored['orders'])) {
      $stored['orders'] = [];
    }
    if (!isset($stored['clients']) || !is_array($stored['clients'])) {
      $stored['clients'] = [];
    }

    if (is_array($client) && !empty($client['phone'])) {
      $found = false;
      foreach ($stored['clients'] as $i => $c) {
        if (($c['phone'] ?? '') === ($client['phone'] ?? '') || ($c['id'] ?? '') === ($client['id'] ?? '')) {
          $stored['clients'][$i] = array_merge($c, $client);
          $found = true;
          break;
        }
      }
      if (!$found) {
        $stored['clients'][] = $client;
      }
    }

    // Evita pedido duplicado (mesmo id ou mesmo envio em poucos segundos)
    $orderId = (string)($order['id'] ?? '');
    if ($orderId !== '') {
      foreach ($stored['orders'] as $existing) {
        if (($existing['id'] ?? '') === $orderId) {
          echo json_encode(['ok' => true, 'orderNumber' => $existing['number'] ?? '', 'duplicated' => true]);
          exit;
        }
      }
    }

    $phone = preg_replace('/\D+/', '', (string)($order['clientWhatsapp'] ?? ''));
    $now = time();
    foreach ($stored['orders'] as $existing) {
      $existingPhone = preg_replace('/\D+/', '', (string)($existing['clientWhatsapp'] ?? ''));
      if ($existingPhone === '' || $existingPhone !== $phone) continue;
      $existingTs = strtotime((string)($existing['date'] ?? '')) ?: 0;
      if ($existingTs <= 0 || ($now - $existingTs) > 90) continue;
      $sameTotal = (float)($existing['total'] ?? 0) === (float)($order['total'] ?? 0);
      $sameName = trim((string)($existing['clientName'] ?? '')) === trim((string)($order['clientName'] ?? ''));
      $sameNotes = trim((string)($existing['notes'] ?? '')) === trim((string)($order['notes'] ?? ''));
      if ($sameTotal && $sameName && $sameNotes) {
        echo json_encode(['ok' => true, 'orderNumber' => $existing['number'] ?? '', 'duplicated' => true]);
        exit;
      }
    }

    // Garante nÃºmero sequencial Ãºnico no servidor
    $year = (int)date('Y');
    $max = 0;
    foreach ($stored['orders'] as $existing) {
      if (preg_match('/PED-(\d{4})-(\d+)/i', (string)($existing['number'] ?? ''), $m)) {
        if ((int)$m[1] === $year) {
          $max = max($max, (int)$m[2]);
        }
      }
    }
    $order['number'] = sprintf('PED-%d-%03d', $year, $max + 1);

    $stored['orders'][] = $order;

    if (!write_data($file, $stored)) {
      http_response_code(500);
      echo json_encode(['error' => 'Falha ao gravar pedido']);
      exit;
    }

    echo json_encode(['ok' => true, 'orderNumber' => $order['number'] ?? '']);
    exit;
  }

  // Salvamento completo
  $payload = $body['data'] ?? $body;
  if (!is_array($payload) || !isset($payload['settings'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados incompletos']);
    exit;
  }

  if ($stored === null) {
    // Primeiro salvamento: cria o arquivo (bootstrap)
    if ($password === '' && !empty($payload['auth']['password'])) {
      $password = (string) $payload['auth']['password'];
    }
    if ($password === '') {
      http_response_code(401);
      echo json_encode(['error' => 'Informe a senha do admin para criar os dados']);
      exit;
    }
    if (empty($payload['auth']['password'])) {
      $payload['auth'] = [
        'email' => $payload['auth']['email'] ?? 'admin@Aurora.com.br',
        'password' => $password,
      ];
    }
  } else {
    $authPass = (string) ($stored['auth']['password'] ?? '');
    if ($password === '' || !hash_equals($authPass, $password)) {
      http_response_code(401);
      echo json_encode(['error' => 'Senha invÃ¡lida para salvar']);
      exit;
    }
    // MantÃ©m auth se o payload nÃ£o trouxe
    if (empty($payload['auth'])) {
      $payload['auth'] = $stored['auth'];
    }
  }

  if (!write_data($file, $payload)) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao gravar no servidor']);
    exit;
  }

  echo json_encode(['ok' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'MÃ©todo nÃ£o permitido']);

