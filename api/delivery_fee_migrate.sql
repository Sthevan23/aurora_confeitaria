-- Frete editável no painel (Configurações)
-- phpMyAdmin → SQL → Executar (um de cada vez se der erro de coluna já existente)

ALTER TABLE `settings`
  ADD COLUMN `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 7.00;

ALTER TABLE `settings`
  ADD COLUMN `delivery_note` VARCHAR(255) NULL DEFAULT 'Bairros mais afastados: consultar';
