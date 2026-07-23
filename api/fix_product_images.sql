-- OBRIGATÓRIO para a Clara subir fotos pelo admin
-- phpMyAdmin → banco u586160337_aurora_doces → aba SQL → Executar:

ALTER TABLE `products`
  MODIFY `image` MEDIUMTEXT NULL;

-- Confira com:
-- SHOW COLUMNS FROM products LIKE 'image';
-- Deve aparecer: mediumtext
