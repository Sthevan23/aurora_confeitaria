-- Atualiza o e-mail de login do admin no MySQL Hostinger
UPDATE admins
SET email = 'auroraconfeitaria2022@gmail.com'
WHERE email = 'admin@aurora.com'
   OR id = 1;
