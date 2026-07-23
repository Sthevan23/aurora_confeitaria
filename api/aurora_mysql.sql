-- =========================================================
-- Aurora Confeitaria — schema MySQL (Hostinger / phpMyAdmin)
-- Charset: utf8mb4
-- Como usar:
-- 1) No hPanel Hostinger, abra o banco MySQL do site
-- 2) phpMyAdmin > SQL > cole este arquivo e Execute
-- NÃO precisa CREATE DATABASE se a Hostinger já criou o banco.
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `finance`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `product_flavor_prices`;
DROP TABLE IF EXISTS `product_flavors`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `gallery`;
DROP TABLE IF EXISTS `faq`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `admins`;

CREATE TABLE `admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `settings` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `name` VARCHAR(190) NOT NULL,
  `tagline` VARCHAR(255) DEFAULT NULL,
  `logo` VARCHAR(500) DEFAULT NULL,
  `banner` VARCHAR(500) DEFAULT NULL,
  `sobre_image` VARCHAR(500) DEFAULT NULL,
  `whatsapp` VARCHAR(30) DEFAULT NULL,
  `instagram` VARCHAR(255) DEFAULT NULL,
  `instagram_user` VARCHAR(120) DEFAULT NULL,
  `facebook` VARCHAR(255) DEFAULT NULL,
  `email` VARCHAR(190) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `hours` VARCHAR(255) DEFAULT NULL,
  `followers` VARCHAR(50) DEFAULT NULL,
  `posts` VARCHAR(50) DEFAULT NULL,
  `map_embed` TEXT,
  `hero_badge` VARCHAR(255) DEFAULT NULL,
  `hero_story` JSON DEFAULT NULL,
  `sobre_text1` TEXT,
  `sobre_text2` TEXT,
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 7.00,
  `delivery_note` VARCHAR(255) DEFAULT 'Bairros mais afastados: consultar',
  `data_version` INT UNSIGNED NOT NULL DEFAULT 16,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `price_from` TINYINT(1) NOT NULL DEFAULT 0,
  `category_id` VARCHAR(64) NOT NULL,
  `image` MEDIUMTEXT DEFAULT NULL,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `slug` VARCHAR(190) NOT NULL,
  `size` VARCHAR(50) DEFAULT NULL,
  `promo_active` TINYINT(1) NOT NULL DEFAULT 0,
  `promo_price` DECIMAL(10,2) DEFAULT NULL,
  `promo_label` VARCHAR(120) DEFAULT NULL,
  `best_seller` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_slug` (`slug`),
  KEY `idx_products_category` (`category_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_flavors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` VARCHAR(64) NOT NULL,
  `flavor` VARCHAR(190) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_pf_product` (`product_id`),
  CONSTRAINT `fk_pf_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_flavor_prices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` VARCHAR(64) NOT NULL,
  `flavor` VARCHAR(190) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pfp` (`product_id`, `flavor`),
  CONSTRAINT `fk_pfp_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `gallery` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `image` VARCHAR(500) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clients` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `email` VARCHAR(190) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clients_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `id` VARCHAR(64) NOT NULL,
  `number` VARCHAR(40) NOT NULL,
  `client_id` VARCHAR(64) DEFAULT NULL,
  `client_name` VARCHAR(190) NOT NULL,
  `client_whatsapp` VARCHAR(30) DEFAULT NULL,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('novo','preparo','entrega','finalizado','cancelado') NOT NULL DEFAULT 'novo',
  `ordered_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_number` (`number`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_client` (`client_id`),
  CONSTRAINT `fk_orders_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) DEFAULT NULL,
  `product_name` VARCHAR(190) NOT NULL,
  `flavor` VARCHAR(190) DEFAULT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_oi_order` (`order_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `finance` (
  `id` VARCHAR(64) NOT NULL,
  `type` ENUM('entrada','saida') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `entry_date` DATE NOT NULL,
  `order_id` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_date` (`entry_date`),
  KEY `idx_finance_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coupons` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `type` ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  `value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `min_order` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `label` VARCHAR(120) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupons_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reviews` (
  `id` VARCHAR(64) NOT NULL,
  `author` VARCHAR(120) NOT NULL,
  `text` TEXT NOT NULL,
  `rating` TINYINT UNSIGNED DEFAULT 5,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `faq` (
  `id` VARCHAR(64) NOT NULL,
  `question` VARCHAR(255) NOT NULL,
  `answer` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- DADOS INICIAIS ----------
-- Admin: auroraconfeitaria2022@gmail.com / senha atual: aurora123 (troque depois)
INSERT INTO `admins` (`email`, `password_hash`) VALUES (
  'auroraconfeitaria2022@gmail.com',
  'aurora123'
);

INSERT INTO `settings` (
  `id`, `name`, `tagline`, `logo`, `banner`, `sobre_image`, `whatsapp`,
  `instagram`, `instagram_user`, `facebook`, `email`, `address`, `hours`,
  `followers`, `posts`, `map_embed`, `hero_badge`, `hero_story`,
  `sobre_text1`, `sobre_text2`, `data_version`
) VALUES (
  1,
  'Aurora Confeitaria Artesanal', 'Feito com amor', '', 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg', 'products/clara-aurora-historia.jpg',
  '5535987216486', 'https://www.instagram.com/a.aurora.confeitaria', '@a.aurora.confeitaria', '',
  'contato@aurora.com', 'Rua dos Expedicionários, 237, Boa Esperança MG, 37170-000, Brasil', 'Pedidos pelo WhatsApp', '', '',
  '', 'Confeitaria artesanal · Boa Esperança/MG', '[]',
  'A Aurora Confeitaria nasceu do sonho de transformar momentos simples em lembranças especiais. Cada receita é preparada artesanalmente, com ingredientes selecionados, muito carinho e a dedicação de quem acredita que um doce pode tornar o dia de alguém mais feliz.', 'Mais do que vender sobremesas, queremos criar experiências. Também acreditamos em fazer a diferença onde estamos — compartilhar o bem faz parte da nossa essência. Seja bem-vindo à Aurora Confeitaria.', 16
);

INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-copos', 'Copos Brownie', 'copos', 0);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-sandu', 'Sandubrownies', 'sandubrownies', 1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-cookies', 'Cookies', 'cookies', 2);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-potes', 'Potes', 'potes', 3);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-salgados', 'Salgados', 'salgados', 4);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-bolos', 'Bolos', 'bolos', 5);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES ('cat-especiais', 'Especiais', 'especiais', 6);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p0', 'Copo Brownie da Felicidade', 'Copo 300ml com camadas generosas de brownie e cremes — promoção especial!', 29, 0,
  'cat-copos', 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg', 1, 'copo-brownie-felicidade', '300ml',
  1, 22, 'Promoção',
  1, 1, 0
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p0', 'Ninho com Nutella', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p0', 'Morango com Ninho', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p0', 'Brigadeiro com Ninho e Nutella', 2);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p0', 'Brigadeiro com Morango', 3);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p0', 'Brigadeiro com Nutella', 4);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-copo-morango', 'Copo Morango, Ninho e Chocolate', 'Camadas de morangos frescos, brigadeiro cremoso de leite ninho e ganache de chocolate nobre, com cobertura em Briganache.', 29, 0,
  'cat-copos', 'products/6aceecd0-e407-4478-b511-f03af2e22e65.jpg', 1, 'copo-morango-ninho-chocolate', '300ml',
  0, NULL, '',
  0, 1, 1
);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-sandu', 'Sandubrownies', 'Sanduíche de brownie com recheios especiais. Escolha o sabor: R$ 28 (Ninho ou Brigadeiro com Nutella), R$ 31 (com morango) ou R$ 34 (Ferrero).', 28, 1,
  'cat-sandu', 'products/4c3b51e1-88fc-473a-a06d-e3f13e31c525.jpg', 1, 'sandubrownies', '',
  0, NULL, '',
  1, 1, 2
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-sandu', 'Ninho com Nutella', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-sandu', 'Brigadeiro com Nutella', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-sandu', 'Ninho com Nutella e Morango', 2);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-sandu', 'Brigadeiro com Nutella e Morango', 3);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-sandu', 'Ferrero', 4);
INSERT INTO `product_flavor_prices` (`product_id`, `flavor`, `price`) VALUES ('p-sandu', 'Ninho com Nutella', 28);
INSERT INTO `product_flavor_prices` (`product_id`, `flavor`, `price`) VALUES ('p-sandu', 'Brigadeiro com Nutella', 28);
INSERT INTO `product_flavor_prices` (`product_id`, `flavor`, `price`) VALUES ('p-sandu', 'Ninho com Nutella e Morango', 31);
INSERT INTO `product_flavor_prices` (`product_id`, `flavor`, `price`) VALUES ('p-sandu', 'Brigadeiro com Nutella e Morango', 31);
INSERT INTO `product_flavor_prices` (`product_id`, `flavor`, `price`) VALUES ('p-sandu', 'Ferrero', 34);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-coxinha', 'Coxinha de Costela com Cream Cheese', 'Opção salgada do cardápio: coxinha de costela desfiada com cream cheese. Ganha refri 200ml de cortesia.', 24.9, 0,
  'cat-salgados', 'products/dcf6f873-6760-4663-a0e4-b5ffb87e0898.jpg', 1, 'coxinha-costela-cream-cheese', '',
  0, NULL, '',
  1, 1, 3
);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-afoga', 'Afogadinhos', 'Docinho afogadinho — R$ 13 cada ou 2 por R$ 25.', 13, 0,
  'cat-especiais', 'products/b9fe2ede-b11b-41e1-b819-d29dec7f18f1.jpg', 1, 'afogadinhos', '',
  0, NULL, '',
  1, 1, 4
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-afoga', 'Kinder', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-afoga', 'Ninho com Nutella', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-afoga', 'Ninho com Geleia de Morangos', 2);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-pudim', 'Pudim', 'Pudim cremoso 140ml — R$ 8 cada ou 2 por R$ 15.', 8, 0,
  'cat-especiais', 'products/b05c8675-2972-47d2-a49d-d2ed4dc93fc6.jpg', 1, 'pudim', '140ml',
  0, NULL, '',
  0, 1, 5
);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-minipote', 'Mini Bolo de Pote', 'Mini bolo de pote 140 ml — R$ 8 cada ou 2 por R$ 15. Escolha o sabor.', 8, 0,
  'cat-potes', 'products/7288ea2a-8bcc-424b-a2d9-e13d9b0d2cc7.jpg', 1, 'mini-bolo-de-pote', '140ml',
  0, NULL, '',
  1, 1, 6
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-minipote', 'Ninho com Nutella', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-minipote', 'Brigadeiro Maracujá', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-minipote', 'Ninho com Maracujá', 2);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-minipote', 'Ninho com Geleia de Morango', 3);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-cookies', 'Cookies Premium', 'Todos no estilo americano: grandes, macios e com recheio generoso. O Tradicional é a massa clássica só com recheio de Nutella.', 18, 0,
  'cat-cookies', 'products/0ff19f98-37de-4629-9520-af19c38f27cc.jpg', 1, 'cookies-premium', '',
  0, NULL, '',
  1, 1, 7
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-cookies', 'Tradicional (Nutella)', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-cookies', 'Chocolate', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-cookies', 'RedVelvet com brigadeiro de cream cheese', 2);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-cookies', 'Kinder', 3);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-patinha', 'Brownie Patinha', 'Item exclusivo da Aurora criado para apoiar uma ONG de animais da cidade — por isso o nome Patinha. A base é brownie, geralmente com brigadeiro cremoso de ninho e geleia de morango para equilibrar o sabor. Também temos outros sabores!', 15, 0,
  'cat-especiais', 'products/679de717-08f0-4c2d-a601-7bb8bae07bc4.jpg', 1, 'brownie-patinha', '',
  0, NULL, '',
  1, 1, 8
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-patinha', 'Ninho com Geleia de Morango', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-patinha', 'Ninho com Nutella', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-patinha', 'Ferrero', 2);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-patinha', 'Kinder', 3);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-torta', 'Torta Cookies de Nutella', 'Torta de cookies com Nutella — escolha o sabor do recheio.', 23, 0,
  'cat-especiais', 'products/6da1f221-d309-46a6-86c6-c55512a40766.jpg', 1, 'torta-cookies-nutella', '',
  0, NULL, '',
  0, 1, 9
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-torta', 'Ninho com Nutella', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-torta', 'Maracujá', 1);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-torta', 'Brigadeiro', 2);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p-recheado', 'Brownie Recheado', 'Brownie recheado artesanal embalado com carinho — escolha o sabor (Kinder ou Dois Amores).', 15, 0,
  'cat-especiais', 'products/27cca0b6-2fd5-4d60-8c72-92a1e8097364.jpg', 1, 'brownie-recheado', '',
  0, NULL, '',
  0, 1, 10
);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-recheado', 'Kinder', 0);
INSERT INTO `product_flavors` (`product_id`, `flavor`, `sort_order`) VALUES ('p-recheado', 'Dois Amores', 1);

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `price_from`, `category_id`, `image`,
  `featured`, `slug`, `size`, `promo_active`, `promo_price`, `promo_label`,
  `best_seller`, `active`, `sort_order`
) VALUES (
  'p18', 'Mega brownie', 'Mega brownie generoso com brigadeiro cremoso de leite ninho, ganache de chocolate e morangos frescos — perfeito para compartilhar.', 38, 1,
  'cat-especiais', 'products/ccae5bfe-0976-4cbb-9484-05c3e75b9695.jpg', 1, 'mega-brownie', '',
  0, NULL, '',
  1, 1, 11
);

INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg', 0);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/06b9382c-b7eb-422d-bd3a-e7b46b44a936.jpg', 1);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/0ff19f98-37de-4629-9520-af19c38f27cc.jpg', 2);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/27cca0b6-2fd5-4d60-8c72-92a1e8097364.jpg', 3);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/4ba1b56d-f4ea-4b7d-9c2d-2f8fbeab8bb1.jpg', 4);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/4c3b51e1-88fc-473a-a06d-e3f13e31c525.jpg', 5);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/6da1f221-d309-46a6-86c6-c55512a40766.jpg', 6);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/ccae5bfe-0976-4cbb-9484-05c3e75b9695.jpg', 7);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/ebaf8618-a5e9-4874-9cfd-9d085da4a193.jpg', 8);
INSERT INTO `gallery` (`image`, `sort_order`) VALUES ('products/dcf6f873-6760-4663-a0e4-b5ffb87e0898.jpg', 9);

SET FOREIGN_KEY_CHECKS = 1;

-- Consultas úteis
-- SELECT p.name, c.name AS categoria, p.price, p.promo_price, p.best_seller FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 ORDER BY p.sort_order;
-- SELECT * FROM settings WHERE id = 1;
-- SELECT o.number, o.client_name, o.status, o.total, o.ordered_at FROM orders o ORDER BY o.ordered_at DESC;