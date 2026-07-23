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

function aurora_load_all(PDO $pdo): ?array {
  if (!aurora_db_ready($pdo)) {
    return null;
  }

  $settingsRow = $pdo->query('SELECT * FROM settings WHERE id = 1 LIMIT 1')->fetch();
  if (!$settingsRow) {
    return null;
  }

  $admin = $pdo->query('SELECT email, password_hash FROM admins ORDER BY id ASC LIMIT 1')->fetch();

  $categories = [];
  $catRows = $pdo->query('SELECT id, name, slug FROM categories ORDER BY sort_order ASC, name ASC')->fetchAll();
  foreach ($catRows as $row) {
    $categories[] = [
      'id' => $row['id'],
      'name' => $row['name'],
      'slug' => $row['slug'],
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
      'featured' => (bool) $row['featured'],
      'slug' => $row['slug'],
      'size' => $row['size'] ?? '',
      'flavors' => $flavorMap[$pid] ?? [],
      'promoActive' => (bool) $row['promo_active'],
      'promoPrice' => $row['promo_price'] !== null ? (float) $row['promo_price'] : null,
      'promoLabel' => $row['promo_label'] ?? '',
      'bestSeller' => (bool) $row['best_seller'],
      'active' => (bool) $row['active'],
    ];
    if (!empty($row['price_from'])) {
      $product['priceFrom'] = true;
    }
    if (!empty($priceMap[$pid])) {
      $product['flavorPrices'] = $priceMap[$pid];
    }
    $products[] = $product;
  }

  $gallery = [];
  $galRows = $pdo->query(
    'SELECT image FROM gallery WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  )->fetchAll();
  foreach ($galRows as $row) {
    $gallery[] = $row['image'];
  }

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
      ];
    }
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
        $itemsByOrder[$oid][] = [
          'productId' => $item['product_id'] ?? '',
          'name' => $item['product_name'],
          'flavor' => $item['flavor'] ?? '',
          'qty' => (int) $item['qty'],
          'price' => (float) $item['price'],
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

  return [
    'version' => (int) ($settingsRow['data_version'] ?? 16),
    'settings' => [
      'name' => $settingsRow['name'] ?? '',
      'tagline' => $settingsRow['tagline'] ?? '',
      'logo' => $settingsRow['logo'] ?? '',
      'banner' => $settingsRow['banner'] ?? '',
      'sobreImage' => $settingsRow['sobre_image'] ?? '',
      'whatsapp' => $settingsRow['whatsapp'] ?? '',
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
    ],
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
  ];
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

function aurora_save_all(PDO $pdo, array $payload): void {
  if (!aurora_db_ready($pdo)) {
    throw new RuntimeException('Tabelas MySQL não encontradas. Importe api/aurora_mysql.sql no phpMyAdmin.');
  }

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
        sobre_text1, sobre_text2, delivery_fee, delivery_note, data_version
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON DUPLICATE KEY UPDATE
        name=VALUES(name), tagline=VALUES(tagline), logo=VALUES(logo), banner=VALUES(banner),
        sobre_image=VALUES(sobre_image), whatsapp=VALUES(whatsapp), instagram=VALUES(instagram),
        instagram_user=VALUES(instagram_user), facebook=VALUES(facebook), email=VALUES(email),
        address=VALUES(address), hours=VALUES(hours), followers=VALUES(followers), posts=VALUES(posts),
        map_embed=VALUES(map_embed), hero_badge=VALUES(hero_badge), hero_story=VALUES(hero_story),
        sobre_text1=VALUES(sobre_text1), sobre_text2=VALUES(sobre_text2),
        delivery_fee=VALUES(delivery_fee), delivery_note=VALUES(delivery_note),
        data_version=VALUES(data_version)'
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
        $i,
      ]);
    }

    $prodStmt = $pdo->prepare(
      'INSERT INTO products (
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
      $prodStmt->execute([
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
        $i,
      ]);

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

    // Pedidos + itens
    $pdo->exec('DELETE FROM order_items');
    $pdo->exec('DELETE FROM orders');
    $orderStmt = $pdo->prepare(
      'INSERT INTO orders (
        id, number, client_id, client_name, client_whatsapp, total, status, ordered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
}

function aurora_upsert_client(PDO $pdo, array $client): void {
  if (empty($client['id']) && empty($client['phone'])) return;

  $id = $client['id'] ?? ('c_' . uniqid());
  $phone = preg_replace('/\D+/', '', (string) ($client['phone'] ?? ''));

  if ($phone !== '') {
    $find = $pdo->prepare('SELECT id FROM clients WHERE phone = ? LIMIT 1');
    $find->execute([$phone]);
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
      return;
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
}

function aurora_create_order(PDO $pdo, array $order, ?array $client = null): array {
  if (is_array($client)) {
    aurora_upsert_client($pdo, $client);
  }

  $orderId = (string) ($order['id'] ?? '');
  if ($orderId !== '') {
    $chk = $pdo->prepare('SELECT number FROM orders WHERE id = ? LIMIT 1');
    $chk->execute([$orderId]);
    $existingNumber = $chk->fetchColumn();
    if ($existingNumber) {
      return ['ok' => true, 'orderNumber' => $existingNumber, 'duplicated' => true];
    }
  }

  $phone = preg_replace('/\D+/', '', (string) ($order['clientWhatsapp'] ?? ''));
  $total = (float) ($order['total'] ?? 0);
  $name = trim((string) ($order['clientName'] ?? ''));
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
      return ['ok' => true, 'orderNumber' => $dupNumber, 'duplicated' => true];
    }
  }

  $year = (int) date('Y');
  $max = 0;
  $nums = $pdo->query('SELECT number FROM orders')->fetchAll(PDO::FETCH_COLUMN);
  foreach ($nums as $number) {
    if (preg_match('/PED-(\d{4})-(\d+)/i', (string) $number, $m) && (int) $m[1] === $year) {
      $max = max($max, (int) $m[2]);
    }
  }
  $orderNumber = sprintf('PED-%d-%03d', $year, $max + 1);
  if ($orderId === '') $orderId = 'o_' . uniqid();

  $pdo->beginTransaction();
  try {
    $ins = $pdo->prepare(
      'INSERT INTO orders (
        id, number, client_id, client_name, client_whatsapp, total, status, ordered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $ins->execute([
      $orderId,
      $orderNumber,
      $order['clientId'] ?? ($client['id'] ?? null),
      $name,
      $phone,
      $total,
      'novo',
    ]);

    $itemStmt = $pdo->prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, flavor, qty, price)
       VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($order['items'] ?? [] as $item) {
      $itemStmt->execute([
        $orderId,
        $item['productId'] ?? $item['id'] ?? null,
        $item['name'] ?? $item['productName'] ?? 'Item',
        $item['flavor'] ?? '',
        (int) ($item['qty'] ?? 1),
        (float) ($item['price'] ?? 0),
      ]);
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }

  return ['ok' => true, 'orderNumber' => $orderNumber];
}
