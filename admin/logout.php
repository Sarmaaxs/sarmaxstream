<?php
require_once __DIR__ . '/config.php';
log_activity('logout', 'Admin logged out');
$_SESSION = [];
session_destroy();
header('Location: login.php');
exit;
