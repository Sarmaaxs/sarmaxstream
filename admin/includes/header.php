<?php
if (!defined('SITE_NAME')) { require_once __DIR__ . '/../config.php'; }
$pageTitle = $pageTitle ?? 'Dashboard';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($pageTitle) ?> — <?= htmlspecialchars(SITE_NAME) ?></title>
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">Sarmax<span>Stream</span></div>
    <nav>
      <a href="index.php" class="<?= ($page ?? '') === 'dash' ? 'active' : '' ?>">Dashboard</a>
      <a href="movies.php" class="<?= ($page ?? '') === 'movies' ? 'active' : '' ?>">Movies / Series</a>
      <a href="users.php" class="<?= ($page ?? '') === 'users' ? 'active' : '' ?>">Users</a>
      <a href="settings.php" class="<?= ($page ?? '') === 'settings' ? 'active' : '' ?>">Settings</a>
      <a href="activity.php" class="<?= ($page ?? '') === 'activity' ? 'active' : '' ?>">Activity</a>
      <a href="logout.php" class="logout">Logout</a>
    </nav>
  </aside>
  <main class="content">
    <header class="topbar">
      <h1><?= htmlspecialchars($pageTitle) ?></h1>
    </header>
    <div class="inner">
