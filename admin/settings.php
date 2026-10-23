<?php
require_once __DIR__ . '/config.php';
require_login();
$page = 'settings';
$pageTitle = 'Settings';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $name = trim($_POST['site_name'] ?? SITE_NAME);
    $maint = isset($_POST['maintenance']) ? '1' : '0';
    $stmt = db()->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    $stmt->execute(['site_name', $name]);
    $stmt->execute(['maintenance', $maint]);
    log_activity('settings_update', "maintenance=$maint");
    header('Location: settings.php?msg=saved');
    exit;
}

$settings = [];
foreach (db()->query("SELECT key, value FROM settings") as $row) {
    $settings[$row['key']] = $row['value'];
}

require __DIR__ . '/includes/header.php';
?>
<?php if (($_GET['msg'] ?? '') === 'saved'): ?><div class="success">Settings saved.</div><?php endif; ?>

<div class="card">
  <form method="post">
    <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
    <div class="form-group">
      <label>Site name</label>
      <input type="text" name="site_name" value="<?= htmlspecialchars($settings['site_name'] ?? SITE_NAME) ?>">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" name="maintenance" value="1" <?= ($settings['maintenance'] ?? '0') === '1' ? 'checked' : '' ?>>
        Maintenance mode
      </label>
    </div>
    <button type="submit" class="btn">Save settings</button>
  </form>
</div>

<div class="card">
  <h2 style="margin-bottom:12px;font-size:1.1rem">Security notes</h2>
  <ul style="color:var(--muted);font-size:0.95rem;padding-left:20px">
    <li>Change ADMIN_USER and ADMIN_PASS_HASH in config.php immediately.</li>
    <li>Generate a new hash with: <code>php -r "echo password_hash('your-strong-password', PASSWORD_DEFAULT);"</code></li>
    <li>Protect /admin with HTTP basic auth or IP allowlist on the server if possible.</li>
    <li>Keep the data/ folder outside web root or deny direct access.</li>
  </ul>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
