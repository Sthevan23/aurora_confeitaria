import fs from 'fs';

const data = Function(
  fs.readFileSync('js/default-data.js', 'utf8') + '; return AURORA_DEFAULT_DATA;'
)();

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

function j(v) {
  return esc(JSON.stringify(v ?? null));
}

const lines = [];
lines.push(`-- =========================================================`);
lines.push(`-- Aurora Confeitaria — schema MySQL (Hostinger / phpMyAdmin)`);
lines.push(`-- Charset: utf8mb4`);
lines.push(`-- Como usar:`);
lines.push(`-- 1) No hPanel Hostinger, abra o banco MySQL do site`);
lines.push(`-- 2) phpMyAdmin > SQL > cole este arquivo e Execute`);
lines.push(`-- NÃO precisa CREATE DATABASE se a Hostinger já criou o banco.`);
lines.push(`-- =========================================================`);
lines.push(``);
lines.push(`SET NAMES utf8mb4;`);
lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
lines.push(``);

const drops = [
  'order_items',
  'orders',
  'finance',
  'clients',
  'product_flavor_prices',
  'product_flavors',
  'products',
  'categories',
  'gallery',
  'faq',
  'reviews',
  'settings',
  'admins',
];
for (const t of drops) lines.push(`DROP TABLE IF EXISTS \`${t}\`;`);
lines.push(``);

lines.push(`CREATE TABLE \`admins\` (`);
lines.push(`  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,`);
lines.push(`  \`email\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`password_hash\` VARCHAR(255) NOT NULL,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  UNIQUE KEY \`uk_admins_email\` (\`email\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`settings\` (`);
lines.push(`  \`id\` TINYINT UNSIGNED NOT NULL DEFAULT 1,`);
lines.push(`  \`name\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`tagline\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`logo\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`banner\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`sobre_image\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`whatsapp\` VARCHAR(30) DEFAULT NULL,`);
lines.push(`  \`instagram\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`instagram_user\` VARCHAR(120) DEFAULT NULL,`);
lines.push(`  \`facebook\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`email\` VARCHAR(190) DEFAULT NULL,`);
lines.push(`  \`address\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`hours\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`followers\` VARCHAR(50) DEFAULT NULL,`);
lines.push(`  \`posts\` VARCHAR(50) DEFAULT NULL,`);
lines.push(`  \`map_embed\` TEXT,`);
lines.push(`  \`hero_badge\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`hero_story\` JSON DEFAULT NULL,`);
lines.push(`  \`sobre_text1\` TEXT,`);
lines.push(`  \`sobre_text2\` TEXT,`);
lines.push(`  \`data_version\` INT UNSIGNED NOT NULL DEFAULT 16,`);
lines.push(`  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`categories\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`name\` VARCHAR(120) NOT NULL,`);
lines.push(`  \`slug\` VARCHAR(120) NOT NULL,`);
lines.push(`  \`sort_order\` INT NOT NULL DEFAULT 0,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  UNIQUE KEY \`uk_categories_slug\` (\`slug\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`products\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`name\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`description\` TEXT,`);
lines.push(`  \`price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,`);
lines.push(`  \`price_from\` TINYINT(1) NOT NULL DEFAULT 0,`);
lines.push(`  \`category_id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`image\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`featured\` TINYINT(1) NOT NULL DEFAULT 0,`);
lines.push(`  \`slug\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`size\` VARCHAR(50) DEFAULT NULL,`);
lines.push(`  \`promo_active\` TINYINT(1) NOT NULL DEFAULT 0,`);
lines.push(`  \`promo_price\` DECIMAL(10,2) DEFAULT NULL,`);
lines.push(`  \`promo_label\` VARCHAR(120) DEFAULT NULL,`);
lines.push(`  \`best_seller\` TINYINT(1) NOT NULL DEFAULT 0,`);
lines.push(`  \`active\` TINYINT(1) NOT NULL DEFAULT 1,`);
lines.push(`  \`sort_order\` INT NOT NULL DEFAULT 0,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  UNIQUE KEY \`uk_products_slug\` (\`slug\`),`);
lines.push(`  KEY \`idx_products_category\` (\`category_id\`),`);
lines.push(
  `  CONSTRAINT \`fk_products_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT`
);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`product_flavors\` (`);
lines.push(`  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,`);
lines.push(`  \`product_id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`flavor\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`sort_order\` INT NOT NULL DEFAULT 0,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  KEY \`idx_pf_product\` (\`product_id\`),`);
lines.push(
  `  CONSTRAINT \`fk_pf_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE`
);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`product_flavor_prices\` (`);
lines.push(`  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,`);
lines.push(`  \`product_id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`flavor\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`price\` DECIMAL(10,2) NOT NULL,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  UNIQUE KEY \`uk_pfp\` (\`product_id\`, \`flavor\`),`);
lines.push(
  `  CONSTRAINT \`fk_pfp_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE`
);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`gallery\` (`);
lines.push(`  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,`);
lines.push(`  \`image\` VARCHAR(500) NOT NULL,`);
lines.push(`  \`sort_order\` INT NOT NULL DEFAULT 0,`);
lines.push(`  \`active\` TINYINT(1) NOT NULL DEFAULT 1,`);
lines.push(`  PRIMARY KEY (\`id\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`clients\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`name\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`email\` VARCHAR(190) DEFAULT NULL,`);
lines.push(`  \`phone\` VARCHAR(30) DEFAULT NULL,`);
lines.push(`  \`address\` VARCHAR(500) DEFAULT NULL,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  KEY \`idx_clients_phone\` (\`phone\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`orders\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`number\` VARCHAR(40) NOT NULL,`);
lines.push(`  \`client_id\` VARCHAR(64) DEFAULT NULL,`);
lines.push(`  \`client_name\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`client_whatsapp\` VARCHAR(30) DEFAULT NULL,`);
lines.push(`  \`total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,`);
lines.push(
  `  \`status\` ENUM('novo','preparo','entrega','finalizado','cancelado') NOT NULL DEFAULT 'novo',`
);
lines.push(`  \`ordered_at\` DATETIME NOT NULL,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  UNIQUE KEY \`uk_orders_number\` (\`number\`),`);
lines.push(`  KEY \`idx_orders_status\` (\`status\`),`);
lines.push(`  KEY \`idx_orders_client\` (\`client_id\`),`);
lines.push(
  `  CONSTRAINT \`fk_orders_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE SET NULL`
);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`order_items\` (`);
lines.push(`  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,`);
lines.push(`  \`order_id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`product_id\` VARCHAR(64) DEFAULT NULL,`);
lines.push(`  \`product_name\` VARCHAR(190) NOT NULL,`);
lines.push(`  \`flavor\` VARCHAR(190) DEFAULT NULL,`);
lines.push(`  \`qty\` INT NOT NULL DEFAULT 1,`);
lines.push(`  \`price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  KEY \`idx_oi_order\` (\`order_id\`),`);
lines.push(
  `  CONSTRAINT \`fk_oi_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE`
);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`finance\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`type\` ENUM('entrada','saida') NOT NULL,`);
lines.push(`  \`amount\` DECIMAL(10,2) NOT NULL,`);
lines.push(`  \`description\` VARCHAR(255) DEFAULT NULL,`);
lines.push(`  \`entry_date\` DATE NOT NULL,`);
lines.push(`  \`order_id\` VARCHAR(64) DEFAULT NULL,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`),`);
lines.push(`  KEY \`idx_finance_date\` (\`entry_date\`),`);
lines.push(`  KEY \`idx_finance_type\` (\`type\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`reviews\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`author\` VARCHAR(120) NOT NULL,`);
lines.push(`  \`text\` TEXT NOT NULL,`);
lines.push(`  \`rating\` TINYINT UNSIGNED DEFAULT 5,`);
lines.push(`  \`active\` TINYINT(1) NOT NULL DEFAULT 1,`);
lines.push(`  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`);
lines.push(`  PRIMARY KEY (\`id\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

lines.push(`CREATE TABLE \`faq\` (`);
lines.push(`  \`id\` VARCHAR(64) NOT NULL,`);
lines.push(`  \`question\` VARCHAR(255) NOT NULL,`);
lines.push(`  \`answer\` TEXT NOT NULL,`);
lines.push(`  \`sort_order\` INT NOT NULL DEFAULT 0,`);
lines.push(`  \`active\` TINYINT(1) NOT NULL DEFAULT 1,`);
lines.push(`  PRIMARY KEY (\`id\`)`);
lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
lines.push(``);

const s = data.settings;
lines.push(`-- ---------- DADOS INICIAIS ----------`);
lines.push(`-- Admin: ${data.auth.email} / senha atual: ${data.auth.password} (troque depois)`);
lines.push(`INSERT INTO \`admins\` (\`email\`, \`password_hash\`) VALUES (`);
lines.push(`  ${esc(data.auth.email)},`);
lines.push(`  ${esc(data.auth.password)}`);
lines.push(`);`);
lines.push(``);

lines.push(`INSERT INTO \`settings\` (`);
lines.push(
  `  \`id\`, \`name\`, \`tagline\`, \`logo\`, \`banner\`, \`sobre_image\`, \`whatsapp\`,`
);
lines.push(
  `  \`instagram\`, \`instagram_user\`, \`facebook\`, \`email\`, \`address\`, \`hours\`,`
);
lines.push(
  `  \`followers\`, \`posts\`, \`map_embed\`, \`hero_badge\`, \`hero_story\`,`
);
lines.push(`  \`sobre_text1\`, \`sobre_text2\`, \`data_version\``);
lines.push(`) VALUES (`);
lines.push(`  1,`);
lines.push(
  `  ${esc(s.name)}, ${esc(s.tagline)}, ${esc(s.logo)}, ${esc(s.banner)}, ${esc(s.sobreImage)},`
);
lines.push(
  `  ${esc(s.whatsapp)}, ${esc(s.instagram)}, ${esc(s.instagramUser)}, ${esc(s.facebook)},`
);
lines.push(
  `  ${esc(s.email)}, ${esc(s.address)}, ${esc(s.hours)}, ${esc(s.followers)}, ${esc(s.posts)},`
);
lines.push(
  `  ${esc(s.mapEmbed)}, ${esc(s.heroBadge)}, ${j(s.heroStory || [])},`
);
lines.push(
  `  ${esc(s.sobreText1)}, ${esc(s.sobreText2)}, ${esc(data.version)}`
);
lines.push(`);`);
lines.push(``);

data.categories.forEach((c, i) => {
  lines.push(
    `INSERT INTO \`categories\` (\`id\`, \`name\`, \`slug\`, \`sort_order\`) VALUES (${esc(c.id)}, ${esc(c.name)}, ${esc(c.slug)}, ${i});`
  );
});
lines.push(``);

data.products.forEach((p, i) => {
  lines.push(`INSERT INTO \`products\` (`);
  lines.push(
    `  \`id\`, \`name\`, \`description\`, \`price\`, \`price_from\`, \`category_id\`, \`image\`,`
  );
  lines.push(
    `  \`featured\`, \`slug\`, \`size\`, \`promo_active\`, \`promo_price\`, \`promo_label\`,`
  );
  lines.push(`  \`best_seller\`, \`active\`, \`sort_order\``);
  lines.push(`) VALUES (`);
  lines.push(
    `  ${esc(p.id)}, ${esc(p.name)}, ${esc(p.description)}, ${esc(p.price)}, ${esc(!!p.priceFrom)},`
  );
  lines.push(
    `  ${esc(p.categoryId)}, ${esc(p.image)}, ${esc(!!p.featured)}, ${esc(p.slug)}, ${esc(p.size || '')},`
  );
  lines.push(
    `  ${esc(!!p.promoActive)}, ${p.promoPrice == null ? 'NULL' : esc(p.promoPrice)}, ${esc(p.promoLabel || '')},`
  );
  lines.push(`  ${esc(!!p.bestSeller)}, ${esc(p.active !== false)}, ${i}`);
  lines.push(`);`);

  (p.flavors || []).forEach((f, fi) => {
    lines.push(
      `INSERT INTO \`product_flavors\` (\`product_id\`, \`flavor\`, \`sort_order\`) VALUES (${esc(p.id)}, ${esc(f)}, ${fi});`
    );
  });

  if (p.flavorPrices) {
    for (const [flavor, price] of Object.entries(p.flavorPrices)) {
      lines.push(
        `INSERT INTO \`product_flavor_prices\` (\`product_id\`, \`flavor\`, \`price\`) VALUES (${esc(p.id)}, ${esc(flavor)}, ${esc(price)});`
      );
    }
  }
  lines.push(``);
});

(data.gallery || []).forEach((img, i) => {
  lines.push(
    `INSERT INTO \`gallery\` (\`image\`, \`sort_order\`) VALUES (${esc(img)}, ${i});`
  );
});

lines.push(``);
lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
lines.push(``);
lines.push(`-- Consultas úteis`);
lines.push(
  `-- SELECT p.name, c.name AS categoria, p.price, p.promo_price, p.best_seller FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 ORDER BY p.sort_order;`
);
lines.push(`-- SELECT * FROM settings WHERE id = 1;`);
lines.push(
  `-- SELECT o.number, o.client_name, o.status, o.total, o.ordered_at FROM orders o ORDER BY o.ordered_at DESC;`
);

fs.writeFileSync('api/aurora_mysql.sql', lines.join('\n'), 'utf8');
console.log('Wrote api/aurora_mysql.sql', lines.length, 'lines');
