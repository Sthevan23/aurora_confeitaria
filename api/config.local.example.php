<?php
/**
 * Exemplo — copie para config.local.php
 *
 * Servidor Hostinger → host localhost
 * PC local → host = hostname do Remote MySQL no hPanel
 */
$httpHost = $_SERVER['HTTP_HOST'] ?? 'cli';
$isLocalDev = (bool) preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/i', $httpHost);
$remoteHost = 'COLOQUE_O_HOSTNAME_REMOTE_MYSQL_AQUI';

return [
  'host' => $isLocalDev ? $remoteHost : 'localhost',
  'port' => 3306,
  'name' => 'u586160337_aurora_doces',
  'user' => 'u586160337_aurora_doces',
  'pass' => 'COLOQUE_A_SENHA_DO_MYSQL_AQUI',
  'charset' => 'utf8mb4',
];
