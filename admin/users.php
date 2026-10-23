<?php
require_once __DIR__ . '/config.php';
require_login();
$page = 'users';
$pageTitle = 'Users';

$list = db()->query("SELECT * FROM users ORDER BY id DESC LIMIT 200")->fetchAll();

require __DIR__ . '/includes/header.php';
?>
<div class="card">
  <p style="color:var(--muted);margin-bottom:16px">This is a local mirror. For real users you will later pull from Supabase Auth via service role key if needed.</p>
  <?php if (!$list): ?>
    <p style="color:var(--muted)">No users recorded yet.</p>
  <?php else: ?>
    <table>
      <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
      <tbody>
      <?php foreach ($list as $u): ?>
        <tr>
          <td><?= $u['id'] ?></td>
          <td><?= htmlspecialchars($u['email'] ?? '') ?></td>
          <td><?= htmlspecialchars($u['role']) ?></td>
          <td style="color:var(--muted)"><?= htmlspecialchars($u['created_at']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
