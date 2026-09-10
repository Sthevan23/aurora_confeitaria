<?php
/**
 * Persistência MySQL — Aurora Confeitaria (Hostinger)
 */

require_once __DIR__ . '/db.php';

function aurora_bool($v): int {
  return !empty($v) ? 1 : 0;
}

function aurora_json_decode_field($v, $fallback = null) {
  if ($v === null || $v === '') return $fallback;
  if (is_array($v)) return $v;
  $decoded = json_decode((string) $v, true);
  return is_array($decoded) ? $decoded : $fallback;
}

function aurora_table_exists(PDO $pdo, string $table): bool {
  $stmt = $pdo->prepare(
    'SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1'
  );
  $stmt->execute([$table]);
  return (bool) $stmt->fetchColumn();
}

function aurora_db_ready(PDO $pdo): bool {
  return aurora_table_exists($pdo, 'settings') && aurora_table_exists($pdo, 'products');
}

function aurora_norm_name(string $name): string {
  $n = trim($name);
  if (function_exists('mb_strtolower')) {
    $n = mb_strtolower($n, 'UTF-8');
  } else {
    $n = strtolower($n);
  }
  return $n;
}

function aurora_photo_map(): array {
  static $map = null;
  if (is_array($map)) return $map;
  $map = ['id' => [], 'name' => []];
  $root = dirname(__DIR__);
  foreach (['product-photos.json', 'catalog.json'] as $file) {
    $path = $root . DIRECTORY_SEPARATOR . $file;
    if (!is_file($path)) continue;
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') continue;
    $data = json_decode($raw, true);
    if (!is_array($data)) continue;
    if (isset($data['byId']) || isset($data['byName'])) {
      foreach (($data['byId'] ?? []) as $id => $img) {
        $img = trim((string) $img);
        if ($id && $img !== '' && !str_starts_with($img, 'data:')) {
          $map['id'][(string) $id] = $img;
        }
      }
      foreach (($data['byName'] ?? []) as $name => $img) {
        $img = trim((string) $img);
        $key = aurora_norm_name((string) $name);
        if ($key !== '' && $img !== '' && !str_starts_with($img, 'data:')) {
          $map['name'][$key] = $img;
        }
      }
      continue;
    }
    foreach (($data['products'] ?? []) as $p) {
      if (!is_array($p)) continue;
      $img = trim((string) ($p['image'] ?? ''));
      if ($img === '' || str_starts_with($img, 'data:')) continue;
      if (!empty($p['id'])) $map['id'][(string) $p['id']] = $img;
      $key = aurora_norm_name((string) ($p['name'] ?? ''));
      if ($key !== '') $map['name'][$key] = $img;
    }
  }
  return $map;
}

function aurora_product_image_on_disk(string $img): bool {
  if ($img === '' || str_starts_with($img, 'data:') || str_starts_with($img, 'http')) {
    return false;
  }
  $name = basename(str_replace('\\', '/', $img));
  if ($name === '' || $name === '.' || $name === '..') return false;
  $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR . $name;
  return is_file($path);
}

function aurora_lookup_photo(string $id, string $name): string {
  $map = aurora_photo_map();
  if ($id !== '' && !empty($map['id'][$id])) return (string) $map['id'][$id];
  $key = aurora_norm_name($name);
  if ($key !== '' && !empty($map['name'][$key])) return (string) $map['name'][$key];
  return '';
}

/**
 * Se a foto do MySQL sumiu (Reimplantar) ou veio vazia, usa o mapa/catalogo.
 * Grava o path de volta só quando mudou — senão o painel volta a "Sem foto".
 */
function aurora_fill_missing_product_images(PDO $pdo, array &$products): void {
  $blobNames = [];
  try {
    if (aurora_table_exists($pdo, 'product_images')) {
      foreach ($pdo->query('SELECT filename FROM product_images') as $row) {
        $fn = basename((string) ($row['filename'] ?? ''));
        if ($fn !== '') $blobNames[$fn] = true;
      }
    }
  } catch (Throwable $e) {
    $blobNames = [];
  }

  $updates = [];
  foreach ($products as &$p) {
    $img = trim((string) ($p['image'] ?? ''));
    $file = $img !== '' ? basename(str_replace('\\', '/', $img)) : '';
    $ok = aurora_product_image_on_disk($img) || ($file !== '' && isset($blobNames[$file]));
    if ($ok) continue;

    $fallback = aurora_lookup_photo((string) ($p['id'] ?? ''), (string) ($p['name'] ?? ''));
    if ($fallback === '') {
      if (str_starts_with($img, 'data:')) $p['image'] = '';
      continue;
    }
    if ($fallback === $img) continue;
    $p['image'] = $fallback;
    if (!empty($p['id'])) $updates[(string) $p['id']] = $fallback;
  }
  unset($p);

  if (!$updates) return;
  try {
    $stmt = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
    foreach ($updates as $id => $path) {
      $stmt->execute([$path, $id]);
    }
  } catch (Throwable $e) {
    // painel ainda recebe o path preenchido nesta resposta
  }
}

/**
 * Rascunhos fora do cardápio (active=0). Só cria se o id ainda não existir.
 * Não republica o site — produtos inativos ficam só no admin.
 */
function aurora_ensure_draft_products(PDO $pdo): void {
  static $done = false;
  if ($done) return;
  $done = true;

  try {
    $productsExists = $pdo->query(
      "SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' LIMIT 1"
    )->fetchColumn();
    if (!$productsExists) return;

    $catExists = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $catExists->execute(['cat-especiais']);
    if (!$catExists->fetchColumn()) return;

    $drafts = [
      [
        'id' => 'p-cone-trufado',
        'name' => 'Cone Trufado',
        'description' => 'Cone trufado artesanal — em preparação. Ajuste preço e foto no admin antes de publicar.',
        'price' => 0,
        'categoryId' => 'cat-especiais',
        'image' => 'products/cone-trufado.jpg',
        'featured' => false,
        'slug' => 'cone-trufado',
        'size' => '',
        'flavors' => [],
        'promoActive' => false,
        'promoPrice' => null,
        'promoLabel' => '',
        'bestSeller' => false,
        'active' => false,
        'available' => false,
        'sortOrder' => 900,
      ],
      [
        'id' => 'p-brownie-cravejado',
        'name' => 'Brownie Cravejado',
        'description' => 'Brownie cravejado artesanal — em preparação. Ajuste preço e foto no admin antes de publicar.',
        'price' => 0,
        'categoryId' => 'cat-especiais',
        'image' => 'products/brownie-cravejado.jpg',
        'featured' => false,
        'slug' => 'brownie-cravejado',
        'size' => '',
        'flavors' => [],
        'promoActive' => false,
        'promoPrice' => null,
        'promoLabel' => '',
        'bestSeller' => false,
        'active' => false,
        'available' => false,
        'sortOrder' => 901,
      ],
    ];

    $check = $pdo->prepare('SELECT id, image FROM products WHERE id = ? LIMIT 1');
    $setImg = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
    foreach ($drafts as $draft) {
      $check->execute([$draft['id']]);
      $row = $check->fetch(PDO::FETCH_ASSOC);
      if (!$row) {
        aurora_save_one_product($pdo, $draft);
        continue;
      }
      $current = trim((string) ($row['image'] ?? ''));
      if ($current === '' || str_starts_with($current, 'data:')) {
        $setImg->execute([(string) $draft['image'], $draft['id']]);
      }
    }
  } catch (Throwable $e) {
    // Não derruba o site se o seed falhar
  }
}

/**
 * Produção do dia (insumos) — só cria se o id ainda não existir,
 * para não sobrescrever contagens que a dona já ajustou no admin.
 */
function aurora_ensure_production_inventory(PDO $pdo): void {
  static $done = false;
  if ($done) return;
  $done = true;

  try {
    aurora_ensure_inventory_items_table($pdo);
    if (!aurora_table_exists($pdo, 'inventory_items')) return;

    $batch = 'Produção 08/09/2026';
    $items = [
      ['id' => 'inv-prod-cone-kinder', 'name' => 'Cone Kinder', 'stock' => 6],
      ['id' => 'inv-prod-cone-ninho-nutella', 'name' => 'Cone Ninho com Nutella', 'stock' => 1],
      ['id' => 'inv-prod-cone-brigadeiro-caramelo', 'name' => 'Cone Brigadeiro com caramelo', 'stock' => 1],
      ['id' => 'inv-prod-cone-ninho-nutella-brownie', 'name' => 'Cone Ninho com Nutella e brownie', 'stock' => 1],
      ['id' => 'inv-prod-brownie-fatia', 'name' => 'Brownie Fatia', 'stock' => 7],
      ['id' => 'inv-prod-browkie', 'name' => 'Browkie', 'stock' => 5],
      ['id' => 'inv-prod-brownie-individual-pequeno', 'name' => 'Brownie individual pequeno', 'stock' => 6],
      ['id' => 'inv-prod-caixinha-4-docinhos', 'name' => 'Caixinhas de 4 docinhos', 'stock' => 4],
      ['id' => 'inv-prod-afogadinho-brigadeiro-caramelo', 'name' => 'Afogadinho brigadeiro com caramelo', 'stock' => 8],
      ['id' => 'inv-prod-afogadinho-brownie-brigadeiro-nutella', 'name' => 'Afogadinho de brownie brigadeiro com Nutella', 'stock' => 4],
      ['id' => 'inv-prod-afogadinho-ninho-nutella', 'name' => 'Afogadinho ninho com Nutella', 'stock' => 1],
      ['id' => 'inv-prod-bolo-pote-ninho-morango', 'name' => 'Bolo de pote ninho com geleia de morango', 'stock' => 1],
      ['id' => 'inv-prod-copo-frutas-amarelas', 'name' => 'Copo da felicidade — frutas amarelas', 'stock' => 2],
      ['id' => 'inv-prod-copo-pessego', 'name' => 'Copo da felicidade — pêssego', 'stock' => 1],
      ['id' => 'inv-prod-palha-chocolate', 'name' => 'Palha Italiana chocolate', 'stock' => 7],
      ['id' => 'inv-prod-palha-oreo', 'name' => 'Palha Italiana Oreo', 'stock' => 9],
      ['id' => 'inv-prod-fatia-quadrada-browkie', 'name' => 'Fatia quadrada pequena browkie', 'stock' => 12],
      ['id' => 'inv-prod-cookies-tradicional', 'name' => 'Cookies tradicional', 'stock' => 8],
      ['id' => 'inv-prod-recheio-coxinha-frango', 'name' => 'Recheio de coxinha de frango', 'stock' => 4],
      ['id' => 'inv-prod-fatia-bolo-chocolate', 'name' => 'Fatia de bolo chocolate', 'stock' => 3],
      ['id' => 'inv-prod-fatia-bolo-prestigio', 'name' => 'Fatia de bolo prestígio', 'stock' => 5],
      ['id' => 'inv-prod-fatia-bolo-cereja', 'name' => 'Fatia de bolo cereja', 'stock' => 1],
      ['id' => 'inv-prod-fatia-bolo-ameixa', 'name' => 'Fatia de bolo ameixa', 'stock' => 1],
    ];

    $check = $pdo->prepare('SELECT id FROM inventory_items WHERE id = ? LIMIT 1');
    foreach ($items as $i => $row) {
      $check->execute([$row['id']]);
      if ($check->fetchColumn()) continue;
      aurora_save_one_inventory_item($pdo, [
        'id' => $row['id'],
        'name' => $row['name'],
        'unit' => 'un',
        'stock' => (float) $row['stock'],
        'minStock' => 1,
        'notes' => $batch,
        'sortOrder' => $i,
      ]);
    }
  } catch (Throwable $e) {
    // Não derruba o painel se o seed falhar
  }
}

/**
 * @param 'full'|'public' $mode
 */
function aurora_load_all(PDO $pdo, string $mode = 'full'): ?array {
  if (!aurora_db_ready($pdo)) {
    return null;
  }

  if (function_exists('aurora_ensure_draft_products')) {
    aurora_ensure_draft_products($pdo);
  }

  if (function_exists('aurora_ensure_production_inventory')) {
    aurora_ensure_production_inventory($pdo);
  }

  if (function_exists('aurora_protect_product_photos')) {
    aurora_protect_product_photos($pdo);
  }

  aurora_ensure_store_settings_columns($pdo);

  $settingsRow = $pdo->query('SELECT * FROM settings WHERE id = 1 LIMIT 1')->fetch();
  if (!$settingsRow) {
    return null;
  }

  $categories = [];
  $catRows = $pdo->query('SELECT id, name, slug FROM categories ORDER BY sort_order ASC, name ASC')->fetchAll();
  foreach ($catRows as $row) {
    $categories[] = [
      'id' => $row['id'],
      'name' => $row['name'],
      'slug' => $row['slug'],
      'sortOrder' => (int) ($row['sort_order'] ?? 0),
    ];
  }

  $flavorMap = [];
  $flavorRows = $pdo->query(
    'SELECT product_id, flavor FROM product_flavors ORDER BY sort_order ASC, id ASC'
  )->fetchAll();
  foreach ($flavorRows as $row) {
    $pid = $row['product_id'];
    if (!isset($flavorMap[$pid])) $flavorMap[$pid] = [];
    $flavorMap[$pid][] = $row['flavor'];
  }

  $priceMap = [];
  $priceRows = $pdo->query(
    'SELECT product_id, flavor, price FROM product_flavor_prices ORDER BY id ASC'
  )->fetchAll();
  foreach ($priceRows as $row) {
    $pid = $row['product_id'];
    if (!isset($priceMap[$pid])) $priceMap[$pid] = [];
    $priceMap[$pid][$row['flavor']] = (float) $row['price'];
  }

  // Conversão de data-URL só sob demanda no save — nunca no login/load
  // (escrever arquivos no login estourava processos na Hostinger)

  $products = [];
  $prodRows = $pdo->query('SELECT * FROM products ORDER BY sort_order ASC, name ASC')->fetchAll();
  foreach ($prodRows as $row) {
    $pid = $row['id'];
    $product = [
      'id' => $pid,
      'name' => $row['name'],
      'description' => $row['description'] ?? '',
      'price' => (float) $row['price'],
      'categoryId' => $row['category_id'],
      'image' => $row['image'] ?? '',
      'featured' => ((int) ($row['featured'] ?? 0)) === 1,
      'slug' => $row['slug'],
      'size' => $row['size'] ?? '',
      'flavors' => $flavorMap[$pid] ?? [],
      'promoActive' => ((int) ($row['promo_active'] ?? 0)) === 1,
      'promoPrice' => $row['promo_price'] !== null ? (float) $row['promo_price'] : null,
      'promoLabel' => $row['promo_label'] ?? '',
      'bestSeller' => ((int) ($row['best_seller'] ?? 0)) === 1,
      'active' => ((int) ($row['active'] ?? 1)) === 1,
      'sortOrder' => (int) ($row['sort_order'] ?? 0),
      'available' => array_key_exists('available', $row)
        ? (((int) ($row['available'] ?? 1)) === 1)
        : true,
    ];
    if (array_key_exists('stock', $row) && $row['stock'] !== null && $row['stock'] !== '') {
      $product['stock'] = max(0, (int) $row['stock']);
    }
    if (((int) ($row['price_from'] ?? 0)) === 1) {
      $product['priceFrom'] = true;
    }
    if (!empty($priceMap[$pid])) {
      $product['flavorPrices'] = $priceMap[$pid];
    }
    // Garante Copo da Felicidade sem promo antiga no cardápio público
    if ($pid === 'p0') {
      $product['price'] = 29;
      $product['promoActive'] = false;
      $product['promoPrice'] = null;
      $product['promoLabel'] = '';
    }
    $products[] = $product;
  }

  aurora_fill_missing_product_images($pdo, $products);

  $gallery = [];
  $galRows = $pdo->query(
    'SELECT image FROM gallery WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  )->fetchAll();
  foreach ($galRows as $row) {
    $gallery[] = $row['image'];
  }

  $coupons = [];
  if (aurora_table_exists($pdo, 'coupons')) {
    $couponRows = $pdo->query('SELECT * FROM coupons ORDER BY created_at DESC')->fetchAll();
    foreach ($couponRows as $row) {
      $coupons[] = [
        'id' => $row['id'],
        'code' => strtoupper(trim((string) ($row['code'] ?? ''))),
        'type' => ($row['type'] ?? '') === 'fixed' ? 'fixed' : 'percent',
        'value' => (float) ($row['value'] ?? 0),
        'minOrder' => (float) ($row['min_order'] ?? 0),
        'active' => ((int) ($row['active'] ?? 1)) === 1,
        'label' => $row['label'] ?? '',
      ];
    }
  }

  $reviews = [];
  if (aurora_table_exists($pdo, 'reviews')) {
    $revRows = $pdo->query('SELECT * FROM reviews WHERE active = 1 ORDER BY created_at DESC')->fetchAll();
    foreach ($revRows as $row) {
      $reviews[] = [
        'id' => $row['id'],
        'author' => $row['author'],
        'text' => $row['text'],
        'rating' => (int) ($row['rating'] ?? 5),
      ];
    }
  }

  $faq = [];
  if (aurora_table_exists($pdo, 'faq')) {
    $faqRows = $pdo->query('SELECT * FROM faq WHERE active = 1 ORDER BY sort_order ASC')->fetchAll();
    foreach ($faqRows as $row) {
      $faq[] = [
        'id' => $row['id'],
        'question' => $row['question'],
        'answer' => $row['answer'],
      ];
    }
  }

  $settings = [
    'name' => $settingsRow['name'] ?? '',
    'tagline' => $settingsRow['tagline'] ?? '',
    'logo' => $settingsRow['logo'] ?? '',
    'banner' => $settingsRow['banner'] ?? '',
    'sobreImage' => $settingsRow['sobre_image'] ?? '',
    'whatsapp' => $settingsRow['whatsapp'] ?? '',
    'pixKey' => $settingsRow['pix_key'] ?? '',
    'pixName' => $settingsRow['pix_name'] ?? '',
    'instagram' => $settingsRow['instagram'] ?? '',
    'instagramUser' => $settingsRow['instagram_user'] ?? '',
    'facebook' => $settingsRow['facebook'] ?? '',
    'email' => $settingsRow['email'] ?? '',
    'address' => $settingsRow['address'] ?? '',
    'hours' => $settingsRow['hours'] ?? '',
    'followers' => $settingsRow['followers'] ?? '',
    'posts' => $settingsRow['posts'] ?? '',
    'mapEmbed' => $settingsRow['map_embed'] ?? '',
    'heroBadge' => $settingsRow['hero_badge'] ?? '',
    'heroStory' => aurora_json_decode_field($settingsRow['hero_story'] ?? null, []),
    'sobreText1' => $settingsRow['sobre_text1'] ?? '',
    'sobreText2' => $settingsRow['sobre_text2'] ?? '',
    'deliveryFee' => isset($settingsRow['delivery_fee']) ? (float) $settingsRow['delivery_fee'] : 7,
    'deliveryNote' => $settingsRow['delivery_note'] ?? 'Bairros mais afastados: consultar',
    'storeStatus' => (string) ($settingsRow['store_status'] ?? 'auto'),
    'openTime' => (string) ($settingsRow['open_time'] ?? '10:00'),
    'closeTime' => (string) ($settingsRow['close_time'] ?? '22:00'),
    'openDays' => aurora_parse_open_days($settingsRow['open_days'] ?? '0,1,2,3,4,5,6'),
  ];

  if ($mode === 'public') {
    return [
      'version' => (int) ($settingsRow['data_version'] ?? 16),
      'settings' => $settings,
      'categories' => $categories,
      'products' => $products,
      'reviews' => $reviews,
      'faq' => $faq,
      'gallery' => $gallery,
      'coupons' => $coupons,
      'clients' => [],
      'orders' => [],
      'finance' => [],
      'auth' => ['email' => '', 'password' => ''],
    ];
  }

  $admin = $pdo->query('SELECT email, password_hash FROM admins ORDER BY id ASC LIMIT 1')->fetch();

  $clients = [];
  if (aurora_table_exists($pdo, 'clients')) {
    $clientRows = $pdo->query('SELECT * FROM clients ORDER BY created_at DESC')->fetchAll();
    foreach ($clientRows as $row) {
      $clients[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
        'address' => $row['address'] ?? '',
        'loyaltyBonus' => (int) ($row['loyalty_bonus'] ?? 0),
      ];
    }
  }

  $productImageById = [];
  $productImageByName = [];
  foreach ($products as $p) {
    $pid = (string) ($p['id'] ?? '');
    $img = (string) ($p['image'] ?? '');
    if ($pid !== '' && $img !== '') $productImageById[$pid] = $img;
    $pname = function_exists('mb_strtolower')
      ? mb_strtolower(trim((string) ($p['name'] ?? '')), 'UTF-8')
      : strtolower(trim((string) ($p['name'] ?? '')));
    if ($pname !== '' && $img !== '') $productImageByName[$pname] = $img;
  }

  $orders = [];
  if (aurora_table_exists($pdo, 'orders')) {
    $orderRows = $pdo->query('SELECT * FROM orders ORDER BY ordered_at DESC')->fetchAll();
    $itemsByOrder = [];
    if (aurora_table_exists($pdo, 'order_items')) {
      $itemRows = $pdo->query('SELECT * FROM order_items ORDER BY id ASC')->fetchAll();
      foreach ($itemRows as $item) {
        $oid = $item['order_id'];
        if (!isset($itemsByOrder[$oid])) $itemsByOrder[$oid] = [];
        $pid = (string) ($item['product_id'] ?? '');
        $iname = (string) ($item['product_name'] ?? '');
        $inameNorm = function_exists('mb_strtolower')
          ? mb_strtolower(trim($iname), 'UTF-8')
          : strtolower(trim($iname));
        $image = $productImageById[$pid]
          ?? $productImageByName[$inameNorm]
          ?? '';
        $itemsByOrder[$oid][] = [
          'productId' => $pid,
          'name' => $iname,
          'flavor' => $item['flavor'] ?? '',
          'qty' => (int) $item['qty'],
          'price' => (float) $item['price'],
          'image' => $image,
        ];
      }
    }
    foreach ($orderRows as $row) {
      $orders[] = [
        'id' => $row['id'],
        'number' => $row['number'],
        'clientId' => $row['client_id'] ?? '',
        'clientName' => $row['client_name'],
        'clientWhatsapp' => $row['client_whatsapp'] ?? '',
        'items' => $itemsByOrder[$row['id']] ?? [],
        'total' => (float) $row['total'],
        'status' => $row['status'],
        'date' => date('c', strtotime($row['ordered_at'])),
        'notes' => $row['notes'] ?? '',
        'deliveryFee' => (float) ($row['delivery_fee'] ?? 0),
        'discount' => (float) ($row['discount'] ?? 0),
        'waiveDelivery' => !empty($row['waive_delivery']),
      ];
    }
  }

  $finance = [];
  if (aurora_table_exists($pdo, 'finance')) {
    $finRows = $pdo->query('SELECT * FROM finance ORDER BY entry_date DESC, created_at DESC')->fetchAll();
    foreach ($finRows as $row) {
      $finance[] = [
        'id' => $row['id'],
        'type' => $row['type'],
        'amount' => (float) $row['amount'],
        'description' => $row['description'] ?? '',
        'date' => $row['entry_date'],
        'orderId' => $row['order_id'] ?? '',
      ];
    }
  }

  $inventoryItems = aurora_load_inventory_items($pdo);

  return [
    'version' => (int) ($settingsRow['data_version'] ?? 16),
    'settings' => $settings,
    'auth' => [
      'email' => $admin['email'] ?? 'auroraconfeitaria2022@gmail.com',
      'password' => $admin['password_hash'] ?? '',
    ],
    'categories' => $categories,
    'products' => $products,
    'clients' => $clients,
    'orders' => $orders,
    'reviews' => $reviews,
    'faq' => $faq,
    'gallery' => $gallery,
    'finance' => $finance,
    'coupons' => $coupons,
    'inventoryItems' => $inventoryItems,
  ];
}

/**
 * Grava data-URL em products/ e devolve path relativo, ou null.
 */
function aurora_save_data_url_file(string $dataUrl): ?string {
  if (!preg_match('#^data:image/(jpeg|jpg|png|webp|gif);base64,#i', $dataUrl, $m)) {
    return null;
  }
  $raw = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
  if ($raw === false || strlen($raw) < 32) return null;

  $siteRoot = dirname(__DIR__);
  $dir = $siteRoot . DIRECTORY_SEPARATOR . 'products';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  if (!is_dir($dir) || !is_writable($dir)) return null;

  $name = sprintf(
    '%s-%s-%s-%s-%s.jpg',
    bin2hex(random_bytes(4)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(6))
  );
  $dest = $dir . DIRECTORY_SEPARATOR . $name;

  // Preferir JPG via GD quando possível
  $tmp = tempnam(sys_get_temp_dir(), 'aurora_durl_');
  if ($tmp === false) return null;
  file_put_contents($tmp, $raw);
  $mime = 'image/' . strtolower($m[1] === 'jpg' ? 'jpeg' : $m[1]);
  if ($mime === 'image/jpg') $mime = 'image/jpeg';

  $wrote = false;
  if (function_exists('imagecreatetruecolor')) {
    // reusa lógica simples: grava bytes crus se jpeg, senão tenta GD
    if ($mime === 'image/jpeg') {
      $wrote = @file_put_contents($dest, $raw) !== false;
    } else {
      $img = null;
      if ($mime === 'image/png' && function_exists('imagecreatefrompng')) $img = @imagecreatefrompng($tmp);
      elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) $img = @imagecreatefromwebp($tmp);
      elseif ($mime === 'image/gif' && function_exists('imagecreatefromgif')) $img = @imagecreatefromgif($tmp);
      if ($img) {
        $wrote = @imagejpeg($img, $dest, 82);
        imagedestroy($img);
      }
    }
  }
  if (!$wrote) {
    $wrote = @file_put_contents($dest, $raw) !== false;
  }
  @unlink($tmp);
  if (!$wrote || !is_file($dest)) return null;
  @chmod($dest, 0644);
  $bytes = @file_get_contents($dest);
  if ($bytes !== false && function_exists('aurora_store_product_image_blob')) {
    try {
      // Precisa de PDO — tenta via conexão global leve
      $pdo = aurora_db(false);
      aurora_store_product_image_blob($pdo, $name, $bytes, 'image/jpeg');
    } catch (Throwable $e) {
      // path em disco ainda vale
    }
  }
  return 'products/' . $name;
}

function aurora_maybe_extract_data_images(PDO $pdo, int $limit = 3): void {
  static $ran = false;
  if ($ran) return;
  $ran = true;
  try {
    $stmt = $pdo->query(
      "SELECT id, image FROM products
       WHERE image LIKE 'data:image%'
       LIMIT " . max(1, min(10, $limit))
    );
    $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    $upd = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
    foreach ($rows as $row) {
      $path = aurora_save_data_url_file((string) ($row['image'] ?? ''));
      if ($path) $upd->execute([$path, $row['id']]);
    }
  } catch (Throwable $e) {
    // silencioso — não derruba o site
  }
}

function aurora_get_auth(PDO $pdo): array {
  $admin = $pdo->query('SELECT email, password_hash FROM admins ORDER BY id ASC LIMIT 1')->fetch();
  if (!$admin) {
    return ['email' => '', 'password' => ''];
  }
  return [
    'email' => (string) $admin['email'],
    'password' => (string) $admin['password_hash'],
  ];
}

function aurora_ensure_sort_order_columns(PDO $pdo): void {
  if (function_exists('aurora_ensure_column')) {
    aurora_ensure_column($pdo, 'categories', 'sort_order', 'INT NOT NULL DEFAULT 0');
    aurora_ensure_column($pdo, 'products', 'sort_order', 'INT NOT NULL DEFAULT 0');
    return;
  }
  foreach (['categories', 'products'] as $table) {
    try {
      $col = $pdo->query("SHOW COLUMNS FROM `$table` LIKE 'sort_order'")->fetch();
      if (!$col) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0");
      }
    } catch (Throwable $e) {
      // ignore — falha explícita virá no UPDATE/INSERT
    }
  }
}

/**
 * Atualiza só a ordem no catalog.json existente (rápido — não recarrega MySQL).
 */
function aurora_patch_catalog_json_order(array $categoryIds, array $productIds): bool {
  $root = dirname(__DIR__);
  $paths = [
    $root . DIRECTORY_SEPARATOR . 'catalog.json',
    $root . DIRECTORY_SEPARATOR . 'catalog.live.json',
    $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'catalog.json',
  ];

  $source = null;
  foreach ($paths as $path) {
    if (!is_file($path)) continue;
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') continue;
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['products'])) continue;
    $source = $data;
    break;
  }
  if (!$source) return false;

  $catMap = [];
  foreach (array_values($categoryIds) as $i => $id) {
    $id = trim((string) $id);
    if ($id !== '') $catMap[$id] = (int) $i;
  }
  $prodMap = [];
  foreach (array_values($productIds) as $i => $id) {
    $id = trim((string) $id);
    if ($id !== '') $prodMap[$id] = (int) $i;
  }

  if (!empty($source['categories']) && is_array($source['categories'])) {
    foreach ($source['categories'] as &$cat) {
      if (!is_array($cat)) continue;
      $cid = (string) ($cat['id'] ?? '');
      if ($cid !== '' && isset($catMap[$cid])) {
        $cat['sortOrder'] = $catMap[$cid];
      }
    }
    unset($cat);
    usort($source['categories'], static function ($a, $b) {
      $diff = ((int) ($a['sortOrder'] ?? 0)) - ((int) ($b['sortOrder'] ?? 0));
      if ($diff !== 0) return $diff;
      return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
    });
  }

  if (!empty($source['products']) && is_array($source['products'])) {
    foreach ($source['products'] as &$prod) {
      if (!is_array($prod)) continue;
      $pid = (string) ($prod['id'] ?? '');
      if ($pid !== '' && isset($prodMap[$pid])) {
        $prod['sortOrder'] = $prodMap[$pid];
      }
    }
    unset($prod);
    usort($source['products'], static function ($a, $b) {
      $diff = ((int) ($a['sortOrder'] ?? 0)) - ((int) ($b['sortOrder'] ?? 0));
      if ($diff !== 0) return $diff;
      return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
    });
  }

  $source['generatedAt'] = gmdate('c');
  $json = json_encode($source, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) return false;

  $ok = false;
  foreach ($paths as $path) {
    if (@file_put_contents($path, $json) !== false) {
      $ok = true;
    }
  }
  return $ok;
}

function aurora_parse_open_days($value): array {
  if (is_array($value)) {
    $days = array_map('intval', $value);
  } else {
    $days = array_map('intval', explode(',', (string) $value));
  }
  $days = array_values(array_unique(array_filter($days, static fn($d) => $d >= 0 && $d <= 6)));
  sort($days);
  return $days ?: [0, 1, 2, 3, 4, 5, 6];
}

function aurora_format_open_days($value): string {
  return implode(',', aurora_parse_open_days($value));
}

function aurora_save_catalog_order(PDO $pdo, array $categoryIds, array $productIds): void {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas. Importe api/aurora_mysql.sql no phpMyAdmin.');
  }

  aurora_ensure_sort_order_columns($pdo);

  $pdo->beginTransaction();
  try {
    $catStmt = $pdo->prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
    foreach (array_values($categoryIds) as $i => $id) {
      $id = trim((string) $id);
      if ($id === '') continue;
      $catStmt->execute([(int) $i, $id]);
    }

    $prodStmt = $pdo->prepare('UPDATE products SET sort_order = ? WHERE id = ?');
    foreach (array_values($productIds) as $i => $id) {
      $id = trim((string) $id);
      if ($id === '') continue;
      $prodStmt->execute([(int) $i, $id]);
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
}

function aurora_catalog_json_paths(): array {
  $root = dirname(__DIR__);
  return [
    $root . DIRECTORY_SEPARATOR . 'catalog.json',
    $root . DIRECTORY_SEPARATOR . 'catalog.live.json',
    $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'catalog.json',
  ];
}

function aurora_load_catalog_json(): ?array {
  foreach (aurora_catalog_json_paths() as $path) {
    if (!is_file($path)) continue;
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') continue;
    $data = json_decode($raw, true);
    if (is_array($data) && isset($data['products'])) {
      return $data;
    }
  }
  return null;
}

function aurora_write_catalog_json_files(array $data): bool {
  $data['generatedAt'] = gmdate('c');
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) return false;
  $ok = false;
  foreach (aurora_catalog_json_paths() as $path) {
    $dir = dirname($path);
    if (!is_dir($dir)) continue;
    if (@file_put_contents($path, $json) !== false) {
      $ok = true;
    }
  }
  return $ok;
}

function aurora_products_has_available(PDO $pdo): bool {
  static $has = null;
  if ($has !== null) return $has;
  try {
    $has = (bool) $pdo->query("SHOW COLUMNS FROM products LIKE 'available'")->fetch();
  } catch (Throwable $e) {
    $has = false;
  }
  return $has;
}

function aurora_product_has_stock_column(PDO $pdo): bool {
  static $cache = [];
  $key = spl_object_hash($pdo);
  if (array_key_exists($key, $cache)) return $cache[$key];
  try {
    $cache[$key] = (bool) $pdo->query("SHOW COLUMNS FROM products LIKE 'stock'")->fetch();
  } catch (Throwable $e) {
    $cache[$key] = false;
  }
  return $cache[$key];
}

function aurora_normalize_stock_value($value): ?int {
  if ($value === null || $value === '') return null;
  if (!is_numeric($value)) return null;
  return max(0, (int) $value);
}

function aurora_ensure_store_settings_columns(PDO $pdo): void {
  aurora_ensure_column($pdo, 'settings', 'delivery_fee', "DECIMAL(10,2) NOT NULL DEFAULT 7.00");
  aurora_ensure_column($pdo, 'settings', 'delivery_note', "VARCHAR(255) NULL DEFAULT 'Bairros mais afastados: consultar'");
  aurora_ensure_column($pdo, 'settings', 'store_status', "VARCHAR(20) NOT NULL DEFAULT 'auto'");
  aurora_ensure_column($pdo, 'settings', 'open_time', "VARCHAR(5) NOT NULL DEFAULT '10:00'");
  aurora_ensure_column($pdo, 'settings', 'close_time', "VARCHAR(5) NOT NULL DEFAULT '22:00'");
  aurora_ensure_column($pdo, 'settings', 'open_days', "VARCHAR(30) NOT NULL DEFAULT '0,1,2,3,4,5,6'");
  aurora_ensure_column($pdo, 'settings', 'pix_key', "VARCHAR(120) NULL DEFAULT NULL");
  aurora_ensure_column($pdo, 'settings', 'pix_name', "VARCHAR(120) NULL DEFAULT NULL");
}

function aurora_save_settings_only(PDO $pdo, array $settings): void {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas. Importe api/aurora_mysql.sql no phpMyAdmin.');
  }

  aurora_ensure_store_settings_columns($pdo);

  $row = $pdo->query('SELECT * FROM settings WHERE id = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC) ?: [];
  $current = [
    'name' => $row['name'] ?? '',
    'tagline' => $row['tagline'] ?? '',
    'logo' => $row['logo'] ?? '',
    'banner' => $row['banner'] ?? '',
    'sobreImage' => $row['sobre_image'] ?? '',
    'whatsapp' => $row['whatsapp'] ?? '',
    'pixKey' => $row['pix_key'] ?? '',
    'pixName' => $row['pix_name'] ?? '',
    'instagram' => $row['instagram'] ?? '',
    'instagramUser' => $row['instagram_user'] ?? '',
    'facebook' => $row['facebook'] ?? '',
    'email' => $row['email'] ?? '',
    'address' => $row['address'] ?? '',
    'hours' => $row['hours'] ?? '',
    'followers' => $row['followers'] ?? '',
    'posts' => $row['posts'] ?? '',
    'mapEmbed' => $row['map_embed'] ?? '',
    'heroBadge' => $row['hero_badge'] ?? '',
    'heroStory' => aurora_json_decode_field($row['hero_story'] ?? null, []),
    'sobreText1' => $row['sobre_text1'] ?? '',
    'sobreText2' => $row['sobre_text2'] ?? '',
    'deliveryFee' => isset($row['delivery_fee']) ? (float) $row['delivery_fee'] : 7,
    'deliveryNote' => $row['delivery_note'] ?? 'Bairros mais afastados: consultar',
    'storeStatus' => (string) ($row['store_status'] ?? 'auto'),
    'openTime' => (string) ($row['open_time'] ?? '10:00'),
    'closeTime' => (string) ($row['close_time'] ?? '22:00'),
    'openDays' => aurora_parse_open_days($row['open_days'] ?? '0,1,2,3,4,5,6'),
  ];

  $s = array_merge($current, $settings);
  $heroStory = json_encode($s['heroStory'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $deliveryFee = isset($s['deliveryFee']) ? (float) $s['deliveryFee'] : 7;
  if ($deliveryFee < 0) $deliveryFee = 0;
  $deliveryNote = trim((string) ($s['deliveryNote'] ?? 'Bairros mais afastados: consultar'));
  if ($deliveryNote === '') $deliveryNote = 'Bairros mais afastados: consultar';

  $pixKey = trim((string) ($s['pixKey'] ?? ''));
  $pixName = trim((string) ($s['pixName'] ?? ''));

  $stmt = $pdo->prepare(
    'INSERT INTO settings (
      id, name, tagline, logo, banner, sobre_image, whatsapp, pix_key, pix_name, instagram, instagram_user,
      facebook, email, address, hours, followers, posts, map_embed, hero_badge, hero_story,
      sobre_text1, sobre_text2, delivery_fee, delivery_note, store_status, open_time, close_time, open_days, data_version
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON DUPLICATE KEY UPDATE
      name=VALUES(name), tagline=VALUES(tagline), logo=VALUES(logo), banner=VALUES(banner),
      sobre_image=VALUES(sobre_image), whatsapp=VALUES(whatsapp), pix_key=VALUES(pix_key), pix_name=VALUES(pix_name),
      instagram=VALUES(instagram),
      instagram_user=VALUES(instagram_user), facebook=VALUES(facebook), email=VALUES(email),
      address=VALUES(address), hours=VALUES(hours), followers=VALUES(followers), posts=VALUES(posts),
      map_embed=VALUES(map_embed), hero_badge=VALUES(hero_badge), hero_story=VALUES(hero_story),
      sobre_text1=VALUES(sobre_text1), sobre_text2=VALUES(sobre_text2),
      delivery_fee=VALUES(delivery_fee), delivery_note=VALUES(delivery_note),
      store_status=VALUES(store_status), open_time=VALUES(open_time), close_time=VALUES(close_time),
      open_days=VALUES(open_days), data_version=VALUES(data_version)'
  );
  $stmt->execute([
    $s['name'] ?? '',
    $s['tagline'] ?? '',
    $s['logo'] ?? '',
    $s['banner'] ?? '',
    $s['sobreImage'] ?? '',
    $s['whatsapp'] ?? '',
    $pixKey !== '' ? $pixKey : null,
    $pixName !== '' ? $pixName : null,
    $s['instagram'] ?? '',
    $s['instagramUser'] ?? '',
    $s['facebook'] ?? '',
    $s['email'] ?? '',
    $s['address'] ?? '',
    $s['hours'] ?? '',
    $s['followers'] ?? '',
    $s['posts'] ?? '',
    $s['mapEmbed'] ?? '',
    $s['heroBadge'] ?? '',
    $heroStory,
    $s['sobreText1'] ?? '',
    $s['sobreText2'] ?? '',
    $deliveryFee,
    $deliveryNote,
    in_array(($s['storeStatus'] ?? 'auto'), ['auto', 'open', 'closed'], true) ? ($s['storeStatus'] ?? 'auto') : 'auto',
    preg_match('/^\d{1,2}:\d{2}$/', (string) ($s['openTime'] ?? '')) ? $s['openTime'] : '10:00',
    preg_match('/^\d{1,2}:\d{2}:\d{2}$/', (string) ($s['closeTime'] ?? '')) ? substr($s['closeTime'], 0, 5) : (
      preg_match('/^\d{1,2}:\d{2}$/', (string) ($s['closeTime'] ?? '')) ? $s['closeTime'] : '22:00'
    ),
    aurora_format_open_days($s['openDays'] ?? [0, 1, 2, 3, 4, 5, 6]),
    (int) ($s['dataVersion'] ?? $row['data_version'] ?? 16),
  ]);
}

function aurora_reserve_stock_for_order(PDO $pdo, array $items): void {
  if (!aurora_product_has_stock_column($pdo)) return;

  foreach ($items as $item) {
    if (!is_array($item)) continue;
    $pid = trim((string) ($item['productId'] ?? $item['id'] ?? ''));
    if ($pid === '') continue;
    $qty = max(1, (int) ($item['qty'] ?? 1));

    $stmt = $pdo->prepare('SELECT name, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE');
    $stmt->execute([$pid]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || $row['stock'] === null || $row['stock'] === '') continue;

    $stock = (int) $row['stock'];
    if ($stock < $qty) {
      $name = trim((string) ($row['name'] ?? 'Produto'));
      throw new InvalidArgumentException("Estoque insuficiente para {$name}. Restam {$stock} un.");
    }

    $upd = $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    $upd->execute([$qty, $pid]);
  }
}

function aurora_product_to_public_row(array $p): array {
  $img = trim((string) ($p['image'] ?? ''));
  if (str_starts_with($img, 'data:')) {
    $img = '';
  }
  $row = [
    'id' => (string) ($p['id'] ?? ''),
    'name' => (string) ($p['name'] ?? ''),
    'description' => (string) ($p['description'] ?? ''),
    'price' => (float) ($p['price'] ?? 0),
    'categoryId' => (string) ($p['categoryId'] ?? ''),
    'image' => $img,
    'featured' => !empty($p['featured']),
    'slug' => (string) ($p['slug'] ?? ''),
    'size' => (string) ($p['size'] ?? ''),
    'flavors' => array_values($p['flavors'] ?? []),
    'promoActive' => !empty($p['promoActive']),
    'promoPrice' => isset($p['promoPrice']) && $p['promoPrice'] !== null && $p['promoPrice'] !== ''
      ? (float) $p['promoPrice']
      : null,
    'promoLabel' => (string) ($p['promoLabel'] ?? ''),
    'bestSeller' => !empty($p['bestSeller']),
    'active' => !empty($p['active']),
    'sortOrder' => (int) ($p['sortOrder'] ?? 0),
    'available' => array_key_exists('available', $p) ? !empty($p['available']) : true,
  ];
  if (!empty($p['priceFrom'])) {
    $row['priceFrom'] = true;
  }
  if (!empty($p['flavorPrices']) && is_array($p['flavorPrices'])) {
    $row['flavorPrices'] = $p['flavorPrices'];
  }
  return $row;
}

/**
 * Atualiza um produto no catalog.json (sem reler o MySQL inteiro).
 * $removeId: tira do cardápio público. $product: inclui/atualiza se active.
 */
function aurora_patch_catalog_json_product(?array $product, ?string $removeId = null): bool {
  $source = aurora_load_catalog_json();
  if (!$source) return false;

  $list = is_array($source['products'] ?? null) ? $source['products'] : [];
  $drop = [];
  if ($removeId) $drop[(string) $removeId] = true;
  if ($product && isset($product['id'])) $drop[(string) $product['id']] = true;

  $next = [];
  foreach ($list as $row) {
    if (!is_array($row)) continue;
    $id = (string) ($row['id'] ?? '');
    if ($id !== '' && isset($drop[$id])) continue;
    $next[] = $row;
  }

  if (is_array($product) && !empty($product['id']) && !empty($product['active'])) {
    $next[] = aurora_product_to_public_row($product);
  }

  usort($next, static function ($a, $b) {
    $diff = ((int) ($a['sortOrder'] ?? 0)) - ((int) ($b['sortOrder'] ?? 0));
    if ($diff !== 0) return $diff;
    return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
  });

  $source['products'] = array_values($next);
  return aurora_write_catalog_json_files($source);
}

function aurora_normalize_product_input(array $p): array {
  $pid = trim((string) ($p['id'] ?? ''));
  $slug = trim((string) ($p['slug'] ?? ''));
  if ($slug === '') {
    $slug = $pid !== '' ? $pid : 'produto';
  }

  $flavors = [];
  foreach (array_values($p['flavors'] ?? []) as $flavor) {
    $flavor = trim((string) $flavor);
    if ($flavor !== '') $flavors[] = $flavor;
  }

  $flavorPrices = [];
  foreach (($p['flavorPrices'] ?? []) as $flavor => $price) {
    $flavor = trim((string) $flavor);
    if ($flavor === '') continue;
    $flavorPrices[$flavor] = (float) $price;
  }

  $img = trim((string) ($p['image'] ?? ''));
  if (str_starts_with($img, 'data:image')) {
    $path = aurora_save_data_url_file($img);
    if (!$path) {
      throw new InvalidArgumentException('Não foi possível gravar a foto. Tente outra imagem, menor.');
    }
    $img = $path;
  }

  $promoPrice = null;
  if (!empty($p['promoActive']) && isset($p['promoPrice']) && $p['promoPrice'] !== null && $p['promoPrice'] !== '') {
    $promoPrice = (float) $p['promoPrice'];
  }

  $out = [
    'id' => $pid,
    'name' => trim((string) ($p['name'] ?? '')),
    'description' => (string) ($p['description'] ?? ''),
    'price' => (float) ($p['price'] ?? 0),
    'priceFrom' => !empty($p['priceFrom']),
    'categoryId' => trim((string) ($p['categoryId'] ?? '')),
    'image' => $img,
    'featured' => !empty($p['featured']),
    'slug' => $slug,
    'size' => trim((string) ($p['size'] ?? '')),
    'flavors' => $flavors,
    'flavorPrices' => $flavorPrices,
    'promoActive' => !empty($p['promoActive']),
    'promoPrice' => $promoPrice,
    'promoLabel' => !empty($p['promoActive']) ? trim((string) ($p['promoLabel'] ?? '')) : '',
    'bestSeller' => !empty($p['bestSeller']),
    'active' => array_key_exists('active', $p) ? !empty($p['active']) : true,
    'available' => array_key_exists('available', $p) ? !empty($p['available']) : true,
    'sortOrder' => (int) ($p['sortOrder'] ?? 0),
  ];
  if (array_key_exists('stock', $p)) {
    $out['stock'] = aurora_normalize_stock_value($p['stock']);
  }

  if ($out['id'] === 'p0') {
    $out['price'] = 29;
    $out['promoActive'] = false;
    $out['promoPrice'] = null;
    $out['promoLabel'] = '';
  }

  return $out;
}

/**
 * UPSERT de um produto (sem regravar o catálogo inteiro).
 */
function aurora_save_one_product(PDO $pdo, array $payload): array {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas. Importe api/aurora_mysql.sql no phpMyAdmin.');
  }

  $p = aurora_normalize_product_input($payload);
  if ($p['id'] === '') {
    throw new InvalidArgumentException('Produto sem id.');
  }
  if ($p['name'] === '') {
    throw new InvalidArgumentException('Informe o nome do produto.');
  }
  if ($p['categoryId'] === '') {
    throw new InvalidArgumentException('Escolha uma categoria.');
  }

  $cat = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
  $cat->execute([$p['categoryId']]);
  if (!$cat->fetchColumn()) {
    throw new InvalidArgumentException('Categoria não encontrada. Salve a categoria antes do produto.');
  }

  $existsStmt = $pdo->prepare('SELECT id, sort_order FROM products WHERE id = ? LIMIT 1');
  $existsStmt->execute([$p['id']]);
  $existing = $existsStmt->fetch(PDO::FETCH_ASSOC);
  $isNew = !$existing;

  if ($isNew && $p['sortOrder'] <= 0) {
    $max = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM products')->fetchColumn();
    $p['sortOrder'] = $max + 1;
  } elseif (!$isNew && !array_key_exists('sortOrder', $payload)) {
    $p['sortOrder'] = (int) ($existing['sort_order'] ?? 0);
  }

  $slugCheck = $pdo->prepare('SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1');
  $slugCheck->execute([$p['slug'], $p['id']]);
  if ($slugCheck->fetchColumn()) {
    $p['slug'] = $p['slug'] . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
  }

  $hasAvailable = aurora_products_has_available($pdo);
  $hasStock = aurora_product_has_stock_column($pdo);

  $pdo->beginTransaction();
  try {
    if ($isNew) {
      if ($hasAvailable && $hasStock) {
        $ins = $pdo->prepare(
          'INSERT INTO products (
            id, name, description, price, price_from, category_id, image, featured, slug, size,
            promo_active, promo_price, promo_label, best_seller, active, available, stock, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
          $p['id'], $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), aurora_bool($p['available']),
          array_key_exists('stock', $p) ? $p['stock'] : null,
          $p['sortOrder'],
        ]);
      } elseif ($hasAvailable) {
        $ins = $pdo->prepare(
          'INSERT INTO products (
            id, name, description, price, price_from, category_id, image, featured, slug, size,
            promo_active, promo_price, promo_label, best_seller, active, available, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
          $p['id'], $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), aurora_bool($p['available']),
          $p['sortOrder'],
        ]);
      } else {
        $ins = $pdo->prepare(
          'INSERT INTO products (
            id, name, description, price, price_from, category_id, image, featured, slug, size,
            promo_active, promo_price, promo_label, best_seller, active, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
          $p['id'], $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), $p['sortOrder'],
        ]);
      }
    } else {
      if ($hasAvailable && $hasStock) {
        $upd = $pdo->prepare(
          'UPDATE products SET
            name = ?, description = ?, price = ?, price_from = ?, category_id = ?, image = ?,
            featured = ?, slug = ?, size = ?, promo_active = ?, promo_price = ?, promo_label = ?,
            best_seller = ?, active = ?, available = ?, stock = ?, sort_order = ?
           WHERE id = ?'
        );
        $upd->execute([
          $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), aurora_bool($p['available']),
          array_key_exists('stock', $p) ? $p['stock'] : null,
          $p['sortOrder'], $p['id'],
        ]);
      } elseif ($hasAvailable) {
        $upd = $pdo->prepare(
          'UPDATE products SET
            name = ?, description = ?, price = ?, price_from = ?, category_id = ?, image = ?,
            featured = ?, slug = ?, size = ?, promo_active = ?, promo_price = ?, promo_label = ?,
            best_seller = ?, active = ?, available = ?, sort_order = ?
           WHERE id = ?'
        );
        $upd->execute([
          $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), aurora_bool($p['available']),
          $p['sortOrder'], $p['id'],
        ]);
      } else {
        $upd = $pdo->prepare(
          'UPDATE products SET
            name = ?, description = ?, price = ?, price_from = ?, category_id = ?, image = ?,
            featured = ?, slug = ?, size = ?, promo_active = ?, promo_price = ?, promo_label = ?,
            best_seller = ?, active = ?, sort_order = ?
           WHERE id = ?'
        );
        $upd->execute([
          $p['name'], $p['description'], $p['price'], aurora_bool($p['priceFrom']),
          $p['categoryId'], $p['image'], aurora_bool($p['featured']), $p['slug'], $p['size'],
          aurora_bool($p['promoActive']), $p['promoPrice'], $p['promoLabel'],
          aurora_bool($p['bestSeller']), aurora_bool($p['active']), $p['sortOrder'], $p['id'],
        ]);
      }
    }

    $pdo->prepare('DELETE FROM product_flavor_prices WHERE product_id = ?')->execute([$p['id']]);
    $pdo->prepare('DELETE FROM product_flavors WHERE product_id = ?')->execute([$p['id']]);

    $flavorStmt = $pdo->prepare(
      'INSERT INTO product_flavors (product_id, flavor, sort_order) VALUES (?, ?, ?)'
    );
    foreach ($p['flavors'] as $fi => $flavor) {
      $flavorStmt->execute([$p['id'], $flavor, (int) $fi]);
    }
    $fpStmt = $pdo->prepare(
      'INSERT INTO product_flavor_prices (product_id, flavor, price) VALUES (?, ?, ?)'
    );
    foreach ($p['flavorPrices'] as $flavor => $price) {
      $fpStmt->execute([$p['id'], $flavor, (float) $price]);
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }

  return $p;
}

function aurora_delete_one_product(PDO $pdo, string $id): void {
  $id = trim($id);
  if ($id === '') {
    throw new InvalidArgumentException('Produto inválido.');
  }
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas.');
  }

  $pdo->beginTransaction();
  try {
    $pdo->prepare('DELETE FROM product_flavor_prices WHERE product_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM product_flavors WHERE product_id = ?')->execute([$id]);
    $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
    $stmt->execute([$id]);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
}

function aurora_save_all(PDO $pdo, array $payload): void {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas. Importe api/aurora_mysql.sql no phpMyAdmin.');
  }

  aurora_ensure_sort_order_columns($pdo);

  $pdo->beginTransaction();
  try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $s = $payload['settings'] ?? [];
    $version = (int) ($payload['version'] ?? 16);
    $heroStory = json_encode($s['heroStory'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $stmt = $pdo->prepare(
      'INSERT INTO settings (
        id, name, tagline, logo, banner, sobre_image, whatsapp, instagram, instagram_user,
        facebook, email, address, hours, followers, posts, map_embed, hero_badge, hero_story,
        sobre_text1, sobre_text2, delivery_fee, delivery_note, store_status, open_time, close_time, open_days, data_version
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON DUPLICATE KEY UPDATE
        name=VALUES(name), tagline=VALUES(tagline), logo=VALUES(logo), banner=VALUES(banner),
        sobre_image=VALUES(sobre_image), whatsapp=VALUES(whatsapp), instagram=VALUES(instagram),
        instagram_user=VALUES(instagram_user), facebook=VALUES(facebook), email=VALUES(email),
        address=VALUES(address), hours=VALUES(hours), followers=VALUES(followers), posts=VALUES(posts),
        map_embed=VALUES(map_embed), hero_badge=VALUES(hero_badge), hero_story=VALUES(hero_story),
        sobre_text1=VALUES(sobre_text1), sobre_text2=VALUES(sobre_text2),
        delivery_fee=VALUES(delivery_fee), delivery_note=VALUES(delivery_note),
        store_status=VALUES(store_status), open_time=VALUES(open_time), close_time=VALUES(close_time),
        open_days=VALUES(open_days), data_version=VALUES(data_version)'
    );
    $deliveryFee = isset($s['deliveryFee']) ? (float) $s['deliveryFee'] : 7;
    if ($deliveryFee < 0) {
      $deliveryFee = 0;
    }
    $deliveryNote = trim((string) ($s['deliveryNote'] ?? 'Bairros mais afastados: consultar'));
    if ($deliveryNote === '') {
      $deliveryNote = 'Bairros mais afastados: consultar';
    }
    $stmt->execute([
      $s['name'] ?? '',
      $s['tagline'] ?? '',
      $s['logo'] ?? '',
      $s['banner'] ?? '',
      $s['sobreImage'] ?? '',
      $s['whatsapp'] ?? '',
      $s['instagram'] ?? '',
      $s['instagramUser'] ?? '',
      $s['facebook'] ?? '',
      $s['email'] ?? '',
      $s['address'] ?? '',
      $s['hours'] ?? '',
      $s['followers'] ?? '',
      $s['posts'] ?? '',
      $s['mapEmbed'] ?? '',
      $s['heroBadge'] ?? '',
      $heroStory,
      $s['sobreText1'] ?? '',
      $s['sobreText2'] ?? '',
      $deliveryFee,
      $deliveryNote,
      in_array(($s['storeStatus'] ?? 'auto'), ['auto', 'open', 'closed'], true) ? ($s['storeStatus'] ?? 'auto') : 'auto',
      preg_match('/^\d{1,2}:\d{2}$/', (string) ($s['openTime'] ?? '')) ? $s['openTime'] : '10:00',
      preg_match('/^\d{1,2}:\d{2}$/', (string) ($s['closeTime'] ?? '')) ? $s['closeTime'] : '22:00',
      aurora_format_open_days($s['openDays'] ?? [0, 1, 2, 3, 4, 5, 6]),
      $version,
    ]);

    $auth = $payload['auth'] ?? [];
    if (!empty($auth['email']) && isset($auth['password']) && $auth['password'] !== '') {
      $existing = $pdo->query('SELECT id FROM admins ORDER BY id ASC LIMIT 1')->fetch();
      if ($existing) {
        $upd = $pdo->prepare('UPDATE admins SET email = ?, password_hash = ? WHERE id = ?');
        $upd->execute([$auth['email'], $auth['password'], $existing['id']]);
      } else {
        $ins = $pdo->prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)');
        $ins->execute([$auth['email'], $auth['password']]);
      }
    }

    $pdo->exec('DELETE FROM product_flavor_prices');
    $pdo->exec('DELETE FROM product_flavors');
    $pdo->exec('DELETE FROM products');
    $pdo->exec('DELETE FROM categories');
    $pdo->exec('DELETE FROM gallery');

    $catStmt = $pdo->prepare(
      'INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)'
    );
    foreach (array_values($payload['categories'] ?? []) as $i => $cat) {
      $catStmt->execute([
        $cat['id'] ?? ('cat-' . $i),
        $cat['name'] ?? '',
        $cat['slug'] ?? ('cat-' . $i),
        (int) ($cat['sortOrder'] ?? $i),
      ]);
    }

    $hasAvailable = false;
    try {
      $hasAvailable = (bool) $pdo->query("SHOW COLUMNS FROM products LIKE 'available'")->fetch();
    } catch (Throwable $e) {
      $hasAvailable = false;
    }
    $hasStock = aurora_product_has_stock_column($pdo);

    $prodStmt = $pdo->prepare(
      $hasAvailable
        ? 'INSERT INTO products (
            id, name, description, price, price_from, category_id, image, featured, slug, size,
            promo_active, promo_price, promo_label, best_seller, active, available, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO products (
            id, name, description, price, price_from, category_id, image, featured, slug, size,
            promo_active, promo_price, promo_label, best_seller, active, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $flavorStmt = $pdo->prepare(
      'INSERT INTO product_flavors (product_id, flavor, sort_order) VALUES (?, ?, ?)'
    );
    $fpStmt = $pdo->prepare(
      'INSERT INTO product_flavor_prices (product_id, flavor, price) VALUES (?, ?, ?)'
    );

    foreach (array_values($payload['products'] ?? []) as $i => $p) {
      $pid = $p['id'] ?? ('p-' . $i);
      // Copo da Felicidade: preço cheio R$29 (sem promo antiga)
      if ($pid === 'p0') {
        $p['price'] = 29;
        $p['promoActive'] = false;
        $p['promoPrice'] = null;
        $p['promoLabel'] = '';
      }
      $row = [
        $pid,
        $p['name'] ?? '',
        $p['description'] ?? '',
        (float) ($p['price'] ?? 0),
        aurora_bool($p['priceFrom'] ?? false),
        $p['categoryId'] ?? '',
        $p['image'] ?? '',
        aurora_bool($p['featured'] ?? false),
        $p['slug'] ?? $pid,
        $p['size'] ?? '',
        aurora_bool($p['promoActive'] ?? false),
        isset($p['promoPrice']) && $p['promoPrice'] !== null && $p['promoPrice'] !== ''
          ? (float) $p['promoPrice']
          : null,
        $p['promoLabel'] ?? '',
        aurora_bool($p['bestSeller'] ?? false),
        aurora_bool($p['active'] ?? true),
      ];
      if ($hasAvailable) {
        $row[] = aurora_bool($p['available'] ?? true);
      }
      $row[] = (int) ($p['sortOrder'] ?? $i);
      $prodStmt->execute($row);
      if ($hasStock) {
        $stockUpd = $pdo->prepare('UPDATE products SET stock = ? WHERE id = ?');
        $stockUpd->execute([
          array_key_exists('stock', $p) ? aurora_normalize_stock_value($p['stock']) : null,
          $pid,
        ]);
      }

      foreach (array_values($p['flavors'] ?? []) as $fi => $flavor) {
        $flavorStmt->execute([$pid, $flavor, $fi]);
      }
      foreach (($p['flavorPrices'] ?? []) as $flavor => $price) {
        $fpStmt->execute([$pid, $flavor, (float) $price]);
      }
    }

    $galStmt = $pdo->prepare('INSERT INTO gallery (image, sort_order, active) VALUES (?, ?, 1)');
    foreach (array_values($payload['gallery'] ?? []) as $i => $img) {
      if (!$img) continue;
      $galStmt->execute([$img, $i]);
    }

    // Clientes
    $pdo->exec('DELETE FROM clients');
    $hasLoyaltyBonus = false;
    try {
      $col = $pdo->query("SHOW COLUMNS FROM clients LIKE 'loyalty_bonus'")->fetch();
      $hasLoyaltyBonus = !empty($col);
    } catch (Throwable $e) {
      $hasLoyaltyBonus = false;
    }
    if ($hasLoyaltyBonus) {
      $clientStmt = $pdo->prepare(
        'INSERT INTO clients (id, name, email, phone, address, loyalty_bonus) VALUES (?, ?, ?, ?, ?, ?)'
      );
      foreach ($payload['clients'] ?? [] as $c) {
        $clientStmt->execute([
          $c['id'] ?? uniqid('c', true),
          $c['name'] ?? '',
          $c['email'] ?? '',
          $c['phone'] ?? '',
          $c['address'] ?? '',
          max(0, (int) ($c['loyaltyBonus'] ?? 0)),
        ]);
      }
    } else {
      $clientStmt = $pdo->prepare(
        'INSERT INTO clients (id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)'
      );
      foreach ($payload['clients'] ?? [] as $c) {
        $clientStmt->execute([
          $c['id'] ?? uniqid('c', true),
          $c['name'] ?? '',
          $c['email'] ?? '',
          $c['phone'] ?? '',
          $c['address'] ?? '',
        ]);
      }
    }

    // Pedidos + itens
    $pdo->exec('DELETE FROM order_items');
    $pdo->exec('DELETE FROM orders');
    $orderStmt = $pdo->prepare(
      'INSERT INTO orders (
        id, number, client_id, client_name, client_whatsapp, total, status, ordered_at,
        notes, delivery_fee, discount, waive_delivery
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $itemStmt = $pdo->prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, flavor, qty, price)
       VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($payload['orders'] ?? [] as $o) {
      $oid = $o['id'] ?? uniqid('o', true);
      $orderedAt = !empty($o['date']) ? date('Y-m-d H:i:s', strtotime($o['date'])) : date('Y-m-d H:i:s');
      $status = $o['status'] ?? 'novo';
      $allowed = ['novo', 'preparo', 'entrega', 'finalizado', 'cancelado'];
      if (!in_array($status, $allowed, true)) $status = 'novo';

      $orderStmt->execute([
        $oid,
        $o['number'] ?? ('PED-' . date('Y') . '-001'),
        $o['clientId'] ?? null,
        $o['clientName'] ?? '',
        $o['clientWhatsapp'] ?? '',
        (float) ($o['total'] ?? 0),
        $status,
        $orderedAt,
        $o['notes'] ?? '',
        (float) ($o['deliveryFee'] ?? 0),
        (float) ($o['discount'] ?? 0),
        !empty($o['waiveDelivery']) ? 1 : 0,
      ]);

      foreach ($o['items'] ?? [] as $item) {
        $itemStmt->execute([
          $oid,
          $item['productId'] ?? $item['id'] ?? null,
          $item['name'] ?? $item['productName'] ?? 'Item',
          $item['flavor'] ?? '',
          (int) ($item['qty'] ?? 1),
          (float) ($item['price'] ?? 0),
        ]);
      }
    }

    // Financeiro
    $pdo->exec('DELETE FROM finance');
    $finStmt = $pdo->prepare(
      'INSERT INTO finance (id, type, amount, description, entry_date, order_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($payload['finance'] ?? [] as $f) {
      $type = ($f['type'] ?? '') === 'saida' ? 'saida' : 'entrada';
      $entryDate = !empty($f['date']) ? date('Y-m-d', strtotime($f['date'])) : date('Y-m-d');
      $finStmt->execute([
        $f['id'] ?? uniqid('f', true),
        $type,
        (float) ($f['amount'] ?? 0),
        $f['description'] ?? '',
        $entryDate,
        $f['orderId'] ?? null,
      ]);
    }

    // Insumos / itens de estoque
    aurora_ensure_inventory_items_table($pdo);
    if (aurora_table_exists($pdo, 'inventory_items')) {
      $pdo->exec('DELETE FROM inventory_items');
      $invStmt = $pdo->prepare(
        'INSERT INTO inventory_items (id, name, unit, stock, min_stock, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      foreach (array_values($payload['inventoryItems'] ?? []) as $i => $item) {
        if (!is_array($item)) continue;
        $name = trim((string) ($item['name'] ?? ''));
        if ($name === '') continue;
        $invStmt->execute([
          $item['id'] ?? uniqid('inv', true),
          $name,
          aurora_normalize_inventory_unit($item['unit'] ?? 'un'),
          aurora_normalize_inventory_qty($item['stock'] ?? 0),
          isset($item['minStock']) && $item['minStock'] !== '' && $item['minStock'] !== null
            ? aurora_normalize_inventory_qty($item['minStock'])
            : null,
          trim((string) ($item['notes'] ?? '')) ?: null,
          (int) ($item['sortOrder'] ?? $i),
        ]);
      }
    }

    // Cupons
    aurora_ensure_coupons_table($pdo);
    if (aurora_table_exists($pdo, 'coupons')) {
      $pdo->exec('DELETE FROM coupons');
      $couponStmt = $pdo->prepare(
        'INSERT INTO coupons (id, code, type, value, min_order, active, label) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      foreach ($payload['coupons'] ?? [] as $c) {
        $code = strtoupper(trim((string) ($c['code'] ?? '')));
        if ($code === '') continue;
        $type = ($c['type'] ?? '') === 'fixed' ? 'fixed' : 'percent';
        $couponStmt->execute([
          $c['id'] ?? uniqid('cp', true),
          $code,
          $type,
          (float) ($c['value'] ?? 0),
          (float) ($c['minOrder'] ?? 0),
          !empty($c['active']) ? 1 : 0,
          $c['label'] ?? '',
        ]);
      }
    }

    // Reviews / FAQ
    $pdo->exec('DELETE FROM reviews');
    $revStmt = $pdo->prepare(
      'INSERT INTO reviews (id, author, text, rating, active) VALUES (?, ?, ?, ?, 1)'
    );
    foreach ($payload['reviews'] ?? [] as $r) {
      $revStmt->execute([
        $r['id'] ?? uniqid('r', true),
        $r['author'] ?? '',
        $r['text'] ?? '',
        (int) ($r['rating'] ?? 5),
      ]);
    }

    $pdo->exec('DELETE FROM faq');
    $faqStmt = $pdo->prepare(
      'INSERT INTO faq (id, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)'
    );
    foreach (array_values($payload['faq'] ?? []) as $i => $f) {
      $faqStmt->execute([
        $f['id'] ?? uniqid('faq', true),
        $f['question'] ?? '',
        $f['answer'] ?? '',
        $i,
      ]);
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      try { $pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); } catch (Throwable $ignored) {}
      $pdo->rollBack();
    }
    throw $e;
  }

  // Cardápio estático (não depende de PHP nas visitas do site)
  try {
    aurora_write_public_catalog($pdo);
  } catch (Throwable $e) {
    // não falha o save se o JSON estático não gravar
  }
}

/**
 * Grava catalog.json na raiz do site — HTML/JS leem sem MySQL/PHP.
 */
function aurora_write_public_catalog(PDO $pdo): bool {
  $data = aurora_load_all($pdo, 'public');
  if (!$data) return false;

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

  $products = [];
  foreach ($data['products'] ?? [] as $p) {
    if (!is_array($p)) continue;
    if (((int) (!empty($p['active']) ? 1 : 0)) !== 1) continue;
    $img = (string) ($p['image'] ?? '');
    // data-URL → arquivo + backup MySQL (catalog.json não pode ficar gigante)
    if (str_starts_with($img, 'data:')) {
      $path = aurora_save_data_url_file($img);
      if ($path) {
        $p['image'] = $path;
        if (!empty($p['id'])) {
          try {
            $upd = $pdo->prepare('UPDATE products SET image = ? WHERE id = ?');
            $upd->execute([$path, $p['id']]);
          } catch (Throwable $e) {
            // catalog ainda leva o path
          }
        }
      } else {
        $p['image'] = '';
      }
    }
    $products[] = $p;
  }

  $payload = [
    'version' => $data['version'] ?? 16,
    'generatedAt' => gmdate('c'),
    'settings' => $data['settings'] ?? new stdClass(),
    'categories' => $data['categories'] ?? [],
    'products' => $products,
    'reviews' => $data['reviews'] ?? [],
    'faq' => $data['faq'] ?? [],
    'gallery' => array_values(array_filter(
      $data['gallery'] ?? [],
      static fn($g) => !str_starts_with((string) $g, 'data:')
    )),
    'coupons' => $coupons,
  ];

  $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) return false;

  $root = dirname(__DIR__);
  $ok = @file_put_contents($root . DIRECTORY_SEPARATOR . 'catalog.json', $json) !== false;

  // Espelho em api/ (alguns deploys)
  @file_put_contents($root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'catalog.json', $json);

  // Arquivo "vivo" (não versionado) — sobrevive melhor a confusão com o JSON do Git
  @file_put_contents($root . DIRECTORY_SEPARATOR . 'catalog.live.json', $json);

  return $ok;
}

function aurora_upsert_client(PDO $pdo, array $client): ?string {
  if (empty($client['id']) && empty($client['phone'])) return null;

  $id = (string) ($client['id'] ?? ('c_' . uniqid()));
  $phone = preg_replace('/\D+/', '', (string) ($client['phone'] ?? ''));

  if ($phone !== '') {
    // Também tenta achar por variantes do WhatsApp (com/sem 55 e 9)
    $variants = function_exists('aurora_phone_match_keys')
      ? aurora_phone_match_keys($phone)
      : array_values(array_unique(array_filter([$phone])));
    if ($variants) {
      $placeholders = implode(',', array_fill(0, count($variants), '?'));
      $find = $pdo->prepare("SELECT id FROM clients WHERE phone IN ($placeholders) LIMIT 1");
      $find->execute($variants);
      $existing = $find->fetchColumn();
      if ($existing) {
        $upd = $pdo->prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?');
        $upd->execute([
          $client['name'] ?? '',
          $client['email'] ?? '',
          $phone,
          $client['address'] ?? '',
          $existing,
        ]);
        return (string) $existing;
      }
    }
  }

  $ins = $pdo->prepare(
    'INSERT INTO clients (id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), address=VALUES(address)'
  );
  $ins->execute([
    $id,
    $client['name'] ?? '',
    $client['email'] ?? '',
    $phone,
    $client['address'] ?? '',
  ]);
  return $id;
}

function aurora_create_order(PDO $pdo, array $order, ?array $client = null): array {
  $resolvedClientId = null;
  if (is_array($client)) {
    $resolvedClientId = aurora_upsert_client($pdo, $client);
  }

  $phone = preg_replace('/\D+/', '', (string) ($order['clientWhatsapp'] ?? ''));
  $total = (float) ($order['total'] ?? 0);
  $name = trim((string) ($order['clientName'] ?? ''));
  $clientId = $resolvedClientId
    ?: (string) ($order['clientId'] ?? ($client['id'] ?? ''));
  if ($clientId === '') $clientId = null;

  $orderId = (string) ($order['id'] ?? '');
  if ($orderId !== '') {
    $chk = $pdo->prepare('SELECT number FROM orders WHERE id = ? LIMIT 1');
    $chk->execute([$orderId]);
    $existingNumber = $chk->fetchColumn();
    if ($existingNumber) {
      return [
        'ok' => true,
        'orderNumber' => $existingNumber,
        'duplicated' => true,
        'loyalty' => aurora_loyalty_stats_safe($pdo, $phone),
      ];
    }
  }

  if ($phone !== '') {
    $dup = $pdo->prepare(
      "SELECT number FROM orders
       WHERE client_whatsapp = ?
         AND client_name = ?
         AND ABS(total - ?) < 0.001
         AND ordered_at >= (NOW() - INTERVAL 90 SECOND)
       ORDER BY ordered_at DESC LIMIT 1"
    );
    $dup->execute([$phone, $name, $total]);
    $dupNumber = $dup->fetchColumn();
    if ($dupNumber) {
      return [
        'ok' => true,
        'orderNumber' => $dupNumber,
        'duplicated' => true,
        'loyalty' => aurora_loyalty_stats_safe($pdo, $phone),
      ];
    }
  }

  $year = (int) date('Y');
  $max = 0;
  $like = sprintf('PED-%d-%%', $year);
  $numStmt = $pdo->prepare(
    'SELECT number FROM orders WHERE number LIKE ? ORDER BY number DESC LIMIT 50'
  );
  $numStmt->execute([$like]);
  foreach ($numStmt->fetchAll(PDO::FETCH_COLUMN) as $number) {
    if (preg_match('/PED-(\d{4})-(\d+)/i', (string) $number, $m) && (int) $m[1] === $year) {
      $max = max($max, (int) $m[2]);
    }
  }
  $orderNumber = sprintf('PED-%d-%03d', $year, $max + 1);
  if ($orderId === '') $orderId = 'o_' . uniqid();

  $pdo->beginTransaction();
  try {
    if ($clientId) {
      $chkClient = $pdo->prepare('SELECT id FROM clients WHERE id = ? LIMIT 1');
      $chkClient->execute([$clientId]);
      if (!$chkClient->fetchColumn()) {
        $clientId = null;
      }
    }

    $notes = trim((string) ($order['notes'] ?? ''));
    $hasNotes = false;
    try {
      $hasNotes = (bool) $pdo->query("SHOW COLUMNS FROM orders LIKE 'notes'")->fetch();
    } catch (Throwable $e) {
      $hasNotes = false;
    }

    if ($hasNotes) {
      $ins = $pdo->prepare(
        'INSERT INTO orders (
          id, number, client_id, client_name, client_whatsapp, total, status, notes, ordered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
      );
      $ins->execute([
        $orderId,
        $orderNumber,
        $clientId,
        $name,
        $phone,
        $total,
        'novo',
        $notes !== '' ? $notes : null,
      ]);
    } else {
      $ins = $pdo->prepare(
        'INSERT INTO orders (
          id, number, client_id, client_name, client_whatsapp, total, status, ordered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
      );
      $ins->execute([
        $orderId,
        $orderNumber,
        $clientId,
        $name,
        $phone,
        $total,
        'novo',
      ]);
    }

    aurora_reserve_stock_for_order($pdo, $order['items'] ?? []);

    $itemStmt = $pdo->prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, flavor, qty, price)
       VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($order['items'] ?? [] as $item) {
      $itemStmt->execute([
        $orderId,
        $item['productId'] ?? $item['id'] ?? null,
        $item['name'] ?? $item['productName'] ?? 'Item',
        $item['flavor'] ?? ($item['detail'] ?? ''),
        (int) ($item['qty'] ?? 1),
        (float) ($item['price'] ?? 0),
      ]);
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }

  // Atualiza cardápio público para refletir estoque esgotado no site
  try {
    aurora_write_public_catalog($pdo);
  } catch (Throwable $e) {
    // pedido já gravado — não falha a venda por causa do JSON
  }

  return [
    'ok' => true,
    'orderNumber' => $orderNumber,
    'loyalty' => aurora_loyalty_stats_safe($pdo, $phone),
  ];
}

function aurora_loyalty_stats_safe(PDO $pdo, string $phone): array {
  try {
    return aurora_loyalty_stats($pdo, $phone);
  } catch (Throwable $e) {
    $goal = aurora_loyalty_goal();
    return [
      'phone' => aurora_normalize_phone($phone),
      'total' => 0,
      'siteTotal' => 0,
      'bonus' => 0,
      'progress' => 0,
      'goal' => $goal,
      'remaining' => $goal,
      'rewards' => 0,
      'eligible' => false,
      'gift' => aurora_loyalty_gift(),
    ];
  }
}

/**
 * Fidelidade Aurora — 15 pedidos finalizados no painel = 1 brinde.
 * Chave: WhatsApp do cliente.
 */
function aurora_loyalty_goal(): int {
  return 15;
}

function aurora_loyalty_gift(): string {
  return '1 brinde surpresa da Aurora';
}

function aurora_normalize_phone($phone): string {
  return preg_replace('/\D+/', '', (string) $phone);
}

/**
 * Gera chaves de comparação para o mesmo WhatsApp BR
 * (com/sem 55, com/sem o 9º dígito após o DDD).
 */
function aurora_phone_match_keys(string $phone): array {
  $phone = aurora_normalize_phone($phone);
  if ($phone === '' || strlen($phone) < 10) return [];

  $keys = [];
  $add = static function (string $p) use (&$keys): void {
    if ($p !== '' && strlen($p) >= 10) $keys[$p] = true;
  };

  $add($phone);
  $local = (str_starts_with($phone, '55') && strlen($phone) >= 12) ? substr($phone, 2) : $phone;
  $add($local);
  $add(str_starts_with($phone, '55') ? $phone : ('55' . $phone));
  $add(str_starts_with($local, '55') ? $local : ('55' . $local));

  // Com / sem o 9 após o DDD (celular BR)
  if (strlen($local) === 11 && $local[2] === '9') {
    $noNine = substr($local, 0, 2) . substr($local, 3);
    $add($noNine);
    $add('55' . $noNine);
  } elseif (strlen($local) === 10) {
    $withNine = substr($local, 0, 2) . '9' . substr($local, 2);
    $add($withNine);
    $add('55' . $withNine);
  }

  return array_keys($keys);
}

function aurora_phone_variants(string $phone): array {
  return aurora_phone_match_keys($phone);
}

function aurora_phones_equivalent(string $a, string $b): bool {
  $ka = aurora_phone_match_keys($a);
  $kb = aurora_phone_match_keys($b);
  if (!$ka || !$kb) return false;
  return (bool) array_intersect($ka, $kb);
}

function aurora_phone_sql_digits(string $column): string {
  $expr = $column;
  foreach ([' ', '-', '(', ')', '+', '.'] as $ch) {
    $expr = "REPLACE($expr, '$ch', '')";
  }
  return $expr;
}

function aurora_loyalty_stats(PDO $pdo, string $phone): array {
  $goal = aurora_loyalty_goal();
  $gift = aurora_loyalty_gift();
  $variants = aurora_phone_match_keys($phone);
  if (!$variants) {
    return [
      'phone' => '',
      'total' => 0,
      'siteTotal' => 0,
      'bonus' => 0,
      'progress' => 0,
      'goal' => $goal,
      'remaining' => $goal,
      'rewards' => 0,
      'eligible' => false,
      'gift' => $gift,
    ];
  }

  // Contagem por variantes do WhatsApp (SQL — normaliza telefone salvo com máscara)
  $placeholders = implode(',', array_fill(0, count($variants), '?'));
  $phoneExpr = aurora_phone_sql_digits('client_whatsapp');
  $stmt = $pdo->prepare(
    "SELECT COUNT(*) FROM orders
     WHERE status = 'finalizado'
       AND $phoneExpr IN ($placeholders)"
  );
  $stmt->execute($variants);
  $siteTotal = (int) $stmt->fetchColumn();

  $bonus = 0;
  try {
    $clientPhoneExpr = aurora_phone_sql_digits('phone');
    $bStmt = $pdo->prepare(
      "SELECT MAX(loyalty_bonus) FROM clients WHERE $clientPhoneExpr IN ($placeholders)"
    );
    $bStmt->execute($variants);
    $bonus = max(0, (int) $bStmt->fetchColumn());
  } catch (Throwable $e) {
    $bonus = 0;
  }

  $total = $siteTotal + $bonus;

  $rewards = intdiv($total, $goal);
  $mod = $total % $goal;
  $eligible = $total > 0 && $mod === 0;
  $progress = $eligible ? $goal : $mod;
  $remaining = $eligible ? 0 : ($goal - $progress);

  return [
    'phone' => $variants[0],
    'total' => $total,
    'siteTotal' => $siteTotal,
    'bonus' => $bonus,
    'progress' => $progress,
    'goal' => $goal,
    'remaining' => $remaining,
    'rewards' => $rewards,
    'eligible' => $eligible,
    'gift' => $gift,
  ];
}

function aurora_normalize_inventory_unit($unit): string {
  $u = strtolower(trim((string) $unit));
  $allowed = ['un', 'cx', 'kg', 'g', 'l', 'ml', 'pct', 'lt'];
  if ($u === 'lt') $u = 'l';
  if ($u === 'pacote') $u = 'pct';
  if ($u === 'caixa') $u = 'cx';
  return in_array($u, $allowed, true) ? $u : 'un';
}

function aurora_normalize_inventory_qty($value): float {
  if ($value === null || $value === '') return 0.0;
  if (!is_numeric($value)) return 0.0;
  return max(0, round((float) $value, 2));
}

function aurora_load_inventory_items(PDO $pdo): array {
  if (!aurora_table_exists($pdo, 'inventory_items')) {
    return [];
  }
  $rows = $pdo->query(
    'SELECT * FROM inventory_items ORDER BY sort_order ASC, name ASC'
  )->fetchAll(PDO::FETCH_ASSOC);
  $items = [];
  foreach ($rows as $row) {
    $item = [
      'id' => (string) ($row['id'] ?? ''),
      'name' => (string) ($row['name'] ?? ''),
      'unit' => aurora_normalize_inventory_unit($row['unit'] ?? 'un'),
      'stock' => aurora_normalize_inventory_qty($row['stock'] ?? 0),
      'sortOrder' => (int) ($row['sort_order'] ?? 0),
    ];
    if ($row['min_stock'] !== null && $row['min_stock'] !== '') {
      $item['minStock'] = aurora_normalize_inventory_qty($row['min_stock']);
    }
    $notes = trim((string) ($row['notes'] ?? ''));
    if ($notes !== '') $item['notes'] = $notes;
    $items[] = $item;
  }
  return $items;
}

function aurora_normalize_inventory_input(array $item): array {
  $name = trim((string) ($item['name'] ?? ''));
  $id = trim((string) ($item['id'] ?? ''));
  if ($id === '') $id = 'inv_' . bin2hex(random_bytes(6));
  $out = [
    'id' => $id,
    'name' => $name,
    'unit' => aurora_normalize_inventory_unit($item['unit'] ?? 'un'),
    'stock' => aurora_normalize_inventory_qty($item['stock'] ?? 0),
    'sortOrder' => (int) ($item['sortOrder'] ?? 0),
  ];
  if (array_key_exists('minStock', $item) && $item['minStock'] !== '' && $item['minStock'] !== null) {
    $out['minStock'] = aurora_normalize_inventory_qty($item['minStock']);
  }
  $notes = trim((string) ($item['notes'] ?? ''));
  if ($notes !== '') $out['notes'] = $notes;
  return $out;
}

function aurora_save_one_inventory_item(PDO $pdo, array $payload): array {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas.');
  }
  aurora_ensure_inventory_items_table($pdo);
  $item = aurora_normalize_inventory_input($payload);
  if ($item['name'] === '') {
    throw new InvalidArgumentException('Informe o nome do item.');
  }

  $exists = $pdo->prepare('SELECT id, sort_order FROM inventory_items WHERE id = ? LIMIT 1');
  $exists->execute([$item['id']]);
  $existing = $exists->fetch(PDO::FETCH_ASSOC);
  $isNew = !$existing;
  if ($isNew && $item['sortOrder'] <= 0) {
    $max = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), -1) FROM inventory_items')->fetchColumn();
    $item['sortOrder'] = $max + 1;
  } elseif (!$isNew && !array_key_exists('sortOrder', $payload)) {
    $item['sortOrder'] = (int) ($existing['sort_order'] ?? 0);
  }

  $minStock = $item['minStock'] ?? null;
  $notes = $item['notes'] ?? null;

  if ($isNew) {
    $stmt = $pdo->prepare(
      'INSERT INTO inventory_items (id, name, unit, stock, min_stock, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
      $item['id'], $item['name'], $item['unit'], $item['stock'],
      $minStock, $notes, $item['sortOrder'],
    ]);
  } else {
    $stmt = $pdo->prepare(
      'UPDATE inventory_items SET name = ?, unit = ?, stock = ?, min_stock = ?, notes = ?, sort_order = ?
       WHERE id = ?'
    );
    $stmt->execute([
      $item['name'], $item['unit'], $item['stock'], $minStock, $notes,
      $item['sortOrder'], $item['id'],
    ]);
  }

  return $item;
}

function aurora_delete_one_inventory_item(PDO $pdo, string $itemId): void {
  aurora_ensure_inventory_items_table($pdo);
  $id = trim($itemId);
  if ($id === '') {
    throw new InvalidArgumentException('Item inválido.');
  }
  $stmt = $pdo->prepare('DELETE FROM inventory_items WHERE id = ?');
  $stmt->execute([$id]);
}

/* --- Analytics (visitas e eventos do site) --- */

function aurora_analytics_client_ip(): string {
  foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
    if (empty($_SERVER[$key])) {
      continue;
    }
    $raw = trim(explode(',', (string) $_SERVER[$key])[0]);
    if (filter_var($raw, FILTER_VALIDATE_IP)) {
      return $raw;
    }
  }
  return '';
}

function aurora_analytics_ip_hash(string $ip): string {
  if ($ip === '') {
    return '';
  }
  return hash('sha256', $ip . '|aurora_analytics_v1');
}

function aurora_analytics_geo_lookup(string $ip, bool $allowExternal = true): array {
  if (
    $ip === ''
    || $ip === '127.0.0.1'
    || str_starts_with($ip, '192.168.')
    || str_starts_with($ip, '10.')
  ) {
    return ['country' => '', 'region' => '', 'city' => ''];
  }

  // Headers do host/CDN primeiro — não trava processo PHP
  foreach (['HTTP_CF_IPCOUNTRY', 'HTTP_X_COUNTRY_CODE', 'GEOIP_COUNTRY_CODE', 'HTTP_X_APPENGINE_COUNTRY'] as $header) {
    if (empty($_SERVER[$header]) || $_SERVER[$header] === 'XX') continue;
    $raw = strtoupper(trim((string) $_SERVER[$header]));
    $cc = substr($raw, 0, 2);
    $country = ($cc === 'BR' || stripos($raw, 'BRASIL') !== false || stripos($raw, 'BRAZIL') !== false)
      ? 'Brasil'
      : substr((string) $_SERVER[$header], 0, 80);
    $city = substr(trim((string) ($_SERVER['HTTP_CF_IPCITY'] ?? '')), 0, 120);
    $region = substr(trim((string) ($_SERVER['HTTP_CF_REGION'] ?? $_SERVER['HTTP_CF_REGION_CODE'] ?? '')), 0, 120);
    return ['country' => $country, 'region' => $region, 'city' => $city];
  }

  // No pico: não chama API externa em page_view (segura processos da Hostinger)
  if (!$allowExternal) {
    return ['country' => '', 'region' => '', 'city' => ''];
  }

  $ctx = stream_context_create([
    'http' => [
      'timeout' => 0.4,
      'header' => "Accept: application/json\r\n",
    ],
  ]);
  $url = 'http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,country,regionName,city&lang=pt-BR';
  $raw = @file_get_contents($url, false, $ctx);
  if (!is_string($raw)) {
    return ['country' => '', 'region' => '', 'city' => ''];
  }
  $json = json_decode($raw, true);
  if (!is_array($json) || ($json['status'] ?? '') !== 'success') {
    return ['country' => '', 'region' => '', 'city' => ''];
  }
  $country = trim((string) ($json['country'] ?? ''));
  if ($country === 'Brazil') $country = 'Brasil';
  return [
    'country' => substr($country, 0, 80),
    'region' => substr((string) ($json['regionName'] ?? ''), 0, 120),
    'city' => substr((string) ($json['city'] ?? ''), 0, 120),
  ];
}

function aurora_analytics_period_start(string $period): string {
  return aurora_analytics_period_range($period)['since'];
}

function aurora_analytics_period_range(string $period): array {
  $tz = new DateTimeZone('America/Sao_Paulo');
  $now = new DateTime('now', $tz);

  if ($period === 'today') {
    $since = new DateTime($now->format('Y-m-d') . ' 00:00:00', $tz);
    $prevUntil = clone $since;
    $prevSince = clone $since;
    $prevSince->modify('-1 day');
    return [
      'since' => $since->format('Y-m-d H:i:s'),
      'until' => null,
      'prevSince' => $prevSince->format('Y-m-d H:i:s'),
      'prevUntil' => $prevUntil->format('Y-m-d H:i:s'),
      'label' => 'Hoje',
      'compareLabel' => 'vs. ontem',
    ];
  }

  if ($period === '7d') {
    $since = clone $now;
    $since->modify('-7 days');
    $prevUntil = clone $since;
    $prevSince = clone $since;
    $prevSince->modify('-7 days');
    return [
      'since' => $since->format('Y-m-d H:i:s'),
      'until' => null,
      'prevSince' => $prevSince->format('Y-m-d H:i:s'),
      'prevUntil' => $prevUntil->format('Y-m-d H:i:s'),
      'label' => 'Últimos 7 dias',
      'compareLabel' => 'vs. 7 dias anteriores',
    ];
  }

  $since = clone $now;
  $since->modify('-30 days');
  $prevUntil = clone $since;
  $prevSince = clone $since;
  $prevSince->modify('-30 days');
  return [
    'since' => $since->format('Y-m-d H:i:s'),
    'until' => null,
    'prevSince' => $prevSince->format('Y-m-d H:i:s'),
    'prevUntil' => $prevUntil->format('Y-m-d H:i:s'),
    'label' => 'Últimos 30 dias',
    'compareLabel' => 'vs. 30 dias anteriores',
  ];
}

function aurora_analytics_delta(int $current, int $previous): ?float {
  if ($previous === 0) {
    return $current > 0 ? 100.0 : null;
  }
  return round((($current - $previous) / $previous) * 100, 1);
}

function aurora_analytics_metrics(PDO $pdo, string $since, ?string $until = null): array {
  $sessionBind = [$since];
  $sessionUntil = '';
  if ($until) {
    $sessionUntil = ' AND last_seen < ?';
    $sessionBind[] = $until;
  }

  $visitorsStmt = $pdo->prepare(
    'SELECT COUNT(*) FROM analytics_sessions WHERE last_seen >= ?' . $sessionUntil
  );
  $visitorsStmt->execute($sessionBind);
  $uniqueVisitors = (int) $visitorsStmt->fetchColumn();

  $eventBind = [$since];
  $eventUntil = '';
  if ($until) {
    $eventUntil = ' AND created_at < ?';
    $eventBind[] = $until;
  }

  $countEvent = function (string $type) use ($pdo, $eventBind, $eventUntil): int {
    $stmt = $pdo->prepare(
      'SELECT COUNT(*) FROM analytics_events WHERE event_type = ? AND created_at >= ?' . $eventUntil
    );
    $stmt->execute(array_merge([$type], $eventBind));
    return (int) $stmt->fetchColumn();
  };

  $countSessionsEvent = function ($types) use ($pdo, $eventBind, $eventUntil): int {
    if (!is_array($types)) {
      $types = [$types];
    }
    $placeholders = implode(',', array_fill(0, count($types), '?'));
    $stmt = $pdo->prepare(
      "SELECT COUNT(DISTINCT session_id) FROM analytics_events
       WHERE event_type IN ($placeholders) AND created_at >= ?" . $eventUntil
    );
    $stmt->execute(array_merge($types, $eventBind));
    return (int) $stmt->fetchColumn();
  };

  $pageViews = $countEvent('page_view');
  $productViews = $countEvent('product_view') + $countEvent('product_click');
  $addToCart = $countEvent('add_to_cart');
  $beginCheckout = $countEvent('begin_checkout');
  $ordersCreated = $countEvent('order_created');

  $sessionsProductView = $countSessionsEvent(['product_view', 'product_click']);
  $sessionsAddCart = $countSessionsEvent('add_to_cart');
  $sessionsCheckout = $countSessionsEvent('begin_checkout');
  $sessionsOrder = $countSessionsEvent('order_created');

  $avgPages = 0.0;
  if ($uniqueVisitors > 0) {
    $avgPages = round($pageViews / $uniqueVisitors, 1);
  }

  $cartRate = $sessionsProductView > 0
    ? round(($sessionsAddCart / $sessionsProductView) * 100, 1)
    : 0;
  $checkoutRate = $sessionsAddCart > 0
    ? round(($sessionsCheckout / $sessionsAddCart) * 100, 1)
    : 0;
  $orderRate = $sessionsCheckout > 0
    ? round(($sessionsOrder / $sessionsCheckout) * 100, 1)
    : 0;
  $conversionRate = $uniqueVisitors > 0
    ? round(($sessionsOrder / $uniqueVisitors) * 100, 1)
    : 0;
  $abandonCheckout = $beginCheckout > 0
    ? round((max(0, $beginCheckout - $ordersCreated) / $beginCheckout) * 100, 1)
    : 0;

  return [
    'uniqueVisitors' => $uniqueVisitors,
    'pageViews' => $pageViews,
    'productViews' => $productViews,
    'addToCart' => $addToCart,
    'beginCheckout' => $beginCheckout,
    'ordersCreated' => $ordersCreated,
    'sessionsProductView' => $sessionsProductView,
    'sessionsAddCart' => $sessionsAddCart,
    'sessionsCheckout' => $sessionsCheckout,
    'sessionsOrder' => $sessionsOrder,
    'avgPagesPerVisitor' => $avgPages,
    'cartRate' => $cartRate,
    'checkoutRate' => $checkoutRate,
    'orderRate' => $orderRate,
    'conversionRate' => $conversionRate,
    'abandonCheckout' => $abandonCheckout,
  ];
}

function aurora_analytics_format_referrer(string $ref): string {
  $ref = trim($ref);
  if ($ref === '') {
    return 'Acesso direto';
  }
  $host = parse_url($ref, PHP_URL_HOST);
  if (is_string($host) && $host !== '') {
    $host = preg_replace('/^www\./i', '', $host);
    if (stripos($host, 'instagram') !== false) return 'Instagram';
    if (stripos($host, 'facebook') !== false) return 'Facebook';
    if (stripos($host, 'google') !== false) return 'Google';
    if (stripos($host, 'whatsapp') !== false) return 'WhatsApp';
    return $host;
  }
  return 'Outros';
}

function aurora_analytics_build_insights(array $current, array $extra): array {
  $insights = [];

  $deltaVisitors = $extra['delta']['uniqueVisitors'] ?? null;
  if ($deltaVisitors !== null) {
    if ($deltaVisitors >= 15) {
      $insights[] = "Tráfego em alta (+{$deltaVisitors}% de visitantes). Aproveite para destacar produtos campeões.";
    } elseif ($deltaVisitors <= -15) {
      $insights[] = "Tráfego caiu ({$deltaVisitors}% de visitantes). Vale reforçar divulgação no Instagram/WhatsApp.";
    }
  }

  $peakHour = (int) ($extra['peakHour'] ?? -1);
  if ($peakHour >= 0 && ($extra['peakCount'] ?? 0) > 0) {
    $label = str_pad((string) $peakHour, 2, '0', STR_PAD_LEFT) . 'h';
    $insights[] = "Horário de pico: {$label}. Programe posts e respostas rápidas nesse intervalo.";
  }

  $topProduct = $extra['topProduct'] ?? null;
  if (is_array($topProduct) && ($topProduct['views'] ?? 0) >= 3) {
    $name = (string) ($topProduct['productName'] ?? 'Produto');
    $insights[] = "Produto mais visto: {$name}. Mantenha foto, preço e estoque atualizados.";
  }

  $lowConv = $extra['lowConversionProduct'] ?? null;
  if (is_array($lowConv) && ($lowConv['views'] ?? 0) >= 3 && ($lowConv['conversionRate'] ?? 100) < 15) {
    $name = (string) ($lowConv['productName'] ?? 'Produto');
    $rate = (float) ($lowConv['conversionRate'] ?? 0);
    $insights[] = "{$name} chama atenção ({$lowConv['views']} views) mas converte pouco ({$rate}%). Revise preço, descrição ou foto.";
  }

  if (($current['abandonCheckout'] ?? 0) >= 40 && ($current['beginCheckout'] ?? 0) >= 2) {
    $insights[] = "Abandono no checkout: {$current['abandonCheckout']}%. Simplifique pagamento/entrega ou responda WhatsApp mais rápido.";
  }

  if (($current['conversionRate'] ?? 0) >= 5) {
    $insights[] = "Taxa de conversão de {$current['conversionRate']}% — bom sinal de intenção de compra no site.";
  } elseif (($current['uniqueVisitors'] ?? 0) >= 5 && ($current['ordersCreated'] ?? 0) === 0) {
    $insights[] = "Visitantes entrando, mas nenhum pedido registrado no período. Confira se a loja está aberta e o checkout funciona.";
  }

  $topRef = $extra['topReferrer'] ?? '';
  if ($topRef !== '' && $topRef !== 'Acesso direto') {
    $insights[] = "Principal origem de tráfego: {$topRef}. Invista mais nesse canal.";
  }

  if ($insights === []) {
    $insights[] = 'Continue divulgando o site — os dados ficam mais úteis com mais visitas no período.';
  }

  return array_slice($insights, 0, 5);
}

function aurora_track_event(PDO $pdo, array $body): array {
  aurora_ensure_analytics_tables($pdo);

  $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($body['sessionId'] ?? ''));
  if (strlen($sessionId) < 8 || strlen($sessionId) > 64) {
    throw new InvalidArgumentException('Sessão inválida');
  }

  $allowed = ['page_view', 'product_view', 'product_click', 'add_to_cart', 'begin_checkout', 'order_created'];
  $eventType = (string) ($body['eventType'] ?? '');
  if (!in_array($eventType, $allowed, true)) {
    throw new InvalidArgumentException('Evento inválido');
  }

  $rateStmt = $pdo->prepare(
    'SELECT COUNT(*) FROM analytics_events
     WHERE session_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
  );
  $rateStmt->execute([$sessionId]);
  if ((int) $rateStmt->fetchColumn() > 80) {
    return ['ok' => true, 'throttled' => true];
  }

  $page = substr(trim((string) ($body['page'] ?? '')), 0, 255) ?: null;
  $productId = substr(trim((string) ($body['productId'] ?? '')), 0, 64) ?: null;
  $productName = substr(trim((string) ($body['productName'] ?? '')), 0, 190) ?: null;
  $categoryId = substr(trim((string) ($body['categoryId'] ?? '')), 0, 64) ?: null;
  $referrer = substr(trim((string) ($body['referrer'] ?? '')), 0, 500) ?: null;
  $landing = substr(trim((string) ($body['landing'] ?? '')), 0, 255) ?: null;
  $userAgent = substr(trim((string) ($body['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? ''))), 0, 500) ?: null;

  $meta = $body['meta'] ?? null;
  $metaJson = null;
  if (is_array($meta) && $meta !== []) {
    $metaJson = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  }

  $ip = aurora_analytics_client_ip();
  $ipHash = aurora_analytics_ip_hash($ip);
  // Geo externa só em eventos de compra — page_view não pode travar o servidor no fim de semana
  $allowExternalGeo = in_array($eventType, ['add_to_cart', 'begin_checkout', 'order_created'], true);

  $existing = $pdo->prepare('SELECT country, region, city FROM analytics_sessions WHERE session_id = ? LIMIT 1');
  $existing->execute([$sessionId]);
  $sessionRow = $existing->fetch(PDO::FETCH_ASSOC);

  if (!$sessionRow) {
    $geo = aurora_analytics_geo_lookup($ip, $allowExternalGeo);
    $ins = $pdo->prepare(
      'INSERT INTO analytics_sessions
       (session_id, ip_hash, country, region, city, referrer, landing_page, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
      $sessionId,
      $ipHash ?: null,
      $geo['country'] ?: null,
      $geo['region'] ?: null,
      $geo['city'] ?: null,
      $referrer,
      $landing ?: $page,
      $userAgent,
    ]);
  } else {
    $upd = $pdo->prepare('UPDATE analytics_sessions SET last_seen = NOW() WHERE session_id = ?');
    $upd->execute([$sessionId]);
    if (
      ($sessionRow['country'] ?? '') === ''
      && ($sessionRow['city'] ?? '') === ''
      && $ip !== ''
      && $allowExternalGeo
    ) {
      $geo = aurora_analytics_geo_lookup($ip, true);
      if (($geo['country'] ?? '') !== '' || ($geo['city'] ?? '') !== '') {
        $geoUpd = $pdo->prepare(
          'UPDATE analytics_sessions SET country = ?, region = ?, city = ?, ip_hash = COALESCE(ip_hash, ?)
           WHERE session_id = ?'
        );
        $geoUpd->execute([
          $geo['country'] ?: null,
          $geo['region'] ?: null,
          $geo['city'] ?: null,
          $ipHash ?: null,
          $sessionId,
        ]);
      }
    }
  }

  $evt = $pdo->prepare(
    'INSERT INTO analytics_events
     (session_id, event_type, page, product_id, product_name, category_id, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  $evt->execute([
    $sessionId,
    $eventType,
    $page,
    $productId,
    $productName,
    $categoryId,
    $metaJson,
  ]);

  return ['ok' => true];
}

function aurora_get_analytics(PDO $pdo, string $period = '7d'): array {
  aurora_ensure_analytics_tables($pdo);

  try {
    $pdo->exec("SET time_zone = '-03:00'");
  } catch (Throwable $e) {
    // segue com fuso do servidor
  }

  $period = in_array($period, ['today', '7d', '30d'], true) ? $period : '7d';
  $range = aurora_analytics_period_range($period);
  $since = $range['since'];
  $prevSince = $range['prevSince'];
  $prevUntil = $range['prevUntil'];

  $current = aurora_analytics_metrics($pdo, $since);
  $previous = aurora_analytics_metrics($pdo, $prevSince, $prevUntil);

  $delta = [
    'uniqueVisitors' => aurora_analytics_delta($current['uniqueVisitors'], $previous['uniqueVisitors']),
    'pageViews' => aurora_analytics_delta($current['pageViews'], $previous['pageViews']),
    'ordersCreated' => aurora_analytics_delta($current['ordersCreated'], $previous['ordersCreated']),
    'addToCart' => aurora_analytics_delta($current['addToCart'], $previous['addToCart']),
  ];

  $hourStmt = $pdo->prepare(
    "SELECT HOUR(created_at) AS hr, COUNT(*) AS total
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at >= ?
     GROUP BY hr
     ORDER BY hr"
  );
  $hourStmt->execute([$since]);
  $byHourRaw = $hourStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
  $byHour = array_fill(0, 24, 0);
  $peakHour = 0;
  $peakCount = 0;
  foreach ($byHourRaw as $row) {
    $h = (int) ($row['hr'] ?? -1);
    $total = (int) ($row['total'] ?? 0);
    if ($h >= 0 && $h <= 23) {
      $byHour[$h] = $total;
      if ($total > $peakCount) {
        $peakCount = $total;
        $peakHour = $h;
      }
    }
  }

  $dailyStmt = $pdo->prepare(
    "SELECT DATE(created_at) AS day, COUNT(*) AS total
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at >= ?
     GROUP BY day
     ORDER BY day"
  );
  $dailyStmt->execute([$since]);
  $dailyVisits = [];
  foreach ($dailyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $dailyVisits[] = [
      'date' => (string) ($row['day'] ?? ''),
      'total' => (int) ($row['total'] ?? 0),
    ];
  }

  $weekdayStmt = $pdo->prepare(
    "SELECT WEEKDAY(created_at) AS wd, COUNT(*) AS total
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at >= ?
     GROUP BY wd
     ORDER BY wd"
  );
  $weekdayStmt->execute([$since]);
  $weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  $byWeekday = array_fill(0, 7, 0);
  foreach ($weekdayStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $wd = (int) ($row['wd'] ?? -1);
    if ($wd >= 0 && $wd <= 6) {
      $byWeekday[$wd] = (int) ($row['total'] ?? 0);
    }
  }
  $byWeekdayLabeled = [];
  foreach ($weekdayLabels as $i => $label) {
    $byWeekdayLabeled[] = ['label' => $label, 'total' => $byWeekday[$i]];
  }

  $topProductsStmt = $pdo->prepare(
    "SELECT product_id, product_name,
            SUM(CASE WHEN event_type IN ('product_view','product_click') THEN 1 ELSE 0 END) AS views,
            SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS adds
     FROM analytics_events
     WHERE created_at >= ? AND product_id IS NOT NULL AND product_id <> ''
       AND product_name NOT LIKE '%INFORMAÇÕES%'
       AND product_name NOT LIKE '%Informações%'
       AND product_id NOT LIKE 'info%'
     GROUP BY product_id, product_name
     ORDER BY views DESC, adds DESC
     LIMIT 15"
  );
  $topProductsStmt->execute([$since]);
  $topProducts = [];
  $topProduct = null;
  $lowConversionProduct = null;
  foreach ($topProductsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $views = (int) ($row['views'] ?? 0);
    $adds = (int) ($row['adds'] ?? 0);
    $conv = $views > 0 ? round(($adds / $views) * 100, 1) : 0;
    $item = [
      'productId' => (string) ($row['product_id'] ?? ''),
      'productName' => (string) ($row['product_name'] ?? ''),
      'views' => $views,
      'adds' => $adds,
      'conversionRate' => $conv,
    ];
    $topProducts[] = $item;
    if (!$topProduct) {
      $topProduct = $item;
    }
    if ($views >= 3 && ($lowConversionProduct === null || $conv < ($lowConversionProduct['conversionRate'] ?? 100))) {
      $lowConversionProduct = $item;
    }
  }

  $topPagesStmt = $pdo->prepare(
    "SELECT page, COUNT(*) AS total
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at >= ? AND page IS NOT NULL AND page <> ''
     GROUP BY page
     ORDER BY total DESC
     LIMIT 10"
  );
  $topPagesStmt->execute([$since]);
  $topPages = [];
  foreach ($topPagesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $topPages[] = [
      'page' => (string) ($row['page'] ?? ''),
      'total' => (int) ($row['total'] ?? 0),
    ];
  }

  $locationsStmt = $pdo->prepare(
    "SELECT country, region, city, COUNT(*) AS sessions
     FROM analytics_sessions
     WHERE last_seen >= ?
       AND (
         country IN ('BR', 'Brasil', 'Brazil')
         OR country LIKE 'Brasil%'
         OR LOWER(country) LIKE '%brazil%'
       )
       AND (
         (city IS NOT NULL AND city <> '')
         OR (region IS NOT NULL AND region <> '')
       )
     GROUP BY country, region, city
     ORDER BY sessions DESC
     LIMIT 20"
  );
  $locationsStmt->execute([$since]);
  $locations = [];
  foreach ($locationsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $locations[] = [
      'country' => (string) ($row['country'] ?? ''),
      'region' => (string) ($row['region'] ?? ''),
      'city' => (string) ($row['city'] ?? ''),
      'sessions' => (int) ($row['sessions'] ?? 0),
    ];
  }

  $referrersStmt = $pdo->prepare(
    "SELECT referrer, COUNT(*) AS sessions
     FROM analytics_sessions
     WHERE last_seen >= ?
     GROUP BY referrer
     ORDER BY sessions DESC
     LIMIT 12"
  );
  $referrersStmt->execute([$since]);
  $referrers = [];
  $topReferrer = '';
  foreach ($referrersStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
    $label = aurora_analytics_format_referrer((string) ($row['referrer'] ?? ''));
    $sessions = (int) ($row['sessions'] ?? 0);
    $referrers[] = ['source' => $label, 'sessions' => $sessions];
    if ($topReferrer === '' && $sessions > 0) {
      $topReferrer = $label;
    }
  }

  $baseVisitors = max(1, $current['uniqueVisitors']);
  $funnel = [
    [
      'key' => 'visitors',
      'label' => 'Visitantes',
      'value' => $current['uniqueVisitors'],
      'rate' => 100,
    ],
    [
      'key' => 'product',
      'label' => 'Viram produto',
      'value' => $current['sessionsProductView'],
      'rate' => round(($current['sessionsProductView'] / $baseVisitors) * 100, 1),
    ],
    [
      'key' => 'cart',
      'label' => 'Add. carrinho',
      'value' => $current['sessionsAddCart'],
      'rate' => round(($current['sessionsAddCart'] / $baseVisitors) * 100, 1),
    ],
    [
      'key' => 'checkout',
      'label' => 'Checkout',
      'value' => $current['sessionsCheckout'],
      'rate' => round(($current['sessionsCheckout'] / $baseVisitors) * 100, 1),
    ],
    [
      'key' => 'order',
      'label' => 'Pedido',
      'value' => $current['sessionsOrder'],
      'rate' => round(($current['sessionsOrder'] / $baseVisitors) * 100, 1),
    ],
  ];

  $insights = aurora_analytics_build_insights($current, [
    'delta' => $delta,
    'peakHour' => $peakHour,
    'peakCount' => $peakCount,
    'topProduct' => $topProduct,
    'lowConversionProduct' => $lowConversionProduct && ($lowConversionProduct['conversionRate'] ?? 100) < 15
      ? $lowConversionProduct : null,
    'topReferrer' => $topReferrer,
  ]);

  return [
    'ok' => true,
    'period' => $period,
    'periodLabel' => $range['label'],
    'compareLabel' => $range['compareLabel'],
    'since' => $since,
    'generatedAt' => (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s'),
    'summary' => array_merge($current, [
      'previous' => [
        'uniqueVisitors' => $previous['uniqueVisitors'],
        'pageViews' => $previous['pageViews'],
        'ordersCreated' => $previous['ordersCreated'],
        'addToCart' => $previous['addToCart'],
      ],
      'delta' => $delta,
    ]),
    'funnel' => $funnel,
    'insights' => $insights,
    'peakHour' => $peakHour,
    'peakHourLabel' => str_pad((string) $peakHour, 2, '0', STR_PAD_LEFT) . 'h',
    'peakCount' => $peakCount,
    'byHour' => $byHour,
    'byWeekday' => $byWeekdayLabeled,
    'dailyVisits' => $dailyVisits,
    'topProducts' => $topProducts,
    'topPages' => $topPages,
    'locations' => $locations,
    'referrers' => $referrers,
  ];
}
