<?php
/**
 * Carrega config MySQL. Preferência: config.local.php (não versionado).
 */
$local = __DIR__ . '/config.local.php';
$example = __DIR__ . '/config.local.example.php';

if (is_file($local)) {
  return require $local;
}

if (is_file($example)) {
  return require $example;
}

return [
  'host' => getenv('AURORA_DB_HOST') ?: 'localhost',
  'port' => (int) (getenv('AURORA_DB_PORT') ?: 3306),
  'name' => getenv('AURORA_DB_NAME') ?: 'u586160337_aurora_doces',
  'user' => getenv('AURORA_DB_USER') ?: 'u586160337_aurora_doces',
  'pass' => getenv('AURORA_DB_PASS') ?: '',
  'charset' => 'utf8mb4',
];
