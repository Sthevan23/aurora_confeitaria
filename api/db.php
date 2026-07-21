<?php
/**
 * PDO MySQL — Aurora / Hostinger
 */

function aurora_db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $cfg = require __DIR__ . '/config.php';
  $host = $cfg['host'] ?? 'localhost';
  $port = (int) ($cfg['port'] ?? 3306);
  $name = $cfg['name'] ?? '';
  $user = $cfg['user'] ?? '';
  $pass = $cfg['pass'] ?? '';
  $charset = $cfg['charset'] ?? 'utf8mb4';

  if ($name === '' || $user === '') {
    throw new RuntimeException('Config MySQL incompleta (name/user).');
  }
  if ($pass === '' || $pass === 'COLOQUE_A_SENHA_DO_MYSQL_AQUI') {
    throw new RuntimeException('Defina a senha MySQL em api/config.local.php');
  }

  $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}
