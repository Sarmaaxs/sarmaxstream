<?php
require_once __DIR__ . '/config.php';

if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $user = trim($_POST['user'] ?? '');
    $pass = $_POST['pass'] ?? '';
    if ($user === ADMIN_USER && password_verify($pass, ADMIN_PASS_HASH)) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_user'] = $user;
        log_activity('login', 'Admin logged in');
        header('Location: index.php');
        exit;
    }
    $error = 'Invalid credentials';
    usleep(400000); // small delay against brute force
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login — <?= htmlspecialchars(SITE_NAME) ?></title>
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>
<div class="login-wrap">
  <div class="login-box">
    <h1>SarmaxStream Admin</h1>
    <?php if ($error): ?><div class="error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="user" required autocomplete="username" autofocus>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="pass" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn" style="width:100%;margin-top:8px">Sign in</button>
    </form>
  </div>
</div>
</body>
</html>
