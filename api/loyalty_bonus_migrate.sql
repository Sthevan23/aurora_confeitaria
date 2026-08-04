-- Ajuste manual de fidelidade (pedidos fora do site)
-- Se der erro de coluna já existente, pode ignorar.
ALTER TABLE `clients`
  ADD COLUMN `loyalty_bonus` INT NOT NULL DEFAULT 0
  COMMENT 'Pedidos fora do site (ajuste fidelidade)';
