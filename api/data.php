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
  $coupons = [];
  foreach ($data['coupons'] ?? [] as $c) {
    if (empty($c['active'])) continue;
    $coupons[] = [
      'code' => strtoupper(trim((string) ($c['code'] ?? ''))),
      'type' => ($c['type'] ?? '') === 'fixed' ? 'fixed' : 'percent',
      'value' => (float) ($c['value'] ?? 0),
      'minOrder' => (float) ($c['minOrder'] ?? 0),
      'label' => $c['label'] ?? '',
    ];
  }

  // Produtos: mantém paths; data-URL enorme já é convertida gradualmente no loader
  $products = [];
  foreach ($data['products'] ?? [] as $p) {
    if (!is_array($p)) continue;
    $products[] = $p;
  }

  return [
    'version' => $data['version'] ?? 1,
    'settings' => $data['settings'] ?? new stdClass(),
    'categories' => $data['categories'] ?? [],
    'products' => $products,
    'reviews' => $data['reviews'] ?? [],
    'faq' => $data['faq'] ?? [],
    'gallery' => $data['gallery'] ?? [],
    'coupons' => $coupons,
  ];
}

function get_password_header(): string {
  return (string) ($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');
}

function get_password_from_body(array $body): string {
  if (!empty($body['password'])) {
    return (string) $body['password'];
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
  // Health / probe — SEM MySQL (bem leve)
  if (isset($_GET['ping'])) {
    json_out([
      'ok' => true,
      'db' => 'mysql',
      'light' => true,
      'ts' => time(),
    ]);
  }

  // Preferir catalog.json estático (zero MySQL) quando existir e estiver fresco
  if (!isset($_GET['full']) && $action !== 'full') {
    $catalogFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'catalog.json';
    if (is_file($catalogFile) && (time() - (int) @filemtime($catalogFile)) < 3600) {
      $raw = @file_get_contents($catalogFile);
      if ($raw !== false && $raw !== '') {
        header('Cache-Control: public, max-age=120');
        header('Content-Type: application/json; charset=utf-8');
        echo $raw;
        exit;
      }
    }
  }

  $pdo = db_or_fail();
  $password = get_password_header();
  $wantFull = isset($_GET['full']) || $action === 'full';

  try {
    $data = aurora_load_all($pdo, $wantFull ? 'full' : 'public');
  } catch (Throwable $e) {
    json_out(['error' => 'Falha ao ler MySQL', 'detail' => $e->getMessage()], 500);
  }

  if ($data === null) {
    json_out(['empty' => true, 'db' => 'mysql']);
  }

  if ($wantFull) {
    $auth = aurora_get_auth($pdo);
    $ok = $auth['password'] !== '' && hash_equals($auth['password'], (string) $password);
    if (!$ok) {
      json_out(['error' => 'Senha inválida'], 401);
    }
    header('Cache-Control: no-store');
    json_out($data);
  }

  // Atualiza catalog.json pra próximas visitas não baterem no MySQL
  try {
    aurora_write_public_catalog($pdo);
  } catch (Throwable $e) {
  }

  header('Cache-Control: public, max-age=120');
  json_out(public_payload($data));
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);

  if (!is_array($body)) {
    json_out(['error' => 'JSON inválido'], 400);
  }

  $pdo = db_or_fail();
  $password = get_password_header() ?: get_password_from_body($body);
  $actionName = (string) ($body['action'] ?? '');

  // Login — carrega tudo 1x
  if ($actionName === 'login') {
    try {
      $stored = aurora_load_all($pdo, 'full');
    } catch (Throwable $e) {
      json_out(['error' => 'Falha ao ler MySQL', 'detail' => $e->getMessage()], 500);
    }

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

  // Pedido / fidelidade — sem carregar produtos/imagens
  if ($actionName === 'loyalty_status') {
    if (!aurora_db_ready($pdo)) {
      json_out(['error' => 'Sistema ainda não inicializado no MySQL.'], 503);
    }
    $phone = (string) ($body['phone'] ?? $body['whatsapp'] ?? '');
    try {
      json_out(['ok' => true, 'loyalty' => aurora_loyalty_stats_safe($pdo, $phone)]);
    } catch (Throwable $e) {
      json_out(['error' => 'Falha ao consultar fidelidade', 'detail' => $e->getMessage()], 500);
    }
  }

  if ($actionName === 'create_order') {
    if (!aurora_db_ready($pdo)) {
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

  // Extrai data-URLs restantes para arquivos (admin)
  if ($actionName === 'extract_data_images') {
    $auth = aurora_get_auth($pdo);
    if ($password === '' || $auth['password'] === '' || !hash_equals($auth['password'], $password)) {
      json_out(['error' => 'Senha inválida'], 401);
    }
    $limit = max(1, min(50, (int) ($body['limit'] ?? 20)));
    try {
      $stmt = $pdo->query(
        "SELECT id, image FROM products WHERE image LIKE 'data:image%' LIMIT " . $limit
      );
      $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
      $upd = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
      $converted = 0;
      foreach ($rows as $row) {
        $path = aurora_save_data_url_file((string) ($row['image'] ?? ''));
        if ($path) {
          $upd->execute([$path, $row['id']]);
          $converted++;
        }
      }
      $left = (int) $pdo->query(
        "SELECT COUNT(*) FROM products WHERE image LIKE 'data:image%'"
      )->fetchColumn();
      try { aurora_write_public_catalog($pdo); } catch (Throwable $e) {}
      json_out(['ok' => true, 'converted' => $converted, 'remaining' => $left]);
    } catch (Throwable $e) {
      json_out(['error' => 'Falha ao extrair imagens', 'detail' => $e->getMessage()], 500);
    }
  }

  if ($actionName === 'migrate_product_images') {
    $auth = aurora_get_auth($pdo);
    if ($password === '' || $auth['password'] === '' || !hash_equals($auth['password'], $password)) {
      json_out(['error' => 'Senha inválida'], 401);
    }
    try {
      $pdo->exec('ALTER TABLE `products` MODIFY `image` MEDIUMTEXT NULL');
      $col = $pdo->query("SHOW COLUMNS FROM products LIKE 'image'")->fetch(PDO::FETCH_ASSOC);
      json_out([
        'ok' => true,
        'columnType' => $col['Type'] ?? null,
      ]);
    } catch (Throwable $e) {
      json_out(['error' => 'Falha no ALTER', 'detail' => $e->getMessage()], 500);
    }
  }

  // Salvamento completo (admin)
  $payload = $body['data'] ?? $body;
  if (!is_array($payload) || !isset($payload['settings'])) {
    json_out(['error' => 'Dados incompletos'], 400);
  }

  $auth = aurora_get_auth($pdo);
  $authPass = (string) ($auth['password'] ?? '');
  $hasData = aurora_db_ready($pdo) && $authPass !== '';

  if (!$hasData) {
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
    if ($password === '' || !hash_equals($authPass, $password)) {
      json_out(['error' => 'Senha inválida para salvar'], 401);
    }
    if (empty($payload['auth'])) {
      $payload['auth'] = [
        'email' => $auth['email'] ?? '',
        'password' => $authPass,
      ];
    }
  }

  // Antes de salvar: se vier data-URL, tenta virar arquivo
  if (!empty($payload['products']) && is_array($payload['products'])) {
    foreach ($payload['products'] as &$prod) {
      $img = (string) ($prod['image'] ?? '');
      if (str_starts_with($img, 'data:image')) {
        $path = aurora_save_data_url_file($img);
        if ($path) $prod['image'] = $path;
      }
    }
    unset($prod);
  }

  try {
    aurora_save_all($pdo, $payload);
    json_out(['ok' => true]);
  } catch (Throwable $e) {
    json_out(['error' => 'Falha ao salvar', 'detail' => $e->getMessage()], 500);
  }
}

json_out(['error' => 'Método não suportado'], 405);
